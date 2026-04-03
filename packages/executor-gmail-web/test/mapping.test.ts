import { describe, expect, it, vi } from "vitest";

import { buildComposeRequest, buildGmailComposeUrl, formatScheduledInputs, sortExecutableProposals } from "../src/mapping";

describe("executor mapping", () => {
  it("sorts proposals oldest first", () => {
    const proposals = sortExecutableProposals([
      {
        id: "b",
        kind: "gmail.web.send_now",
        status: "approved",
        payloadHash: "a".repeat(64),
        requester: { type: "agent", id: "agent-1" },
        createdAt: "2026-04-04T10:00:00.000Z",
        updatedAt: "2026-04-04T10:00:00.000Z",
        approval: {
          approvedAt: "2026-04-04T10:01:00.000Z",
          approvedBy: { type: "human", id: "reviewer-1" }
        },
        rejection: null,
        execution: null,
        expiresAt: null,
        statusReason: null,
        version: 1,
        payload: {
          to: ["b@example.com"],
          cc: [],
          bcc: [],
          subject: "B"
        }
      },
      {
        id: "a",
        kind: "gmail.web.send_now",
        status: "approved",
        payloadHash: "b".repeat(64),
        requester: { type: "agent", id: "agent-1" },
        createdAt: "2026-04-04T09:00:00.000Z",
        updatedAt: "2026-04-04T09:00:00.000Z",
        approval: {
          approvedAt: "2026-04-04T09:01:00.000Z",
          approvedBy: { type: "human", id: "reviewer-1" }
        },
        rejection: null,
        execution: null,
        expiresAt: null,
        statusReason: null,
        version: 1,
        payload: {
          to: ["a@example.com"],
          cc: [],
          bcc: [],
          subject: "A"
        }
      }
    ]);

    expect(proposals.map((proposal) => proposal.id)).toEqual(["a", "b"]);
  });

  it("builds compose requests and compose URLs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T00:00:00.000Z"));

    const request = buildComposeRequest({
      id: "proposal-1",
      kind: "gmail.web.schedule_send",
      status: "approved",
      payloadHash: "c".repeat(64),
      requester: { type: "agent", id: "agent-1" },
      createdAt: "2026-04-04T01:00:00.000Z",
      updatedAt: "2026-04-04T01:00:00.000Z",
      approval: {
        approvedAt: "2026-04-04T01:05:00.000Z",
        approvedBy: { type: "human", id: "reviewer-1" }
      },
      rejection: null,
      execution: null,
      expiresAt: null,
      statusReason: null,
      version: 1,
      payload: {
        to: ["lead@example.com"],
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        subject: "Hello",
        text: "Body",
        schedule: {
          sendAt: "2026-04-05T09:30:00-04:00",
          timezone: "America/New_York"
        }
      }
    });

    expect(request.schedule?.timezone).toBe("America/New_York");

    const url = buildGmailComposeUrl("https://mail.google.com/mail/u/0/?hl=en#inbox", request);

    expect(url).toContain("view=cm");
    expect(url).toContain("to=lead%40example.com");
    expect(url).toContain("cc=cc%40example.com");
    expect(url).toContain("bcc=bcc%40example.com");
    expect(url).toContain("su=Hello");
    expect(url).toContain("body=Body");

    vi.useRealTimers();
  });

  it("formats schedule inputs in the target timezone", () => {
    const formatted = formatScheduledInputs(
      "2026-04-05T09:30:00-04:00",
      "America/New_York"
    );

    expect(formatted.dateValue).toBe("04/05/2026");
    expect(formatted.timeValue).toBe("9:30 AM");
  });

  it("rejects past schedule times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T14:31:00.000Z"));

    expect(() =>
      buildComposeRequest({
        id: "proposal-2",
        kind: "gmail.web.schedule_send",
        status: "approved",
        payloadHash: "d".repeat(64),
        requester: { type: "agent", id: "agent-1" },
        createdAt: "2026-04-04T01:00:00.000Z",
        updatedAt: "2026-04-04T01:00:00.000Z",
        approval: {
          approvedAt: "2026-04-04T01:05:00.000Z",
          approvedBy: { type: "human", id: "reviewer-1" }
        },
        rejection: null,
        execution: null,
        expiresAt: null,
        statusReason: null,
        version: 1,
        payload: {
          to: ["lead@example.com"],
          cc: [],
          bcc: [],
          subject: "Hello",
          schedule: {
            sendAt: "2026-04-05T09:30:00-04:00",
            timezone: "America/New_York"
          }
        }
      })
    ).toThrow(/past/);

    vi.useRealTimers();
  });
});
