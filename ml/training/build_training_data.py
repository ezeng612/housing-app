from google.cloud import bigquery, storage
import pandas as pd
import io

PROJECT_ID = "housing-app-490522"

def build_training_dataset():
    print("Building training dataset from BigQuery...")

    client = bigquery.Client(project=PROJECT_ID)

    sql = """
    SELECT
        z.zhvi_sfr AS home_value,
        z.zip_code,
        z.state,
        z.metro_area,
        EXTRACT(YEAR  FROM z.date) AS year,
        EXTRACT(MONTH FROM z.date) AS month,
        z.zhvi_sfr AS current_zhvi,
        z.zhvi_sfrcondo,
        z.zori_rent,
        SAFE_DIVIDE(
            z.zhvi_sfr - LAG(z.zhvi_sfr, 12) OVER (
                PARTITION BY z.zip_code ORDER BY z.date),
            LAG(z.zhvi_sfr, 12) OVER (
                PARTITION BY z.zip_code ORDER BY z.date)
        ) * 100 AS price_yoy_pct,
        SAFE_DIVIDE(
            z.zhvi_sfr - LAG(z.zhvi_sfr, 3) OVER (
                PARTITION BY z.zip_code ORDER BY z.date),
            LAG(z.zhvi_sfr, 3) OVER (
                PARTITION BY z.zip_code ORDER BY z.date)
        ) * 100 AS price_3mo_pct,
        c.median_income,
        c.owner_occupied_pct,
        c.total_units,
        c.median_rooms,
        e.education_index,
        e.academic_score,
        e.total_schools,
        m.median_sale_price   AS metro_median_price,
        m.days_to_pending     AS metro_days_pending,
        m.market_heat_index   AS metro_heat_index,
        m.for_sale_inventory  AS metro_inventory,
        m.pct_sold_above_list AS metro_pct_above_list,
        nf.safety_index,
        nf.air_quality_index,
        nf.natural_amenity_score
    FROM `{project}.housing_data.zip_market_data` z
    LEFT JOIN `{project}.housing_data.census_data` c
        ON z.zip_code = c.zip_code
    LEFT JOIN `{project}.housing_data.education_data` e
        ON z.zip_code = e.zip_code
    LEFT JOIN `{project}.housing_data.metro_market_data` m
        ON z.metro_area = m.metro_area
        AND z.date = m.date
    LEFT JOIN `{project}.housing_data.neighborhood_features` nf
        ON z.zip_code = nf.zip_code
    WHERE z.zhvi_sfr IS NOT NULL
    AND z.date >= '2018-01-01'
    AND c.median_income IS NOT NULL
    ORDER BY z.zip_code, z.date
    """.format(project=PROJECT_ID)

    print("Querying BigQuery...")
    df = client.query(sql).to_dataframe()
    print(f"Raw dataset: {len(df):,} rows, {len(df.columns)} columns")

    df = df.dropna(subset=['home_value'])
    print(f"After dropping nulls: {len(df):,} rows")

    return df

if __name__ == "__main__":
    df = build_training_dataset()
    print("\nSample:")
    print(df.head())
    print("\nFeature stats:")
    print(df.describe())

    client_gcs = storage.Client(project=PROJECT_ID)
    bucket     = client_gcs.bucket(f"{PROJECT_ID}-processed-data")
    blob       = bucket.blob("ml/training_data.csv")
    blob.upload_from_string(df.to_csv(index=False), content_type="text/csv")
    print(f"\nSaved {len(df):,} rows to gs://{PROJECT_ID}-processed-data/ml/training_data.csv")
