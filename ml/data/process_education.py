import pandas as pd
from google.cloud import storage
import io

PROJECT_ID  = "housing-app-490522"
RAW_BUCKET  = f"{PROJECT_ID}-raw-data"
PROC_BUCKET = f"{PROJECT_ID}-processed-data"

def download_csv(blob_name, **kwargs):
    client = storage.Client(project=PROJECT_ID)
    blob   = client.bucket(RAW_BUCKET).blob(blob_name)
    return pd.read_csv(io.BytesIO(blob.download_as_bytes()), **kwargs)

def upload_csv(df, blob_name):
    client = storage.Client(project=PROJECT_ID)
    blob   = client.bucket(PROC_BUCKET).blob(blob_name)
    blob.upload_from_string(df.to_csv(index=False), content_type="text/csv")
    print(f"Uploaded {blob_name} ({len(df):,} rows)")

def process_nces(df):
    print("  Processing NCES school directory...")

    # Normalize column names to uppercase
    df.columns = [c.strip().upper() for c in df.columns]

    # Keep only active schools
    if "SY_STATUS" in df.columns:
        df = df[df["SY_STATUS"].isin([1, 2, 3, 4])].copy()

    # Zip code
    df["zip_code"] = df["LZIP"].astype(str).str[:5].str.zfill(5)

    # Charter flag — CHARTER_TEXT is "Yes" or "No" in this file
    df["is_charter"] = df["CHARTER_TEXT"].astype(str).str.strip().str.upper().eq("YES").astype(int)

    # District name and state for SEDA join
    df["district_name"] = df["LEA_NAME"].astype(str).str.upper().str.strip()
    df["state"]         = df["LSTATE"].astype(str).str.upper().str.strip()

    # School level from LEVEL column
    df["is_elementary"] = df["LEVEL"].astype(str).str.upper().str.contains("ELEMENTARY", na=False).astype(int)
    df["is_high"]       = df["LEVEL"].astype(str).str.upper().str.contains("HIGH", na=False).astype(int)

    # Aggregate to zip level
    by_zip = df.groupby("zip_code").agg(
        total_schools     = ("zip_code",      "count"),
        charter_schools   = ("is_charter",    "sum"),
        elementary_schools= ("is_elementary", "sum"),
        high_schools      = ("is_high",       "sum"),
    ).reset_index()

    by_zip["charter_pct"] = (
        by_zip["charter_schools"] / by_zip["total_schools"] * 100
    ).round(1)

    # District-zip mapping for SEDA join
    district_zip = df[["zip_code", "district_name", "state"]].drop_duplicates()

    print(f"  NCES zip rows: {len(by_zip):,}")
    return by_zip, district_zip

def process_seda(df):
    print("  Processing SEDA academic achievement data...")

    # Normalize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Find district name and state columns
    name_col  = next(
        (c for c in ["sedaleaname", "sedaleanm", "geodistname", "distname", "leanm"] if c in df.columns), None)
    state_col = next(
        (c for c in ["stateabb", "state", "st"] if c in df.columns), None)
    year_col  = next(
        (c for c in ["year", "sedalean"] if c in df.columns), None)

    if not name_col:
        print(f"  Warning: district name column not found. Available: {df.columns.tolist()[:20]}")
        return pd.DataFrame()

    # Use most recent year only
    if year_col and year_col == "year":
        latest = df["year"].max()
        df = df[df["year"] == latest].copy()
        print(f"  Using SEDA year: {latest}")

    # Find ELA and math score columns
    ela_col  = next(
        (c for c in df.columns if "mn_all" in c or c == "gys_mn_all"), None)
    math_col = ela_col

    if not ela_col or not math_col:
        # Fallback — look for any mean score columns
        score_cols = [c for c in df.columns if "mn_" in c or "_mean" in c]
        print(f"  Score columns found: {score_cols[:10]}")
        if len(score_cols) >= 2:
            ela_col  = score_cols[0]
            math_col = score_cols[1]
        else:
            print("  Warning: could not find score columns")
            return pd.DataFrame()

    df["district_name"] = df[name_col].astype(str).str.upper().str.strip()
    df["state"]         = df[state_col].astype(str).str.upper().str.strip() \
        if state_col else "UNKNOWN"
    df[ela_col]         = pd.to_numeric(df[ela_col],  errors="coerce")
    df[math_col]        = pd.to_numeric(df[math_col], errors="coerce")

    by_district = df.groupby(["district_name", "state"]).agg(
        avg_ela_score  = (ela_col,  "mean"),
        avg_math_score = (math_col, "mean"),
    ).reset_index().dropna(subset=["avg_ela_score", "avg_math_score"])

    # Normalize scores to 0-100
    for col in ["avg_ela_score", "avg_math_score"]:
        min_v = by_district[col].min()
        max_v = by_district[col].max()
        by_district[f"{col}_norm"] = (
            (by_district[col] - min_v) / (max_v - min_v) * 100
        ).round(1)

    by_district["academic_score"] = (
        by_district["avg_ela_score_norm"] * 0.5 +
        by_district["avg_math_score_norm"] * 0.5
    ).round(1)

    print(f"  SEDA district rows: {len(by_district):,}")
    return by_district[["district_name", "state", "academic_score"]]

def build_zip_education(nces_zip, district_zip, seda_df):
    print("  Building zip-level education table...")

    # Join SEDA scores to zip codes via district name + state
    district_zip = district_zip.copy()
    district_zip["district_name"] = district_zip["district_name"].str.upper().str.strip()
    seda_df["district_name"]      = seda_df["district_name"].str.upper().str.strip()

    zip_with_seda = district_zip.merge(
        seda_df, on=["district_name", "state"], how="left")

    seda_by_zip = zip_with_seda.groupby("zip_code").agg(
        academic_score=("academic_score", "mean")
    ).reset_index()

    # Combine with NCES zip stats
    result = nces_zip.merge(seda_by_zip, on="zip_code", how="left")

    # Check match rate
    matched = result["academic_score"].notna().sum()
    print(f"  SEDA matched {matched:,} of {len(result):,} zip codes ({matched/len(result)*100:.1f}%)")

    # Schools per zip normalized to 0-100
    max_schools = result["total_schools"].quantile(0.95)
    result["schools_normalized"] = (
        result["total_schools"].clip(0, max_schools) / max_schools * 100
    ).round(1)

    # Education index — academic score 70%, school availability 30%
    result["education_index"] = (
        result["academic_score"].fillna(50)      * 0.70 +
        result["schools_normalized"].fillna(50)  * 0.30
    ).round(1)

    print(f"  Final education rows: {len(result):,}")
    return result[[
        "zip_code", "total_schools", "charter_schools",
        "charter_pct", "academic_score", "education_index"
    ]]

if __name__ == "__main__":
    print("Loading NCES school directory...")
    nces_raw = download_csv(
        "education/ccd_sch_029_2425_w_1a_073025.csv",
        encoding="latin-1",
        low_memory=False
    )
    nces_zip, district_zip = process_nces(nces_raw)

    print("Loading SEDA academic achievement data...")
    seda_raw = download_csv(
        "education/seda_geodist_long_gys_6.0.csv",
        low_memory=False
    )
    seda_df = process_seda(seda_raw)

    print("Building zip-level education table...")
    result = build_zip_education(nces_zip, district_zip, seda_df)

    upload_csv(result, "education/education_clean.csv")
    print("Education processing complete.")