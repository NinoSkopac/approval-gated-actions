import { describe, expect, it } from "vitest";

import { hashActionPayload, normalizeActionPayload } from "../src";

describe("hashActionPayload", () => {
  it("is stable across key ordering and defaulted optional fields", () => {
    const normalizedA = normalizeActionPayload("gmail.web.send_now", {
      to: ["USER@example.com"],
      subject: "Hello",
      text: "Body",
      cc: []
    });

    const normalizedB = normalizeActionPayload("gmail.web.send_now", {
      text: "Body",
      subject: "Hello",
      to: ["user@example.com"]
    });

    expect(hashActionPayload("gmail.web.send_now", normalizedA)).toBe(
      hashActionPayload("gmail.web.send_now", normalizedB)
    );
  });

  it("changes when the normalized payload changes", () => {
    const first = normalizeActionPayload("gmail.web.schedule_send", {
      to: ["recipient@example.com"],
      subject: "Hello",
      schedule: {
        sendAt: "2026-04-04T10:00:00+07:00",
        timezone: "Asia/Bangkok"
      }
    });

    const second = normalizeActionPayload("gmail.web.schedule_send", {
      to: ["recipient@example.com"],
      subject: "Hello",
      schedule: {
        sendAt: "2026-04-04T11:00:00+07:00",
        timezone: "Asia/Bangkok"
      }
    });

    expect(hashActionPayload("gmail.web.schedule_send", first)).not.toBe(
      hashActionPayload("gmail.web.schedule_send", second)
    );
  });
});
