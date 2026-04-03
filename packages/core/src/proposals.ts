import { randomUUID } from "node:crypto";

import { hashActionPayload, stableStringify } from "./hash";
import {
  actionPayloadSchemas,
  ActionProposalSchema,
  ActionStatusSchema,
  IsoTimestampSchema
} from "./schemas";
import type {
  ActionActor,
  ActionKind,
  ActionPayloadInputByKind,
  ActionPayloadByKind,
  ActionProposal,
  ActionProposalOf,
  ActionStatus,
  ApproveActionProposalInput,
  CreateActionProposalInput,
  ExpireActionProposalInput,
  JsonObject,
  MarkExecutedInput,
  MarkExecutingInput,
  MarkFailedInput,
  RejectActionProposalInput
} from "./types";

const VALID_TRANSITIONS: Readonly<Record<ActionStatus, readonly ActionStatus[]>> = {
  proposed: ["approved", "rejected", "expired"],
  approved: ["executing"],
  rejected: [],
  expired: [],
  executing: ["executed", "failed"],
  executed: [],
  failed: []
};

export const SYSTEM_EXPIRY_ACTOR: ActionActor = {
  type: "system",
  id: "broker-expiry"
};

export class InvalidActionTransitionError extends Error {
  public readonly fromStatus: ActionStatus;

  public readonly toStatus: ActionStatus;

