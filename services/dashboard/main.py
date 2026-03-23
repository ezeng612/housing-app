from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from typing import Optional
import os

app = FastAPI(title="Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ID = os.getenv("PROJECT_ID", "housing-app-490522")
DATASET    = "housing_data"
bq_client  = bigquery.Client(project=PROJECT_ID)

def run_query(sql: str) -> list:
    job     = bq_client.query(sql)
    results = job.result()
    return [dict(row) for row in results]

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "dashboard"}

# ── KPI summary cards ─────────────────────────────────────────────────────────

@app.get("/dashboard/kpis")
def get_kpis(
    metro_area: Optional[str] = Query(None),
    state:      Optional[str] = Query(None)
):
    conditions = ["zhvi_sfr IS NOT NULL"]
    if metro_area:
        conditions.append(f"LOWER(metro_area) LIKE LOWER('%{metro_area}%')")
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        WITH summary AS (
            SELECT
                ROUND(AVG(zhvi_sfr), 0)            AS avg_home_value,
                ROUND(AVG(median_income), 0)        AS avg_median_income,
                ROUND(AVG(education_index), 1)      AS avg_education_index,
                ROUND(AVG(owner_occupied_pct), 1)   AS avg_owner_occupied,
                COUNT(DISTINCT zip_code)            AS total_zip_codes,
                COUNT(DISTINCT metro_area)          AS total_metros
            FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
            WHERE {where}
        )
        SELECT * FROM summary
    """

    try:
        results = run_query(sql)
        return results[0] if results else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Price trends over time ────────────────────────────────────────────────────

@app.get("/dashboard/price-trends")
def get_price_trends(
    metro_area: Optional[str] = Query(None, description="Filter by metro area"),
    state:      Optional[str] = Query(None, description="Filter by state"),
    months:     int           = Query(24,   description="Months of history"),
    interval:   str           = Query("month", description="month or quarter")
):
    geo_filter = ""
    if metro_area:
        geo_filter += f"AND LOWER(z.metro_area) LIKE LOWER('%{metro_area}%')"
    if state:
        geo_filter += f"AND UPPER(z.state) = UPPER('{state}')"

    if interval == "quarter":
        date_trunc = "QUARTER"
    else:
        date_trunc = "MONTH"

    sql = f"""
        SELECT
            DATE_TRUNC(date, {date_trunc})      AS period,
            ROUND(AVG(zhvi_sfr), 0)             AS avg_zhvi_sfr,
            ROUND(AVG(zhvi_sfrcondo), 0)        AS avg_zhvi_sfrcondo,
            ROUND(AVG(zori_rent), 0)            AS avg_rent,
            COUNT(DISTINCT zip_code)            AS zip_count
        FROM `{PROJECT_ID}.{DATASET}.zip_market_data` z
        WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL {months} MONTH)
        {geo_filter}
        GROUP BY period
        ORDER BY period ASC
    """

    try:
        results = run_query(sql)
        return {"months": months, "interval": interval, "trends": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Metro comparison ──────────────────────────────────────────────────────────

@app.get("/dashboard/metros")
def get_metro_comparison(
    state:  Optional[str] = Query(None),
    limit:  int           = Query(15)
):
    conditions = ["metro_area IS NOT NULL", "zhvi_sfr IS NOT NULL"]
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            metro_area,
            state,
            COUNT(DISTINCT zip_code)            AS zip_count,
            ROUND(AVG(zhvi_sfr), 0)             AS avg_home_value,
            ROUND(AVG(zori_rent), 0)            AS avg_rent,
            ROUND(AVG(median_income), 0)        AS avg_income,
            ROUND(AVG(education_index), 1)      AS avg_education,
            ROUND(AVG(owner_occupied_pct), 1)   AS avg_owner_pct
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        GROUP BY metro_area, state
        ORDER BY avg_home_value DESC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"count": len(results), "metros": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Home value distribution ───────────────────────────────────────────────────

@app.get("/dashboard/value-distribution")
def get_value_distribution(
    metro_area: Optional[str] = Query(None),
    state:      Optional[str] = Query(None)
):
    conditions = ["zhvi_sfr IS NOT NULL"]
    if metro_area:
        conditions.append(f"LOWER(metro_area) LIKE LOWER('%{metro_area}%')")
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            CASE
                WHEN zhvi_sfr < 200000  THEN 'Under $200K'
                WHEN zhvi_sfr < 400000  THEN '$200K - $400K'
                WHEN zhvi_sfr < 600000  THEN '$400K - $600K'
                WHEN zhvi_sfr < 800000  THEN '$600K - $800K'
                WHEN zhvi_sfr < 1000000 THEN '$800K - $1M'
                ELSE 'Over $1M'
            END AS price_range,
            COUNT(*) AS zip_count,
            ROUND(AVG(zhvi_sfr), 0) AS avg_value
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        GROUP BY price_range
        ORDER BY avg_value ASC
    """

    try:
        results = run_query(sql)
        return {"distribution": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Education vs home value correlation ───────────────────────────────────────

@app.get("/dashboard/education-vs-value")
def get_education_vs_value(
    state:  Optional[str] = Query(None),
    limit:  int           = Query(100)
):
    conditions = [
        "zhvi_sfr IS NOT NULL",
        "education_index IS NOT NULL",
        "city IS NOT NULL"
    ]
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            zip_code, city, state,
            ROUND(zhvi_sfr, 0)          AS home_value,
            ROUND(education_index, 1)   AS education_index,
            ROUND(median_income, 0)     AS median_income
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        ORDER BY zhvi_sfr DESC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"count": len(results), "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Affordability index ───────────────────────────────────────────────────────

@app.get("/dashboard/affordability")
def get_affordability(
    state:  Optional[str] = Query(None),
    limit:  int           = Query(20)
):
    conditions = [
        "zhvi_sfr IS NOT NULL",
        "median_income IS NOT NULL",
        "city IS NOT NULL"
    ]
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            ROUND(zhvi_sfr, 0)                              AS home_value,
            ROUND(median_income, 0)                         AS median_income,
            ROUND(zhvi_sfr / NULLIF(median_income, 0), 2)  AS price_to_income_ratio,
            ROUND(zori_rent, 0)                             AS monthly_rent,
            ROUND(education_index, 1)                       AS education_index
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        ORDER BY price_to_income_ratio ASC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"count": len(results), "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))