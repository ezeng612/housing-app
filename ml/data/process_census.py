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

def extract_zip(geo_id):
    geo_id = str(geo_id)
    if "ZCTA5" in geo_id:
        return geo_id.split("US")[-1].strip().zfill(5)
    return geo_id[-5:].zfill(5)

def process_income(df):
    print("  Processing income data...")

    # Skip the second header row that Census includes
    df = df[df["GEO_ID"] != "id"].copy()
    df["zip_code"] = df["GEO_ID"].apply(extract_zip)

    # S1901_C01_012E = median household income estimate
    # S1901_C01_012M = margin of error
    income_col = next(
        (c for c in df.columns if "C01_012E" in c), None)
    margin_col = next(
        (c for c in df.columns if "C01_012M" in c), None)

    if not income_col:
        print("  Warning: income column not found, checking available columns...")
        print(df.columns.tolist()[:20])
        return pd.DataFrame()

    out = pd.DataFrame()
    out["zip_code"]      = df["zip_code"]
    out["median_income"] = pd.to_numeric(df[income_col], errors="coerce")

    if margin_col:
        out["income_margin"] = pd.to_numeric(df[margin_col], errors="coerce")
    else:
        out["income_margin"] = None

    out = out.dropna(subset=["median_income"])
    out = out[out["median_income"] > 0]
    print(f"  Income rows: {len(out):,}")
    return out

def process_housing(df):
    print("  Processing housing characteristics...")

    df = df[df["GEO_ID"] != "id"].copy()
    df["zip_code"] = df["GEO_ID"].apply(extract_zip)

    # DP04_0001E = total housing units
    # DP04_0002E = occupied housing units
    # DP04_0046PE = owner occupied %
    # DP04_0037E = median number of rooms
    col_map = {
        "0001E": "total_units",
        "0002E": "occupied_units",
        "0046PE": "owner_occupied_pct",
        "0037E": "median_rooms",
    }

    out = pd.DataFrame()
    out["zip_code"] = df["zip_code"]

    for suffix, new_name in col_map.items():
        col = next((c for c in df.columns if suffix in c), None)
        if col:
            out[new_name] = pd.to_numeric(df[col], errors="coerce")
        else:
            print(f"  Warning: column with suffix {suffix} not found")
            out[new_name] = None

    out = out.dropna(subset=["total_units"])
    out = out[out["total_units"] > 0]
    print(f"  Housing rows: {len(out):,}")
    return out

if __name__ == "__main__":
    print("Processing Census income data...")
    income_raw = download_csv(
        "census/ACSST5Y2024.S1901-Data.csv",
        low_memory=False
    )
    income_df = process_income(income_raw)

    print("Processing Census housing data...")
    housing_raw = download_csv(
        "census/ACSDP5Y2024.DP04-Data.csv",
        low_memory=False
    )
    housing_df = process_housing(housing_raw)

    print("Joining Census datasets...")
    combined = income_df.merge(housing_df, on="zip_code", how="inner")
    combined = combined.sort_values("zip_code")
    print(f"Combined Census rows: {len(combined):,}")

    upload_csv(combined, "census/census_combined_clean.csv")
    print("Census processing complete.")