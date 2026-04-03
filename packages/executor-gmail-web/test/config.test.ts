import { describe, expect, it } from "vitest";

import { parseExecutorConfig } from "../src/config";

describe("parseExecutorConfig", () => {
  it("applies defaults", () => {
    const config = parseExecutorConfig({}, "/repo");

    expect(config.brokerBaseUrl).toBe("http://127.0.0.1:3000");
    expect(config.browserUserDataDir).toBe(
      "/repo/packages/executor-gmail-web/data/chromium-profile"
    );
    expect(config.browserChannel).toBe("chrome");
    expect(config.headless).toBe(false);
  });

  it("parses custom environment overrides", () => {
    const config = parseExecutorConfig({
      BROKER_BASE_URL: "http://broker.internal:9999",
      GMAIL_EXECUTOR_USER_DATA_DIR: "/tmp/gmail-profile",
      GMAIL_EXECUTOR_BROWSER_CHANNEL: "chromium",
      GMAIL_EXECUTOR_HEADLESS: "true",
      GMAIL_EXECUTOR_POLL_INTERVAL_MS: "2500"
    });

    expect(config.brokerBaseUrl).toBe("http://broker.internal:9999");
    expect(config.browserUserDataDir).toBe("/tmp/gmail-profile");
    expect(config.browserChannel).toBe("chromium");
    expect(config.headless).toBe(true);
    expect(config.pollIntervalMs).toBe(2500);
  });
});