  public constructor(fromStatus: ActionStatus, toStatus: ActionStatus) {
    super(`Invalid action proposal transition: ${fromStatus} -> ${toStatus}`);
    this.name = "InvalidActionTransitionError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

function normalizeTimestamp(value?: string): string {
  return IsoTimestampSchema.parse(value ?? new Date().toISOString());
}

function normalizeOptionalTimestamp(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return IsoTimestampSchema.parse(value);
}

function normalizePayload<K extends ActionKind>(
  kind: K,
  payload: ActionPayloadInputByKind[K] | ActionPayloadByKind[K]
): ActionPayloadByKind[K] {
  return actionPayloadSchemas[kind].parse(payload) as ActionPayloadByKind[K];
}

function nextVersion(proposal: ActionProposal): number {
  return proposal.version + 1;
}

function finalizeProposal(proposal: unknown): ActionProposal {
  return ActionProposalSchema.parse(proposal);
}

function transitionStatus(
  proposal: ActionProposal,
  nextStatus: ActionStatus,
  updatedAt: string,
  statusReason?: string | null
): ActionProposal {
  assertValidActionTransition(proposal.status, nextStatus);

  return finalizeProposal({
    ...proposal,
    status: nextStatus,
    updatedAt,
    statusReason: statusReason ?? null,
    version: nextVersion(proposal)
  });
}

export function canTransitionActionStatus(
  fromStatus: ActionStatus,
  toStatus: ActionStatus
): boolean {
  return VALID_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertValidActionTransition(
  fromStatus: ActionStatus,
  toStatus: ActionStatus
): void {
  ActionStatusSchema.parse(fromStatus);
  ActionStatusSchema.parse(toStatus);

  if (!canTransitionActionStatus(fromStatus, toStatus)) {
    throw new InvalidActionTransitionError(fromStatus, toStatus);
  }
}

export function normalizeActionPayload<K extends ActionKind>(
  kind: K,
  payload: ActionPayloadInputByKind[K] | ActionPayloadByKind[K]
): ActionPayloadByKind[K] {
  return normalizePayload(kind, payload);
}

export function createActionProposal<K extends ActionKind>(
  input: CreateActionProposalInput<K>
): ActionProposalOf<K> {
  const createdAt = normalizeTimestamp(input.createdAt);
  const expiresAt = normalizeOptionalTimestamp(input.expiresAt);
  const payload = normalizePayload(input.kind, input.payload);

  const proposal = finalizeProposal({
    id: input.id ?? randomUUID(),
    kind: input.kind,
    status: "proposed",
    payload,
    payloadHash: hashActionPayload(input.kind, payload),
    requester: input.requester,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    statusReason: null,
    approval: null,
    rejection: null,
    execution: null,
    version: 1
  });

  return proposal as ActionProposalOf<K>;
}

export function isProposalExpired(proposal: ActionProposal, now?: string): boolean {
  if (!proposal.expiresAt || proposal.status !== "proposed") {
    return false;
  }

  return proposal.expiresAt <= normalizeTimestamp(now);
}

export function expireActionProposal(
  proposal: ActionProposal,
  input: ExpireActionProposalInput = {}
): ActionProposal {
  const expiredAt = normalizeTimestamp(input.expiredAt);
  const statusReason = input.reason ?? "Proposal expired before approval.";
  const actor = input.actor ?? SYSTEM_EXPIRY_ACTOR;

  const expired = transitionStatus(proposal, "expired", expiredAt, statusReason);

  return finalizeProposal({
    ...expired,
    rejection: {
      rejectedAt: expiredAt,
      rejectedBy: actor,
      reason: statusReason
    }
  });
}

export function expireActionProposalIfNeeded(
  proposal: ActionProposal,
  now?: string,
  actor: ActionActor = SYSTEM_EXPIRY_ACTOR
): ActionProposal {
  if (!isProposalExpired(proposal, now)) {
    return proposal;
  }

  return expireActionProposal(proposal, {
    actor,
    expiredAt: now,
    reason: "Proposal expired before approval."
  });
}

export function approveActionProposal<K extends ActionKind>(
  proposal: ActionProposalOf<K>,
  input: ApproveActionProposalInput<K>
): ActionProposalOf<K> {
  const approvedAt = normalizeTimestamp(input.approvedAt);
  const payload = (input.payload
    ? normalizePayload(proposal.kind, input.payload)
    : proposal.payload) as ActionPayloadByKind[K];
  const expiresAt = normalizeOptionalTimestamp(
    input.expiresAt === undefined ? proposal.expiresAt : input.expiresAt
  );

  const approved = transitionStatus(proposal, "approved", approvedAt, null);

  return finalizeProposal({
    ...approved,
    payload,
    payloadHash: hashActionPayload(proposal.kind, payload),
    expiresAt,
    approval: {
      approvedAt,
      approvedBy: input.actor,
      comment: input.comment ?? null
    },
    rejection: null
  }) as ActionProposalOf<K>;
}

export function rejectActionProposal(
  proposal: ActionProposal,
  input: RejectActionProposalInput
): ActionProposal {
  const rejectedAt = normalizeTimestamp(input.rejectedAt);
  const statusReason = input.reason ?? null;
  const rejected = transitionStatus(proposal, "rejected", rejectedAt, statusReason);

  return finalizeProposal({
    ...rejected,
    rejection: {
      rejectedAt,
      rejectedBy: input.actor,
      reason: statusReason
    }
  });
}

export function markActionProposalExecuting(
  proposal: ActionProposal,
  input: MarkExecutingInput
): ActionProposal {
  const startedAt = normalizeTimestamp(input.startedAt);
  const executing = transitionStatus(proposal, "executing", startedAt, null);

  return finalizeProposal({
    ...executing,
    execution: {
      ...(proposal.execution ?? {}),
      startedAt,
      startedBy: input.actor
    }
  });
}

export function markActionProposalExecuted(
  proposal: ActionProposal,
  input: MarkExecutedInput
): ActionProposal {
  const completedAt = normalizeTimestamp(input.completedAt);
  const executed = transitionStatus(proposal, "executed", completedAt, null);

  return finalizeProposal({
    ...executed,
    execution: {
      ...(proposal.execution ?? {}),
      completedAt,
      completedBy: input.actor,
      externalId: input.externalId ?? null,
      result: input.result ?? null,
      errorCode: null,
      errorMessage: null,
      details: null
    }
  });
}

export function markActionProposalFailed(
  proposal: ActionProposal,
  input: MarkFailedInput
): ActionProposal {
  const failedAt = normalizeTimestamp(input.failedAt);
  const failed = transitionStatus(proposal, "failed", failedAt, input.errorMessage);

  return finalizeProposal({
    ...failed,
    execution: {
      ...(proposal.execution ?? {}),
      completedAt: failedAt,
      completedBy: input.actor,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage,
      details: input.details ?? null
    }
  });
}

export function haveProposalContentsChanged(
  previous: ActionProposal,
  next: ActionProposal
): boolean {
  if (previous.expiresAt !== next.expiresAt || previous.payloadHash !== next.payloadHash) {
    return true;
  }

  return stableStringify(previous.payload as JsonObject) !== stableStringify(next.payload as JsonObject);
}
