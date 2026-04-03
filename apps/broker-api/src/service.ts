import {
  InvalidActionTransitionError,
  SYSTEM_EXPIRY_ACTOR,
  approveActionProposal,
  createActionProposal,
  expireActionProposalIfNeeded,
  haveProposalContentsChanged,
  markActionProposalExecuted,
  markActionProposalExecuting,
  markActionProposalFailed,
  rejectActionProposal
} from "@approval-gated-actions/core";
import type {
  ActionActor,
  ActionProposal,
  ActionProposalOf,
  ActionStatus,
  ApproveActionProposalInput,
  CreateActionProposalInput,
  ListProposalFilters,
  MarkExecutedInput,
  MarkExecutingInput,
  MarkFailedInput,
  RejectActionProposalInput
} from "@approval-gated-actions/core";

import { InvalidTransitionApiError, ProposalNotFoundError } from "./errors";
import type { ProposalRepository } from "./repository";

export interface ProposalService {
  createProposal(input: CreateActionProposalInput): ActionProposal;
  getProposal(id: string): ActionProposal;
  listProposals(filters: ListProposalFilters): ActionProposal[];
  approveProposal(
    id: string,
    input: ApproveActionProposalInput
  ): { proposal: ActionProposal; auditCount: number };
  rejectProposal(id: string, input: RejectActionProposalInput): ActionProposal;
  markExecuting(id: string, input: MarkExecutingInput): ActionProposal;
  markExecuted(id: string, input: MarkExecutedInput): ActionProposal;
  markFailed(id: string, input: MarkFailedInput): ActionProposal;
}

function nowIso(): string {
  return new Date().toISOString();
}

function editedMetadata(before: ActionProposal, after: ActionProposal): Record<string, unknown> {
  return {
    payloadChanged: before.payloadHash !== after.payloadHash,
    expiresAtChanged: before.expiresAt !== after.expiresAt,
    previousPayloadHash: before.payloadHash,
    nextPayloadHash: after.payloadHash,
    previousExpiresAt: before.expiresAt,
    nextExpiresAt: after.expiresAt
  };
}

function translateTransitionError(error: unknown): never {
  if (error instanceof InvalidActionTransitionError) {
    throw new InvalidTransitionApiError(error.fromStatus, error.toStatus);
  }

  throw error;
}

