from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from typing import Optional
import os

app = FastAPI(title="Neighborhood Explorer API", version="1.0.0")

app.add_middleware(
    app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
    q:              Optional[str]   = Query(None),
    state:          Optional[str]   = Query(None),
    min_price:      Optional[float] = Query(None),
    max_price:      Optional[float] = Query(None),
    min_education:  Optional[float] = Query(None),
    min_income:     Optional[float] = Query(None),
    max_budget:     Optional[float] = Query(None),
    value_tier:     Optional[str]   = Query(None),
    min_population: Optional[float] = Query(None),
    max_population: Optional[float] = Query(None),
    pop_class:      Optional[str]   = Query(None),
    min_safety:     Optional[float] = Query(None),
    min_air_quality:Optional[float] = Query(None),
    sort_by:        str             = Query("value_score"),
    limit:          int             = Query(20),
):
    allowed_sorts = [
        "value_score", "affordability_score", "zhvi_sfr",
        "median_income", "education_index", "price_to_income_ratio",
        "safety_index", "air_quality_index", "natural_amenity_score"
    ]
    if sort_by not in allowed_sorts:
        sort_by = "value_score"

    sort_direction = "ASC" if sort_by == "price_to_income_ratio" else "DESC"

    conditions = ["zip_code IS NOT NULL"]

    if q:
        conditions.append(f"""
            (LOWER(city) LIKE LOWER('%{q}%')
            OR zip_code LIKE '%{q}%')
        """)
    if state:
        conditions.append(f"UPPER(state) = UPPER('{state}')")
    if max_budget:
        conditions.append(f"zhvi_sfr <= {max_budget}")
    if min_price:
        conditions.append(f"zhvi_sfr >= {min_price}")
    if max_price:
        conditions.append(f"zhvi_sfr <= {max_price}")
    if min_education:
        conditions.append(f"education_index >= {min_education}")
    if min_income:
        conditions.append(f"median_income >= {min_income}")
    if value_tier:
        conditions.append(f"value_tier = '{value_tier}'")
    if min_population:
        conditions.append(f"total_population >= {min_population}")
    if max_population:
        conditions.append(f"total_population <= {max_population}")
    if pop_class:
        conditions.append(f"pop_density_class = '{pop_class}'")
    if min_safety:
        conditions.append(f"safety_index >= {min_safety}")
    if min_air_quality:
        conditions.append(f"air_quality_index >= {min_air_quality}")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, zhvi_sfrcondo, zori_rent,
            median_income, owner_occupied_pct,
            education_index, academic_score,
            safety_index, violent_crime_rate,
            property_crime_rate, air_quality_index,
            median_aqi, natural_amenity_score,
            price_to_income_ratio, affordability_score,
            value_score, value_tier,
            total_population, pop_density_class,
            latitude, longitude,
            last_updated
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        ORDER BY {sort_by} {sort_direction} NULLS LAST
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
    "owner_occupied_pct", "market_heat_index",
    "value_score", "affordability_score"
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
    
# ── City search ───────────────────────────────────────────────────────────────

@app.get("/cities/search")
def search_cities(q: str = Query(...), limit: int = Query(10)):
    sql = f"""
        SELECT
            city,
            state,
            COUNT(*)                    AS zip_count,
            ROUND(AVG(zhvi_sfr), 0)     AS avg_home_value,
            ROUND(AVG(value_score), 1)  AS avg_value_score,
            ROUND(MIN(zhvi_sfr), 0)     AS min_home_value,
            ROUND(MAX(zhvi_sfr), 0)     AS max_home_value
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE LOWER(city) LIKE LOWER('%{q}%')
        AND city IS NOT NULL
        AND zhvi_sfr IS NOT NULL
        GROUP BY city, state
        HAVING COUNT(*) >= 1
        ORDER BY zip_count DESC
        LIMIT {limit}
    """
    try:
        results = run_query(sql)
        return {"cities": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cities/{city}/{state}/neighborhoods")
def get_city_neighborhoods(
    city:    str,
    state:   str,
    sort_by: str = Query("value_score"),
    limit:   int = Query(20),
):
    allowed_sorts = [
        "value_score", "affordability_score", "zhvi_sfr",
        "median_income", "education_index", "safety_index",
        "air_quality_index", "natural_amenity_score",
        "price_to_income_ratio"
    ]
    if sort_by not in allowed_sorts:
        sort_by = "value_score"
    sort_dir = "ASC" if sort_by == "price_to_income_ratio" else "DESC"

    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, zhvi_sfrcondo, zori_rent,
            median_income, owner_occupied_pct,
            education_index, academic_score,
            safety_index, violent_crime_rate,
            property_crime_rate, air_quality_index,
            median_aqi, natural_amenity_score,
            price_to_income_ratio, affordability_score,
            value_score, value_tier,
            total_population, pop_density_class,
            latitude, longitude,
            last_updated
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE LOWER(city)  = LOWER('{city}')
        AND   UPPER(state) = UPPER('{state}')
        AND   zhvi_sfr IS NOT NULL
        ORDER BY {sort_by} {sort_dir} NULLS LAST
        LIMIT {limit}
    """
    try:
        results = run_query(sql)
        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"No neighborhoods found for {city}, {state}"
            )
        avg_value   = sum(r['zhvi_sfr'] or 0 for r in results) / len(results)
        avg_score   = sum(r['value_score'] or 0 for r in results) / len(results)
        min_value   = min(r['zhvi_sfr'] or 0 for r in results)
        max_value   = max(r['zhvi_sfr'] or 0 for r in results)
        return {
            "city":           city,
            "state":          state,
            "zip_count":      len(results),
            "avg_home_value": round(avg_value, 0),
            "avg_value_score":round(avg_score, 1),
            "min_home_value": round(min_value, 0),
            "max_home_value": round(max_value, 0),
            "neighborhoods":  results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))