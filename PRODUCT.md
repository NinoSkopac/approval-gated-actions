# PRODUCT.md

## Name

Agent Action Governance

## One-line description

Approval-gated side effects for AI agents.

## Problem

The main blocker to using agents in real workflows is not drafting quality.
It is trust at the moment an agent is about to do something with consequences.

Examples:
- send an email
- post to chat
- submit a browser form
- call an external API that changes state
- run a script with real-world effects

Teams want the agent to prepare the action, but they do not want blind execution.

## Product

This project adds a durable governance layer between agent intent and real-world execution.

Flow:
1. An agent proposes an action.
2. The action is normalized into a proposal record.
3. A human can approve, edit, reject, or let it expire.
4. The decision is logged.
5. A privileged executor performs the side effect only after approval.

## Positioning

Do not position this as “email approval.”

Position it as:
- approval-gated side effects for AI agents
- agent action governance

Email is the first executor, not the whole product.

## Why this exists

Agent runtimes can already draft and request approval, but there is still a missing reusable layer for:
- normalized proposal storage
- deterministic action states
- edits, rejects, and expiry
- durable audit history
- executor handoff
- provider-specific execution behind a generic model

That is the product.

## Core principle

Separate:
- proposal
- approval
- execution

Agents can propose.
Humans decide.
Executors act.

## MVP

The MVP is intentionally small.

It must support:
- proposal creation
- normalized proposal schema
- deterministic state transitions
- approve / edit / reject
- audit log
- expiry
- executor dispatch
- one real end-to-end executor

## First vertical

OpenClaw adapter + broker + Gmail browser executor.

Why:
- outbound email is trust-sensitive
- scheduled send is a strong practical use case
- the core model remains reusable for future executors

## Important constraint

For scheduled email, do not build a fake backend timer scheduler in MVP.

Use Gmail web’s native scheduling flow so the email lands in Gmail’s own Scheduled folder.

## Architecture summary

### `packages/core`
Shared domain logic:
- action kinds
- proposal schema
- statuses
- hashing
- transition rules

### `apps/broker-api`
Source of truth:
- stores proposals
- stores audit events
- validates transitions
- exposes APIs for adapters and executors

### `packages/openclaw-adapter`
Thin producer:
- accepts agent/tool input
- normalizes payloads
- hashes payloads
- creates proposals in broker
- never performs privileged side effects

### `packages/executor-gmail-web`
Privileged executor:
- consumes approved proposals
- opens Gmail web
- composes the message
- schedules natively through Gmail web
- may support browser-based send-now as a fallback path
- writes execution result back to broker

Preferred personal-deployment path:
- Gmail API for draft creation
- Gmail API for non-native send-now where acceptable
- OpenClaw-controlled Chrome session for native Gmail schedule-send
- Playwright only as an optional/reference backend
- no bulk sending, spam, service-limit bypass, or misleading automation

Trademark posture:
- This project is not affiliated with, endorsed by, or sponsored by Google or Gmail.
- Gmail and Google are referenced only to describe interoperability with user-approved workflows.
- Public diagrams should avoid Gmail logos/icons unless reviewed against Google brand guidance.

## Trust boundaries

### Adapter
Can:
- propose actions

Cannot:
- send Gmail directly
- hold privileged Gmail execution state

### Broker
Can:
- store proposals
- track decisions
- expose approved work to executors

Cannot:
- perform side effects directly in MVP

### Executor
Can:
- perform side effects after approval

Must:
- only act on approved proposals
- update broker state before and after execution

## Action model

Initial action kinds:
- `gmail.web.send_now`
- `gmail.web.schedule_send`
- `gmail.api.create_draft`

The first executor may only implement:
- `gmail.web.send_now`
- `gmail.web.schedule_send`

For personal deployment, prefer:
- `gmail.api.create_draft`
- a future Gmail API-backed send-now path
- Gmail web only when native schedule-send behavior is required

The core must remain generic enough for future kinds like:
- `slack.post_message`
- `browser.submit_form`
- `api.call`
- `shell.exec_release`

## State model

Minimum statuses:
- `proposed`
- `approved`
- `rejected`
- `expired`
- `executing`
- `executed`
- `failed`

Rules:
- invalid transitions must fail explicitly
- every transition must be auditable
- edits must be logged

## Ideal users

- founders
- agencies
- operations teams
- recruiters
- executive assistants
- outbound teams
- internal automation teams

## Non-goals for MVP

Do not turn v1 into:
- a giant workflow engine
- a broad policy DSL
- a massive custom approval UI
- a multi-tenant enterprise platform
- a fake email scheduler

## Success criteria for v1

v1 is successful if a user can:
1. have an agent propose an email
2. approve or edit it
3. send or schedule it through Gmail web
4. see a durable audit trail
5. trust that nothing is sent without approval

## Repo shape

- `packages/core`
- `apps/broker-api`
- `packages/openclaw-adapter`
- `packages/executor-gmail-web`

## Build order

1. `packages/core`
2. `apps/broker-api`
3. `packages/executor-gmail-web`
4. `packages/openclaw-adapter`

## Summary

This project is the missing layer between agent intent and real-world execution.

It is not an email popup.
It is a reusable governance system for agent actions.

Gmail is the first executor family.
The product is bigger than Gmail.
