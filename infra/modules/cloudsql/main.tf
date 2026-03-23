resource "google_compute_global_address" "private_ip_range" {
  name          = "housing-db-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = var.network_id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = var.network_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

resource "google_sql_database_instance" "postgres" {
  name             = "housing-db"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier              = "db-g1-small"
    availability_type = "ZONAL"
    disk_size         = 20
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "housing" {
  name     = "housing"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

resource "google_sql_user" "app_user" {
  name     = "housing_user"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
  project  = var.project_id
}