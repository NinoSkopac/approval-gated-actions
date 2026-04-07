# `@approval-gated-actions/openclaw-adapter`

Thin proposing adapter for approval-gated email actions.

This package accepts email-action input, normalizes it, hashes it with `@approval-gated-actions/core`, submits it to the broker, and returns the created proposal ID plus preview metadata.

It does not hold Gmail credentials and it does not send mail directly.

## Supported input

- `mode: "send_now" | "schedule_send" | "create_draft"`
- `to`, `cc`, `bcc`
- `subject`
- `text` and/or `html`
- optional `schedule: { sendAt, timezone }` for `schedule_send`

## Trust boundary

- Adapter can propose
- Broker stores
- Human approves
- Executor performs the side effect

That separation is the product boundary. This adapter is intentionally not privileged.

## Library usage

```ts
import { createOpenClawAdapterClient } from "@approval-gated-actions/openclaw-adapter";

const client = createOpenClawAdapterClient({
  brokerBaseUrl: "http://127.0.0.1:3000",
  requester: {
    type: "agent",
    id: "openclaw",
    displayName: "OpenClaw"
  }
});

const result = await client.createEmailProposal({
  mode: "schedule_send",
  to: ["lead@example.com"],
  subject: "Following up",
  text: "Wanted to follow up on our last conversation.",
  schedule: {
    sendAt: "2026-04-05T09:00:00-04:00",
    timezone: "America/New_York"
  }
});
```

The result includes:

- `proposalId`
- `status`
- `kind`
- `payloadHash`
- preview metadata for recipients, body, and schedule

## Tool wrapper

Use the built-in wrapper when an agent runtime wants a callable tool surface without assuming any private OpenClaw runtime API:

```ts
import {
  createOpenClawAdapterClient,
  createProposeEmailTool
} from "@approval-gated-actions/openclaw-adapter";

const client = createOpenClawAdapterClient({
  brokerBaseUrl: "http://127.0.0.1:3000"
});

const tool = createProposeEmailTool(client);
const result = await tool.invoke({
  mode: "send_now",
  to: ["lead@example.com"],
  subject: "Intro",
  text: "Hello there."
});
```

## Wiring with broker and executor

1. Agent or tool calls this adapter.
2. Adapter normalizes the payload and computes a deterministic hash.
3. Adapter sends the proposal to `apps/broker-api`.
4. Broker stores proposal and audit trail.
5. Human approves or rejects.
6. `packages/executor-gmail-web` consumes approved proposals and uses the configured browser backend only when native Gmail schedule-send behavior is required.

## Examples

- Direct client call: [direct-call.ts](examples/direct-call.ts)
- Minimal HTTP tool server: [tool-server.ts](examples/tool-server.ts)

Run them with:

```bash
pnpm --filter @approval-gated-actions/openclaw-adapter example:direct
pnpm --filter @approval-gated-actions/openclaw-adapter example:server
```
