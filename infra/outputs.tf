output "render_env" {
  description = <<-EOT
    Environment variables for the Render service. Contains a secret, so read it deliberately:

      terraform output -raw render_env

    Paste into Render → your service → Environment. Never commit the result.
  EOT
  sensitive   = true
  value       = <<-EOT
    AWS_REGION=${var.aws_region}
    AWS_ACCESS_KEY_ID=${module.render_access.access_key_id}
    AWS_SECRET_ACCESS_KEY=${module.render_access.secret_access_key}
    PUSH_QUEUE_URL=${module.notifications.push_queue_url}
    PUSH_SUBSCRIPTIONS_TABLE=${module.storage.push_subscriptions_table_name}
    VAPID_PUBLIC_KEY=${var.vapid_public_key}
    CORS_ORIGINS=${join(",", var.cors_origins)}
  EOT
}

output "render_access_key_id" {
  description = "Access key id for the Render service. The secret is inside render_env."
  value       = module.render_access.access_key_id
}

output "render_iam_user" {
  description = "IAM user backing that key, for auditing exactly what it can do."
  value       = module.render_access.user_name
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
    push_logs  = "aws logs tail /aws/lambda/${module.notifications.function_name} --follow --region ${var.aws_region} --profile ${var.aws_profile}"
    dlq_depth  = "aws sqs get-queue-attributes --queue-url ${module.notifications.push_dlq_url} --attribute-names ApproximateNumberOfMessages --region ${var.aws_region} --profile ${var.aws_profile}"
    render_env = "terraform -chdir=infra output -raw render_env"
  }
}
