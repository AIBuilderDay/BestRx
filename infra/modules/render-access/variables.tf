variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
}

variable "push_queue_arn" {
  description = "The queue this key may send to, and only send to."
  type        = string
}

variable "push_subscriptions_table_arn" {
  description = "The one table this key may touch."
  type        = string
}
