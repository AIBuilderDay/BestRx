variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
}

variable "enable_pitr" {
  description = <<-EOT
    Point-in-time recovery. Off by default: the data is synthetic and reseedable from JSON, so
    paying for continuous backups buys nothing.
  EOT
  type        = bool
  default     = false
}