export function createProposalService(repository: ProposalRepository): ProposalService {
  function expireStaleProposals(currentTime: string): void {
    repository.transaction(() => {
      const stale = repository.listExpiredProposals(currentTime);

      for (const proposal of stale) {
        const expired = expireActionProposalIfNeeded(proposal, currentTime, SYSTEM_EXPIRY_ACTOR);

        if (expired.status !== proposal.status) {
          repository.updateProposal(expired);
          repository.addAuditEvent({
            proposalId: expired.id,
            eventType: "proposal.expired",
            actor: SYSTEM_EXPIRY_ACTOR,
            timestamp: currentTime,
            fromStatus: proposal.status,
            toStatus: expired.status,
            metadata: {
              reason: expired.statusReason
            }
          });
        }
      }
    });
  }

  function getCurrentProposalWithinTransaction(
    id: string,
    currentTime: string
  ): ActionProposal {
    const proposal = repository.getProposal(id);

    if (!proposal) {
      throw new ProposalNotFoundError(id);
    }

    const expired = expireActionProposalIfNeeded(proposal, currentTime, SYSTEM_EXPIRY_ACTOR);

    if (expired.status !== proposal.status) {
      repository.updateProposal(expired);
      repository.addAuditEvent({
        proposalId: expired.id,
        eventType: "proposal.expired",
        actor: SYSTEM_EXPIRY_ACTOR,
        timestamp: currentTime,
        fromStatus: proposal.status,
        toStatus: expired.status,
        metadata: {
          reason: expired.statusReason
        }
      });
    }

    return expired;
  }

  function getCurrentProposal(id: string, currentTime: string): ActionProposal {
    return repository.transaction(() => getCurrentProposalWithinTransaction(id, currentTime));
  }

  function transitionProposal(
    id: string,
    nextStatus: ActionStatus,
    actor: ActionActor,
    handler: (proposal: ActionProposal) => ActionProposal,
    metadataFactory?: (before: ActionProposal, after: ActionProposal) => Record<string, unknown> | null
  ): ActionProposal {
    const currentTime = nowIso();

    try {
      return repository.transaction(() => {
        const current = getCurrentProposalWithinTransaction(id, currentTime);
        const updated = handler(current);

        repository.updateProposal(updated);
        repository.addAuditEvent({
          proposalId: id,
          eventType:
            nextStatus === "approved"
              ? "proposal.approved"
              : nextStatus === "rejected"
                ? "proposal.rejected"
                : nextStatus === "executing"
                  ? "proposal.executing"
                  : nextStatus === "executed"
                    ? "proposal.executed"
                    : "proposal.failed",
          actor,
          timestamp: updated.updatedAt,
          fromStatus: current.status,
          toStatus: updated.status,
          metadata: metadataFactory ? metadataFactory(current, updated) : null
        });

        return updated;
      });
    } catch (error) {
      translateTransitionError(error);
    }
  }

  return {
    createProposal(input): ActionProposal {
      const proposal = createActionProposal(input);

      return repository.transaction(() => {
        repository.createProposal(proposal);
        repository.addAuditEvent({
          proposalId: proposal.id,
          eventType: "proposal.created",
          actor: proposal.requester,
          timestamp: proposal.createdAt,
          fromStatus: null,
          toStatus: proposal.status,
          metadata: {
            kind: proposal.kind,
            payloadHash: proposal.payloadHash,
            expiresAt: proposal.expiresAt
          }
        });
        return proposal;
      });
    },
    getProposal(id): ActionProposal {
      return getCurrentProposal(id, nowIso());
    },
    listProposals(filters): ActionProposal[] {
      expireStaleProposals(nowIso());
      return repository.listProposals(filters);
    },
    approveProposal(id, input): { proposal: ActionProposal; auditCount: number } {
      const currentTime = nowIso();

      try {
        return repository.transaction(() => {
          const current = getCurrentProposalWithinTransaction(id, currentTime) as ActionProposalOf<
            typeof input extends ApproveActionProposalInput<infer K> ? K : never
          >;
          const approved = approveActionProposal(current, input as never);
          let auditCount = 1;

          if (haveProposalContentsChanged(current, approved)) {
            repository.addAuditEvent({
              proposalId: id,
              eventType: "proposal.edited",
              actor: input.actor,
              timestamp: approved.updatedAt,
              fromStatus: current.status,
              toStatus: current.status,
              metadata: editedMetadata(current, approved)
            });
            auditCount += 1;
          }

          repository.updateProposal(approved);
          repository.addAuditEvent({
            proposalId: id,
            eventType: "proposal.approved",
            actor: input.actor,
            timestamp: approved.updatedAt,
            fromStatus: current.status,
            toStatus: approved.status,
            metadata: {
              comment: input.comment ?? null
            }
          });

          return { proposal: approved, auditCount };
        });
      } catch (error) {
        translateTransitionError(error);
      }
    },
    rejectProposal(id, input): ActionProposal {
      return transitionProposal(
        id,
        "rejected",
        input.actor,
        (proposal) => rejectActionProposal(proposal, input),
        (_before, after) => ({
          reason: after.rejection?.reason ?? null
        })
      );
    },
    markExecuting(id, input): ActionProposal {
      return transitionProposal(
        id,
        "executing",
        input.actor,
        (proposal) => markActionProposalExecuting(proposal, input)
      );
    },
    markExecuted(id, input): ActionProposal {
      return transitionProposal(
        id,
        "executed",
        input.actor,
        (proposal) => markActionProposalExecuted(proposal, input),
        (_before, after) => ({
          externalId: after.execution?.externalId ?? null
        })
      );
    },
    markFailed(id, input): ActionProposal {
      return transitionProposal(
        id,
        "failed",
        input.actor,
        (proposal) => markActionProposalFailed(proposal, input),
        (_before, after) => ({
          errorCode: after.execution?.errorCode ?? null,
          errorMessage: after.execution?.errorMessage ?? null
        })
      );
    }
  };
}
