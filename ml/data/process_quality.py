import pandas as pd
import numpy as np
from google.cloud import storage, bigquery
import io

PROJECT_ID  = "housing-app-490522"
RAW_BUCKET  = f"{PROJECT_ID}-raw-data"
PROC_BUCKET = f"{PROJECT_ID}-processed-data"

def download_file(blob_name, **kwargs):
    client = storage.Client(project=PROJECT_ID)
    blob   = client.bucket(RAW_BUCKET).blob(blob_name)
    data   = blob.download_as_bytes()
    if blob_name.endswith('.xls') or blob_name.endswith('.xlsx'):
        return pd.read_excel(io.BytesIO(data), **kwargs)
    return pd.read_csv(io.BytesIO(data), **kwargs)

def upload_csv(df, blob_name):
    client = storage.Client(project=PROJECT_ID)
    blob   = client.bucket(PROC_BUCKET).blob(blob_name)
    blob.upload_from_string(df.to_csv(index=False), content_type="text/csv")
    print(f"Uploaded {blob_name} ({len(df):,} rows)")

def load_crosswalk():
    """Load county-zip crosswalk from BigQuery."""
    print("Loading county-zip crosswalk...")
    bq     = bigquery.Client(project=PROJECT_ID)
    sql    = f"""
        SELECT zip_code, state, county_clean
        FROM `{PROJECT_ID}.housing_data.county_zip_crosswalk`
    """
    df     = bq.query(sql).to_dataframe()
    df['county_clean'] = df['county_clean'].str.upper().str.strip()
    df['state']        = df['state'].str.upper().str.strip()
    print(f"Crosswalk loaded: {len(df):,} zip-county pairs")
    return df

def clean_county(name):
    if pd.isna(name):
        return None
    name = str(name).strip().upper()
    for suffix in [' COUNTY', ' PARISH', ' BOROUGH',
                   ' CENSUS AREA', ' CITY AND BOROUGH',
                   ' MUNICIPALITY', ' DISTRICT', ' CITY']:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name

# ── Process crime data ────────────────────────────────────────────────────────

def process_crime(df, crosswalk):
    print("Processing crime data...")
    df.columns = [c.strip().upper() for c in df.columns]

    # Extract state and county directly from county_name
    df['state_abbr']   = df['COUNTY_NAME'].str.strip().str.extract(
        r',\s*([A-Za-z]{2})\s*$')[0].str.strip().str.upper()
    df['county_clean'] = df['COUNTY_NAME'].str.strip().str.replace(
        r',\s*[A-Za-z]{2}\s*$', '', regex=True
    ).str.strip().str.upper()

    # Remove suffixes but preserve CITY for matching
    for suffix in [' COUNTY', ' PARISH', ' BOROUGH',
                   ' CENSUS AREA', ' MUNICIPALITY']:
        df['county_clean'] = df['county_clean'].str.replace(
            suffix + '$', '', regex=True).str.strip()

    # Calculate crime metrics
    for col in ['MURDER','RAPE','ROBBERY','AGASSLT',
                'BURGLRY','LARCENY','MVTHEFT']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    df['population']          = pd.to_numeric(df['POPULATION'], errors='coerce')
    df['violent_crimes']      = df['MURDER'] + df['RAPE'] + df['ROBBERY'] + df['AGASSLT']
    df['property_crimes']     = df['BURGLRY'] + df['LARCENY'] + df['MVTHEFT']
    df['violent_crime_rate']  = (
        df['violent_crimes']  / df['population'].replace(0,1) * 100000
    ).round(1)
    df['property_crime_rate'] = (
        df['property_crimes'] / df['population'].replace(0,1) * 100000
    ).round(1)

    max_v = df['violent_crime_rate'].quantile(0.95)
    max_p = df['property_crime_rate'].quantile(0.95)
    df['safety_index'] = (
        100 - (
            df['violent_crime_rate'].clip(0, max_v)  / max_v  * 60 +
            df['property_crime_rate'].clip(0, max_p) / max_p  * 40
        )
    ).round(1).clip(0, 100)

    county_df = df[['county_clean', 'state_abbr',
                    'violent_crime_rate', 'property_crime_rate',
                    'safety_index']].dropna()

    # Try exact match first
    merged = crosswalk.merge(
        county_df,
        left_on=['county_clean', 'state'],
        right_on=['county_clean', 'state_abbr'],
        how='inner'
    )

    # For unmatched zips try fuzzy match by removing spaces and punctuation
    if len(merged) < 1000:
        print("  Trying fuzzy county match...")
        crosswalk['county_fuzzy'] = crosswalk['county_clean'].str.replace(
            r'[^A-Z0-9]', '', regex=True)
        county_df['county_fuzzy'] = county_df['county_clean'].str.replace(
            r'[^A-Z0-9]', '', regex=True)
        merged2 = crosswalk.merge(
            county_df,
            left_on=['county_fuzzy', 'state'],
            right_on=['county_fuzzy', 'state_abbr'],
            how='inner'
        )
        if len(merged2) > len(merged):
            merged = merged2
            print(f"  Fuzzy match improved results")

    result = merged[['zip_code', 'violent_crime_rate',
                     'property_crime_rate', 'safety_index']].drop_duplicates('zip_code')

    print(f"  Crime matched: {len(result):,} zip codes")
    return result

