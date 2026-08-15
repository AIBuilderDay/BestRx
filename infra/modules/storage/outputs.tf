output "push_subscriptions_table_name" {
  description = "Name of the push subscriptions table."
  value       = aws_dynamodb_table.push_subscriptions.name
}

output "push_subscriptions_table_arn" {
  description = "ARN of the push subscriptions table."
  value       = aws_dynamodb_table.push_subscriptions.arn
}
