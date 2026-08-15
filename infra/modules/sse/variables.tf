variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
}

variable "build_dir" {
  description = "Directory holding the bundled SSE Lambda. Produced by `task infra:build`."
  type        = string
}

variable "order_events_table_name" {
  type = string
}

variable "order_events_table_arn" {
  type = string
}

variable "order_events_index_arn" {
  description = "ARN of the by-seq index this Lambda pages through."
  type        = string
}

variable "cors_origins" {
  type = list(string)
}

variable "log_retention_days" {
  type    = number
  default = 7
}
