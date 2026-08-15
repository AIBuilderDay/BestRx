/**
 * The notification service.
 *
 * Separate from the API and fronted by a queue, so a burst of status changes or a failing push
 * service queues up here instead of backpressuring the order API. Retries and the dead-letter queue
 * come free with SQS.
 *
 * There is deliberately no SNS topic. Fan-out is worth its weight once a second independent
 * consumer exists (audit, analytics, a vendor webhook); with one consumer it is just a hop.
 */

locals {
  function_name = "${var.prefix}-push"
}

resource "aws_sqs_queue" "push_dlq" {
  name = "${var.prefix}-push-dlq"

  # Two weeks is the maximum. A message that lands here is a bug worth investigating, so keep it
  # around long enough to be noticed.
  message_retention_seconds = 1209600

  tags = { Name = "${var.prefix}-push-dlq" }
}

resource "aws_sqs_queue" "push" {
  name = "${var.prefix}-push-queue"

  # Must be at least the Lambda timeout, or SQS hands the same message to a second invocation while
  # the first is still working and the user gets notified twice.
  visibility_timeout_seconds = var.lambda_timeout * 6

  message_retention_seconds = 86400
  # Long polling: fewer empty receives, lower cost, faster pickup.
  receive_wait_time_seconds = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.push_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.prefix}-push-queue" }
}

resource "aws_cloudwatch_metric_alarm" "dlq_not_empty" {
  alarm_name          = "${var.prefix}-push-dlq-not-empty"
  alarm_description   = "Push messages are failing after 3 attempts. Notifications are being lost."
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  period              = 300
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.push_dlq.name
  }
}

/**
 * VAPID keys.
 *
 * Terraform creates an empty secret; backend/scripts/generate_vapid.py fills it after the first
 * apply. The private key therefore never enters Terraform state, a plan file, or the repo.
 */
resource "aws_secretsmanager_secret" "vapid" {
  name        = "${var.prefix}/vapid"
  description = "VAPID keypair for Web Push. Populated by backend/scripts/generate_vapid.py."

  # A demo stack gets torn down and stood back up; the default 30-day window would block reusing
  # the same secret name.
  recovery_window_in_days = 0
}

data "archive_file" "push" {
  type        = "zip"
  source_dir  = var.build_dir
  output_path = "${path.module}/.build/${local.function_name}.zip"
}

resource "aws_cloudwatch_log_group" "push" {
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

resource "aws_iam_role" "push" {
  name               = "${local.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "push" {
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.push.arn}:*"]
  }

  statement {
    sid    = "ConsumeQueue"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.push.arn]
  }

  # Read subscriptions, and delete the ones a push service reports as gone.
  statement {
    sid    = "Subscriptions"
    effect = "Allow"
    actions = [
      "dynamodb:Scan",
      "dynamodb:DeleteItem",
    ]
    resources = [var.push_subscriptions_table_arn]
  }

  statement {
    sid       = "ReadVapidKey"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.vapid.arn]
  }
}

resource "aws_iam_role_policy" "push" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.push.id
  policy = data.aws_iam_policy_document.push.json
}

resource "aws_lambda_function" "push" {
  function_name = local.function_name
  role          = aws_iam_role.push.arn
  handler       = "handler.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]

  filename         = data.archive_file.push.output_path
  source_code_hash = data.archive_file.push.output_base64sha256

  memory_size = 512
  timeout     = var.lambda_timeout

  # Bounds how fast the queue drains, so a burst of status changes cannot consume the account's
  # entire Lambda concurrency and starve the API. Off (-1) by default — Lambda rejects any
  # reservation on an account whose total concurrency limit is 10.
  reserved_concurrent_executions = var.reserved_concurrency

  environment {
    variables = {
      PUSH_SUBSCRIPTIONS_TABLE = var.push_subscriptions_table_name
      VAPID_SECRET_ARN         = aws_secretsmanager_secret.vapid.arn
      VAPID_SUBJECT            = var.vapid_subject
      APP_URL                  = var.app_url
    }
  }

  depends_on = [
    aws_iam_role_policy.push,
    aws_cloudwatch_log_group.push,
  ]
}

resource "aws_lambda_event_source_mapping" "push" {
  event_source_arn = aws_sqs_queue.push.arn
  function_name    = aws_lambda_function.push.arn
  batch_size       = 10

  # The handler returns batchItemFailures, so one bad message is retried on its own instead of
  # replaying the whole batch and notifying everyone in it twice.
  function_response_types = ["ReportBatchItemFailures"]
}
