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
    if 'US' in geo_id:
        return geo_id.split('US')[-1].strip().zfill(5)
    return geo_id[-5:].zfill(5)

def process_income(df):
    print("  Processing income data...")
    df['zip_code']      = df['GEO_ID'].apply(extract_zip)
    df['median_income'] = pd.to_numeric(df.get('S1901_C01_012E'), errors='coerce')
    df['income_margin'] = pd.to_numeric(df.get('S1901_C01_012M'), errors='coerce')
    out = df[['zip_code', 'median_income', 'income_margin']]
    out = out.dropna(subset=['median_income'])
    out = out[out['median_income'] > 0]
    print(f"  Income rows: {len(out):,}")
    return out

def process_housing(df):
    print("  Processing housing data...")
    df['zip_code']          = df['GEO_ID'].apply(extract_zip)
    df['total_units']       = pd.to_numeric(df.get('DP04_0001E'), errors='coerce')
    df['occupied_units']    = pd.to_numeric(df.get('DP04_0002E'), errors='coerce')
    df['owner_occupied_pct']= pd.to_numeric(df.get('DP04_0046PE'), errors='coerce')
    df['median_rooms']      = pd.to_numeric(df.get('DP04_0037E'), errors='coerce')
    out = df[['zip_code', 'total_units', 'occupied_units',
              'owner_occupied_pct', 'median_rooms']]
    out = out.dropna(subset=['total_units'])
    out = out[out['total_units'] > 0]
    print(f"  Housing rows: {len(out):,}")
    return out

if __name__ == "__main__":
    print("Processing Census income data...")
    income_raw = download_csv(
        "census/ACSST5Y2024.S1901-Data.csv",
        low_memory=False,
        skiprows=[1]
    )
    income_df = process_income(income_raw)

    print("Processing Census housing data...")
    housing_raw = download_csv(
        "census/ACSDP5Y2024.DP04-Data.csv",
        low_memory=False,
        skiprows=[1]
    )
    housing_df = process_housing(housing_raw)

    print("Joining Census datasets...")
    combined = income_df.merge(housing_df, on="zip_code", how="inner")
    combined = combined.sort_values("zip_code")
    print(f"Combined Census rows: {len(combined):,}")

    upload_csv(combined, "census/census_combined_clean.csv")
    print("Census processing complete.")