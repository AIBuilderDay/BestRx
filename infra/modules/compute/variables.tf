variable "prefix" {
  description = "Name prefix for every resource."
  type        = string
}

variable "aws_region" {
  type = string
}

variable "instance_type" {
  description = <<-EOT
    Graviton by default: cheaper per hour than the x86 equivalent, and the image is already built
    for arm64. t4g.small is ~$12/month.
  EOT
  type        = string
  default     = "t4g.small"
}

variable "vpc_cidr" {
  description = <<-EOT
    Address space for the VPC this module creates. It makes its own rather than using the account's
    default VPC, which does not exist in every region and can be deleted.
  EOT
  type        = string
  default     = "10.20.0.0/16"
}

variable "allowed_cidrs" {
  description = <<-EOT
    Who may reach the API on port 8000. Open by default because the stack has no authentication —
    narrow this to your own address if the instance will be up for more than a demo.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "push_queue_url" {
  type = string
}

variable "push_queue_arn" {
  type = string
}

variable "push_subscriptions_table_name" {
  type = string
}

variable "push_subscriptions_table_arn" {
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
