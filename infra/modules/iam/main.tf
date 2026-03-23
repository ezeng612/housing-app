locals {
  services = [
    "neighborhood-svc",
    "predictor-svc",
    "dashboard-svc",
    "recommender-svc"
  ]
}

resource "google_service_account" "services" {
  for_each     = toset(local.services)
  account_id   = each.key
  display_name = "${each.key} service account"
  project      = var.project_id
}

resource "google_project_iam_member" "neighborhood_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.services["neighborhood-svc"].email}"
}

resource "google_project_iam_member" "predictor_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.services["predictor-svc"].email}"
}

resource "google_project_iam_member" "dashboard_bq_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.services["dashboard-svc"].email}"
}

resource "google_project_iam_member" "dashboard_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.services["dashboard-svc"].email}"
}

resource "google_project_iam_member" "recommender_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.services["recommender-svc"].email}"
}

resource "google_project_iam_member" "secret_access" {
  for_each = toset(local.services)
  project  = var.project_id
  role     = "roles/secretmanager.secretAccessor"
  member   = "serviceAccount:${google_service_account.services[each.key].email}"
}