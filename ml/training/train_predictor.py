from google.cloud import bigquery, storage
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error
import joblib
import io
import os

PROJECT_ID = "housing-app-490522"

def load_training_data():
    print("Loading training data from GCS...")
    client = storage.Client(project=PROJECT_ID)
    bucket = client.bucket(f"{PROJECT_ID}-processed-data")
    blob   = bucket.blob("ml/training_data.csv")
    df     = pd.read_csv(io.BytesIO(blob.download_as_bytes()))
    print(f"Loaded {len(df):,} rows")
    return df

def prepare_features(df):
    print("Preparing features...")

    # Features to use for training
    feature_cols = [
        'year', 'month',
        'median_income', 'owner_occupied_pct', 'total_units', 'median_rooms',
        'education_index', 'academic_score', 'total_schools',
        'metro_median_price', 'metro_days_pending', 'metro_heat_index',
        'metro_inventory', 'metro_pct_above_list',
        'price_yoy_pct', 'price_3mo_pct',
        'zori_rent', 'zhvi_sfrcondo',
        'safety_index', 'air_quality_index', 'natural_amenity_score',
    ]

    # Encode state as categorical
    le_state = LabelEncoder()
    df['state_encoded'] = le_state.fit_transform(df['state'].fillna('UNKNOWN'))
    feature_cols.append('state_encoded')

    # Fill nulls with median
    for col in feature_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = df[col].fillna(df[col].median())

    X = df[feature_cols].values
    y = df['home_value'].values

    print(f"Features: {len(feature_cols)}")
    print(f"Training samples: {len(X):,}")

    return X, y, feature_cols, le_state

def train_model(X, y, feature_cols):
    print("Splitting train/test...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42
    )

    print("Training XGBoost model...")
    model = xgb.XGBRegressor(
        n_estimators=500,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        early_stopping_rounds=20,
        eval_metric='mae',
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50
    )

    # Evaluate
    y_pred = model.predict(X_test)
    mae    = mean_absolute_error(y_test, y_pred)
    mape   = mean_absolute_percentage_error(y_test, y_pred) * 100

    print(f"\nModel performance:")
    print(f"  MAE:  ${mae:,.0f}")
    print(f"  MAPE: {mape:.1f}%")

    # Feature importance
    importance = pd.DataFrame({
        'feature':    feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    print("\nTop 10 most important features:")
    print(importance.head(10).to_string())

    return model, mae, mape

def save_model(model, le_state, feature_cols, mae, mape):
    print("\nSaving model to GCS...")

    # Save model
    model_buffer = io.BytesIO()
    joblib.dump({
        'model':        model,
        'label_encoder': le_state,
        'feature_cols': feature_cols,
        'mae':          mae,
        'mape':         mape,
    }, model_buffer)
    model_buffer.seek(0)

    client = storage.Client(project=PROJECT_ID)
    bucket = client.bucket(f"{PROJECT_ID}-processed-data")
    blob   = bucket.blob("ml/predictor_model.joblib")
    blob.upload_from_file(model_buffer, content_type="application/octet-stream")
    print(f"Model saved to gs://{PROJECT_ID}-processed-data/ml/predictor_model.joblib")
    print(f"Final MAE: ${mae:,.0f} | MAPE: {mape:.1f}%")

if __name__ == "__main__":
    df                           = load_training_data()
    X, y, feature_cols, le_state = prepare_features(df)
    model, mae, mape             = train_model(X, y, feature_cols)
    save_model(model, le_state, feature_cols, mae, mape)
    print("\nTraining complete.")