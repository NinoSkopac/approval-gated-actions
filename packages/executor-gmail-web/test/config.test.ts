import { describe, expect, it } from "vitest";

import { parseExecutorConfig } from "../src/config";

describe("parseExecutorConfig", () => {
  it("applies defaults", () => {
    const config = parseExecutorConfig({}, "/repo");

    expect(config.brokerBaseUrl).toBe("http://127.0.0.1:3000");
    expect(config.browserBackend).toBe("openclaw");
    expect(config.browserUserDataDir).toBe(
      "/repo/packages/executor-gmail-web/data/chromium-profile"
    );
    expect(config.browserChannel).toBe("chrome");
    expect(config.headless).toBe(false);
    expect(config.maxProposalsPerRun).toBe(1);
  });

  it("parses custom environment overrides", () => {
    const config = parseExecutorConfig({
      BROKER_BASE_URL: "http://broker.internal:9999",
      GMAIL_EXECUTOR_BROWSER_BACKEND: "playwright",
      GMAIL_EXECUTOR_USER_DATA_DIR: "/tmp/gmail-profile",
      GMAIL_EXECUTOR_BROWSER_CHANNEL: "chromium",
      GMAIL_EXECUTOR_OPENCLAW_SESSION_ID: "session-123",
      GMAIL_EXECUTOR_HEADLESS: "true",
      GMAIL_EXECUTOR_POLL_INTERVAL_MS: "2500",
      GMAIL_EXECUTOR_MAX_PROPOSALS_PER_RUN: "3"
    });

    expect(config.brokerBaseUrl).toBe("http://broker.internal:9999");
    expect(config.browserBackend).toBe("playwright");
    expect(config.browserUserDataDir).toBe("/tmp/gmail-profile");
    expect(config.browserChannel).toBe("chromium");
    expect(config.openClawSessionId).toBe("session-123");
    expect(config.headless).toBe(true);
    expect(config.pollIntervalMs).toBe(2500);
    expect(config.maxProposalsPerRun).toBe(3);
  });
});
