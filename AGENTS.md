# AGENTS.md

Before making product or naming decisions, read `PRODUCT.md`.
Before making system design, package boundary, trust-boundary, or flow changes, read `ARCHITECTURE.md`.

## Mission

Build an open-source TypeScript monorepo for approval-gated side effects for AI agents.

The system is generic. Gmail is the first executor, not the whole product.

## Current scope

Implement and maintain these packages/apps:

- `packages/core`
- `apps/broker-api`
- `packages/openclaw-adapter`
- `packages/executor-gmail-web`

## Non-negotiable architecture rules

- The broker is the source of truth for proposals, approvals, edits, execution state, and audit history.
- The adapter may **propose** actions, but must never perform privileged side effects directly.
- The executor may perform side effects, but only for proposals that are already approved.
- Keep the Gmail session, credentials, and browser profile separate from the OpenClaw-facing adapter.
- Do not collapse broker, adapter, and executor into one service.
- Do not implement a fake backend timer scheduler for Gmail scheduled send in MVP.
- For scheduled email, use Gmail web’s native scheduling flow so messages land in Gmail Scheduled.

## Product rules

- Position the product as **agent action governance** or **approval-gated side effects for AI agents**.
- Do not narrow the architecture to email-only assumptions.
- Keep the core reusable for future executors like Slack, browser submit, API side effects, and shell release gates.

## Coding standards

- TypeScript only.
- Prefer `pnpm` workspaces.
- Prefer `zod` for runtime validation.
- Prefer `vitest` for tests.
- Prefer small, typed functions.
- Prefer explicit return types for exported functions.
- Prefer composition over large classes unless a class clearly improves lifecycle management.
- Avoid broad `try/catch` blocks that swallow useful errors.
- Do not leave placeholder TODO-only code when a working MVP implementation is feasible.

## Broker rules

- Validate all inbound payloads.
- Enforce deterministic state transitions.
- Reject invalid transitions explicitly.
- Every state transition must be auditable.
- Proposal edits must be logged.
- Keep the proposal model generic enough for non-Gmail action kinds.

## Adapter rules

- Normalize payloads before hashing or submission.
- Hash normalized payloads deterministically.
- Return proposal IDs and preview metadata.
- Never store or use privileged Gmail credentials.

## Executor rules

- Only process approved proposals.
- Mark proposals `executing` before acting.
- Mark proposals `executed` or `failed` after acting.
- Log clearly enough for manual debugging.
- Make browser automation selectors/configuration easy to update.
- Keep provider-specific automation behind a clean interface.

## Testing requirements

At minimum, maintain tests for:
- core hashing stability
- state transition validity
- broker validation logic
- broker state transition endpoints
- any pure mapping/normalization logic in adapter or executor

When browser-level tests are impractical, still provide runnable code and document manual verification steps.

## Documentation requirements

Keep these docs accurate:
- `README.md`
- `PRODUCT.md`
- `ARCHITECTURE.md`

If you change flows, trust boundaries, action kinds, or package responsibilities, update the docs in the same change.

## Delivery expectations

Do not stop at a plan if implementation is feasible.
Implement the requested slice end to end.
Run relevant tests after changes.
Summarize:
- what changed
- what works
- what remains
- any assumptions or manual setup still required