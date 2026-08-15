output "api_url" {
  description = "Base URL of the API. Set as VITE_API_BASE_URL in frontend/.env."
  value       = module.compute.api_url
}

output "sse_url" {
  description = "SSE endpoint. Served by the same container as the API."
  value       = "${module.compute.api_url}/stream"
}

output "frontend_env" {
  description = "Paste this straight into frontend/.env."
  value       = <<-EOT
    VITE_API_BASE_URL=${module.compute.api_url}
    VITE_SSE_URL=${module.compute.api_url}/stream
  EOT
}

output "ecr_repository_url" {
  description = "Where the API image is pushed. scripts/deploy.sh uses this."
  value       = module.compute.ecr_repository_url
}

output "instance_id" {
  description = "EC2 instance running the API."
  value       = module.compute.instance_id
}

output "public_ip" {
  description = "Elastic IP of the API host. Stable across instance replacement."
  value       = module.compute.public_ip
}

output "vapid_secret_id" {
  description = "Pass to generate_vapid.py --secret-id after the first apply."
  value       = module.notifications.vapid_secret_id
}

output "push_queue_url" {
  description = "Queue the API enqueues status changes to."
  value       = module.notifications.push_queue_url
}

output "push_dlq_url" {
  description = "Dead-letter queue. Anything here failed three delivery attempts."
  value       = module.notifications.push_dlq_url
}

output "push_subscriptions_table" {
  description = "The only DynamoDB table: state shared between the API and the push Lambda."
  value       = module.storage.push_subscriptions_table_name
}

output "commands" {
  description = "Ready-made commands for operating the stack."
  value = {
    ssh       = "aws ssm start-session --target ${module.compute.instance_id} --region ${var.aws_region} --profile ${var.aws_profile}"
    api_logs  = "aws ssm start-session --target ${module.compute.instance_id} --region ${var.aws_region} --profile ${var.aws_profile} --document-name AWS-StartInteractiveCommand --parameters command='docker logs -f bestrx-api'"
    push_logs = "aws logs tail /aws/lambda/${module.notifications.function_name} --follow --region ${var.aws_region} --profile ${var.aws_profile}"
    health    = "curl -s ${module.compute.api_url}/health"
  }
}
