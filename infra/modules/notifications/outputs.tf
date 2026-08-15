output "push_queue_url" {
  description = "URL the API sends status changes to."
  value       = aws_sqs_queue.push.url
}

output "push_queue_arn" {
  description = "ARN of the push queue."
  value       = aws_sqs_queue.push.arn
}

output "push_dlq_url" {
  description = "Dead-letter queue. Messages here failed three delivery attempts."
  value       = aws_sqs_queue.push_dlq.url
}

output "vapid_secret_arn" {
  description = "Secret holding the VAPID keypair. Populate it with backend/scripts/generate_vapid.py."
  value       = aws_secretsmanager_secret.vapid.arn
}

output "vapid_secret_id" {
  description = "Secret name to pass to generate_vapid.py --secret-id."
  value       = aws_secretsmanager_secret.vapid.name
}

output "function_name" {
  description = "Name of the push Lambda, for `aws logs tail`."
  value       = aws_lambda_function.push.function_name
}
