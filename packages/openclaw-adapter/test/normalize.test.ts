import { describe, expect, it } from "vitest";

import { buildProposalPreview, modeToActionKind, normalizeEmailActionInput } from "../src";

describe("openclaw adapter normalization", () => {
  it("maps send_now mode to a normalized broker payload and hash", () => {
    const normalized = normalizeEmailActionInput({
      mode: "send_now",
      to: ["USER@example.com", "user@example.com"],
      cc: ["cc@example.com"],
      bcc: [],
      subject: " Hello ",
      text: "Body"
    });

    expect(modeToActionKind("send_now")).toBe("gmail.web.send_now");
    expect(normalized.kind).toBe("gmail.web.send_now");
    expect(normalized.payload.to).toEqual(["user@example.com"]);
    expect(normalized.payload.subject).toBe("Hello");
    expect(normalized.payloadHash).toHaveLength(64);
  });

  it("requires schedule details for schedule_send", () => {
    expect(() =>
      normalizeEmailActionInput({
        mode: "schedule_send",
        to: ["lead@example.com"],
        subject: "Follow up",
        text: "Body"
      })
    ).toThrow(/schedule/);
  });

  it("rejects schedule on non-scheduled modes", () => {
    expect(() =>
      normalizeEmailActionInput({
        mode: "create_draft",
        to: ["lead@example.com"],
        subject: "Draft",
        text: "Body",
        schedule: {
          sendAt: "2026-04-05T09:30:00-04:00",
          timezone: "America/New_York"
        }
      })
    ).toThrow(/only allowed/);
  });

  it("builds preview metadata", () => {
    const normalized = normalizeEmailActionInput({
      mode: "schedule_send",
      to: ["lead@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      subject: "Follow up",
      html: "<p>Hello <strong>there</strong></p>",
      schedule: {
        sendAt: "2026-04-05T09:30:00-04:00",
        timezone: "America/New_York"
      }
    });

    const preview = buildProposalPreview(normalized);

    expect(preview.bodyFormat).toBe("html");
    expect(preview.bodyPreview).toContain("Hello");
    expect(preview.recipients.toCount).toBe(1);
    expect(preview.schedule?.timezone).toBe("America/New_York");
  });
});
