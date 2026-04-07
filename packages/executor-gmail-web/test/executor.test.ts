import { describe, expect, it, vi } from "vitest";

import { BrokerTransitionConflictError } from "../src/broker-client";
import { GmailWebExecutor } from "../src/executor";
import { GmailBrowserExecutionFlow } from "../src/gmail-browser-flow";
import type {
  BrokerClientLike,
  ExecutableGmailProposal,
  ExecutorFailureDetails,
  GmailBrowserBackend,
  GmailBrowserExecutionResult
} from "../src/types";

function createProposal(kind: ExecutableGmailProposal["kind"]): ExecutableGmailProposal {
  return {
    id: `${kind}-1`,
    kind,
    status: "approved",
    payloadHash: "a".repeat(64),
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
    payload:
      kind === "gmail.web.schedule_send"
        ? {
            to: ["lead@example.com"],
            cc: [],
            bcc: [],
            subject: "Hello",
            text: "Body",
            schedule: {
              sendAt: "2026-04-05T09:30:00-04:00",
              timezone: "America/New_York"
            }
          }
        : {
            to: ["lead@example.com"],
            cc: [],
            bcc: [],
            subject: "Hello",
            text: "Body"
          }
  };
}

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

describe("GmailWebExecutor", () => {
  it("marks successful executions executed", async () => {
    const markExecuted = vi.fn<BrokerClientLike["markExecuted"]>().mockResolvedValue();
    const brokerClient: BrokerClientLike = {
      fetchApprovedExecutableProposals: vi.fn().mockResolvedValue([
        createProposal("gmail.web.send_now")
      ]),
      markExecuting: vi.fn().mockResolvedValue(),
      markExecuted,
      markFailed: vi.fn().mockResolvedValue()
    };
    const flow = {
      execute: vi.fn().mockResolvedValue({
        verification: "toast",
        externalId: null
      } satisfies GmailBrowserExecutionResult)
    } as unknown as GmailBrowserExecutionFlow;
    const browserBackend: GmailBrowserBackend = {
      kind: "playwright",
      displayName: "Test Backend",
      openSession: vi.fn()
    };
    const executor = new GmailWebExecutor({
      brokerClient,
      browserBackend,
      flow,
      logger: createLogger()
    });

    const summary = await executor.runOnce();

    expect(summary).toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0
    });
    expect(markExecuted).toHaveBeenCalledTimes(1);
  });

  it("marks action failures failed", async () => {
    const markFailed = vi.fn<BrokerClientLike["markFailed"]>().mockResolvedValue();
    const brokerClient: BrokerClientLike = {
      fetchApprovedExecutableProposals: vi.fn().mockResolvedValue([
        createProposal("gmail.web.send_now")
      ]),
      markExecuting: vi.fn().mockResolvedValue(),
      markExecuted: vi.fn().mockResolvedValue(),
      markFailed
    };
    const flow = {
      execute: vi.fn().mockRejectedValue(new Error("Gmail toast not found"))
    } as unknown as GmailBrowserExecutionFlow;
    const browserBackend: GmailBrowserBackend = {
      kind: "playwright",
      displayName: "Test Backend",
      openSession: vi.fn()
    };
    const executor = new GmailWebExecutor({
      brokerClient,
      browserBackend,
      flow,
      logger: createLogger()
    });

    const summary = await executor.runOnce();

    expect(summary.failed).toBe(1);
    expect(markFailed).toHaveBeenCalledWith(
      "gmail.web.send_now-1",
      expect.objectContaining<ExecutorFailureDetails>({
        errorMessage: "Gmail toast not found"
      })
    );
  });

  it("skips proposals lost to another executor", async () => {
    const brokerClient: BrokerClientLike = {
      fetchApprovedExecutableProposals: vi.fn().mockResolvedValue([
        createProposal("gmail.web.send_now")
      ]),
      markExecuting: vi
        .fn()
        .mockRejectedValue(new BrokerTransitionConflictError("conflict", {})),
      markExecuted: vi.fn().mockResolvedValue(),
      markFailed: vi.fn().mockResolvedValue()
    };
    const flow = {
      execute: vi.fn().mockResolvedValue({
        verification: "toast"
      } satisfies GmailBrowserExecutionResult)
    } as unknown as GmailBrowserExecutionFlow;
    const browserBackend: GmailBrowserBackend = {
      kind: "playwright",
      displayName: "Test Backend",
      openSession: vi.fn()
    };
    const executor = new GmailWebExecutor({
      brokerClient,
      browserBackend,
      flow,
      logger: createLogger()
    });

    const summary = await executor.runOnce();

    expect(summary.skipped).toBe(1);
    expect(flow.execute).not.toHaveBeenCalled();
  });
});
