import {
  ActionProposalSchema,
  ActionStatusSchema,
  type ActionActor,
  type ActionKind,
  type JsonObject
} from "@approval-gated-actions/core";
import { z } from "zod";

import { parseExecutableGmailProposal, sortExecutableProposals } from "./mapping";
import type {
  BrokerClientLike,
  ExecutableGmailProposal,
  ExecutorFailureDetails,
  GmailBrowserExecutionResult
} from "./types";

const listResponseSchema = z
  .object({
    proposals: z.array(ActionProposalSchema),
    count: z.number().int().nonnegative()
  })
  .strict();

class BrokerHttpError extends Error {
  public readonly statusCode: number;

  public readonly body: unknown;

  public constructor(message: string, statusCode: number, body: unknown) {
    super(message);
    this.name = "BrokerHttpError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class BrokerTransitionConflictError extends BrokerHttpError {
  public constructor(message: string, body: unknown) {
    super(message, 409, body);
    this.name = "BrokerTransitionConflictError";
  }
}

export interface BrokerClientOptions {
  baseUrl: string;
  actor: ActionActor;
}

export class BrokerClient implements BrokerClientLike {
  private readonly baseUrl: string;

  private readonly actor: ActionActor;

  public constructor(options: BrokerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.actor = options.actor;
  }

  public async fetchApprovedExecutableProposals(): Promise<ExecutableGmailProposal[]> {
    const kinds: ActionKind[] = ["gmail.web.send_now", "gmail.web.schedule_send"];
    const proposals: ExecutableGmailProposal[] = [];

    for (const kind of kinds) {
      const data = await this.fetchJson(
        `/proposals?status=${ActionStatusSchema.parse("approved")}&kind=${kind}`
      );
      const parsed = listResponseSchema.parse(data);
      proposals.push(...parsed.proposals.map(parseExecutableGmailProposal));
    }

    return sortExecutableProposals(proposals);
  }

  public async markExecuting(proposalId: string): Promise<void> {
    await this.postJson(`/proposals/${proposalId}/executing`, {
      actor: this.actor
    });
  }

  public async markExecuted(
    proposalId: string,
    result: GmailBrowserExecutionResult
  ): Promise<void> {
    await this.postJson(`/proposals/${proposalId}/executed`, {
      actor: this.actor,
      externalId: result.externalId ?? null,
      result: (result.details as JsonObject | null | undefined) ?? null
    });
  }

  public async markFailed(
    proposalId: string,
    error: ExecutorFailureDetails
  ): Promise<void> {
    await this.postJson(`/proposals/${proposalId}/failed`, {
      actor: this.actor,
      errorCode: error.errorCode ?? null,
      errorMessage: error.errorMessage,
      details: error.details ?? null
    });
  }

  private async fetchJson(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return this.parseResponse(response);
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return this.parseResponse(response);
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    const parsedBody = text.length > 0 ? JSON.parse(text) : null;

    if (!response.ok) {
      if (response.status === 409) {
        throw new BrokerTransitionConflictError(
          `Broker transition conflict (${response.status})`,
          parsedBody
        );
      }

      throw new BrokerHttpError(
        `Broker request failed with status ${response.status}`,
        response.status,
        parsedBody
      );
    }

    return parsedBody;
  }
}
