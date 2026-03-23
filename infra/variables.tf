variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "housing-app-490522"
}

variable "region" {
  description = "Default GCP region"
  type        = string
  default     = "us-east1"
}

variable "zone" {
  description = "Default GCP zone"
  type        = string
  default     = "us-east1-b"
}

variable "db_password" {
  description = "Cloud SQL postgres password"
  type        = string
  sensitive   = true
}