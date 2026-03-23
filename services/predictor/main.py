from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import bigquery, storage
from typing import Optional
from datetime import date
import numpy as np
import joblib
import io
import os

app = FastAPI(title="Market Value Predictor API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ID = os.getenv("PROJECT_ID", "housing-app-490522")
DATASET    = "housing_data"
bq_client  = bigquery.Client(project=PROJECT_ID)

# ── Load ML model at startup ──────────────────────────────────────────────────

def load_model():
    print("Loading ML model from GCS...")
    try:
        client = storage.Client(project=PROJECT_ID)
        bucket = client.bucket(f"{PROJECT_ID}-processed-data")
        blob   = bucket.blob("ml/predictor_model.joblib")
        buffer = io.BytesIO(blob.download_as_bytes())
        data   = joblib.load(buffer)
        print(f"Model loaded — MAE: ${data['mae']:,.0f} | MAPE: {data['mape']:.1f}%")
        return data
    except Exception as e:
        print(f"Warning: Could not load ML model: {e}")
        return None

MODEL_DATA = None

def get_model():
    global MODEL_DATA
    if MODEL_DATA is None:
        MODEL_DATA = load_model()
    return MODEL_DATA

# ── Request / response models ─────────────────────────────────────────────────

class PropertyInput(BaseModel):
    zip_code:      str
    sqft:          float
    bedrooms:      int
    bathrooms:     float
    year_built:    int
    condition:     str
    property_type: str
    garage:        bool = True
    stories:       Optional[int] = 1

class PredictionResponse(BaseModel):
    estimated_value:   float
    low_estimate:      float
    high_estimate:     float
    confidence:        float
    price_per_sqft:    float
    zip_code:          str
    city:              Optional[str]
    state:             Optional[str]
    metro_area:        Optional[str]
    model_version:     str
    neighborhood_data: dict

# ── Helper functions ──────────────────────────────────────────────────────────

def get_neighborhood_context(zip_code: str) -> dict:
    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, zhvi_sfrcondo, zori_rent,
            median_sale_price, days_to_pending,
            market_heat_index,
            median_income, owner_occupied_pct,
            education_index, academic_score, total_schools
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE zip_code = '{zip_code}'
        LIMIT 1
    """
    job     = bq_client.query(sql)
    results = list(job.result())
    if not results:
        return {}
    return dict(results[0])

def get_recent_trends(zip_code: str) -> list:
    sql = f"""
        SELECT date, zhvi_sfr
        FROM `{PROJECT_ID}.{DATASET}.zip_market_data`
        WHERE zip_code = '{zip_code}'
        AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 14 MONTH)
        ORDER BY date ASC
    """
    try:
        job = bq_client.query(sql)
        return [dict(row) for row in job.result()]
    except Exception:
        return []

def estimate_value_ml(prop: PropertyInput, neighborhood: dict, recent_trends: list) -> dict:
    model_data   = get_model()
    model        = model_data['model']
    le_state     = model_data['label_encoder']
    feature_cols = model_data['feature_cols']
    mape         = model_data['mape']
    mae          = model_data['mae']

    today = date.today()

    # Calculate price trends
    price_yoy_pct = 0.0
    price_3mo_pct = 0.0
    if len(recent_trends) >= 12:
        current   = recent_trends[-1].get('zhvi_sfr') or 0
        year_ago  = recent_trends[-12].get('zhvi_sfr') or current
        three_ago = recent_trends[-3].get('zhvi_sfr') or current
        if year_ago:
            price_yoy_pct = (current - year_ago) / year_ago * 100
        if three_ago:
            price_3mo_pct = (current - three_ago) / three_ago * 100

    # Encode state
    state = neighborhood.get('state') or 'UNKNOWN'
    try:
        state_encoded = int(le_state.transform([state])[0])
    except ValueError:
        state_encoded = 0

    features = {
        'year':                today.year,
        'month':               today.month,
        'median_income':       neighborhood.get('median_income')      or 65000,
        'owner_occupied_pct':  neighborhood.get('owner_occupied_pct') or 60,
        'total_units':         5000,
        'median_rooms':        6,
        'education_index':     neighborhood.get('education_index')    or 50,
        'academic_score':      neighborhood.get('academic_score')     or 50,
        'total_schools':       neighborhood.get('total_schools')      or 5,
        'metro_median_price':  neighborhood.get('median_sale_price')  or 350000,
        'metro_days_pending':  neighborhood.get('days_to_pending')    or 20,
        'metro_heat_index':    neighborhood.get('market_heat_index')  or 50,
        'metro_inventory':     1000,
        'metro_pct_above_list':0.3,
        'price_yoy_pct':       price_yoy_pct,
        'price_3mo_pct':       price_3mo_pct,
        'zori_rent':           neighborhood.get('zori_rent')          or 1500,
        'zhvi_sfrcondo':       neighborhood.get('zhvi_sfrcondo')      or 300000,
        'state_encoded':       state_encoded,
    }

    X               = [[features[col] for col in feature_cols]]
    base_prediction = float(model.predict(X)[0])

    # Property-specific adjustments on top of ML base
    MEDIAN_SQFT = 1800
    size_adj    = (prop.sqft / MEDIAN_SQFT) ** 0.85
    bed_adj     = 1 + (prop.bedrooms  - 3) * 0.035
    bath_adj    = 1 + (prop.bathrooms - 2) * 0.025
    age         = max(0, today.year - prop.year_built)
    age_adj     = max(0.70, 1 - age * 0.0025)
    cond_map    = {'excellent': 1.08, 'good': 1.00, 'fair': 0.89, 'poor': 0.76}
    cond_adj    = cond_map.get(prop.condition.lower(), 1.0)
    type_map    = {'single_family': 1.00, 'condo': 0.87, 'townhouse': 0.93}
    type_adj    = type_map.get(prop.property_type.lower(), 1.0)
    garage_adj  = 1.035 if prop.garage else 1.0

    estimate = (base_prediction * size_adj * bed_adj * bath_adj *
                age_adj * cond_adj * type_adj * garage_adj)

    # Confidence and range
    base_confidence = max(70, min(92, 100 - mape * 3))
    if not neighborhood.get('median_income'):   base_confidence -= 5
    if not neighborhood.get('education_index'): base_confidence -= 3
    if not recent_trends:                       base_confidence -= 4

    margin = (100 - base_confidence) / 100
    low    = estimate * (1 - margin * 1.2)
    high   = estimate * (1 + margin * 1.2)

    return {
        'estimated_value': round(estimate, -2),
        'low_estimate':    round(low,      -2),
        'high_estimate':   round(high,     -2),
        'confidence':      round(base_confidence, 1),
        'price_per_sqft':  round(estimate / prop.sqft, 2),
    }

def estimate_value_fallback(prop: PropertyInput, neighborhood: dict) -> dict:
    """Fallback formula if ML model fails to load."""
    base_price = neighborhood.get('zhvi_sfr') or neighborhood.get('zhvi_sfrcondo') or 350000
    MEDIAN_SQFT = 1800
    size_adj  = (prop.sqft / MEDIAN_SQFT) ** 0.85
    bed_adj   = 1 + (prop.bedrooms  - 3) * 0.04
    bath_adj  = 1 + (prop.bathrooms - 2) * 0.03
    age       = max(0, date.today().year - prop.year_built)
    age_adj   = max(0.65, 1 - age * 0.003)
    cond_map  = {'excellent': 1.10, 'good': 1.00, 'fair': 0.88, 'poor': 0.75}
    cond_adj  = cond_map.get(prop.condition.lower(), 1.0)
    type_map  = {'single_family': 1.00, 'condo': 0.88, 'townhouse': 0.93}
    type_adj  = type_map.get(prop.property_type.lower(), 1.0)
    garage_adj = 1.04 if prop.garage else 1.0
    estimate  = base_price * size_adj * bed_adj * bath_adj * age_adj * cond_adj * type_adj * garage_adj
    low       = estimate * 0.92
    high      = estimate * 1.08
    return {
        'estimated_value': round(estimate, -2),
        'low_estimate':    round(low,      -2),
        'high_estimate':   round(high,     -2),
        'confidence':      75.0,
        'price_per_sqft':  round(estimate / prop.sqft, 2),
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":        "ok",
        "service":       "market-value-predictor",
        "model_loaded":  MODEL_DATA is not None,
        "model_version": "xgboost-v2" if MODEL_DATA else "not-loaded-yet"
    }

@app.post("/predict", response_model=PredictionResponse)
def predict(prop: PropertyInput):
    neighborhood = get_neighborhood_context(prop.zip_code)
    if not neighborhood:
        raise HTTPException(
            status_code=404,
            detail=f"Zip code {prop.zip_code} not found"
        )

    recent_trends = get_recent_trends(prop.zip_code)

    model = get_model()
    if model:
        result        = estimate_value_ml(prop, neighborhood, recent_trends)
        model_version = "xgboost-v2"
    else:
        result        = estimate_value_fallback(prop, neighborhood)
        model_version = "fallback"

    return PredictionResponse(
        **result,
        zip_code          = prop.zip_code,
        city              = neighborhood.get('city'),
        state             = neighborhood.get('state'),
        metro_area        = neighborhood.get('metro_area'),
        model_version     = model_version,
        neighborhood_data = {
            'zhvi_sfr':           neighborhood.get('zhvi_sfr'),
            'median_income':      neighborhood.get('median_income'),
            'education_index':    neighborhood.get('education_index'),
            'owner_occupied_pct': neighborhood.get('owner_occupied_pct'),
        }
    )

@app.get("/predict/comparable/{zip_code}")
def get_comparables(zip_code: str, radius: int = 5):
    sql = f"""
        WITH target AS (
            SELECT zhvi_sfr, metro_area
            FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
            WHERE zip_code = '{zip_code}'
            LIMIT 1
        )
        SELECT
            n.zip_code, n.city, n.state,
            n.zhvi_sfr, n.median_income, n.education_index,
            ABS(n.zhvi_sfr - t.zhvi_sfr) AS value_diff
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features` n
        CROSS JOIN target t
        WHERE n.zip_code != '{zip_code}'
        AND n.metro_area = t.metro_area
        AND n.zhvi_sfr IS NOT NULL
        AND t.zhvi_sfr IS NOT NULL
        ORDER BY value_diff ASC
        LIMIT {radius}
    """
    try:
        job     = bq_client.query(sql)
        results = [dict(row) for row in job.result()]
        return {"zip_code": zip_code, "comparables": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/market/trends/{zip_code}")
def get_market_trends(zip_code: str, months: int = 12):
    sql = f"""
        SELECT date, zhvi_sfr, zhvi_sfrcondo, zori_rent
        FROM `{PROJECT_ID}.{DATASET}.zip_market_data`
        WHERE zip_code = '{zip_code}'
        AND date >= DATE_SUB(CURRENT_DATE, INTERVAL {months} MONTH)
        ORDER BY date ASC
    """
    try:
        job     = bq_client.query(sql)
        results = [dict(row) for row in job.result()]
        if len(results) >= 2:
            first        = results[0].get('zhvi_sfr')  or 0
            last         = results[-1].get('zhvi_sfr') or 0
            appreciation = round(((last - first) / first * 100) if first else 0, 2)
        else:
            appreciation = None
        return {
            "zip_code":     zip_code,
            "months":       months,
            "appreciation": appreciation,
            "trend":        results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))