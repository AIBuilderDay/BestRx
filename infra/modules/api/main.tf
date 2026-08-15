/**
 * The FastAPI service: a Lambda behind an API Gateway HTTP API.
 *
 * Mangum adapts the ASGI app to the Lambda event model, so the same `app` object serves
 * `uvicorn app.main:app` locally and this in AWS.
 *
 * The deployment package is built by `task infra:build`, which installs dependencies and copies the
 * JSON fixtures into backend/build/api. Terraform only zips what that produced.
 */

locals {
  function_name = "${var.prefix}-api"
}

data "archive_file" "api" {
  type        = "zip"
  source_dir  = var.build_dir
  output_path = "${path.module}/.build/${local.function_name}.zip"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${local.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "api" {
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }

  statement {
    sid    = "OrdersReadWrite"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      var.orders_table_arn,
      var.order_events_table_arn,
      var.order_events_index_arn,
    ]
  }

  statement {
    sid    = "SubscriptionsReadWrite"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
    ]
    resources = [var.push_subscriptions_table_arn]
  }

  # The API's only contact with the notification service. It can enqueue and nothing else.
  statement {
    sid       = "EnqueuePush"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [var.push_queue_arn]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = aws_iam_role.api.arn
  handler       = "app.main.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  # Cold start dominates a demo click. 1024MB is the knee of the price/performance curve — more CPU
  # is allocated proportionally to memory, so this is faster *and* barely costlier than 512MB.
  memory_size = 1024
  timeout     = 29 # one second inside API Gateway's own 30s ceiling

  environment {
    variables = {
      BESTRX_PREFIX            = var.prefix
      ORDERS_TABLE             = var.orders_table_name
      ORDER_EVENTS_TABLE       = var.order_events_table_name
      PUSH_SUBSCRIPTIONS_TABLE = var.push_subscriptions_table_name
      PUSH_QUEUE_URL           = var.push_queue_url
      VAPID_PUBLIC_KEY         = var.vapid_public_key
      CORS_ORIGINS             = join(",", var.cors_origins)
    }
  }

  depends_on = [
    aws_iam_role_policy.api,
    aws_cloudwatch_log_group.api,
  ]
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_origins
    allow_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

# One catch-all route: FastAPI owns the routing table, not API Gateway.
resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/apigateway/${var.prefix}-api"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
