output "orders_table_name" {
  description = "Name of the orders table."
  value       = aws_dynamodb_table.orders.name
}

output "orders_table_arn" {
  description = "ARN of the orders table."
  value       = aws_dynamodb_table.orders.arn
}

output "order_events_table_name" {
  description = "Name of the order events table."
  value       = aws_dynamodb_table.order_events.name
}

output "order_events_table_arn" {
  description = "ARN of the order events table."
  value       = aws_dynamodb_table.order_events.arn
}

output "order_events_index_arn" {
  description = "ARN of the by-seq index the SSE Lambda queries."
  value       = "${aws_dynamodb_table.order_events.arn}/index/by-seq"
}

output "push_subscriptions_table_name" {
  description = "Name of the push subscriptions table."
  value       = aws_dynamodb_table.push_subscriptions.name
}

output "push_subscriptions_table_arn" {
  description = "ARN of the push subscriptions table."
  value       = aws_dynamodb_table.push_subscriptions.arn
}
