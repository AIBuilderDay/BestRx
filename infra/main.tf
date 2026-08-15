/**
 * BestRx order status notifications.
 *
 * A nurse's open tab updates live, and their phone raises an OS notification even while asleep.
 * Those are two different mechanisms and both are needed: an SSE connection dies when the tab
 * closes, and Web Push is the only thing that survives a sleeping device.
 *
 *   PATCH /orders/{id}/status
 *     -> DynamoDB order + event        -> SSE Lambda streams it to open tabs
 *     -> SQS push queue                -> push Lambda signs with VAPID -> browser push service
 *
 * Apply order matters on a first run — see README.md.
 */

locals {
  # Built by `task infra:build`. Terraform zips these; it does not build them.
  api_build_dir  = "${path.module}/../backend/build/api"
  push_build_dir = "${path.module}/../backend/build/push"
  sse_build_dir  = "${path.module}/../backend/build/sse"
}

module "storage" {
  source = "./modules/storage"

  prefix = var.prefix
}

# Created before the API, which needs the queue URL to enqueue into.
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

module "api" {
  source = "./modules/api"

  prefix    = var.prefix
  build_dir = local.api_build_dir

  orders_table_name             = module.storage.orders_table_name
  orders_table_arn              = module.storage.orders_table_arn
  order_events_table_name       = module.storage.order_events_table_name
  order_events_table_arn        = module.storage.order_events_table_arn
  order_events_index_arn        = module.storage.order_events_index_arn
  push_subscriptions_table_name = module.storage.push_subscriptions_table_name
  push_subscriptions_table_arn  = module.storage.push_subscriptions_table_arn

  push_queue_url = module.notifications.push_queue_url
  push_queue_arn = module.notifications.push_queue_arn

  vapid_public_key   = var.vapid_public_key
  cors_origins       = var.cors_origins
  log_retention_days = var.log_retention_days
}

module "sse" {
  source = "./modules/sse"

  prefix    = var.prefix
  build_dir = local.sse_build_dir

  order_events_table_name = module.storage.order_events_table_name
  order_events_table_arn  = module.storage.order_events_table_arn
  order_events_index_arn  = module.storage.order_events_index_arn

  cors_origins       = var.cors_origins
  log_retention_days = var.log_retention_days
}
