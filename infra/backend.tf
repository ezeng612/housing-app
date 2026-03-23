terraform {
  backend "gcs" {
    bucket = "housing-app-490522-tfstate"
    prefix = "terraform/state"
  }
}