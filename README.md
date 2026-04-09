# Dwellr — Housing Intelligence Platform

A full-stack housing intelligence web application built on Google Cloud Platform. Dwellr helps users find the best-value neighborhoods, predict home values using machine learning, and explore market trends using real data from Zillow, Census, FBI, EPA, and USDA.

**Live app**: https://frontend-262793354273.us-east1.run.app

---

## Table of Contents

- [Project Structure](#project-structure)
- [ML Predictor](#ml-predictor)
- [CI/CD](#cicd)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [BigQuery Schema](#bigquery-schema)
- [API Reference](#api-reference)

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

## ML Predictor

### Model Architecture
- **Algorithm**: XGBoost gradient boosting regressor
- **Training data**: 2,224,304 rows of Zillow Data
- **Features**: 22 (time series, education, quality of life, etc.)
- **Target**: Zillow ZHVI (zip-level home value index)

### Performance
- **MAE**: $4,978
- **MAPE**: 1.4%

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


## BigQuery Schema

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
