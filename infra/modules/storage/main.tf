/**
 * DynamoDB tables.
 *
 * Only what the API actually writes lives here. The read-only reference tables (patients, vendors,
 * offers, catalog) ship inside the Lambda bundle as JSON — copying them into DynamoDB would add
 * seeding work and buy nothing.
 *
 * On-demand billing throughout: no capacity planning, no idle cost.
 */

resource "aws_dynamodb_table" "orders" {
  name         = "${var.prefix}-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = { Name = "${var.prefix}-orders" }
}

resource "aws_dynamodb_table" "order_events" {
  name         = "${var.prefix}-order-events"
  billing_mode = "PAY_PER_REQUEST"

  # Partitioned by order so a detail view reads one order's timeline in a single query.
  hash_key  = "orderId"
  range_key = "at"

  attribute {
    name = "orderId"
    type = "S"
  }

  attribute {
    name = "at"
    type = "S"
  }

  attribute {
    name = "stream"
    type = "S"
  }

  attribute {
    name = "seq"
    type = "N"
  }

  # The SSE Lambda pages forward on a monotonic seq. Without this index it would have to scan the
  # whole table every two seconds.
  global_secondary_index {
    name            = "by-seq"
    hash_key        = "stream"
    range_key       = "seq"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = { Name = "${var.prefix}-order-events" }
}

resource "aws_dynamodb_table" "push_subscriptions" {
  name         = "${var.prefix}-push-subscriptions"
  billing_mode = "PAY_PER_REQUEST"

  # The endpoint URL is the browser's own identifier for a subscription, so it is the natural key.
  hash_key = "endpoint"

  attribute {
    name = "endpoint"
    type = "S"
  }

  tags = { Name = "${var.prefix}-push-subscriptions" }
}
