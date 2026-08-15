output "sse_url" {
  description = "Function URL the browser opens with EventSource. This is VITE_SSE_URL."
  value       = aws_lambda_function_url.sse.function_url
}

output "function_name" {
  description = "Name of the SSE Lambda, for `aws logs tail`."
  value       = aws_lambda_function.sse.function_name
}
