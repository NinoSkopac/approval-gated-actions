# `@approval-gated-actions/executor-gmail-web`

Privileged browser executor for approved broker proposals that require Gmail-native scheduled send.

It consumes approved proposals from `apps/broker-api`, marks them `executing`, performs approved browser actions through a pluggable backend when native Gmail schedule-send behavior is required, then reports `executed` or `failed` back to the broker.

Supported action kinds:

- `gmail.web.send_now`
- `gmail.web.schedule_send`

It does not process `gmail.api.create_draft`, and it does not implement any fake timer-based scheduler. Scheduled sends go through Gmail’s native schedule-send UI so mail lands in Gmail Scheduled.

## Preferred usage model

For personal real Gmail usage, the preferred production path is:

- Gmail API for `create_draft`
- Gmail API for non-native `send_now` when acceptable
- browser-based Gmail execution only when native Gmail schedule-send behavior is required
- browser execution through an OpenClaw-controlled Chrome session/profile for personal deployment
- no bulk sending, spam, service-limit bypass, or misleading automation

This package currently implements the pluggable browser abstraction, a Playwright reference backend, and an OpenClaw backend contract with concrete integration notes. The OpenClaw backend is not fully wired yet in this slice.

## Trademark and Affiliation

This package is not affiliated with, endorsed by, or sponsored by Google or Gmail. Gmail and Google are trademarks of Google LLC. Product names are used only to describe interoperability with user-approved workflows.

## Key design points

- Uses a dedicated persistent browser profile directory separate from any adapter/runtime profile
- Uses a broker client plus a backend-neutral Gmail browser flow and pluggable browser backend interface
- Uses configurable selector maps to keep Gmail UI maintenance localized
- Logs each broker transition and execution outcome clearly

## Install

```bash
pnpm install
```

If you want to use the Playwright reference backend with bundled Chromium:

```bash
pnpm exec playwright install chromium
```

## Required setup

1. Start the broker API.
2. Choose a browser backend.
3. Configure a dedicated Gmail executor browser profile directory or OpenClaw-controlled Chrome profile.
4. Run the login command or session-prep path for the selected backend.
5. Keep using that same privileged browser context for executor runs.

OpenClaw-preferred config:

```bash
export BROKER_BASE_URL=http://127.0.0.1:3000
export GMAIL_EXECUTOR_BROWSER_BACKEND=openclaw
export GMAIL_EXECUTOR_USER_DATA_DIR=$PWD/packages/executor-gmail-web/data/chromium-profile
export GMAIL_EXECUTOR_OPENCLAW_SESSION_ID=my-openclaw-session
export GMAIL_EXECUTOR_OPENCLAW_CHROME_PROFILE_NAME="Profile 1"

pnpm --filter @approval-gated-actions/executor-gmail-web login
```

Playwright reference config:

```bash
export BROKER_BASE_URL=http://127.0.0.1:3000
export GMAIL_EXECUTOR_BROWSER_BACKEND=playwright
export GMAIL_EXECUTOR_USER_DATA_DIR=$PWD/packages/executor-gmail-web/data/chromium-profile
export GMAIL_EXECUTOR_BROWSER_CHANNEL=chrome

pnpm --filter @approval-gated-actions/executor-gmail-web login
pnpm --filter @approval-gated-actions/executor-gmail-web run:once
pnpm --filter @approval-gated-actions/executor-gmail-web run:poll
```

## Commands

- `login`: attempt backend session prep and verify the inbox/session path is reachable
- `run:once`: fetch approved proposals and process them once
- `run:poll`: keep polling the broker for approved proposals

## Config

- `BROKER_BASE_URL`
- `GMAIL_EXECUTOR_BROWSER_BACKEND`
  Values: `openclaw`, `playwright`
- `GMAIL_EXECUTOR_USER_DATA_DIR`
- `GMAIL_EXECUTOR_BROWSER_CHANNEL`
  Values: `chrome`, `msedge`, `chromium`
- `GMAIL_EXECUTOR_OPENCLAW_SESSION_ID`
- `GMAIL_EXECUTOR_OPENCLAW_CHROME_PROFILE_NAME`
- `GMAIL_EXECUTOR_HEADLESS`
- `GMAIL_EXECUTOR_POLL_INTERVAL_MS`
- `GMAIL_EXECUTOR_ACTOR_ID`
- `GMAIL_EXECUTOR_ACTOR_DISPLAY_NAME`
- `GMAIL_EXECUTOR_GMAIL_BASE_URL`
- `GMAIL_EXECUTOR_LOCALE`
- `GMAIL_EXECUTOR_NAVIGATION_TIMEOUT_MS`
- `GMAIL_EXECUTOR_ACTION_TIMEOUT_MS`

Defaults are defined in [config.ts](src/config.ts).

## Backends

### OpenClaw backend

- Preferred personal-deployment path
- Intended to control an existing real Chrome session/profile through OpenClaw
- Intended for native Gmail schedule-send against the user’s own Chrome session
- Implemented in this slice as a concrete backend contract plus integration notes, not a full runtime integration

Contract references:

- [types.ts](src/types.ts)
- [gmail-browser-flow.ts](src/gmail-browser-flow.ts)
- [openclaw-browser-backend.ts](src/openclaw-browser-backend.ts)

### Playwright backend

- Optional/reference backend
- Preserves a runnable browser implementation
- Useful for local testing, development, or controlled environments where Playwright is acceptable

Reference implementation:

- [playwright-browser-backend.ts](src/playwright-browser-backend.ts)

## Manual verification path

1. Run broker and create an approved `gmail.web.schedule_send` proposal with a future `sendAt`.
2. Configure the intended browser backend.
3. Run `run:once`.
4. Confirm the broker marks the proposal `executed`.
5. Confirm Gmail shows the message in Scheduled.
6. Optionally repeat with `gmail.web.send_now` if you want browser-based send-now behavior.

## Risk areas

- Gmail web selectors are not a public API and may drift.
- Schedule-send dialog labels are English-oriented in this implementation.
- The OpenClaw backend contract is defined, but real OpenClaw browser control still needs wiring.
- The first login and any re-authentication, MFA, or suspicious-login challenge still require manual operator action.
- Rich HTML body insertion is best-effort because Gmail’s compose editor is a dynamic contenteditable surface.
- Success verification is toast-based; Gmail does not expose a stable message ID in the compose flow here.
- Public docs and diagrams should avoid Gmail logos/icons unless reviewed against Google brand guidance.

## What still requires manual setup

- Wiring the OpenClaw backend to a real OpenClaw-controlled Chrome session if you want the preferred personal-deployment path
- Installing a compatible browser or Playwright Chromium if you want the reference backend
- Logging into Gmail in the dedicated executor profile or OpenClaw-controlled Chrome profile
- Handling MFA or account challenge flows
- Updating selectors if Gmail changes its UI
