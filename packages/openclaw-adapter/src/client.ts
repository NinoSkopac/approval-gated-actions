import { ActionActorSchema, ActionProposalSchema } from "@approval-gated-actions/core";
import { z } from "zod";

import { buildProposalPreview, normalizeEmailActionInput } from "./normalize";
import type {
  CreateBrokerProposalResult,
  CreateProposalOptions,
  OpenClawAdapterClientOptions,
  OpenClawEmailActionInput
} from "./types";

const brokerCreateResponseSchema = z
  .object({
    proposal: ActionProposalSchema
  })
  .strict();

export class AdapterBrokerError extends Error {
  public readonly statusCode: number;

  public readonly body: unknown;

  public constructor(message: string, statusCode: number, body: unknown) {
    super(message);
    this.name = "AdapterBrokerError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class AdapterHashMismatchError extends Error {
  public constructor(expectedHash: string, actualHash: string) {
    super(`Broker returned payload hash ${actualHash}, expected ${expectedHash}.`);
    this.name = "AdapterHashMismatchError";
  }
}

export class OpenClawAdapterClient {
  private readonly brokerBaseUrl: string;

  private readonly requester;

  private readonly fetchImpl: typeof fetch;

  public constructor(options: OpenClawAdapterClientOptions) {
    this.brokerBaseUrl = options.brokerBaseUrl.replace(/\/$/, "");
    this.requester = ActionActorSchema.parse(
      options.requester ?? {
        type: "agent",
        id: "openclaw-adapter",
        displayName: "OpenClaw Adapter"
      }
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async createEmailProposal(
    input: OpenClawEmailActionInput,
    options: CreateProposalOptions = {}
  ): Promise<CreateBrokerProposalResult> {
    const normalized = normalizeEmailActionInput(input as never);
    const preview = buildProposalPreview(normalized);
    const requester = ActionActorSchema.parse(options.requester ?? this.requester);

    const response = await this.fetchImpl(`${this.brokerBaseUrl}/proposals`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        kind: normalized.kind,
        payload: normalized.payload,
        requester,
        expiresAt: options.expiresAt ?? null
      })
    });
    const text = await response.text();
    const body = text.length > 0 ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new AdapterBrokerError(
        `Broker proposal creation failed with status ${response.status}`,
        response.status,
        body
      );
    }

    const parsed = brokerCreateResponseSchema.parse(body);

    if (parsed.proposal.payloadHash !== normalized.payloadHash) {
      throw new AdapterHashMismatchError(
        normalized.payloadHash,
        parsed.proposal.payloadHash
      );
    }

    return {
      proposalId: parsed.proposal.id,
      status: parsed.proposal.status,
      kind: parsed.proposal.kind,
      payloadHash: normalized.payloadHash,
      preview
    };
  }
}

export function createOpenClawAdapterClient(
  options: OpenClawAdapterClientOptions
): OpenClawAdapterClient {
  return new OpenClawAdapterClient(options);
}
