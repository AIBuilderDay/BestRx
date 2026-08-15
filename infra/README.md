# infra

Terraform for the BestRx backend and notification service.

Two compute models, because the two halves need different things: the API holds SSE connections open
and runs as a container on EC2; the notification service is bursty and idle most of the time, so it
is a queue and a Lambda.

---

## What gets created

```
PATCH /orders/{id}/status
        │
        ▼
   FastAPI container on EC2
        │
        ├── in-process fan-out ──> SSE ──> every open tab
        │                                  (live UI update)
        │
        └── SQS push-queue ──> push Lambda
                  (+ DLQ)         │  VAPID-signed POST
                                  ▼
                         FCM / Apple / Mozilla
                                  │
                                  ▼
                         Service Worker
                         → OS notification
                           (phone asleep ✓)
```

Two channels, because they solve different problems. SSE updates a tab that is open and dies the
moment it closes. Web Push is the only thing that survives a sleeping phone.

| Resource | Name |
|---|---|
| VPC, public subnet, internet gateway | `bestrx-vpc` |
| EC2 instance + Elastic IP | `bestrx-api` |
| ECR repository | `bestrx-api` |
| Push Lambda | `bestrx-push` |
| Queues | `bestrx-push-queue`, `bestrx-push-dlq` |
| Table | `bestrx-push-subscriptions` |
| Secret | `bestrx/vapid` |

**One DynamoDB table**, holding only push subscriptions — the single piece of state shared between
the API container and the Lambda. Orders and their timeline live in the container's memory, seeded
from the JSON fixtures.

Change `prefix` in `terraform.tfvars` to stand up a second, fully isolated stack.

The module builds its own VPC rather than using the account's default. There is no default VPC in
`us-east-2` on this account, and relying on one is fragile in any case — it can be deleted and it
differs per region. One public subnet, no NAT gateway: the instance needs to be reachable from a
browser, so a private subnet would cost ~$32/month to achieve nothing the security group does not.

**Cost: roughly $12/month**, almost all of it the `t4g.small` instance. Lambda, SQS, and DynamoDB
are effectively free at this volume; Secrets Manager is $0.40. The VPC and internet gateway are
free; the Elastic IP is free while attached to a running instance.

---

## First deploy

Requires Terraform ≥ 1.9, the AWS CLI with a working profile, Docker, and `uv`.

```bash
# 1. Build the push Lambda package. Terraform zips it; it does not build it.
task infra:build

# 2. Create the infrastructure.
cd infra
cp terraform.tfvars.example terraform.tfvars   # edit if you want non-defaults
terraform init
terraform apply

# 3. Generate the VAPID keypair into the secret Terraform just created.
cd .. && task infra:vapid

# 4. Build the API image, push it to ECR, and start the container.
task infra:deploy

# 5. Re-apply with the public key so the API can serve it to browsers.
terraform -chdir=infra apply -var="vapid_public_key=<the key printed in step 3>"

# 6. Point the frontend at the stack.
task infra:env
```

Two applies on a first run: the VAPID public key does not exist until the secret does, and the first
apply creates it.

The instance comes up before any image exists in ECR. That is expected — the systemd unit has
`Restart=always`, so the API starts as soon as step 4 pushes one.

---

## Verifying it works

```bash
terraform -chdir=infra output -json commands | jq -r .health
curl -s "$(terraform -chdir=infra output -raw api_url)/orders?hospiceId=HSP-001" | jq 'length'
```

Watch the stream in one terminal:

```bash
curl -N "$(terraform -chdir=infra output -raw api_url)/stream"
```

Move an order in another:

```bash
API=$(terraform -chdir=infra output -raw api_url)
curl -s -X PATCH "$API/orders/DME-10231/status" \
  -H 'Content-Type: application/json' \
  -d '{"status":"dispatched","actorId":"USR-001"}' | jq
```

The event appears in the first terminal immediately.

**The push path needs a real browser.** Load the frontend, subscribe, lock the phone, then PATCH an
order. A green `curl` does not prove a notification landed on a sleeping device — only the phone
does.

---

## Operating it

```bash
terraform -chdir=infra output -json commands | jq   # ssh, logs, health

# Shell on the instance — no SSH key, no open port 22.
aws ssm start-session --target "$(terraform -chdir=infra output -raw instance_id)" \
  --region us-east-2 --profile default

# Anything in the DLQ failed three delivery attempts.
aws sqs get-queue-attributes --queue-url "$(terraform -chdir=infra output -raw push_dlq_url)" \
  --attribute-names ApproximateNumberOfMessages --region us-east-2
```

A CloudWatch alarm (`bestrx-push-dlq-not-empty`) fires when the DLQ is non-empty. It has no
notification target — wire an SNS topic to it if you want to be told.

After changing the API: `task infra:deploy`. After changing the push handler:
`task infra:build && terraform -chdir=infra apply`.

---

## Known limits

Accepted trade-offs, not bugs.

**Orders are in memory.** A container restart reloads the JSON fixtures and discards every write.
Deliberate for a demo — no database to provision, and a restart returns to a known-good state.

**One instance, one worker.** SSE subscribers are held in that process's memory, so a second worker
or a second instance would serve clients that never receive events. Scaling out needs a shared
broker (Redis pub/sub), which is a real change rather than a config flag. One process handles
thousands of idle SSE connections comfortably.

**No HTTPS.** The API is plain HTTP on port 8000. Browsers refuse Web Push and Service Workers on
insecure origins, so **push will not work from a frontend served over HTTPS talking to this API**.
For a real deployment, put an ALB with an ACM certificate in front, or run Caddy on the instance.

**No authentication.** Every endpoint is open; anyone with the IP can PATCH an order. A deliberate
hackathon decision. Do not put real data behind it.

**Port 8000 is open to the world** by default. Narrow `api_allowed_cidrs` if the instance will be up
longer than a demo.

**iOS needs Add to Home Screen.** Safari delivers Web Push only to an installed PWA (16.4+). Android
and desktop work from a normal tab.

**Push is best-effort.** If the SQS enqueue fails, the order update still succeeds and SSE still
fires. Losing a notification beats losing an order.

---

## Teardown

```bash
task infra:destroy
```

Removes everything: the instance, the Elastic IP, the ECR repository and its images, the queues, and
the subscriptions table. The secret is configured with `recovery_window_in_days = 0`, so its name is
immediately reusable.
