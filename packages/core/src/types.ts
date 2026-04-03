import type { z } from "zod";

import {
  ActionActorSchema,
  ActionAuditEventSchema,
  ActionKindSchema,
  ActionProposalSchema,
  ActionStatusSchema,
  GmailApiCreateDraftPayloadSchema,
  GmailWebScheduleSendPayloadSchema,
  GmailWebSendNowPayloadSchema
} from "./schemas";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type ActionKind = z.infer<typeof ActionKindSchema>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type ActionActor = z.infer<typeof ActionActorSchema>;

export type GmailWebSendNowPayload = z.infer<typeof GmailWebSendNowPayloadSchema>;
export type GmailWebScheduleSendPayload = z.infer<
  typeof GmailWebScheduleSendPayloadSchema
>;
export type GmailApiCreateDraftPayload = z.infer<
  typeof GmailApiCreateDraftPayloadSchema
>;

export interface GmailWebSendNowPayloadInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
}

export interface GmailWebScheduleSendPayloadInput extends GmailWebSendNowPayloadInput {
  schedule: {
    sendAt: string;
    timezone: string;
  };
}

export interface GmailApiCreateDraftPayloadInput {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
}

export interface ActionPayloadByKind {
  "gmail.web.send_now": GmailWebSendNowPayload;
  "gmail.web.schedule_send": GmailWebScheduleSendPayload;
  "gmail.api.create_draft": GmailApiCreateDraftPayload;
}

export interface ActionPayloadInputByKind {
  "gmail.web.send_now": GmailWebSendNowPayloadInput;
  "gmail.web.schedule_send": GmailWebScheduleSendPayloadInput;
  "gmail.api.create_draft": GmailApiCreateDraftPayloadInput;
}

export type ActionProposal = z.infer<typeof ActionProposalSchema>;
export type ActionAuditEvent = z.infer<typeof ActionAuditEventSchema>;

export type ActionProposalOf<K extends ActionKind> = Extract<ActionProposal, { kind: K }>;

export interface CreateActionProposalInput<K extends ActionKind = ActionKind> {
  id?: string;
  kind: K;
  payload: ActionPayloadInputByKind[K];
  requester: ActionActor;
  createdAt?: string;
  expiresAt?: string | null;
}

export interface ApproveActionProposalInput<K extends ActionKind = ActionKind> {
  actor: ActionActor;
  approvedAt?: string;
  comment?: string | null;
  payload?: ActionPayloadInputByKind[K];
  expiresAt?: string | null;
}

export interface RejectActionProposalInput {
  actor: ActionActor;
  rejectedAt?: string;
  reason?: string | null;
}

export interface ExpireActionProposalInput {
  actor?: ActionActor;
  expiredAt?: string;
  reason?: string | null;
}

export interface MarkExecutingInput {
  actor: ActionActor;
  startedAt?: string;
}

export interface MarkExecutedInput {
  actor: ActionActor;
  completedAt?: string;
  externalId?: string | null;
  result?: JsonObject | null;
}

export interface MarkFailedInput {
  actor: ActionActor;
  failedAt?: string;
  errorCode?: string | null;
  errorMessage: string;
  details?: JsonObject | null;
}

export interface ListProposalFilters {
  status?: ActionStatus;
  kind?: ActionKind;
}
