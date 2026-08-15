variable "prefix" {
  description = "Name prefix for every resource. Change it to stand up a second isolated stack."
  type        = string
  default     = "bestrx"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.prefix))
    error_message = "prefix must be lowercase alphanumeric with hyphens, 2-21 characters."
  }
}

variable "environment" {
  description = "Environment tag applied to all resources."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-2"
}

variable "aws_profile" {
  description = "AWS CLI profile Terraform authenticates with."
  type        = string
  default     = "default"
}

variable "vapid_subject" {
  description = <<-EOT
    Contact for the VAPID `sub` claim, sent to push services so they can reach the operator.
    Never shown to users. Must be a mailto: or https: URL.
  EOT
  type        = string
  default     = "mailto:ylim.8299+bestrx-vapid@gmail.com"

  validation {
    condition     = can(regex("^(mailto:|https://)", var.vapid_subject))
    error_message = "vapid_subject must start with mailto: or https://."
  }
}

variable "cors_origins" {
  description = "Origins allowed to call the API and open the SSE stream."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "instance_type" {
  description = <<-EOT
    EC2 instance for the API container. Graviton by default: cheaper than the x86 equivalent and the
    image is already built for arm64. t4g.small is roughly $12/month.
  EOT
  type        = string
  default     = "t4g.small"
}

variable "api_allowed_cidrs" {
  description = <<-EOT
    Who may reach the API on port 8000. Open by default because the stack has no authentication —
    narrow this to your own address if the instance will be up for longer than a demo.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "app_url" {
  description = "Base URL of the frontend. Used to build the click-through link in a notification."
  type        = string
  default     = "http://localhost:5173"
}

variable "vapid_public_key" {
  description = <<-EOT
    VAPID public key, produced by backend/scripts/generate_vapid.py after the first apply.
    Safe to expose — the browser needs it to subscribe. Leave empty on the first apply.
  EOT
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention. Short by default so a demo account stays cheap."
  type        = number
  default     = 7
}

variable "push_lambda_reserved_concurrency" {
  description = <<-EOT
    Cap on concurrent push Lambdas. Bounds how fast the queue drains so a burst of status changes
    cannot exhaust the account's Lambda pool. -1 disables the cap.

    Defaults to -1: a fresh AWS account has a total concurrency limit of 10, and Lambda refuses any
    reservation that would drop unreserved concurrency below 10. Set a positive cap once the
    account's concurrency quota has been raised.
  EOT
  type        = number
  default     = -1
}
