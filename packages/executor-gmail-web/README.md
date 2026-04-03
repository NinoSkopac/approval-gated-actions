# `@approval-gated-actions/executor-gmail-web`

Privileged Gmail web executor for approved broker proposals.

It consumes approved proposals from `apps/broker-api`, marks them `executing`, performs the side effect in Gmail web through Playwright, then reports `executed` or `failed` back to the broker.

Supported action kinds:

- `gmail.web.send_now`
- `gmail.web.schedule_send`

It does not process `gmail.api.create_draft`, and it does not implement any fake timer-based scheduler. Scheduled sends go through Gmail’s native schedule-send UI so mail lands in Gmail Scheduled.

## Key design points

- Uses a dedicated persistent browser profile directory separate from any adapter/runtime profile
- Uses a broker client plus a swappable Gmail automation backend interface
- Uses configurable selector maps to keep Gmail UI maintenance localized
- Logs each broker transition and execution outcome clearly

## Install

```bash
pnpm install
```

If you want bundled Chromium instead of local Chrome:

```bash
pnpm exec playwright install chromium
```

## Required setup

1. Start the broker API.
2. Configure a dedicated Gmail executor browser profile directory.
3. Run the login command once and complete manual Gmail login in that dedicated profile.
4. Keep using that same profile for executor runs.

Example:

```bash
export BROKER_BASE_URL=http://127.0.0.1:3000
export GMAIL_EXECUTOR_USER_DATA_DIR=$PWD/packages/executor-gmail-web/data/chromium-profile
export GMAIL_EXECUTOR_BROWSER_CHANNEL=chrome

pnpm --filter @approval-gated-actions/executor-gmail-web login
pnpm --filter @approval-gated-actions/executor-gmail-web run:once
pnpm --filter @approval-gated-actions/executor-gmail-web run:poll
```

## Commands

- `login`: open Gmail with the dedicated profile and verify the inbox is reachable
- `run:once`: fetch approved proposals and process them once
- `run:poll`: keep polling the broker for approved proposals

## Config

- `BROKER_BASE_URL`
- `GMAIL_EXECUTOR_USER_DATA_DIR`
- `GMAIL_EXECUTOR_BROWSER_CHANNEL`
  Values: `chrome`, `msedge`, `chromium`
- `GMAIL_EXECUTOR_HEADLESS`
- `GMAIL_EXECUTOR_POLL_INTERVAL_MS`
- `GMAIL_EXECUTOR_ACTOR_ID`
- `GMAIL_EXECUTOR_ACTOR_DISPLAY_NAME`
- `GMAIL_EXECUTOR_GMAIL_BASE_URL`
- `GMAIL_EXECUTOR_LOCALE`
- `GMAIL_EXECUTOR_NAVIGATION_TIMEOUT_MS`
- `GMAIL_EXECUTOR_ACTION_TIMEOUT_MS`

Defaults are defined in [config.ts](/Users/onin/dev/approval-gated-actions/packages/executor-gmail-web/src/config.ts).

## Manual verification path

1. Run broker and create an approved `gmail.web.send_now` proposal.
2. Run `run:once`.
3. Confirm the broker marks the proposal `executed`.
4. Confirm Gmail shows the sent message.
5. Create an approved `gmail.web.schedule_send` proposal with a future `sendAt`.
6. Run `run:once`.
7. Confirm the broker marks the proposal `executed`.
8. Confirm Gmail shows the message in Scheduled.

## Risk areas

- Gmail web selectors are not a public API and may drift.
- Schedule-send dialog labels are English-oriented in this implementation.
- The first login and any re-authentication, MFA, or suspicious-login challenge still require manual operator action.
- Rich HTML body insertion is best-effort because Gmail’s compose editor is a dynamic contenteditable surface.
- Success verification is toast-based; Gmail does not expose a stable message ID in the compose flow here.

## What still requires manual setup

- Installing a compatible browser or Playwright Chromium
- Logging into Gmail in the dedicated executor profile
- Handling MFA or account challenge flows
- Updating selectors if Gmail changes its UI
