import { ActionProposalSchema, IsoTimestampSchema } from "@approval-gated-actions/core";
import type {
  ActionProposal,
  ActionProposalOf
} from "@approval-gated-actions/core";

import type { ExecutableGmailProposal, GmailComposeRequest } from "./types";

export const SUPPORTED_EXECUTOR_ACTION_KINDS = [
  "gmail.web.send_now",
  "gmail.web.schedule_send"
] as const;

export function isExecutableGmailProposal(
  proposal: ActionProposal
): proposal is ExecutableGmailProposal {
  return (
    proposal.status === "approved" &&
    (proposal.kind === "gmail.web.send_now" ||
      proposal.kind === "gmail.web.schedule_send")
  );
}

export function parseExecutableGmailProposal(value: unknown): ExecutableGmailProposal {
  const proposal = ActionProposalSchema.parse(value);

  if (!isExecutableGmailProposal(proposal)) {
    throw new Error(
      `Proposal ${proposal.id} is not an approved executable Gmail proposal.`
    );
  }

  return proposal;
}

export function sortExecutableProposals(
  proposals: ExecutableGmailProposal[]
): ExecutableGmailProposal[] {
  return [...proposals].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return left.id.localeCompare(right.id);
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function buildComposeRequest(
  proposal: ExecutableGmailProposal
): GmailComposeRequest {
  if (proposal.kind === "gmail.web.schedule_send") {
    const sendAt = IsoTimestampSchema.parse(proposal.payload.schedule.sendAt);

    if (sendAt <= new Date().toISOString()) {
      throw new Error(
        `Proposal ${proposal.id} has a schedule time in the past: ${sendAt}`
      );
    }
  }

  return {
    proposalId: proposal.id,
    kind: proposal.kind,
    to: proposal.payload.to,
    cc: proposal.payload.cc,
    bcc: proposal.payload.bcc,
    subject: proposal.payload.subject,
    text: proposal.payload.text,
    html: proposal.payload.html,
    schedule:
      proposal.kind === "gmail.web.schedule_send"
        ? {
            sendAt: proposal.payload.schedule.sendAt,
            timezone: proposal.payload.schedule.timezone
          }
        : undefined
  };
}

export function buildGmailComposeUrl(
  baseUrl: string,
  request: GmailComposeRequest
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  url.searchParams.set("tf", "1");
  url.searchParams.set("to", request.to.join(","));

  if (request.cc.length > 0) {
    url.searchParams.set("cc", request.cc.join(","));
  }

  if (request.bcc.length > 0) {
    url.searchParams.set("bcc", request.bcc.join(","));
  }

  if (request.subject.length > 0) {
    url.searchParams.set("su", request.subject);
  }

  const body = request.text ?? "";

  if (body.length > 0) {
    url.searchParams.set("body", body);
  }

  return url.toString();
}

export function formatScheduledInputs(
  sendAt: string,
  timezone: string
): { dateValue: string; timeValue: string } {
  const date = new Date(sendAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date);

  const getPart = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const month = getPart("month");
  const day = getPart("day");
  const year = getPart("year");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod = getPart("dayPeriod").toUpperCase();

  return {
    dateValue: `${month}/${day}/${year}`,
    timeValue: `${hour}:${minute} ${dayPeriod}`.trim()
  };
}
