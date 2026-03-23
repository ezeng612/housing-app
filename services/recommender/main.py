from fastapi import FastAPI, HTTPException, Query
from google.cloud import bigquery
from pydantic import BaseModel
from typing import Optional
import numpy as np
import os

app = FastAPI(title="Neighborhood Recommender API", version="1.0.0")

PROJECT_ID = os.getenv("PROJECT_ID", "housing-app-490522")
DATASET    = "housing_data"
bq_client  = bigquery.Client(project=PROJECT_ID)

# ── Models ────────────────────────────────────────────────────────────────────

class UserPreferences(BaseModel):
    max_budget:         float
    min_budget:         Optional[float] = None
    priorities:         list[str] = []
    max_commute_mins:   Optional[int] = None
    state:              Optional[str] = None
    metro_area:         Optional[str] = None
    min_education:      Optional[float] = None
    min_income:         Optional[float] = None
    prefer_ownership:   bool = True

# ── Priority weight maps ──────────────────────────────────────────────────────

PRIORITY_WEIGHTS = {
    "schools":     {"education_index": 0.5,  "academic_score": 0.3,  "zhvi_sfr": 0.2},
    "safety":      {"education_index": 0.2,  "median_income": 0.3,   "zhvi_sfr": 0.5},
    "walkable":    {"zhvi_sfr": 0.3,          "median_income": 0.3,   "education_index": 0.4},
    "transit":     {"zhvi_sfr": 0.4,          "median_income": 0.3,   "education_index": 0.3},
    "parks":       {"education_index": 0.3,   "median_income": 0.3,   "zhvi_sfr": 0.4},
    "nightlife":   {"zhvi_sfr": 0.5,          "median_income": 0.3,   "education_index": 0.2},
    "quiet":       {"education_index": 0.3,   "median_income": 0.4,   "zhvi_sfr": 0.3},
    "appreciate":  {"zhvi_sfr": 0.6,          "median_income": 0.2,   "education_index": 0.2},
    "affordable":  {"zhvi_sfr": 0.1,          "median_income": 0.5,   "education_index": 0.4},
    "family":      {"education_index": 0.5,   "median_income": 0.3,   "zhvi_sfr": 0.2},
}

def run_query(sql: str) -> list:
    job = bq_client.query(sql)
    return [dict(row) for row in job.result()]

# ── Scoring engine ────────────────────────────────────────────────────────────

def score_neighborhood(row: dict, prefs: UserPreferences) -> float:
    score = 0.0

    # Budget fit — how well does the home value fit the budget
    home_val   = row.get("zhvi_sfr") or 0
    max_budget = prefs.max_budget
    min_budget = prefs.min_budget or max_budget * 0.5

    if home_val <= max_budget and home_val >= min_budget:
        # Perfect budget fit
        budget_score = 1.0 - abs(home_val - max_budget * 0.85) / (max_budget * 0.5)
        score += max(0, budget_score) * 40
    elif home_val < min_budget:
        score += 15
    else:
        # Over budget — penalize proportionally
        over_pct = (home_val - max_budget) / max_budget
        score   -= over_pct * 30

    # Priority scores
    if prefs.priorities:
        priority_score = 0.0
        for priority in prefs.priorities:
            weights = PRIORITY_WEIGHTS.get(priority, {})
            for metric, weight in weights.items():
                val = row.get(metric)
                if val is not None:
                    # Normalize each metric to 0-1
                    normalized = min(1.0, val / get_metric_max(metric))
                    priority_score += normalized * weight
        score += (priority_score / len(prefs.priorities)) * 40

    # Education bonus
    edu = row.get("education_index") or 0
    score += (edu / 100) * 10

    # Income stability signal
    income = row.get("median_income") or 0
    if income > 50000:
        score += min(10, (income - 50000) / 20000)

    return round(min(100, max(0, score)), 1)

def get_metric_max(metric: str) -> float:
    maxes = {
        "zhvi_sfr":        2000000,
        "zhvi_sfrcondo":   1500000,
        "zori_rent":       5000,
        "median_income":   200000,
        "education_index": 100,
        "academic_score":  100,
        "owner_occupied_pct": 100,
    }
    return maxes.get(metric, 100)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "neighborhood-recommender"}

