/**
 * The one table.
 *
 * Push subscriptions are the only state shared across a process boundary: the API container writes
 * them, and the push Lambda in AWS reads and prunes them. Orders and their timeline live in the
 * container's memory, seeded from the JSON fixtures — nothing else needs a database.
 *
 * On-demand billing: no capacity planning, no idle cost.
 */

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
