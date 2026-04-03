# `@approval-gated-actions/core`

Shared domain logic for approval-gated action proposals.

## Exports

- action kinds and statuses
- typed Gmail payload schemas
- action proposal types
- deterministic payload normalization
- SHA-256 payload hashing
- proposal expiry helpers
- deterministic transition helpers with explicit invalid-transition errors

## Supported action kinds

- `gmail.web.send_now`
- `gmail.web.schedule_send`
- `gmail.api.create_draft`

## Example

```ts
import {
  createActionProposal,
  approveActionProposal,
  SYSTEM_EXPIRY_ACTOR
} from "@approval-gated-actions/core";

const proposal = createActionProposal({
  kind: "gmail.web.send_now",
  payload: {
    to: ["recipient@example.com"],
    subject: "Hello",
    text: "Body"
  },
  requester: {
    type: "agent",
    id: "openclaw"
  }
});

const approved = approveActionProposal(proposal, {
  actor: {
    type: "human",
    id: "reviewer-1"
  }
});
```
