# Dwellr — Housing Intelligence Platform

A full-stack housing intelligence web application built on Google Cloud Platform. Dwellr helps users find the best-value neighborhoods, predict home values using machine learning, and explore market trends using real data from Zillow, Census, FBI, EPA, and USDA.

**Live app**: https://frontend-262793354273.us-east1.run.app

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Sources](#data-sources)
- [Features](#features)
- [ML Predictor](#ml-predictor)
- [Infrastructure](#infrastructure)
- [CI/CD](#cicd)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [BigQuery Schema](#bigquery-schema)
- [API Reference](#api-reference)

---

## Architecture Overview

```
User Browser
     │
     ▼
React Frontend (Cloud Run)
     │
     ├── Neighborhood Service (Cloud Run)
     ├── Predictor Service   (Cloud Run)
     ├── Dashboard Service   (Cloud Run)
     └── Recommender Service (Cloud Run)
              │
              ▼
         BigQuery
     (housing_data dataset)
              │
              ▼
    GCS (raw + processed data)
         ML model (joblib)
```

All five services are containerized with Docker, stored in Artifact Registry, and deployed to Cloud Run. A Cloud Build trigger automatically rebuilds and redeploys all services on every push to the `main` branch.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Recharts, Lucide React |
| Backend | FastAPI (Python 3.11), Uvicorn |
| ML | XGBoost, scikit-learn, joblib |
| Database | BigQuery (analytics), Cloud SQL (PostgreSQL) |
| Storage | Google Cloud Storage |
| Infra | Terraform, GCP Cloud Run, Artifact Registry |
| CI/CD | Cloud Build (triggered on push to main) |
| Containerization | Docker |

---

## Project Structure

```
housing-app/
├── cloudbuild.yaml              # CI/CD — builds and deploys all 5 services
├── infra/                       # Terraform infrastructure
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── backend.tf
│   └── modules/
│       ├── vpc/
│       ├── cloudsql/
│       ├── firestore/
│       ├── iam/
│       ├── bigquery/
│       └── storage/
├── frontend/                    # React app
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── api/client.js        # API client for all 4 services
│   │   └── pages/
│   │       ├── Landing.jsx
│   │       ├── NeighborhoodExplorer.jsx
│   │       ├── MarketPredictor.jsx
│   │       ├── Dashboard.jsx
│   │       └── Recommender.jsx
│   ├── Dockerfile
│   └── nginx.conf
├── services/
│   ├── neighborhood/            # Neighborhood Explorer API
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── predictor/               # Market Value Predictor API
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── dashboard/               # Market Dashboard API
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── recommender/             # Personalized Recommender API
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
└── ml/
    ├── data/                    # Data processing scripts
    │   ├── process_zillow.py
    │   ├── process_census.py
    │   ├── process_education.py
    │   ├── process_quality.py
    │   └── zip_to_county.py
    └── training/                # ML model training
        ├── build_training_data.py
        └── train_predictor.py
```

---

## Data Sources

### Zillow Research
- **Zip_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv** — zip-level single family home values (ZHVI), monthly from 2000
- **Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv** — zip-level condo/SFR home values
- **Zip_zori_uc_sfrcondomfr_sm_sa_month.csv** — zip-level observed rent index (ZORI)
- **Metro_median_sale_price_uc_sfr_month.csv** — metro-level median sale prices
- **Metro_mean_doz_pending_uc_sfrcondo_month.csv** — days to pending
- **Metro_market_temp_index_uc_sfrcondo_month.csv** — market heat index
- **Metro_invt_fs_uc_sfrcondo_month.csv** — for-sale inventory
- **Metro_pct_sold_above_list_uc_sfrcondo_month.csv** — pct sold above list price

### US Census Bureau (ACS 5-Year Estimates 2024)
- **ACSST5Y2024.S1901** — median household income by zip code
- **ACSDP5Y2024.DP04** — housing characteristics (total units, occupied units, owner occupancy rate, median rooms)

### NCES Common Core of Data 2024-25
- **ccd_sch_029_2425_w_1a_073025.csv** — public school directory with zip codes, school types, charter status

### Stanford SEDA (Social Opportunity Data Archive) v6.0
- **seda_geodist_long_gys_6.0.csv** — academic achievement scores by school district, standardized test results

### FBI Crime Data (via Kaggle)
- **crime_data_w_population_and_crime_rate.csv** — county-level violent and property crime rates per 100K residents

### EPA Annual AQI Data 2025
- **annual_aqi_by_county_2025.csv** — county-level air quality index, good days, median AQI

### USDA Natural Amenities Scale
- **natamenf_1_.xls** — county-level natural amenity rankings based on climate, topography, and water features

---

## Features

### Neighborhood Explorer
- Search and filter 26,000+ zip codes across all 50 states
- Sort by value score, affordability, safety, air quality, natural amenities, education, home value, or income
- Filter by state, area type (urban/suburban/small town/rural), value tier, max budget, min safety, and min air quality
- Value tier classification: Hidden gem, Great value, Fair market, Premium, Overpriced
- Detail panel showing all quality of life metrics with score bars
- Crime detail (violent and property crime rates per 100K)
- Air quality detail (median AQI, good day percentage)
- 24-month price history
- Expandable metrics explanation panel
- Data coverage notice (metropolitan and suburban zip codes)

### Market Value Predictor
- XGBoost ML model trained on 2.2M zip-month records from 2018-2026
- 22 features including Zillow market signals, Census demographics, education quality, safety index, air quality, and natural amenities
- MAE: $4,978 | MAPE: 1.4%
- Property inputs: zip code, sqft, bedrooms, bathrooms, year built, condition, property type, garage
- ZHVI blending to prevent extreme predictions
- Investment forecast: 1, 2, 3 year projections with growth chart
- Neighborhood quality context in response (safety, air quality, amenities, value tier)
- Comparable neighborhoods within same metro area

### Market Dashboard
- National KPI cards: avg home value, median income, education index, total zip codes
- 24-month home value trend chart (ZHVI area chart)
- Rent trend chart (ZORI line chart)
- Top metros by home value (horizontal bar chart)
- Price distribution by value range (donut chart)
- State filter and time range selector (12m, 24m, 3y, 5y)

### Personalized Recommender ("For You")
- 3-step preference wizard: budget, priorities, lifestyle
- Recommendations scored against value score, safety, education, air quality, and affordability
- Value tier labels on each recommendation

---

## ML Predictor

### Model Architecture
- **Algorithm**: XGBoost gradient boosting regressor
- **Training data**: 2,224,304 rows (zip code × month, 2018–2026)
- **Features**: 22 (time, market signals, demographics, education, quality of life)
- **Target**: Zillow ZHVI (zip-level home value index)

### Feature Importance (Top 10)
| Feature | Importance |
|---|---|
| zhvi_sfrcondo | 58.2% |
| zori_rent | 14.5% |
| natural_amenity_score | 5.9% |
| median_income | 3.1% |
| median_rooms | 2.9% |
| state_encoded | 1.9% |
| academic_score | 1.9% |
| owner_occupied_pct | 1.9% |
| total_schools | 1.8% |
| metro_median_price | 1.6% |

### Performance
- **MAE**: $4,978
- **MAPE**: 1.4%
- **Model file**: `gs://housing-app-490522-processed-data/ml/predictor_model.joblib`

### ZHVI Blending
To prevent extreme predictions the model output is blended with the actual Zillow ZHVI:
- If ML prediction diverges >50% from ZHVI → 85% ZHVI + 15% ML
- Otherwise → 50% ZHVI + 50% ML

---

## Infrastructure

### GCP Project
- **Project ID**: housing-app-490522
- **Region**: us-east1

### Cloud Run Services
| Service | URL | Memory | CPU |
|---|---|---|---|
| Frontend | https://frontend-262793354273.us-east1.run.app | 256Mi | 1 |
| Neighborhood | https://neighborhood-svc-262793354273.us-east1.run.app | 512Mi | 1 |
| Predictor | https://predictor-svc-262793354273.us-east1.run.app | 1Gi | 2 |
| Dashboard | https://dashboard-svc-262793354273.us-east1.run.app | 512Mi | 1 |
| Recommender | https://recommender-svc-262793354273.us-east1.run.app | 512Mi | 1 |

### GCS Buckets
| Bucket | Purpose |
|---|---|
| housing-app-490522-raw-data | Raw downloaded datasets |
| housing-app-490522-processed-data | Cleaned CSVs and ML model |
| housing-app-490522-tfstate | Terraform state |

### Artifact Registry
- Repository: `us-east1-docker.pkg.dev/housing-app-490522/housing-app`
- Images: frontend, neighborhood-svc, predictor-svc, dashboard-svc, recommender-svc

---

## CI/CD

Cloud Build automatically triggers on every push to the `main` branch:

1. Builds all 5 Docker images with `--no-cache`
2. Pushes images to Artifact Registry
3. Deploys all 5 Cloud Run services

Frontend build args are injected at Docker build time via `cloudbuild.yaml` substitution variables so the Vite environment variables are correctly baked into the production bundle.

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop
- Google Cloud SDK (`gcloud`)
- Terraform

### Setup

```bash
# Clone the repo
git clone https://github.com/ezeng612/housing-app.git
cd housing-app

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r services/neighborhood/requirements.txt

# Install frontend dependencies
cd frontend
npm install
```

### Run services locally

```bash
# Start all four backend services
cd services/neighborhood && uvicorn main:app --port 8080 --reload
cd services/predictor    && uvicorn main:app --port 8081 --reload
cd services/dashboard    && uvicorn main:app --port 8082 --reload
cd services/recommender  && uvicorn main:app --port 8083 --reload

# Start the frontend
cd frontend && npm run dev
```

### Run data processing scripts

```bash
source .venv/bin/activate

# Process all datasets
python ml/data/process_zillow.py
python ml/data/process_census.py
python ml/data/process_education.py
python ml/data/zip_to_county.py
python ml/data/process_quality.py

# Build training data and retrain ML model
python ml/training/build_training_data.py
python ml/training/train_predictor.py
```

---

## Environment Variables

Create `frontend/.env` (gitignored — values are injected via Docker build args in CI):

```
VITE_NEIGHBORHOOD_API=https://neighborhood-svc-262793354273.us-east1.run.app
VITE_PREDICTOR_API=https://predictor-svc-262793354273.us-east1.run.app
VITE_DASHBOARD_API=https://dashboard-svc-262793354273.us-east1.run.app
VITE_RECOMMENDER_API=https://recommender-svc-262793354273.us-east1.run.app
```

Backend services use the `PROJECT_ID` environment variable set via Cloud Run:

```
PROJECT_ID=housing-app-490522
```

---

## Deployment

### Deploy via CI/CD (recommended)
```bash
git add .
git commit -m "your changes"
git push origin main
# Cloud Build automatically deploys all services
```

### Deploy manually
```bash
# Build and push a single service
cd services/neighborhood
docker build --no-cache -t us-east1-docker.pkg.dev/housing-app-490522/housing-app/neighborhood-svc:latest .
docker push us-east1-docker.pkg.dev/housing-app-490522/housing-app/neighborhood-svc:latest
gcloud run deploy neighborhood-svc \
  --image=us-east1-docker.pkg.dev/housing-app-490522/housing-app/neighborhood-svc:latest \
  --region=us-east1 \
  --project=housing-app-490522
```

---

## BigQuery Schema

### Dataset: `housing-app-490522.housing_data`

#### `neighborhood_features` (26,354 rows)
Core denormalized table — pre-joined snapshot of all data sources.

| Column | Type | Description |
|---|---|---|
| zip_code | STRING | 5-digit ZIP code |
| city | STRING | City name |
| state | STRING | State abbreviation |
| metro_area | STRING | Zillow metro area name |
| zhvi_sfr | FLOAT64 | Zillow Home Value Index (single family) |
| zhvi_sfrcondo | FLOAT64 | Zillow Home Value Index (SFR + condo) |
| zori_rent | FLOAT64 | Zillow Observed Rent Index |
| median_sale_price | FLOAT64 | Metro median sale price |
| days_to_pending | FLOAT64 | Metro avg days to pending |
| market_heat_index | FLOAT64 | Metro market heat index |
| median_income | FLOAT64 | Median household income (Census) |
| owner_occupied_pct | FLOAT64 | Owner-occupied housing % |
| total_schools | INT64 | Number of schools in zip |
| academic_score | FLOAT64 | SEDA academic achievement score |
| education_index | FLOAT64 | Composite education score (0-100) |
| safety_index | FLOAT64 | Composite safety score (0-100) |
| violent_crime_rate | FLOAT64 | Violent crimes per 100K residents |
| property_crime_rate | FLOAT64 | Property crimes per 100K residents |
| air_quality_index | FLOAT64 | Air quality score (0-100, higher = cleaner) |
| median_aqi | FLOAT64 | Median Air Quality Index |
| natural_amenity_score | FLOAT64 | USDA natural amenity score (0-100) |
| amenity_rank | FLOAT64 | USDA amenity rank (1-7) |
| topography_z | FLOAT64 | Topography z-score |
| water_area_pct | FLOAT64 | Water area percentage |
| price_to_income_ratio | FLOAT64 | Home value / median income |
| affordability_score | FLOAT64 | Affordability score (0-100) |
| value_score | FLOAT64 | Composite value score (0-100) |
| value_tier | STRING | Hidden gem / Great value / Fair market / Premium / Overpriced |
| total_population | FLOAT64 | Estimated zip population |
| pop_density_class | STRING | urban / suburban / small_town / rural |
| last_updated | DATE | Last updated date |

#### `zip_market_data` (6,337,960 rows)
Monthly zip-level Zillow data from 2000 to present.

#### `metro_market_data` (153,839 rows)
Monthly metro-level Zillow market data.

#### `census_data` (30,414 rows)
ZIP-level Census ACS data.

#### `education_data` (22,207 rows)
ZIP-level education metrics from NCES + SEDA.

#### `crime_data` (25,690 rows)
ZIP-level crime rates joined from FBI county data.

#### `air_quality_data` (14,452 rows)
ZIP-level EPA air quality data.

#### `natural_amenities_data` (24,916 rows)
ZIP-level USDA natural amenity scores.

#### `county_zip_crosswalk` (26,188 rows)
Maps ZIP codes to county names for joining county-level datasets.

---

## API Reference

### Neighborhood Service
`GET /neighborhoods/search` — Search neighborhoods with filters

| Param | Type | Description |
|---|---|---|
| state | string | State abbreviation |
| q | string | City or zip search |
| max_budget | float | Max home value |
| value_tier | string | Filter by tier |
| pop_class | string | urban/suburban/small_town/rural |
| min_safety | float | Minimum safety index |
| min_air_quality | float | Minimum air quality index |
| sort_by | string | value_score, affordability_score, zhvi_sfr, etc. |
| limit | int | Max results (default 20) |

`GET /neighborhoods/{zip_code}` — Get single neighborhood detail

`GET /neighborhoods/{zip_code}/history` — Get price history

### Predictor Service
`POST /predict` — Predict property value

```json
{
  "zip_code": "78701",
  "sqft": 1800,
  "bedrooms": 3,
  "bathrooms": 2,
  "year_built": 2005,
  "condition": "good",
  "property_type": "single_family",
  "garage": true,
  "forecast_years": 3
}
```

`GET /predict/comparable/{zip_code}` — Get comparable neighborhoods

`GET /market/trends/{zip_code}` — Get price trend history

### Dashboard Service
`GET /dashboard/kpis` — National/state KPI summary

`GET /dashboard/price-trends` — Price trend time series

`GET /dashboard/metros` — Top metros by home value

`GET /dashboard/value-distribution` — Price range distribution

### Recommender Service
`POST /recommend` — Get personalized neighborhood recommendations

---

## Value Scoring Methodology

### Value Score (0-100)
Composite score used to rank neighborhoods by overall value:

| Signal | Weight |
|---|---|
| Affordability score | 25% |
| Safety index | 20% |
| Education index | 20% |
| Air quality index | 15% |
| Natural amenity score | 12% |
| Market tier bonus | 8% |

### Value Tiers
Based on price-to-income ratio (home value ÷ median household income):

| Tier | Criteria |
|---|---|
| Hidden gem | PTI < 3x AND education ≥ 55 |
| Great value | PTI < 5x AND education ≥ 45 |
| Fair market | PTI < 8x |
| Premium | PTI < 12x |
| Overpriced | PTI ≥ 12x |

### Population Density Classes
Based on estimated zip code population (occupied units × 2.1):

| Class | Population |
|---|---|
| Urban | 8,000+ |
| Suburban | 2,500–8,000 |
| Small town | 800–2,500 |
| Rural | < 800 |

---


## License

MIT