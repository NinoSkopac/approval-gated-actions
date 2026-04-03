# `@approval-gated-actions/openclaw-adapter`

This package is scaffolded but not fully implemented in the first MVP slice.

Next work here:

- accept OpenClaw tool payloads
- normalize and hash action payloads with `@approval-gated-actions/core`
- submit proposals to `apps/broker-api`
- return proposal IDs and preview metadata

It must not hold privileged Gmail credentials or execute side effects directly.
