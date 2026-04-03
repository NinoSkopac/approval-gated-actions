# `@approval-gated-actions/executor-gmail-web`

This package is scaffolded but not fully implemented in the first MVP slice.

Next work here:

- fetch approved Gmail web proposals from the broker
- mark proposals `executing`
- drive Gmail web compose/send/schedule using Gmail’s native scheduling UI
- report `executed` or `failed` back to the broker

It must only process already-approved proposals.
