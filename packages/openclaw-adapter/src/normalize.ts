import {
  hashActionPayload,
  normalizeActionPayload,
  type ActionKind
} from "@approval-gated-actions/core";

import { OpenClawEmailActionInputSchema } from "./schemas";
import type {
  AdapterActionKindByMode,
  NormalizedAdapterProposal,
  OpenClawEmailActionInput,
  OpenClawEmailMode,
  ProposalPreviewMetadata
} from "./types";

const actionKindByMode: AdapterActionKindByMode = {
  send_now: "gmail.web.send_now",
  schedule_send: "gmail.web.schedule_send",
  create_draft: "gmail.api.create_draft"
};

function bodyFormatOf(input: { text?: string; html?: string }): "text" | "html" | "both" {
  if (input.text && input.html) {
    return "both";
  }

  if (input.html) {
    return "html";
  }

  return "text";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildBodyPreview(input: { text?: string; html?: string }): string {
  const source = input.text ?? (input.html ? stripHtml(input.html) : "");
  return source.slice(0, 160);
}

export function modeToActionKind(mode: OpenClawEmailMode): ActionKind {
  return actionKindByMode[mode];
}

export function normalizeEmailActionInput<M extends OpenClawEmailMode>(
  input: OpenClawEmailActionInput & { mode: M }
): NormalizedAdapterProposal<M> {
  const parsed = OpenClawEmailActionInputSchema.parse(input);

  switch (parsed.mode) {
    case "send_now": {
      const payload = normalizeActionPayload("gmail.web.send_now", {
        to: parsed.to,
        cc: parsed.cc,
        bcc: parsed.bcc,
        subject: parsed.subject,
        text: parsed.text,
        html: parsed.html
      });

      return {
        mode: parsed.mode as M,
        kind: "gmail.web.send_now" as AdapterActionKindByMode[M],
        payload: payload as NormalizedAdapterProposal<M>["payload"],
        payloadHash: hashActionPayload("gmail.web.send_now", payload)
      };
    }
    case "schedule_send": {
      const payload = normalizeActionPayload("gmail.web.schedule_send", {
        to: parsed.to,
        cc: parsed.cc,
        bcc: parsed.bcc,
        subject: parsed.subject,
        text: parsed.text,
        html: parsed.html,
        schedule: parsed.schedule!
      });

      return {
        mode: parsed.mode as M,
        kind: "gmail.web.schedule_send" as AdapterActionKindByMode[M],
        payload: payload as NormalizedAdapterProposal<M>["payload"],
        payloadHash: hashActionPayload("gmail.web.schedule_send", payload)
      };
    }
    case "create_draft": {
      const payload = normalizeActionPayload("gmail.api.create_draft", {
        to: parsed.to,
        cc: parsed.cc,
        bcc: parsed.bcc,
        subject: parsed.subject,
        text: parsed.text,
        html: parsed.html
      });

      return {
        mode: parsed.mode as M,
        kind: "gmail.api.create_draft" as AdapterActionKindByMode[M],
        payload: payload as NormalizedAdapterProposal<M>["payload"],
        payloadHash: hashActionPayload("gmail.api.create_draft", payload)
      };
    }
  }
}

export function buildProposalPreview(
  normalized: NormalizedAdapterProposal
): ProposalPreviewMetadata {
  const schedule =
    normalized.mode === "schedule_send"
      ? {
          sendAt: (
            normalized as NormalizedAdapterProposal<"schedule_send">
          ).payload.schedule.sendAt,
          timezone: (
            normalized as NormalizedAdapterProposal<"schedule_send">
          ).payload.schedule.timezone
        }
      : null;

  return {
    mode: normalized.mode,
    kind: normalized.kind,
    payloadHash: normalized.payloadHash,
    recipients: {
      to: normalized.payload.to,
      cc: normalized.payload.cc,
      bcc: normalized.payload.bcc,
      toCount: normalized.payload.to.length,
      ccCount: normalized.payload.cc.length,
      bccCount: normalized.payload.bcc.length
    },
    subject: normalized.payload.subject,
    bodyFormat: bodyFormatOf(normalized.payload),
    bodyPreview: buildBodyPreview(normalized.payload),
    schedule
  };
}
