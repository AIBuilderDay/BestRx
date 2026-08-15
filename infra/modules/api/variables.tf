variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
}

variable "build_dir" {
  description = "Directory holding the built API package. Produced by `task infra:build`."
  type        = string
}

variable "orders_table_name" {
  type = string
}

variable "orders_table_arn" {
  type = string
}

variable "order_events_table_name" {
  type = string
}

variable "order_events_table_arn" {
  type = string
}

variable "order_events_index_arn" {
  type = string
}

variable "push_subscriptions_table_name" {
  type = string
}

variable "push_subscriptions_table_arn" {
  type = string
}

variable "push_queue_url" {
  type = string
}

variable "push_queue_arn" {
  type = string
}

variable "vapid_public_key" {
  description = "Public VAPID key served to the browser so it can subscribe."
  type        = string
  default     = ""
}

variable "cors_origins" {
  type = list(string)
}

variable "log_retention_days" {
  type    = number
  default = 7
}
