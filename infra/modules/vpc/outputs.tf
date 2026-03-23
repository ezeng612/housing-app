output "network_id" {
  value = google_compute_network.vpc.id
}

output "private_subnet_id" {
  value = google_compute_subnetwork.private.id
}

output "public_subnet_id" {
  value = google_compute_subnetwork.public.id
}