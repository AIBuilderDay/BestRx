# infra

Terraform for the notification service, plus a tightly scoped AWS key for the API to reach it.

The API and frontend are **not** here — they run on Render and Cloudflare Pages, both free with real
HTTPS. That matters beyond cost: browsers refuse to deliver Web Push to an insecure origin, so
plain-HTTP hosting cannot work at all.

---

## Where everything runs

| | Where | Why there | Cost |
|---|---|---|---|
| Frontend | Cloudflare Pages | static build, global CDN, HTTPS | free |
| API + SSE | Render | needs a long-lived process to hold SSE connections | free |
| Push notifications | **AWS (this stack)** | queue-fronted, bursty, idle most of the time | ~$0.40/mo |

```
PATCH /orders/{id}/status          (Render)
        │
        ├── in-process fan-out ──> SSE ──> every open tab
        │                                  (live UI update)
        │
        └── SQS push-queue ──> push Lambda          (AWS)
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
| Push Lambda | `bestrx-push` |
| Queues | `bestrx-push-queue`, `bestrx-push-dlq` |
| Table | `bestrx-push-subscriptions` |
| Secret | `bestrx/vapid` |
| IAM user for Render | `bestrx-render-api` |

**One DynamoDB table**, holding only push subscriptions — the single piece of state shared between
the API on Render and the Lambda in AWS. Orders live in the API process's memory, seeded from the
JSON fixtures.

Change `prefix` in `terraform.tfvars` to stand up a second, isolated stack.

---

## The Render key

On EC2 an instance role supplied credentials automatically. Render sits outside AWS, so it needs a
static access key — which makes least privilege matter *more*, not less: the key lives in a
third-party dashboard.

The policy grants exactly the four calls the backend makes, verified against the source:

| Action | Resource | Used by |
|---|---|---|
| `sqs:SendMessage` | the push queue | `app/services/notifications.py` |
| `dynamodb:PutItem` | the subscriptions table | `app/subscriptions.py` |
| `dynamodb:DeleteItem` | the subscriptions table | `app/subscriptions.py` |
| `dynamodb:Scan` | the subscriptions table | `app/subscriptions.py` |

No wildcards, no `ReceiveMessage` (the Lambda drains the queue, and the API must not be able to),
no `GetItem`, no `Query`. Add an AWS call to the backend and this fails loudly — which is the point.

**Rotating the key:**

```bash
terraform -chdir=infra taint module.render_access.aws_iam_access_key.render
terraform -chdir=infra apply
terraform -chdir=infra output -raw render_env    # paste the new values into Render
```

---

## First deploy

Requires Terraform ≥ 1.9, the AWS CLI with a working profile, and `uv`.

### 1. AWS

```bash
task infra:build          # builds the push Lambda package
cd infra
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply

cd .. && task infra:vapid # generates the VAPID keypair into Secrets Manager, once
```

Then re-apply with the printed public key so the API can serve it to browsers:

```bash
terraform -chdir=infra apply -var="vapid_public_key=<the key from the previous step>"
```

Two applies on a first run: the key does not exist until the secret does, and the first apply
creates the secret.

### 2. Render

Connect the repo — `render.yaml` at the root defines the service. Render prompts for the values
marked `sync: false`:

```bash
terraform -chdir=infra output -raw render_env
```

That prints every one of them, including the secret access key. **Never commit the result.**

### 3. Cloudflare Pages

Connect the repo and set:

| Setting | Value |
|---|---|
| Build command | `pnpm install && pnpm build` |
| Output directory | `frontend/dist` |
| Root directory | `frontend` |
| `VITE_API_BASE_URL` | `https://bestrx-api.onrender.com` |
| `VITE_SSE_URL` | `https://bestrx-api.onrender.com/stream` |

### 4. Close the CORS loop

The frontend and API are on different origins, so the API has to allow the Pages URL explicitly.
Set `CORS_ORIGINS` in Render to the Pages URL, and add it to `cors_origins` in `terraform.tfvars`
so `app_url` in the notification click-through matches.

---

## Verifying it works

```bash
curl -s https://bestrx-api.onrender.com/health | jq
curl -N https://bestrx-api.onrender.com/stream          # in one terminal

curl -s -X PATCH https://bestrx-api.onrender.com/orders/DME-10231/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"dispatched","actorId":"USR-001"}' | jq
```

The event appears in the first terminal immediately.

**The push path needs a real browser.** Load the Pages URL, subscribe, lock the phone, then PATCH an
order. A green `curl` does not prove a notification landed on a sleeping device — only the phone
does.

---

## Operating it

```bash
terraform -chdir=infra output -json commands | jq   # logs, DLQ depth, render env
```

A CloudWatch alarm (`bestrx-push-dlq-not-empty`) fires when the DLQ is non-empty. It has no
notification target — wire an SNS topic to it if you want to be told.

After changing the push handler: `task infra:build && terraform -chdir=infra apply`.
After changing the API: push to the branch; Render rebuilds on its own.

---

## Known limits

Accepted trade-offs, not bugs.

**Render's free tier spins down after 15 minutes of inactivity**, and the next request waits 30-60s
for a cold start. Hit `/health` shortly before a demo, or keep it warm with a cron. This is the
single biggest risk to a live demo.

**Orders are in memory**, so a spin-down also resets them to the seeded fixtures. Deliberate — no
database to provision, and a restart returns to a known-good state — but on Render it now happens
automatically, not only on deploy.

**One instance, one worker.** SSE subscribers live in that process's memory, so a second worker or
instance would serve clients that never receive events. Scaling out needs a shared broker (Redis
pub/sub), which is a real change rather than a config flag. One process handles thousands of idle
SSE connections comfortably.

**SSE disconnects have been reported on Render past ~5 minutes.** The 15s heartbeat is the standard
mitigation and `useOrderStream` reconnects with backoff, so a drop should be invisible — but it is
not something this repo can guarantee.

**A static AWS key lives in Render.** Scoped to four actions on two ARNs, and rotatable in one
command, but it is still a long-lived credential outside AWS. An instance role would be better;
Render cannot use one.

**No authentication.** Every endpoint is open; anyone with the URL can PATCH an order. A deliberate
hackathon decision. Do not put real data behind it.

**iOS needs Add to Home Screen.** Safari delivers Web Push only to an installed PWA (16.4+). Android
and desktop work from a normal tab.

**Push is best-effort.** If the SQS enqueue fails, the order update still succeeds and SSE still
fires. Losing a notification beats losing an order.

---

## Teardown

```bash
task infra:destroy        # AWS only
```

Delete the Render service and the Pages project in their own dashboards. The VAPID secret is
configured with `recovery_window_in_days = 0`, so its name is immediately reusable.
