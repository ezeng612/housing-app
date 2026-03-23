import pandas as pd
from google.cloud import storage, bigquery
import io

PROJECT_ID  = "housing-app-490522"
RAW_BUCKET  = f"{PROJECT_ID}-raw-data"

def clean_county(name):
    if pd.isna(name):
        return None
    name = str(name).strip().upper()
    for suffix in [' COUNTY', ' PARISH', ' BOROUGH',
                   ' CENSUS AREA', ' CITY AND BOROUGH',
                   ' MUNICIPALITY', ' DISTRICT']:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name

def zip_to_county():
    print("Building county-zip crosswalk from Zillow data...")

    client = storage.Client(project=PROJECT_ID)
    bucket = client.bucket(RAW_BUCKET)
    blob   = bucket.blob(
        "zillow/Zip_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv"
    )
    df = pd.read_csv(
        io.BytesIO(blob.download_as_bytes()),
        usecols=['RegionName', 'State', 'City', 'Metro', 'CountyName'],
        low_memory=False
    )

    df = df.rename(columns={
        'RegionName': 'zip_code',
        'State':      'state',
        'City':       'city',
        'Metro':      'metro_area',
        'CountyName': 'county_raw',
    })

    df['zip_code']    = df['zip_code'].astype(str).str.zfill(5)
    df['state']       = df['state'].astype(str).str.strip().str.upper()
    df['county_raw']  = df['county_raw'].astype(str).str.strip()
    df['county_clean']= df['county_raw'].apply(clean_county)

    crosswalk = df[['zip_code', 'state', 'city',
                    'metro_area', 'county_raw', 'county_clean']].drop_duplicates()
    crosswalk = crosswalk.dropna(subset=['zip_code', 'county_clean'])

    print(f"Crosswalk rows: {len(crosswalk):,}")
    print(f"Unique zip codes: {crosswalk['zip_code'].nunique():,}")
    print(f"Unique counties: {crosswalk['county_clean'].nunique():,}")
    print(f"Sample:")
    print(crosswalk.head(5).to_string())

    # Load into BigQuery
    bq_client  = bigquery.Client(project=PROJECT_ID)
    table_id   = f"{PROJECT_ID}.housing_data.county_zip_crosswalk"
    job_config = bigquery.LoadJobConfig(
        write_disposition="WRITE_TRUNCATE",
        schema=[
            bigquery.SchemaField("zip_code",     "STRING"),
            bigquery.SchemaField("state",        "STRING"),
            bigquery.SchemaField("city",         "STRING"),
            bigquery.SchemaField("metro_area",   "STRING"),
            bigquery.SchemaField("county_raw",   "STRING"),
            bigquery.SchemaField("county_clean", "STRING"),
        ]
    )
    job = bq_client.load_table_from_dataframe(
        crosswalk, table_id, job_config=job_config
    )
    job.result()
    print(f"Loaded into BigQuery: {table_id}")
    return crosswalk

if __name__ == "__main__":
    zip_to_county()