# ── Process air quality ───────────────────────────────────────────────────────

def process_air_quality(df, crosswalk):
    print("Processing air quality data...")
    df.columns = [c.strip().strip('"') for c in df.columns]

    df = df.rename(columns={
        'State':          'state',
        'County':         'county',
        'Median AQI':     'median_aqi',
        'Good Days':      'good_days',
        'Days with AQI':  'days_with_aqi',
        'Unhealthy Days': 'unhealthy_days',
        'Hazardous Days': 'hazardous_days',
    })

    df['median_aqi']     = pd.to_numeric(df['median_aqi'],     errors='coerce')
    df['good_days']      = pd.to_numeric(df['good_days'],      errors='coerce')
    df['days_with_aqi']  = pd.to_numeric(df['days_with_aqi'],  errors='coerce')
    df['unhealthy_days'] = pd.to_numeric(df['unhealthy_days'], errors='coerce')

    df['good_day_pct']   = (df['good_days'] /
                            df['days_with_aqi'].replace(0,1) * 100).round(1)

    max_aqi = df['median_aqi'].quantile(0.95)
    df['air_quality_index'] = (
        100 - (df['median_aqi'].clip(0, max_aqi) / max_aqi * 100)
    ).round(1).clip(0, 100)

    df['county_clean'] = df['county'].apply(clean_county)
    df['state_upper']  = df['state'].str.upper().str.strip()

    # State names to abbreviations
    state_map = {
        'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR',
        'CALIFORNIA':'CA','COLORADO':'CO','CONNECTICUT':'CT','DELAWARE':'DE',
        'FLORIDA':'FL','GEORGIA':'GA','HAWAII':'HI','IDAHO':'ID',
        'ILLINOIS':'IL','INDIANA':'IN','IOWA':'IA','KANSAS':'KS',
        'KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD',
        'MASSACHUSETTS':'MA','MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS',
        'MISSOURI':'MO','MONTANA':'MT','NEBRASKA':'NE','NEVADA':'NV',
        'NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY',
        'NORTH CAROLINA':'NC','NORTH DAKOTA':'ND','OHIO':'OH','OKLAHOMA':'OK',
        'OREGON':'OR','PENNSYLVANIA':'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC',
        'SOUTH DAKOTA':'SD','TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT',
        'VERMONT':'VT','VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV',
        'WISCONSIN':'WI','WYOMING':'WY','DISTRICT OF COLUMBIA':'DC'
    }
    df['state_abbr'] = df['state_upper'].map(state_map)

    county_df = df[['county_clean', 'state_abbr',
                    'median_aqi', 'good_day_pct',
                    'air_quality_index']].dropna()

    merged = crosswalk.merge(
        county_df,
        left_on=['county_clean', 'state'],
        right_on=['county_clean', 'state_abbr'],
        how='inner'
    )

    result = merged[['zip_code', 'median_aqi',
                     'good_day_pct', 'air_quality_index']].drop_duplicates('zip_code')

    print(f"  Air quality matched: {len(result):,} zip codes")
    return result

# ── Process natural amenities ─────────────────────────────────────────────────

