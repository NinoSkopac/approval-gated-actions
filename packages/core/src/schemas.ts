import { z } from "zod";

const isoTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

const nullableIsoTimestampSchema = isoTimestampSchema.nullable();

const emailAddressSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

const actionMetadataSchema = z.record(z.string(), z.unknown());

const gmailMessageBaseSchema = z
  .object({
    to: z.array(emailAddressSchema).default([]),
    cc: z.array(emailAddressSchema).default([]),
    bcc: z.array(emailAddressSchema).default([]),
    subject: z.string().default(""),
    text: z.string().optional(),
    html: z.string().optional()
  })
  .strict();

export const GmailWebSendNowPayloadSchema = gmailMessageBaseSchema
  .extend({
    to: z.array(emailAddressSchema).min(1)
  })
  .strict();

export const GmailWebScheduleSendPayloadSchema = gmailMessageBaseSchema
  .extend({
    to: z.array(emailAddressSchema).min(1),
    schedule: z
      .object({
        sendAt: isoTimestampSchema,
        timezone: z.string().trim().min(1)
      })
      .strict()
  })
  .strict();

export const GmailApiCreateDraftPayloadSchema = gmailMessageBaseSchema;

export const ActionKindSchema = z.enum([
  "gmail.web.send_now",
  "gmail.web.schedule_send",
  "gmail.api.create_draft"
]);

export const ActionStatusSchema = z.enum([
  "proposed",
  "approved",
  "rejected",
  "expired",
  "executing",
  "executed",
  "failed"
]);

export const ActionActorSchema = z
  .object({
    type: z.enum(["agent", "human", "executor", "system"]),
    id: z.string().trim().min(1),
    displayName: z.string().trim().min(1).optional(),
    metadata: actionMetadataSchema.optional()
  })
  .strict();

export const ProposalApprovalSchema = z
  .object({
    approvedAt: isoTimestampSchema,
    approvedBy: ActionActorSchema,
    comment: z.string().nullable().optional()
  })
  .strict();

export const ProposalRejectionSchema = z
  .object({
    rejectedAt: isoTimestampSchema,
    rejectedBy: ActionActorSchema,
    reason: z.string().nullable().optional()
  })
  .strict();

export const ProposalExecutionSchema = z
  .object({
    startedAt: isoTimestampSchema.optional(),
    startedBy: ActionActorSchema.optional(),
    completedAt: isoTimestampSchema.optional(),
    completedBy: ActionActorSchema.optional(),
    externalId: z.string().nullable().optional(),
    result: z.record(z.string(), z.unknown()).nullable().optional(),
    errorCode: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    details: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .strict();

const proposalBaseSchema = z
  .object({
    id: z.string().trim().min(1),
    status: ActionStatusSchema,
    payloadHash: z.string().trim().length(64),
    requester: ActionActorSchema,
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    expiresAt: nullableIsoTimestampSchema.optional(),
    statusReason: z.string().nullable().optional(),
    approval: ProposalApprovalSchema.nullable().optional(),
    rejection: ProposalRejectionSchema.nullable().optional(),
    execution: ProposalExecutionSchema.nullable().optional(),
    version: z.number().int().positive()
  })
  .strict();

export const ActionProposalSchema = z.discriminatedUnion("kind", [
  proposalBaseSchema
    .extend({
      kind: z.literal("gmail.web.send_now"),
      payload: GmailWebSendNowPayloadSchema
    })
    .strict(),
  proposalBaseSchema
    .extend({
      kind: z.literal("gmail.web.schedule_send"),
      payload: GmailWebScheduleSendPayloadSchema
    })
    .strict(),
  proposalBaseSchema
    .extend({
      kind: z.literal("gmail.api.create_draft"),
      payload: GmailApiCreateDraftPayloadSchema
    })
    .strict()
]);

export const ActionAuditEventSchema = z
  .object({
    id: z.string().trim().min(1),
    proposalId: z.string().trim().min(1),
    eventType: z.enum([
      "proposal.created",
      "proposal.edited",
      "proposal.approved",
      "proposal.rejected",
      "proposal.expired",
      "proposal.executing",
      "proposal.executed",
      "proposal.failed"
    ]),
    actor: ActionActorSchema,
    timestamp: isoTimestampSchema,
    fromStatus: ActionStatusSchema.nullable().optional(),
    toStatus: ActionStatusSchema.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .strict();

export const actionPayloadSchemas = {
  "gmail.web.send_now": GmailWebSendNowPayloadSchema,
  "gmail.web.schedule_send": GmailWebScheduleSendPayloadSchema,
  "gmail.api.create_draft": GmailApiCreateDraftPayloadSchema
} as const;

export const IsoTimestampSchema = isoTimestampSchema;
