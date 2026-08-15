/**
 * BestRx order status notifications.
 *
 * A nurse's open tab updates live, and their phone raises an OS notification even while asleep.
 * Those are two different mechanisms and both are needed: an SSE connection dies when the tab
 * closes, and Web Push is the only thing that survives a sleeping device.
 *
 *   PATCH /orders/{id}/status   (FastAPI on EC2)
 *     -> in-process fan-out  -> SSE to every connected tab
 *     -> SQS push queue      -> push Lambda -> VAPID -> browser push service
 *
 * The API is a container, not a Lambda, because it holds SSE connections open. The notification
 * service is serverless because it is bursty and idle most of the time — each side gets the compute
 * model that fits it.
 *
 * Apply order matters on a first run — see README.md.
 */

locals {
  # Built by `task infra:build`. Terraform zips this; it does not build it.
  push_build_dir = "${path.module}/../notification-service/build"
}

module "storage" {
  source = "./modules/storage"

  prefix = var.prefix
}

# Created before compute, which needs the queue URL to enqueue into.
module "notifications" {
  source = "./modules/notifications"

  prefix    = var.prefix
  build_dir = local.push_build_dir

  push_subscriptions_table_name = module.storage.push_subscriptions_table_name
  push_subscriptions_table_arn  = module.storage.push_subscriptions_table_arn

  vapid_subject = var.vapid_subject
  app_url       = var.app_url

  reserved_concurrency = var.push_lambda_reserved_concurrency
  log_retention_days   = var.log_retention_days
}

module "compute" {
  source = "./modules/compute"

  prefix     = var.prefix
  aws_region = var.aws_region

  instance_type = var.instance_type
  allowed_cidrs = var.api_allowed_cidrs

  push_queue_url = module.notifications.push_queue_url
  push_queue_arn = module.notifications.push_queue_arn

  push_subscriptions_table_name = module.storage.push_subscriptions_table_name
  push_subscriptions_table_arn  = module.storage.push_subscriptions_table_arn

  vapid_public_key = var.vapid_public_key
  cors_origins     = var.cors_origins
}
