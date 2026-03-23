from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from typing import Optional
import os

app = FastAPI(title="Neighborhood Explorer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://frontend-262793354273.us-east1.run.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ID = os.getenv("PROJECT_ID", "housing-app-490522")
DATASET    = "housing_data"

bq_client  = bigquery.Client(project=PROJECT_ID)

def run_query(sql: str) -> list:
    query_job = bq_client.query(sql)
    results   = query_job.result()
    return [dict(row) for row in results]

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "neighborhood-explorer"}

# ── Search neighborhoods ───────────────────────────────────────────────────────

@app.get("/neighborhoods/search")
def search_neighborhoods(
    q:              Optional[str]   = Query(None, description="City or zip code"),
    state:          Optional[str]   = Query(None, description="State abbreviation e.g. TX"),
    min_price:      Optional[float] = Query(None, description="Minimum ZHVI home value"),
    max_price:      Optional[float] = Query(None, description="Maximum ZHVI home value"),
    min_education:  Optional[float] = Query(None, description="Minimum education index 0-100"),
    min_income:     Optional[float] = Query(None, description="Minimum median income"),
    limit:          int             = Query(20,   description="Number of results"),
):
    conditions = ["zip_code IS NOT NULL"]

    if q:
        conditions.append(f"""
            (LOWER(city) LIKE LOWER('%{q}%')
            OR zip_code LIKE '%{q}%')
        """)
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")
    if min_price:
        conditions.append(f"zhvi_sfr >= {min_price}")
    if max_price:
        conditions.append(f"zhvi_sfr <= {max_price}")
    if min_education:
        conditions.append(f"education_index >= {min_education}")
    if min_income:
        conditions.append(f"median_income >= {min_income}")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            zip_code,
            city,
            state,
            metro_area,
            zhvi_sfr,
            zhvi_sfrcondo,
            zori_rent,
            median_sale_price,
            days_to_pending,
            market_heat_index,
            median_income,
            owner_occupied_pct,
            total_schools,
            academic_score,
            education_index,
            last_updated
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        ORDER BY zhvi_sfr DESC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Get single neighborhood by zip ────────────────────────────────────────────

@app.get("/neighborhoods/{zip_code}")
def get_neighborhood(zip_code: str):
    sql = f"""
        SELECT *
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE zip_code = '{zip_code}'
        LIMIT 1
    """

    try:
        results = run_query(sql)
        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"Zip code {zip_code} not found"
            )
        return results[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Get price history for a zip code ──────────────────────────────────────────

@app.get("/neighborhoods/{zip_code}/price-history")
def get_price_history(
    zip_code: str,
    months:   int = Query(24, description="Number of months of history")
):
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
        results = run_query(sql)
        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"No price history found for zip code {zip_code}"
            )
        return {"zip_code": zip_code, "months": months, "history": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Get top neighborhoods by metric ───────────────────────────────────────────

@app.get("/neighborhoods/top/{metric}")
def get_top_neighborhoods(
    metric: str,
    state:  Optional[str] = Query(None),
    limit:  int           = Query(10)
):
    allowed_metrics = [
        "education_index", "academic_score", "median_income",
        "owner_occupied_pct", "market_heat_index"
    ]

    if metric not in allowed_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric. Choose from: {allowed_metrics}"
        )

    conditions = [f"{metric} IS NOT NULL", "city IS NOT NULL"]
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, median_income, education_index,
            academic_score, market_heat_index,
            {metric} AS sort_metric
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        ORDER BY {metric} DESC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"metric": metric, "count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Get metro summary ──────────────────────────────────────────────────────────

@app.get("/metros")
def get_metros(
    state: Optional[str] = Query(None),
    limit: int           = Query(20)
):
    conditions = ["metro_area IS NOT NULL"]
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            metro_area,
            state,
            COUNT(DISTINCT zip_code)          AS zip_count,
            ROUND(AVG(zhvi_sfr), 0)           AS avg_home_value,
            ROUND(AVG(median_income), 0)      AS avg_income,
            ROUND(AVG(education_index), 1)    AS avg_education_index,
            ROUND(AVG(market_heat_index), 2)  AS avg_heat_index
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        GROUP BY metro_area, state
        ORDER BY avg_home_value DESC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))