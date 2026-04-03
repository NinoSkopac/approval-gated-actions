import { describe, expect, it } from "vitest";

import {
  InvalidActionTransitionError,
  approveActionProposal,
  canTransitionActionStatus,
  createActionProposal,
  expireActionProposalIfNeeded,
  markActionProposalExecuted,
  markActionProposalExecuting,
  markActionProposalFailed,
  rejectActionProposal
} from "../src";

describe("action proposal state machine", () => {
  it("allows a valid proposed -> approved -> executing -> executed lifecycle", () => {
    const proposed = createActionProposal({
      kind: "gmail.web.send_now",
      payload: {
        to: ["recipient@example.com"],
        subject: "Launch update",
        text: "Ship it."
      },
      requester: {
        type: "agent",
        id: "openclaw"
      },
      createdAt: "2026-04-04T08:00:00.000Z"
    });

    const approved = approveActionProposal(proposed, {
      actor: {
        type: "human",
        id: "approver-1"
      },
      approvedAt: "2026-04-04T08:05:00.000Z"
    });

    const executing = markActionProposalExecuting(approved, {
      actor: {
        type: "executor",
        id: "gmail-web-executor"
      },
      startedAt: "2026-04-04T08:06:00.000Z"
    });

    const executed = markActionProposalExecuted(executing, {
      actor: {
        type: "executor",
        id: "gmail-web-executor"
      },
      completedAt: "2026-04-04T08:07:00.000Z",
      externalId: "gmail-message-123"
    });

    expect(executed.status).toBe("executed");
    expect(executed.execution?.externalId).toBe("gmail-message-123");
  });

  it("rejects invalid transitions explicitly", () => {
    const proposed = createActionProposal({
      kind: "gmail.web.send_now",
      payload: {
        to: ["recipient@example.com"],
        subject: "Hello"
      },
      requester: {
        type: "agent",
        id: "openclaw"
      }
    });

    const approved = approveActionProposal(proposed, {
      actor: {
        type: "human",
        id: "approver-1"
      }
    });

    expect(() =>
      rejectActionProposal(approved, {
        actor: {
          type: "human",
          id: "approver-1"
        },
        reason: "Too late"
      })
    ).toThrow(InvalidActionTransitionError);
  });

  it("marks expired proposals deterministically before approval", () => {
    const proposed = createActionProposal({
      kind: "gmail.web.schedule_send",
      payload: {
        to: ["recipient@example.com"],
        subject: "Hello",
        schedule: {
          sendAt: "2026-04-05T10:00:00+07:00",
          timezone: "Asia/Bangkok"
        }
      },
      requester: {
        type: "agent",
        id: "openclaw"
      },
      expiresAt: "2026-04-04T07:59:00.000Z",
      createdAt: "2026-04-04T07:58:00.000Z"
    });

    const expired = expireActionProposalIfNeeded(proposed, "2026-04-04T08:00:00.000Z");

    expect(expired.status).toBe("expired");
    expect(expired.statusReason).toContain("expired");
  });

  it("tracks failure terminal states", () => {
    const proposed = createActionProposal({
      kind: "gmail.web.send_now",
      payload: {
        to: ["recipient@example.com"],
        subject: "Hello"
      },
      requester: {
        type: "agent",
        id: "openclaw"
      }
    });

    const approved = approveActionProposal(proposed, {
      actor: {
        type: "human",
        id: "approver-1"
      }
    });
    const executing = markActionProposalExecuting(approved, {
      actor: {
        type: "executor",
        id: "gmail-web-executor"
      }
    });
    const failed = markActionProposalFailed(executing, {
      actor: {
        type: "executor",
        id: "gmail-web-executor"
      },
      errorMessage: "Could not locate Gmail compose button."
    });

    expect(failed.status).toBe("failed");
    expect(failed.execution?.errorMessage).toContain("compose button");
    expect(canTransitionActionStatus("approved", "executing")).toBe(true);
    expect(canTransitionActionStatus("approved", "executed")).toBe(false);
  });
});
