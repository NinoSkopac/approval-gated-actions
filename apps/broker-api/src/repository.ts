import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { ActionAuditEventSchema, ActionProposalSchema, stableStringify } from "@approval-gated-actions/core";
import type {
  ActionActor,
  ActionAuditEvent,
  ActionKind,
  ActionProposal,
  ActionStatus,
  JsonObject,
  ListProposalFilters
} from "@approval-gated-actions/core";

function parseJson<T>(value: string | null): T | null {
  if (value === null) {
    return null;
  }

  return JSON.parse(value) as T;
}

function serializeJson(value: unknown): string {
  return stableStringify(value as JsonObject);
}

function mapProposalRow(row: Record<string, unknown>): ActionProposal {
  return ActionProposalSchema.parse({
    id: row.id,
    kind: row.kind,
    status: row.status,
    payload: parseJson(row.payload_json as string),
    payloadHash: row.payload_hash,
    requester: parseJson(row.requester_json as string),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    statusReason: row.status_reason,
    approval: parseJson(row.approval_json as string | null),
    rejection: parseJson(row.rejection_json as string | null),
    execution: parseJson(row.execution_json as string | null),
    version: row.version
  });
}

function mapAuditRow(row: Record<string, unknown>): ActionAuditEvent {
  return ActionAuditEventSchema.parse({
    id: row.id,
    proposalId: row.proposal_id,
    eventType: row.event_type,
    actor: parseJson(row.actor_json as string),
    timestamp: row.timestamp,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    metadata: parseJson(row.metadata_json as string | null)
  });
}

export interface ProposalRepository {
  close(): void;
  transaction<T>(fn: () => T): T;
  createProposal(proposal: ActionProposal): void;
  updateProposal(proposal: ActionProposal): void;
  getProposal(id: string): ActionProposal | null;
  listProposals(filters: ListProposalFilters): ActionProposal[];
  listExpiredProposals(nowIso: string): ActionProposal[];
  addAuditEvent(event: Omit<ActionAuditEvent, "id"> & { id?: string }): ActionAuditEvent;
  listAuditEvents(proposalId: string): ActionAuditEvent[];
}

export function createProposalRepository(database: DatabaseSync): ProposalRepository {
  return {
    close(): void {
      database.close();
    },
    transaction<T>(fn: () => T): T {
      database.exec("BEGIN");

      try {
        const result = fn();
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    createProposal(proposal): void {
      database
        .prepare(
          `
            INSERT INTO proposals (
              id,
              kind,
              status,
              payload_json,
              payload_hash,
              requester_json,
              created_at,
              updated_at,
              expires_at,
              status_reason,
              approval_json,
              rejection_json,
              execution_json,
              version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          proposal.id,
          proposal.kind,
          proposal.status,
          serializeJson(proposal.payload),
          proposal.payloadHash,
          serializeJson(proposal.requester),
          proposal.createdAt,
          proposal.updatedAt,
          proposal.expiresAt ?? null,
          proposal.statusReason ?? null,
          proposal.approval ? serializeJson(proposal.approval) : null,
          proposal.rejection ? serializeJson(proposal.rejection) : null,
          proposal.execution ? serializeJson(proposal.execution) : null,
          proposal.version
        );
    },
    updateProposal(proposal): void {
      database
        .prepare(
          `
            UPDATE proposals
            SET
              kind = ?,
              status = ?,
              payload_json = ?,
              payload_hash = ?,
              requester_json = ?,
              created_at = ?,
              updated_at = ?,
              expires_at = ?,
              status_reason = ?,
              approval_json = ?,
              rejection_json = ?,
              execution_json = ?,
              version = ?
            WHERE id = ?
          `
        )
        .run(
          proposal.kind,
          proposal.status,
          serializeJson(proposal.payload),
          proposal.payloadHash,
          serializeJson(proposal.requester),
          proposal.createdAt,
          proposal.updatedAt,
          proposal.expiresAt ?? null,
          proposal.statusReason ?? null,
          proposal.approval ? serializeJson(proposal.approval) : null,
          proposal.rejection ? serializeJson(proposal.rejection) : null,
          proposal.execution ? serializeJson(proposal.execution) : null,
          proposal.version,
          proposal.id
        );
    },
    getProposal(id): ActionProposal | null {
      const row = database.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;

      return row ? mapProposalRow(row) : null;
    },
    listProposals(filters): ActionProposal[] {
      const where: string[] = [];
      const parameters: Array<ActionKind | ActionStatus> = [];

      if (filters.status) {
        where.push("status = ?");
        parameters.push(filters.status);
      }

      if (filters.kind) {
        where.push("kind = ?");
        parameters.push(filters.kind);
      }

      const query = `
        SELECT *
        FROM proposals
        ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC, id DESC
      `;

      return (database.prepare(query).all(...parameters) as Array<Record<string, unknown>>).map(
        mapProposalRow
      );
    },
    listExpiredProposals(nowIso): ActionProposal[] {
      return (
        database
          .prepare(
            `
              SELECT *
              FROM proposals
              WHERE status = 'proposed'
                AND expires_at IS NOT NULL
                AND expires_at <= ?
              ORDER BY expires_at ASC
            `
          )
          .all(nowIso) as Array<Record<string, unknown>>
      ).map(mapProposalRow);
    },
    addAuditEvent(event): ActionAuditEvent {
      const parsed = ActionAuditEventSchema.parse({
        id: event.id ?? randomUUID(),
        proposalId: event.proposalId,
        eventType: event.eventType,
        actor: event.actor,
        timestamp: event.timestamp,
        fromStatus: event.fromStatus ?? null,
        toStatus: event.toStatus ?? null,
        metadata: event.metadata ?? null
      });

      database
        .prepare(
          `
            INSERT INTO audit_log (
              id,
              proposal_id,
              event_type,
              from_status,
              to_status,
              actor_json,
              timestamp,
              metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          parsed.id,
          parsed.proposalId,
          parsed.eventType,
          parsed.fromStatus ?? null,
          parsed.toStatus ?? null,
          serializeJson(parsed.actor),
          parsed.timestamp,
          parsed.metadata ? serializeJson(parsed.metadata) : null
        );

      return parsed;
    },
    listAuditEvents(proposalId): ActionAuditEvent[] {
      return (
        database
          .prepare("SELECT * FROM audit_log WHERE proposal_id = ? ORDER BY timestamp ASC, id ASC")
          .all(proposalId) as Array<Record<string, unknown>>
      ).map(mapAuditRow);
    }
  };
}

export function createSystemAuditActor(): ActionActor {
  return {
    type: "system",
    id: "broker-api"
  };
}
