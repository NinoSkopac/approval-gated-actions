# approval-gated-actions

Approval-gated side effects for AI agents.

This repository is a pnpm TypeScript monorepo for an agent action governance system. The current MVP implements:

- `packages/core`: shared action kinds, proposal types, payload normalization, hashing, expiry helpers, and deterministic state transitions
- `apps/broker-api`: Fastify REST API with Zod validation, SQLite persistence, auditable state transitions, and health/list/query endpoints

Scaffolded but intentionally not yet implemented end to end:

- `packages/openclaw-adapter`
- `packages/executor-gmail-web`

## Workspace layout

- `packages/core`
- `apps/broker-api`
- `packages/openclaw-adapter`
- `packages/executor-gmail-web`

## Prerequisites

- Node.js 24+ with built-in `node:sqlite`
- pnpm 10+

## Install

```bash
pnpm install
```

## Run tests

```bash
pnpm test
```

## Run the broker API

```bash
pnpm dev:broker
```

The broker stores data in `apps/broker-api/data/broker.sqlite` by default.

## Seed demo data

```bash
pnpm seed:broker
```

## API summary

- `GET /health`
- `POST /proposals`
- `GET /proposals/:id`
- `POST /proposals/:id/approve`
- `POST /proposals/:id/reject`
- `POST /proposals/:id/executing`
- `POST /proposals/:id/executed`
- `POST /proposals/:id/failed`
- `GET /proposals?status=approved&kind=gmail.web.schedule_send`

See the package READMEs for payload and request examples.
