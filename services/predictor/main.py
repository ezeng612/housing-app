from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google.cloud import bigquery
from typing import Optional
import numpy as np
import os

app = FastAPI(title="Market Value Predictor API", version="1.0.0")

PROJECT_ID = os.getenv("PROJECT_ID", "housing-app-490522")
DATASET    = "housing_data"
bq_client  = bigquery.Client(project=PROJECT_ID)

# ── Request / response models ─────────────────────────────────────────────────

class PropertyInput(BaseModel):
    zip_code:        str
    sqft:            float
    bedrooms:        int
    bathrooms:       float
    year_built:      int
    condition:       str  # excellent, good, fair, poor
    property_type:   str  # single_family, condo, townhouse
    garage:          bool = True
    stories:         Optional[int] = 1

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
    neighborhood_data: dict

# ── Helper — fetch neighborhood context from BigQuery ─────────────────────────

def get_neighborhood_context(zip_code: str) -> dict:
    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, zhvi_sfrcondo, zori_rent,
            median_sale_price, median_income,
            owner_occupied_pct, education_index
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE zip_code = '{zip_code}'
        LIMIT 1
    """
    job     = bq_client.query(sql)
    results = list(job.result())
    if not results:
        return {}
    return dict(results[0])

# ── Core valuation model ───────────────────────────────────────────────────────

def estimate_value(prop: PropertyInput, neighborhood: dict) -> dict:
    # Base value from ZHVI if available, otherwise use median sale price
    zhvi = neighborhood.get("zhvi_sfr") or neighborhood.get("zhvi_sfrcondo")
    base_price = zhvi or neighborhood.get("median_sale_price") or 350000

    # Median sqft assumption for normalization
    MEDIAN_SQFT = 1800
    sqft_ratio  = prop.sqft / MEDIAN_SQFT

    # Size adjustment — non-linear, larger homes have diminishing returns
    size_adj = sqft_ratio ** 0.85

    # Bedroom/bathroom adjustments
    bed_adj  = 1 + (prop.bedrooms  - 3) * 0.04
    bath_adj = 1 + (prop.bathrooms - 2) * 0.03

    # Age adjustment — newer homes worth more
    age      = max(0, 2025 - prop.year_built)
    age_adj  = 1 - (age * 0.003)
    age_adj  = max(0.65, age_adj)

    # Condition adjustment
    condition_map = {
        "excellent": 1.10,
        "good":      1.00,
        "fair":      0.88,
        "poor":      0.75
    }
    cond_adj = condition_map.get(prop.condition.lower(), 1.0)

    # Property type adjustment
    type_map = {
        "single_family": 1.00,
        "condo":         0.88,
        "townhouse":     0.93
    }
    type_adj = type_map.get(prop.property_type.lower(), 1.0)

    # Garage adjustment
    garage_adj = 1.04 if prop.garage else 1.0

    # Income premium — higher income areas command higher prices
    income        = neighborhood.get("median_income") or 65000
    income_factor = (income / 65000) ** 0.3

    # Education premium
    edu_index     = neighborhood.get("education_index") or 50
    edu_factor    = 1 + (edu_index - 50) / 500

    # Final estimate
    estimate = (
        base_price *
        size_adj   *
        bed_adj    *
        bath_adj   *
        age_adj    *
        cond_adj   *
        type_adj   *
        garage_adj *
        income_factor *
        edu_factor
    )

    # Confidence based on data availability
    confidence = 85.0
    if not zhvi:
        confidence -= 10
    if not neighborhood.get("median_income"):
        confidence -= 5
    if not neighborhood.get("education_index"):
        confidence -= 5

    # Confidence interval — tighter for better data
    margin = 1 - (confidence / 100) * 0.6
    low    = estimate * (1 - margin * 0.12)
    high   = estimate * (1 + margin * 0.12)

    return {
        "estimated_value": round(estimate, -2),
        "low_estimate":    round(low, -2),
        "high_estimate":   round(high, -2),
        "confidence":      round(confidence, 1),
        "price_per_sqft":  round(estimate / prop.sqft, 2),
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "market-value-predictor"}

@app.post("/predict", response_model=PredictionResponse)
def predict(prop: PropertyInput):
    # Fetch neighborhood context from BigQuery
    neighborhood = get_neighborhood_context(prop.zip_code)

    if not neighborhood:
        raise HTTPException(
            status_code=404,
            detail=f"Zip code {prop.zip_code} not found in database"
        )

    # Run valuation model
    result = estimate_value(prop, neighborhood)

    return PredictionResponse(
        **result,
        zip_code          = prop.zip_code,
        city              = neighborhood.get("city"),
        state             = neighborhood.get("state"),
        metro_area        = neighborhood.get("metro_area"),
        neighborhood_data = {
            "zhvi_sfr":          neighborhood.get("zhvi_sfr"),
            "median_income":     neighborhood.get("median_income"),
            "education_index":   neighborhood.get("education_index"),
            "owner_occupied_pct":neighborhood.get("owner_occupied_pct"),
        }
    )

@app.get("/predict/comparable/{zip_code}")
def get_comparables(zip_code: str, radius: int = 5):
    """
    Returns nearby zip codes with similar home values
    for use as comparable sales context.
    """
    sql = f"""
        WITH target AS (
            SELECT zhvi_sfr, metro_area
            FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
            WHERE zip_code = '{zip_code}'
            LIMIT 1
        )
        SELECT
            n.zip_code, n.city, n.state,
            n.zhvi_sfr, n.median_income,
            n.education_index,
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
    """
    Returns price trend data for a zip code
    to show appreciation context alongside the estimate.
    """
    sql = f"""
        SELECT
            date,
            zhvi_sfr,
            zhvi_sfrcondo,
            zori_rent
        FROM `{PROJECT_ID}.{DATASET}.zip_market_data`
        WHERE zip_code = '{zip_code}'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL {months} MONTH)
        ORDER BY date ASC
    """

    try:
        job     = bq_client.query(sql)
        results = [dict(row) for row in job.result()]

        if len(results) >= 2:
            first = results[0]["zhvi_sfr"]  or 0
            last  = results[-1]["zhvi_sfr"] or 0
            appreciation = round(
                ((last - first) / first * 100) if first else 0, 2)
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