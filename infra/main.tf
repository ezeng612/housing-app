terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5"
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

module "vpc" {
  source     = "./modules/vpc"
  project_id = var.project_id
  region     = var.region
}

module "cloudsql" {
  source          = "./modules/cloudsql"
  project_id      = var.project_id
  region          = var.region
  network_id      = module.vpc.network_id
  db_password     = var.db_password
}

module "firestore" {
  source     = "./modules/firestore"
  project_id = var.project_id
  region     = var.region
}

module "iam" {
  source     = "./modules/iam"
  project_id = var.project_id
}

module "bigquery" {
  source     = "./modules/bigquery"
  project_id = var.project_id
  region     = var.region
}