@app.post("/recommend")
def recommend(prefs: UserPreferences, limit: int = Query(10)):
    conditions = ["zhvi_sfr IS NOT NULL", "city IS NOT NULL"]

    # Budget filter with 20% buffer to allow slightly over-budget results
    conditions.append(f"zhvi_sfr <= {prefs.max_budget * 1.2}")

    if prefs.min_budget:
        conditions.append(f"zhvi_sfr >= {prefs.min_budget * 0.8}")
    if prefs.state:
        conditions.append(f"UPPER(state) = UPPER('{prefs.state}')")
    if prefs.metro_area:
        conditions.append(f"LOWER(metro_area) LIKE LOWER('%{prefs.metro_area}%')")
    if prefs.min_education:
        conditions.append(f"education_index >= {prefs.min_education}")
    if prefs.min_income:
        conditions.append(f"median_income >= {prefs.min_income}")

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, zhvi_sfrcondo, zori_rent,
            median_income, owner_occupied_pct,
            education_index, academic_score,
            total_schools, last_updated
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE {where}
        ORDER BY zhvi_sfr DESC
        LIMIT 200
    """

    try:
        candidates = run_query(sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="No neighborhoods found matching your criteria"
        )

    # Score and rank candidates
    scored = []
    for row in candidates:
        match_score = score_neighborhood(row, prefs)
        row["match_score"] = match_score

        # Generate reason text
        reasons = []
        if row.get("education_index") and row["education_index"] >= 60:
            reasons.append(f"Strong education index of {row['education_index']}")
        if row.get("median_income") and row["median_income"] >= 80000:
            reasons.append(f"Median income of ${row['median_income']:,.0f}")
        if row.get("zhvi_sfr") and row["zhvi_sfr"] <= prefs.max_budget:
            reasons.append("Within your budget")
        elif row.get("zhvi_sfr") and row["zhvi_sfr"] <= prefs.max_budget * 1.1:
            reasons.append("Slightly above budget but strong match")
        if not reasons:
            reasons.append("Matches your location and lifestyle preferences")

        row["reason"] = reasons[0]
        scored.append(row)

    # Sort by match score descending
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    top = scored[:limit]

    return {
        "count":       len(top),
        "preferences": prefs.model_dump(),
        "results":     top
    }

@app.get("/recommend/similar/{zip_code}")
def find_similar(
    zip_code: str,
    limit:    int           = Query(5),
    state:    Optional[str] = Query(None)
):
    """
    Find neighborhoods similar to a given zip code
    using feature vector distance in BigQuery.
    """
    # First get the target neighborhood features
    target_sql = f"""
        SELECT
            zhvi_sfr, median_income, education_index,
            owner_occupied_pct, metro_area
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE zip_code = '{zip_code}'
        LIMIT 1
    """

    try:
        target = run_query(target_sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not target:
        raise HTTPException(
            status_code=404,
            detail=f"Zip code {zip_code} not found"
        )

    t = target[0]

    # Normalize reference values
    zhvi_ref    = t.get("zhvi_sfr")    or 400000
    income_ref  = t.get("median_income") or 65000
    edu_ref     = t.get("education_index") or 50
    occ_ref     = t.get("owner_occupied_pct") or 60

    state_filter = f"AND UPPER(state) = UPPER('{state}')" if state else ""

    # Find similar neighborhoods using normalized euclidean distance
    similar_sql = f"""
        SELECT
            zip_code, city, state, metro_area,
            zhvi_sfr, median_income,
            education_index, owner_occupied_pct,
            SQRT(
                POW((zhvi_sfr       - {zhvi_ref})   / NULLIF({zhvi_ref},   0), 2) +
                POW((median_income  - {income_ref}) / NULLIF({income_ref}, 0), 2) +
                POW((education_index - {edu_ref})   / NULLIF({edu_ref},    0), 2) +
                POW((owner_occupied_pct - {occ_ref})/ NULLIF({occ_ref},    0), 2)
            ) AS similarity_distance
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE zip_code != '{zip_code}'
        AND zhvi_sfr IS NOT NULL
        AND median_income IS NOT NULL
        AND education_index IS NOT NULL
        {state_filter}
        ORDER BY similarity_distance ASC
        LIMIT {limit}
    """

    try:
        results = run_query(similar_sql)
        # Convert distance to similarity score (0-100)
        for r in results:
            dist = r.get("similarity_distance") or 1
            r["similarity_score"] = round(max(0, 100 - dist * 50), 1)
            del r["similarity_distance"]
        return {
            "zip_code":   zip_code,
            "city":       t.get("city"),
            "similar":    results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommend/top-metros")
def top_metros_for_budget(
    max_budget:     float,
    min_budget:     Optional[float] = Query(None),
    priorities:     Optional[str]   = Query(None),
    limit:          int             = Query(10)
):
    """
    Returns the best metro areas for a given budget
    ranked by average match quality.
    """
    min_val = min_budget or max_budget * 0.5

    sql = f"""
        SELECT
            metro_area,
            state,
            COUNT(DISTINCT zip_code)            AS zip_count,
            ROUND(AVG(zhvi_sfr), 0)             AS avg_home_value,
            ROUND(AVG(median_income), 0)        AS avg_income,
            ROUND(AVG(education_index), 1)      AS avg_education,
            ROUND(AVG(owner_occupied_pct), 1)   AS avg_ownership,
            ROUND(AVG(zori_rent), 0)            AS avg_rent
        FROM `{PROJECT_ID}.{DATASET}.neighborhood_features`
        WHERE zhvi_sfr BETWEEN {min_val} AND {max_budget}
        AND metro_area IS NOT NULL
        GROUP BY metro_area, state
        HAVING COUNT(DISTINCT zip_code) >= 3
        ORDER BY avg_education DESC, avg_income DESC
        LIMIT {limit}
    """

    try:
        results = run_query(sql)
        return {"max_budget": max_budget, "count": len(results), "metros": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))