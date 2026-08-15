output "api_url" {
  description = "Base URL of the API. Set this as VITE_API_BASE_URL in frontend/.env."
  value       = module.api.api_url
}

output "sse_url" {
  description = "SSE stream URL. Set this as VITE_SSE_URL in frontend/.env."
  value       = module.sse.sse_url
}

output "frontend_env" {
  description = "Paste this straight into frontend/.env."
  value       = <<-EOT
    VITE_API_BASE_URL=${module.api.api_url}
    VITE_SSE_URL=${module.sse.sse_url}
  EOT
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

output "tables" {
  description = "DynamoDB table names, for seeding and debugging."
  value = {
    orders             = module.storage.orders_table_name
    order_events       = module.storage.order_events_table_name
    push_subscriptions = module.storage.push_subscriptions_table_name
  }
}

output "log_commands" {
  description = "Ready-made commands for tailing each Lambda."
  value = {
    api  = "aws logs tail /aws/lambda/${module.api.function_name} --follow --region ${var.aws_region} --profile ${var.aws_profile}"
    push = "aws logs tail /aws/lambda/${module.notifications.function_name} --follow --region ${var.aws_region} --profile ${var.aws_profile}"
    sse  = "aws logs tail /aws/lambda/${module.sse.function_name} --follow --region ${var.aws_region} --profile ${var.aws_profile}"
  }
}
