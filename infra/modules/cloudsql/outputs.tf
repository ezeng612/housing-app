output "instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "private_ip" {
  value     = google_sql_database_instance.postgres.private_ip_address
  sensitive = true
}

output "database_name" {
  value = google_sql_database.housing.name
}