import Fastify from "fastify";
import {
  ActionActorSchema,
  ActionKindSchema,
  ActionStatusSchema
} from "@approval-gated-actions/core";
import type {
  ActionKind,
  ActionStatus,
  ApproveActionProposalInput,
  CreateActionProposalInput,
  JsonObject,
  MarkExecutedInput,
  MarkExecutingInput,
  MarkFailedInput,
  RejectActionProposalInput
} from "@approval-gated-actions/core";
import { z, ZodError } from "zod";

import { getBrokerConfig } from "./config";
import { createDatabase } from "./db";
import { InvalidTransitionApiError, ProposalNotFoundError } from "./errors";
import { createProposalRepository } from "./repository";
import { createProposalService } from "./service";

const createProposalBodySchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    kind: ActionKindSchema,
    payload: z.unknown(),
    requester: ActionActorSchema,
    expiresAt: z.string().datetime({ offset: true }).nullable().optional()
  })
  .strict();

const proposalIdParamsSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .strict();

const approveBodySchema = z
  .object({
    actor: ActionActorSchema,
    comment: z.string().nullable().optional(),
    payload: z.unknown().optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional()
  })
  .strict();

const rejectBodySchema = z
  .object({
    actor: ActionActorSchema,
    reason: z.string().nullable().optional()
  })
  .strict();

const executingBodySchema = z
  .object({
    actor: ActionActorSchema
  })
  .strict();

const executedBodySchema = z
  .object({
    actor: ActionActorSchema,
    externalId: z.string().nullable().optional(),
    result: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .strict();

const failedBodySchema = z
  .object({
    actor: ActionActorSchema,
    errorCode: z.string().nullable().optional(),
    errorMessage: z.string().min(1),
    details: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .strict();

const listProposalsQuerySchema = z
  .object({
    status: ActionStatusSchema.optional(),
    kind: ActionKindSchema.optional()
  })
  .strict();

export interface BuildBrokerAppOptions {
  databasePath?: string;
}

function parseBody<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

function parseProposalCreateInput(input: z.infer<typeof createProposalBodySchema>): CreateActionProposalInput {
  return {
    id: input.id,
    kind: input.kind,
    payload: input.payload as never,
    requester: input.requester,
    expiresAt: input.expiresAt ?? null
  };
}

function parseApproveInput(input: z.infer<typeof approveBodySchema>): ApproveActionProposalInput {
  return {
    actor: input.actor,
    comment: input.comment ?? null,
    payload: input.payload as never,
    expiresAt: input.expiresAt
  };
}

function parseExecutingInput(
  input: z.infer<typeof executingBodySchema>
): MarkExecutingInput {
  return {
    actor: input.actor
  };
}

function parseExecutedInput(input: z.infer<typeof executedBodySchema>): MarkExecutedInput {
  return {
    actor: input.actor,
    externalId: input.externalId ?? null,
    result: (input.result as JsonObject | null | undefined) ?? null
  };
}

function parseFailedInput(input: z.infer<typeof failedBodySchema>): MarkFailedInput {
  return {
    actor: input.actor,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage,
    details: (input.details as JsonObject | null | undefined) ?? null
  };
}

function parseRejectInput(input: z.infer<typeof rejectBodySchema>): RejectActionProposalInput {
  return {
    actor: input.actor,
    reason: input.reason ?? null
  };
}

export function buildBrokerApp(options: BuildBrokerAppOptions = {}) {
  const config = getBrokerConfig();
  const database = createDatabase(options.databasePath ?? config.databasePath);
  const repository = createProposalRepository(database);
  const service = createProposalService(repository);
  const app = Fastify({
    logger: false
  });

  app.get("/health", async () => ({
    status: "ok",
    time: new Date().toISOString()
  }));

  app.post("/proposals", async (request, reply) => {
    const body = parseBody(createProposalBodySchema, request.body);
    const proposal = service.createProposal(parseProposalCreateInput(body));
    reply.code(201);
    return { proposal };
  });

  app.get("/proposals/:id", async (request) => {
    const params = proposalIdParamsSchema.parse(request.params);
    return { proposal: service.getProposal(params.id) };
  });

  app.post("/proposals/:id/approve", async (request) => {
    const params = proposalIdParamsSchema.parse(request.params);
    const body = parseBody(approveBodySchema, request.body);
    const result = service.approveProposal(params.id, parseApproveInput(body));
    return result;
  });

  app.post("/proposals/:id/reject", async (request) => {
    const params = proposalIdParamsSchema.parse(request.params);
    const body = parseBody(rejectBodySchema, request.body);
    return { proposal: service.rejectProposal(params.id, parseRejectInput(body)) };
  });

  app.post("/proposals/:id/executing", async (request) => {
    const params = proposalIdParamsSchema.parse(request.params);
    const body = parseBody(executingBodySchema, request.body);
    return { proposal: service.markExecuting(params.id, parseExecutingInput(body)) };
  });

  app.post("/proposals/:id/executed", async (request) => {
    const params = proposalIdParamsSchema.parse(request.params);
    const body = parseBody(executedBodySchema, request.body);
    return { proposal: service.markExecuted(params.id, parseExecutedInput(body)) };
  });

  app.post("/proposals/:id/failed", async (request) => {
    const params = proposalIdParamsSchema.parse(request.params);
    const body = parseBody(failedBodySchema, request.body);
    return { proposal: service.markFailed(params.id, parseFailedInput(body)) };
  });

  app.get("/proposals", async (request) => {
    const query = listProposalsQuerySchema.parse(request.query);
    const proposals = service.listProposals({
      status: query.status as ActionStatus | undefined,
      kind: query.kind as ActionKind | undefined
    });
    return {
      proposals,
      count: proposals.length
    };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: error.issues
      });
      return;
    }

    if (error instanceof ProposalNotFoundError) {
      reply.code(404).send({
        error: "PROPOSAL_NOT_FOUND",
        message: error.message,
        proposalId: error.proposalId
      });
      return;
    }

    if (error instanceof InvalidTransitionApiError) {
      reply.code(409).send({
        error: "INVALID_TRANSITION",
        message: error.message,
        currentStatus: error.currentStatus,
        requestedStatus: error.requestedStatus
      });
      return;
    }

    reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Unknown error."
    });
  });

  app.addHook("onClose", async () => {
    repository.close();
  });

  return app;
}
