/**
 * BestRx order status notifications.
 *
 * A nurse's open tab updates live, and their phone raises an OS notification even while asleep.
 * Those are two different mechanisms and both are needed: an SSE connection dies when the tab
 * closes, and Web Push is the only thing that survives a sleeping device.
 *
 *   PATCH /orders/{id}/status   (FastAPI on Render)
 *     -> in-process fan-out  -> SSE to every connected tab
 *     -> SQS push queue      -> push Lambda -> VAPID -> browser push service
 *
 * Only the notification service lives in AWS. The API runs on Render and the frontend on Cloudflare
 * Pages — both free, both with real HTTPS, which browsers require before they will deliver Web Push
 * at all. This stack is the queue, the Lambda, the one table they share, and a tightly scoped key
 * for Render to reach them.
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

# Least-privilege credentials for the API on Render: send to the queue, manage subscription rows,
# nothing else.
module "render_access" {
  source = "./modules/render-access"

  prefix = var.prefix

  push_queue_arn               = module.notifications.push_queue_arn
  push_subscriptions_table_arn = module.storage.push_subscriptions_table_arn
}
