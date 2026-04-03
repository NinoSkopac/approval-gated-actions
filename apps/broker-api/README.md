# `@approval-gated-actions/broker-api`

SQLite-backed Fastify broker API for action proposals.

The broker is the system source of truth for:

- proposals
- approval and rejection decisions
- execution state
- audit history

It validates all inbound payloads with Zod, enforces deterministic state transitions from `@approval-gated-actions/core`, and never performs privileged side effects itself.

## Run

```bash
pnpm --filter @approval-gated-actions/broker-api dev
```

By default the API listens on `0.0.0.0:3000` and stores data in `apps/broker-api/data/broker.sqlite`.

## Seed

```bash
pnpm --filter @approval-gated-actions/broker-api seed:demo
```

## Request examples

Create a proposal:

```bash
curl -X POST http://localhost:3000/proposals \
  -H 'content-type: application/json' \
  -d '{
    "kind": "gmail.web.schedule_send",
    "payload": {
      "to": ["lead@example.com"],
      "subject": "Follow up",
      "text": "Wanted to follow up.",
      "schedule": {
        "sendAt": "2026-04-05T09:00:00-04:00",
        "timezone": "America/New_York"
      }
    },
    "requester": {
      "type": "agent",
      "id": "openclaw"
    },
    "expiresAt": "2026-04-05T12:00:00-04:00"
  }'
```

Approve a proposal:

```bash
curl -X POST http://localhost:3000/proposals/<id>/approve \
  -H 'content-type: application/json' \
  -d '{
    "actor": {
      "type": "human",
      "id": "reviewer-1"
    },
    "comment": "Looks good."
  }'
```

List proposals:

```bash
curl "http://localhost:3000/proposals?status=approved&kind=gmail.web.schedule_send"
```
