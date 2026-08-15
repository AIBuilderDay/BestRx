/**
 * The API host.
 *
 * One EC2 instance running the FastAPI container. Not Lambda: this process holds SSE connections
 * open for as long as a browser keeps them, which a request/response function cannot do.
 *
 * The image is built and pushed to ECR by scripts/deploy.sh; user-data pulls and runs it, and the
 * systemd unit restarts it if it exits or the instance reboots.
 */

locals {
  name = "${var.prefix}-api"
}

# Amazon Linux 2023, resolved at plan time rather than pinned — a stale hardcoded AMI is a security
# problem, not a stability feature.
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_ecr_repository" "api" {
  name                 = local.name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # A demo stack gets torn down and rebuilt; without this, destroy fails on a non-empty repository.
  force_delete = true
}

# Keep only the last few images. Untagged layers accumulate on every push and are billed for.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 5 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_security_group" "api" {
  name        = "${local.name}-sg"
  description = "BestRx API: inbound HTTP, all outbound"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "API and SSE"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }

  egress {
    description = "Pull images, reach SQS and DynamoDB"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-sg" }
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${local.name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "api" {
  # The API's only contact with the notification service: it can enqueue and nothing else.
  statement {
    sid       = "EnqueuePush"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [var.push_queue_arn]
  }

  # Push subscriptions are the one piece of state shared with AWS. Orders live in the container's
  # memory, so there is nothing else to grant.
  statement {
    sid    = "Subscriptions"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
    ]
    resources = [var.push_subscriptions_table_arn]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "${local.name}-policy"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

# Lets the instance pull from ECR without any credentials on disk.
resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Shell-free access through Session Manager, so the instance needs no SSH key and no open port 22.
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "api" {
  name = "${local.name}-profile"
  role = aws_iam_role.api.name
}

resource "aws_instance" "api" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.api.name

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    aws_region               = var.aws_region
    ecr_repository_url       = aws_ecr_repository.api.repository_url
    push_queue_url           = var.push_queue_url
    push_subscriptions_table = var.push_subscriptions_table_name
    vapid_public_key         = var.vapid_public_key
    cors_origins             = join(",", var.cors_origins)
  })

  # Re-run user-data when its content changes, so config edits actually reach the instance.
  user_data_replace_on_change = true

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  tags = { Name = local.name }
}

# A stable address, so redeploying the instance does not change the frontend's API URL.
resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"

  tags = { Name = "${local.name}-eip" }
}
