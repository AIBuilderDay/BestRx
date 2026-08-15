output "api_url" {
  description = "Base URL of the HTTP API. This is VITE_API_BASE_URL for the frontend."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "function_name" {
  description = "Name of the API Lambda, for `aws logs tail`."
  value       = aws_lambda_function.api.function_name
}

output "log_group_name" {
  description = "CloudWatch log group for the API Lambda."
  value       = aws_cloudwatch_log_group.api.name
}
