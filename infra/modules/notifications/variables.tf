variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
}

variable "build_dir" {
  description = "Directory holding the built push Lambda package. Produced by `task infra:build`."
  type        = string
}

variable "push_subscriptions_table_name" {
  type = string
}

variable "push_subscriptions_table_arn" {
  type = string
}

variable "vapid_subject" {
  description = "Contact for the VAPID `sub` claim. Never shown to users."
  type        = string
}

variable "app_url" {
  description = "Frontend base URL, used to build the notification click-through link."
  type        = string
}

variable "lambda_timeout" {
  description = <<-EOT
    Seconds the push Lambda may run. It makes one outbound HTTPS call per subscription, each with a
    10s client timeout, so this bounds a batch of 10.
  EOT
  type        = number
  default     = 60
}

variable "reserved_concurrency" {
  description = "Cap on concurrent push Lambdas. -1 disables the cap (required on accounts whose total concurrency limit is 10)."
  type        = number
  default     = -1
}

variable "log_retention_days" {
  type    = number
  default = 7
}
