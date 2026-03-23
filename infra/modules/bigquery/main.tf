resource "google_bigquery_dataset" "housing" {
  dataset_id                 = "housing_data"
  description                = "Housing market data for the housing app"
  location                   = var.region
  project                    = var.project_id
  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "metro_market" {
  dataset_id          = google_bigquery_dataset.housing.dataset_id
  table_id            = "metro_market_data"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "MONTH"
    field = "date"
  }

  schema = jsonencode([
    { name = "metro_area",          type = "STRING",  mode = "REQUIRED" },
    { name = "state",               type = "STRING",  mode = "NULLABLE" },
    { name = "date",                type = "DATE",    mode = "REQUIRED" },
    { name = "median_sale_price",   type = "FLOAT64", mode = "NULLABLE" },
    { name = "days_to_pending",     type = "FLOAT64", mode = "NULLABLE" },
    { name = "market_heat_index",   type = "FLOAT64", mode = "NULLABLE" },
    { name = "for_sale_inventory",  type = "FLOAT64", mode = "NULLABLE" },
    { name = "pct_sold_above_list", type = "FLOAT64", mode = "NULLABLE" }
  ])
}

resource "google_bigquery_table" "zip_market" {
  dataset_id          = google_bigquery_dataset.housing.dataset_id
  table_id            = "zip_market_data"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "MONTH"
    field = "date"
  }

  schema = jsonencode([
    { name = "zip_code",    type = "STRING",  mode = "REQUIRED" },
    { name = "city",        type = "STRING",  mode = "NULLABLE" },
    { name = "state",       type = "STRING",  mode = "NULLABLE" },
    { name = "metro_area",  type = "STRING",  mode = "NULLABLE" },
    { name = "county",      type = "STRING",  mode = "NULLABLE" },
    { name = "date",        type = "DATE",    mode = "REQUIRED" },
    { name = "zhvi_sfr",    type = "FLOAT64", mode = "NULLABLE" },
    { name = "zhvi_sfrcondo", type = "FLOAT64", mode = "NULLABLE" },
    { name = "zori_rent",   type = "FLOAT64", mode = "NULLABLE" }
  ])
}

resource "google_bigquery_table" "census" {
  dataset_id          = google_bigquery_dataset.housing.dataset_id
  table_id            = "census_data"
  project             = var.project_id
  deletion_protection = false

  schema = jsonencode([
    { name = "zip_code",           type = "STRING",  mode = "REQUIRED" },
    { name = "median_income",      type = "FLOAT64", mode = "NULLABLE" },
    { name = "income_margin",      type = "FLOAT64", mode = "NULLABLE" },
    { name = "total_units",        type = "FLOAT64", mode = "NULLABLE" },
    { name = "occupied_units",     type = "FLOAT64", mode = "NULLABLE" },
    { name = "owner_occupied_pct", type = "FLOAT64", mode = "NULLABLE" },
    { name = "median_rooms",       type = "FLOAT64", mode = "NULLABLE" }
  ])
}

resource "google_bigquery_table" "education" {
  dataset_id          = google_bigquery_dataset.housing.dataset_id
  table_id            = "education_data"
  project             = var.project_id
  deletion_protection = false

  schema = jsonencode([
    { name = "zip_code",        type = "STRING",  mode = "REQUIRED" },
    { name = "total_schools",   type = "INT64",   mode = "NULLABLE" },
    { name = "charter_schools", type = "INT64",   mode = "NULLABLE" },
    { name = "charter_pct",     type = "FLOAT64", mode = "NULLABLE" },
    { name = "academic_score",  type = "FLOAT64", mode = "NULLABLE" },
    { name = "education_index", type = "FLOAT64", mode = "NULLABLE" }
  ])
}

resource "google_bigquery_table" "neighborhood_features" {
  dataset_id          = google_bigquery_dataset.housing.dataset_id
  table_id            = "neighborhood_features"
  project             = var.project_id
  deletion_protection = false
  schema = jsonencode([
    { name = "zip_code",           type = "STRING",  mode = "REQUIRED" },
    { name = "city",               type = "STRING",  mode = "NULLABLE" },
    { name = "state",              type = "STRING",  mode = "NULLABLE" },
    { name = "metro_area",         type = "STRING",  mode = "NULLABLE" },
    { name = "zhvi_sfr",           type = "FLOAT64", mode = "NULLABLE" },
    { name = "zhvi_sfrcondo",      type = "FLOAT64", mode = "NULLABLE" },
    { name = "zori_rent",          type = "FLOAT64", mode = "NULLABLE" },
    { name = "median_sale_price",  type = "FLOAT64", mode = "NULLABLE" },
    { name = "days_to_pending",    type = "FLOAT64", mode = "NULLABLE" },
    { name = "market_heat_index",  type = "FLOAT64", mode = "NULLABLE" },
    { name = "median_income",      type = "FLOAT64", mode = "NULLABLE" },
    { name = "owner_occupied_pct", type = "FLOAT64", mode = "NULLABLE" },
    { name = "total_schools",      type = "INT64",   mode = "NULLABLE" },
    { name = "academic_score",     type = "FLOAT64", mode = "NULLABLE" },
    { name = "education_index",    type = "FLOAT64", mode = "NULLABLE" },
    { name = "last_updated",       type = "DATE",    mode = "REQUIRED" }
  ])
}