def process_natural_amenities(df, crosswalk):
    print("Processing natural amenities data...")

    cols = [
        'fips_code', 'fips_used', 'state', 'county', 'census_division',
        'rural_urban_code', 'urban_influence', 'jan_temp', 'jan_sun',
        'jul_temp', 'jul_humidity', 'topography_code', 'water_area_pct',
        'water_area_log', 'jan_temp_z', 'jan_sun_z', 'jul_temp_z',
        'jul_humidity_z', 'topography_z', 'water_area_z',
        'amenity_scale', 'amenity_rank'
    ]
    df.columns = cols[:len(df.columns)]

    df['fips_code']    = df['fips_code'].astype(str).str.zfill(5).str[:5]
    df['state']        = df['state'].astype(str).str.strip().str.upper()
    df['county']       = df['county'].astype(str).str.strip().str.upper()
    df['county_clean'] = df['county'].apply(clean_county)
    df['amenity_rank'] = pd.to_numeric(df['amenity_rank'], errors='coerce')
    df['topography_z'] = pd.to_numeric(df['topography_z'], errors='coerce')
    df['water_area_pct']= pd.to_numeric(df['water_area_pct'], errors='coerce')

    df['natural_amenity_score'] = (
        (df['amenity_rank'] - 1) / 6 * 100
    ).round(1)

    county_df = df[['county_clean', 'state', 'amenity_rank',
                    'natural_amenity_score', 'topography_z',
                    'water_area_pct']].dropna(subset=['amenity_rank'])

    merged = crosswalk.merge(
        county_df,
        left_on=['county_clean', 'state'],
        right_on=['county_clean', 'state'],
        how='inner'
    )

    result = merged[['zip_code', 'amenity_rank', 'natural_amenity_score',
                     'topography_z', 'water_area_pct']].drop_duplicates('zip_code')

    print(f"  Natural amenities matched: {len(result):,} zip codes")
    return result

# ── Load into BigQuery ────────────────────────────────────────────────────────

def load_to_bigquery(df, table_id, schema):
    bq         = bigquery.Client(project=PROJECT_ID)
    job_config = bigquery.LoadJobConfig(
        write_disposition="WRITE_TRUNCATE",
        schema=schema
    )
    job = bq.load_table_from_dataframe(df, table_id, job_config=job_config)
    job.result()
    print(f"Loaded {len(df):,} rows into {table_id}")

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Processing quality datasets")
    print("=" * 60)

    crosswalk = load_crosswalk()

    # Crime
    print("\n1. Crime data")
    crime_raw = download_file(
        "quality/crime_data_w_population_and_crime_rate.csv",
        low_memory=False
    )
    crime_df = process_crime(crime_raw, crosswalk)
    upload_csv(crime_df, "quality/crime_clean.csv")
    load_to_bigquery(
        crime_df,
        f"{PROJECT_ID}.housing_data.crime_data",
        [
            bigquery.SchemaField("zip_code",            "STRING"),
            bigquery.SchemaField("violent_crime_rate",  "FLOAT64"),
            bigquery.SchemaField("property_crime_rate", "FLOAT64"),
            bigquery.SchemaField("safety_index",        "FLOAT64"),
        ]
    )

    # Air quality
    print("\n2. Air quality data")
    aqi_raw = download_file("quality/annual_aqi_by_county_2025.csv")
    aqi_df  = process_air_quality(aqi_raw, crosswalk)
    upload_csv(aqi_df, "quality/air_quality_clean.csv")
    load_to_bigquery(
        aqi_df,
        f"{PROJECT_ID}.housing_data.air_quality_data",
        [
            bigquery.SchemaField("zip_code",          "STRING"),
            bigquery.SchemaField("median_aqi",        "FLOAT64"),
            bigquery.SchemaField("good_day_pct",      "FLOAT64"),
            bigquery.SchemaField("air_quality_index", "FLOAT64"),
        ]
    )

    # Natural amenities
    print("\n3. Natural amenities")
    nat_raw = download_file("quality/natamenf_1_.xls", skiprows=104)
    nat_df  = process_natural_amenities(nat_raw, crosswalk)
    upload_csv(nat_df, "quality/natural_amenities_clean.csv")
    load_to_bigquery(
        nat_df,
        f"{PROJECT_ID}.housing_data.natural_amenities_data",
        [
            bigquery.SchemaField("zip_code",              "STRING"),
            bigquery.SchemaField("amenity_rank",          "FLOAT64"),
            bigquery.SchemaField("natural_amenity_score", "FLOAT64"),
            bigquery.SchemaField("topography_z",          "FLOAT64"),
            bigquery.SchemaField("water_area_pct",        "FLOAT64"),
        ]
    )

    print("\n" + "=" * 60)
    print("All quality datasets processed successfully")
    print("=" * 60)