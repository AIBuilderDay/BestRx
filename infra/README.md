# infra

Terraform for the BestRx backend and notification service. Everything is serverless: three Lambdas,
three DynamoDB tables, one SQS queue.

**Idle cost is effectively zero.** Lambda scales to zero, DynamoDB is on-demand, SQS is inside the
free tier. The only standing charge is Secrets Manager at $0.40/month.

---

## What gets created

```
PATCH /orders/{id}/status
        │
        ▼
   API Gateway HTTP API
        │
        ▼
   FastAPI + Mangum (Lambda)
        │
        ├── DynamoDB: write order, append event ──┐
        │                                          │
        └── SQS push-queue ──> push Lambda         │
                  (+ DLQ)         │                │
                                  ▼                ▼
                          VAPID-signed POST   SSE Lambda
                                  │           (Function URL)
                                  ▼                │
                      FCM / Apple / Mozilla        ▼
                                  │          EventSource
                                  ▼                │
                       Service Worker              ▼
                       → OS notification      live UI update
                         (phone asleep)         (tab open)
```

Two channels, because they solve different problems. SSE updates a tab that is open; it dies the
moment the tab closes. Web Push is the only thing that survives a sleeping phone. Neither alone
covers both cases.

| Resource | Name |
|---|---|
| API Lambda + HTTP API | `bestrx-api` |
| Push Lambda | `bestrx-push` |
| SSE Lambda + Function URL | `bestrx-sse` |
| Tables | `bestrx-orders`, `bestrx-order-events`, `bestrx-push-subscriptions` |
| Queues | `bestrx-push-queue`, `bestrx-push-dlq` |
| Secret | `bestrx/vapid` |

Change `prefix` in `terraform.tfvars` to stand up a second, fully isolated stack.

---

## First deploy

Requires Terraform ≥ 1.9, the AWS CLI with a working profile, `uv`, and Node 22.

```bash
# 1. Build the three Lambda packages. Terraform zips these; it does not build them.
cd backend && ./scripts/build.sh

# 2. Create the infrastructure.
cd ../infra
cp terraform.tfvars.example terraform.tfvars   # edit if you want non-defaults
terraform init
terraform apply

# 3. Generate the VAPID keypair into the secret Terraform just created.
cd ../backend
uv run python scripts/generate_vapid.py --secret-id bestrx/vapid

# 4. Load the fixtures into DynamoDB.
uv run python scripts/seed.py --prefix bestrx --region us-east-2

# 5. Re-apply with the public key so the API can serve it to browsers.
cd ../infra
terraform apply -var="vapid_public_key=<the key printed in step 3>"

# 6. Point the frontend at the stack.
terraform output -raw frontend_env > ../frontend/.env
```

Two applies are needed on a first run: the VAPID public key does not exist until the secret does,
and the secret is created by the first apply. Subsequent applies are single.

---

## Verifying it works

```bash
API=$(terraform output -raw api_url)

curl -s "$API/health" | jq
# {"status":"ok","storage":"dynamodb","pushEnabled":true, ...}

curl -s "$API/orders?hospiceId=HSP-001" | jq 'length'
curl -s "$API/patients" | jq 'length'
curl -s "$API/products" | jq 'length'
```

Open the stream in one terminal:

```bash
curl -N "$(terraform output -raw sse_url)"
```

Move an order in another:

```bash
curl -s -X PATCH "$API/orders/DME-10231/status" \
  -H 'Content-Type: application/json' \
  -d '{"status":"dispatched","actorId":"USR-001"}' | jq
```

The event appears in the first terminal within about two seconds.

**The push path needs a real browser.** Load the frontend, subscribe, lock the phone, then PATCH an
order. A green `curl` does not prove a notification landed on a sleeping device — only the phone
does.

---

## Operating it

```bash
terraform output log_commands       # ready-made `aws logs tail` for each Lambda

# Anything in the DLQ failed three delivery attempts.
aws sqs get-queue-attributes --queue-url "$(terraform output -raw push_dlq_url)" \
  --attribute-names ApproximateNumberOfMessages --region us-east-2
```

A CloudWatch alarm (`bestrx-push-dlq-not-empty`) fires when the DLQ is non-empty. It has no
notification target — wire an SNS topic to it if you want to be told.

After changing any handler: `./scripts/build.sh && terraform apply`.

---

## Known limits

These are accepted trade-offs, not bugs.

**SSE latency is about two seconds.** The Lambda polls DynamoDB rather than subscribing. Fine for
delivery tracking; not for anything that needs to feel instant.

**An SSE connection lasts 13 minutes.** Lambda's ceiling is 15. The handler closes cleanly before
then and the browser reconnects with `Last-Event-ID`, so the stream resumes without a gap — but each
open connection holds a Lambda invocation for its lifetime. Cheap at demo scale, expensive at
thousands of concurrent viewers. A production system would use API Gateway WebSockets or a
long-running process.

**There is no authentication.** Every endpoint is open, and anyone with the URL can PATCH an order.
This is a deliberate hackathon decision. Do not put real data behind it.

**iOS needs Add to Home Screen.** Safari delivers Web Push only to an installed PWA (iOS 16.4+).
Android and desktop work from a normal tab. The ordering flow tells the user this; there is no
install prompt.

**Push is best-effort.** If the SQS enqueue fails, the order update still succeeds and the API still
returns 200. The live channel is unaffected. Losing a notification is better than losing an order.

---

## Teardown

```bash
terraform destroy
```

Removes everything including the tables and their data. The secret is configured with
`recovery_window_in_days = 0`, so its name is immediately reusable — reseed after a rebuild.
