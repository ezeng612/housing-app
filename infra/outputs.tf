output "vpc_network_id" {
  value = module.vpc.network_id
}

output "cloudsql_instance_name" {
  value = module.cloudsql.instance_name
}

output "cloudsql_private_ip" {
  value     = module.cloudsql.private_ip
  sensitive = true
}