/**
 * The SSE streamer.
 *
 * A Lambda Function URL rather than API Gateway, because only Function URLs support response
 * streaming — API Gateway buffers the response and caps it at 30 seconds, which no SSE connection
 * survives.
 *
 * Node runtime, not Python: response streaming is only implemented for Node. It is the one piece of
 * the backend that is not Python, and that is why.
 */

locals {
  function_name = "${var.prefix}-sse"
}

data "archive_file" "sse" {
  type        = "zip"
  source_dir  = var.build_dir
  output_path = "${path.module}/.build/${local.function_name}.zip"
}

resource "aws_cloudwatch_log_group" "sse" {
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

resource "aws_iam_role" "sse" {
  name               = "${local.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "sse" {
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.sse.arn}:*"]
  }

  # Read-only, and only the index it pages through. This Lambda never writes.
  statement {
    sid       = "ReadEventStream"
    effect    = "Allow"
    actions   = ["dynamodb:Query"]
    resources = [var.order_events_table_arn, var.order_events_index_arn]
  }
}

resource "aws_iam_role_policy" "sse" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.sse.id
  policy = data.aws_iam_policy_document.sse.json
}

resource "aws_lambda_function" "sse" {
  function_name = local.function_name
  role          = aws_iam_role.sse.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  filename         = data.archive_file.sse.output_path
  source_code_hash = data.archive_file.sse.output_base64sha256

  # Mostly idle between polls, so memory is about cold start rather than throughput.
  memory_size = 512

  # 15 minutes is Lambda's ceiling. The handler closes itself at 13 minutes so the disconnect is
  # ours and clean, rather than a timeout mid-frame.
  timeout = 900

  environment {
    variables = {
      ORDER_EVENTS_TABLE = var.order_events_table_name
    }
  }

  depends_on = [
    aws_iam_role_policy.sse,
    aws_cloudwatch_log_group.sse,
  ]
}

resource "aws_lambda_function_url" "sse" {
  function_name = aws_lambda_function.sse.function_name

  # No auth, consistent with the rest of this stack. See the README: this is a demo decision.
  authorization_type = "NONE"

  # The whole point: without this the response is buffered and SSE cannot work.
  invoke_mode = "RESPONSE_STREAM"

  cors {
    allow_origins = var.cors_origins
    allow_methods = ["GET"]
    allow_headers = ["last-event-id", "content-type"]
    max_age       = 3600
  }
}
