output "access_key_id" {
  description = "AWS_ACCESS_KEY_ID for Render's environment."
  value       = aws_iam_access_key.render.id
}

output "secret_access_key" {
  description = <<-EOT
    AWS_SECRET_ACCESS_KEY for Render's environment.

    This is the one value in the stack that Terraform cannot avoid holding: creating an access key
    means receiving its secret. `infra/terraform.tfstate` is gitignored and must stay that way.
    Rotate with `terraform taint module.render_access.aws_iam_access_key.render && terraform apply`.
  EOT
  value       = aws_iam_access_key.render.secret
  sensitive   = true
}

output "user_name" {
  description = "IAM user name, for auditing what this key can do."
  value       = aws_iam_user.render.name
}
