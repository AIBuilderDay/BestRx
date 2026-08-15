/**
 * AWS credentials for the API container running on Render.
 *
 * On EC2 an instance role supplied credentials automatically. Render is outside AWS, so it needs a
 * static access key — which makes least privilege matter more, not less: this key sits in a
 * third-party dashboard and cannot be rotated by an instance profile.
 *
 * The policy is written against the four calls the backend actually makes, verified against the
 * source rather than guessed:
 *
 *   sqs:SendMessage        app/services/notifications.py  — enqueue a status change
 *   dynamodb:PutItem       app/subscriptions.py           — store a browser subscription
 *   dynamodb:DeleteItem    app/subscriptions.py           — remove one on unsubscribe
 *   dynamodb:Scan          app/subscriptions.py           — list them
 *
 * Nothing else. No ReceiveMessage (the Lambda consumes the queue, not this), no GetItem, no Query,
 * no wildcard resources. If the backend gains a call, this fails loudly — which is the point.
 */

resource "aws_iam_user" "render" {
  name = "${var.prefix}-render-api"
  path = "/service/"

  tags = { Name = "${var.prefix}-render-api" }
}

data "aws_iam_policy_document" "render" {
  statement {
    sid    = "EnqueuePushNotifications"
    effect = "Allow"
    # Send only. The push Lambda holds ReceiveMessage/DeleteMessage; the API must never be able to
    # drain the queue it writes to.
    actions   = ["sqs:SendMessage"]
    resources = [var.push_queue_arn]
  }

  statement {
    sid    = "ManagePushSubscriptions"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
    ]
    # Scoped to the one table. Orders live in the container's memory, so there is nothing else in
    # DynamoDB for this key to reach.
    resources = [var.push_subscriptions_table_arn]
  }
}

resource "aws_iam_user_policy" "render" {
  name   = "${var.prefix}-render-api-policy"
  user   = aws_iam_user.render.name
  policy = data.aws_iam_policy_document.render.json
}

resource "aws_iam_access_key" "render" {
  user = aws_iam_user.render.name
}
