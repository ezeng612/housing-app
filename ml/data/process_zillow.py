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

# Column names that identify a row — everything else is a date column
METRO_ID_COLS = ["RegionID", "SizeRank", "RegionName", "RegionType", "StateName"]
ZIP_ID_COLS   = ["RegionID", "SizeRank", "RegionName", "RegionType",
                 "StateName", "State", "City", "Metro", "CountyName"]

def melt_zillow(df, value_name, id_cols):
    date_cols = [c for c in df.columns if c not in id_cols]
    long = df.melt(
        id_vars=id_cols,
        value_vars=date_cols,
        var_name="date",
        value_name=value_name
    )
    long["date"]     = pd.to_datetime(long["date"], errors="coerce")
    long[value_name] = pd.to_numeric(long[value_name], errors="coerce")
    long             = long.dropna(subset=["date", value_name])
    return long

def process_metro_files():
    print("Processing metro-level Zillow files...")

    metro_datasets = [
        ("zillow/Metro_median_sale_price_uc_sfr_month.csv",        "median_sale_price"),
        ("zillow/Metro_mean_doz_pending_uc_sfrcondo_month.csv",     "days_to_pending"),
        ("zillow/Metro_market_temp_index_uc_sfrcondo_month.csv",    "market_heat_index"),
        ("zillow/Metro_invt_fs_uc_sfrcondo_month.csv",              "for_sale_inventory"),
        ("zillow/Metro_pct_sold_above_list_uc_sfrcondo_month.csv",  "pct_sold_above_list"),
    ]

    dfs = []
    for blob_name, value_name in metro_datasets:
        print(f"  Loading {blob_name}...")
        raw = download_csv(blob_name)
        df  = melt_zillow(raw, value_name, METRO_ID_COLS)
        df  = df.rename(columns={"RegionName": "metro_area", "StateName": "state"})
        df  = df[["metro_area", "state", "date", value_name]]
        dfs.append(df.set_index(["metro_area", "state", "date"]))

    combined = dfs[0].join(dfs[1:], how="outer").reset_index()
    combined = combined.sort_values(["metro_area", "date"])
    print(f"  Metro combined: {len(combined):,} rows")
    upload_csv(combined, "zillow/metro_combined_clean.csv")

def process_zip_files():
    print("Processing zip-level Zillow files...")

    zip_datasets = [
        ("zillow/Zip_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv",    "zhvi_sfr"),
        ("zillow/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv","zhvi_sfrcondo"),
        ("zillow/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv",            "zori_rent"),
    ]

    dfs = []
    for blob_name, value_name in zip_datasets:
        print(f"  Loading {blob_name}...")
        raw = download_csv(blob_name)
        df  = melt_zillow(raw, value_name, ZIP_ID_COLS)
        df  = df.rename(columns={
            "RegionName": "zip_code",
            "City":       "city",
            "State":      "state",
            "Metro":      "metro_area",
            "CountyName": "county"
        })
        df  = df[["zip_code", "city", "state", "metro_area",
                  "county", "date", value_name]]
        dfs.append(df.set_index(["zip_code", "city", "state",
                                  "metro_area", "county", "date"]))

    combined = dfs[0].join(dfs[1:], how="outer").reset_index()
    combined = combined.sort_values(["zip_code", "date"])
    print(f"  Zip combined: {len(combined):,} rows")
    upload_csv(combined, "zillow/zip_combined_clean.csv")

if __name__ == "__main__":
    process_metro_files()
    process_zip_files()
    print("Zillow processing complete.")