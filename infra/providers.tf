terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.6"
    }
  }

  # Local state, per the project decision. Nothing here is shared between machines, and a hackathon
  # does not need a remote backend. `infra/*.tfstate*` is gitignored.
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.prefix
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
