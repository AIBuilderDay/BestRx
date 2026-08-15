output "api_url" {
  description = "Base URL of the API. This is VITE_API_BASE_URL for the frontend."
  value       = "http://${aws_eip.api.public_ip}:8000"
}

output "public_ip" {
  description = "Elastic IP of the instance. Stable across instance replacement."
  value       = aws_eip.api.public_ip
}

output "instance_id" {
  description = "For `aws ssm start-session --target <id>`."
  value       = aws_instance.api.id
}

output "ecr_repository_url" {
  description = "Push the API image here; scripts/deploy.sh does it for you."
  value       = aws_ecr_repository.api.repository_url
}
