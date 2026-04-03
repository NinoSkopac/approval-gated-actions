import type { ActionStatus } from "@approval-gated-actions/core";

export class ProposalNotFoundError extends Error {
  public readonly proposalId: string;

  public constructor(proposalId: string) {
    super(`Proposal not found: ${proposalId}`);
    this.name = "ProposalNotFoundError";
    this.proposalId = proposalId;
  }
}

export class InvalidTransitionApiError extends Error {
  public readonly currentStatus: ActionStatus;

  public readonly requestedStatus: ActionStatus;

  public constructor(currentStatus: ActionStatus, requestedStatus: ActionStatus) {
    super(`Proposal cannot transition from ${currentStatus} to ${requestedStatus}`);
    this.name = "InvalidTransitionApiError";
    this.currentStatus = currentStatus;
    this.requestedStatus = requestedStatus;
  }
}
