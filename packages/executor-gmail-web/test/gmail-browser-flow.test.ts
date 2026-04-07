import { describe, expect, it, vi } from "vitest";

import { GmailBrowserExecutionFlow } from "../src/gmail-browser-flow";
import { OpenClawBrowserBackendNotImplementedError, OpenClawGmailBrowserBackend } from "../src/openclaw-browser-backend";
import type { GmailBrowserBackend, GmailBrowserSession } from "../src/types";

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

describe("GmailBrowserExecutionFlow", () => {
  it("executes the generic send-now flow through a backend session", async () => {
    const session: GmailBrowserSession = {
      ensureInboxReady: vi.fn().mockResolvedValue(),
      openCompose: vi.fn().mockResolvedValue(),
      submitSendNow: vi.fn().mockResolvedValue(),
      openScheduleSendDialog: vi.fn().mockResolvedValue(),
      applySchedule: vi.fn().mockResolvedValue(),
      confirmScheduleSend: vi.fn().mockResolvedValue(),
      readConfirmation: vi.fn().mockResolvedValue({
        verification: "toast",
        message: "Message sent"
      }),
      close: vi.fn().mockResolvedValue()
    };
    const backend: GmailBrowserBackend = {
      kind: "playwright",
      displayName: "Test Backend",
      openSession: vi.fn().mockResolvedValue(session)
    };
    const flow = new GmailBrowserExecutionFlow({
      logger: createLogger()
    });

    const result = await flow.execute(backend, {
      proposalId: "proposal-1",
      kind: "gmail.web.send_now",
      to: ["lead@example.com"],
      cc: [],
      bcc: [],
      subject: "Hello",
      text: "Body"
    });

    expect(result.verification).toBe("toast");
    expect(session.submitSendNow).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it("documents the unimplemented OpenClaw backend path clearly", async () => {
    const backend = new OpenClawGmailBrowserBackend({
      config: {
        brokerBaseUrl: "http://127.0.0.1:3000",
        browserBackend: "openclaw",
        browserUserDataDir: "/tmp/chrome",
        browserChannel: "chrome",
        openClawSessionId: "session-1",
        openClawChromeProfileName: "Profile 1",
        headless: false,
        pollIntervalMs: 1000,
        actorId: "executor",
        actorDisplayName: "Executor",
        gmailBaseUrl: "https://mail.google.com/mail/u/0/?hl=en#inbox",
        locale: "en-US",
        navigationTimeoutMs: 1000,
        actionTimeoutMs: 1000
      }
    });
    const flow = new GmailBrowserExecutionFlow({
      logger: createLogger()
    });

    await expect(flow.prepareSession(backend)).rejects.toBeInstanceOf(
      OpenClawBrowserBackendNotImplementedError
    );
  });
});
