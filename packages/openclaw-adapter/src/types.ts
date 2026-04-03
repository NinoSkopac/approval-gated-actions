import type {
  ActionActor,
  ActionKind,
  ActionProposal,
  GmailApiCreateDraftPayload,
  GmailWebScheduleSendPayload,
  GmailWebSendNowPayload
} from "@approval-gated-actions/core";

export type OpenClawEmailMode = "send_now" | "schedule_send" | "create_draft";

export interface OpenClawEmailScheduleInput {
  sendAt: string;
  timezone: string;
}

export interface OpenClawEmailActionInput {
  mode: OpenClawEmailMode;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  schedule?: OpenClawEmailScheduleInput;
}

export type AdapterActionKindByMode = {
  send_now: "gmail.web.send_now";
  schedule_send: "gmail.web.schedule_send";
  create_draft: "gmail.api.create_draft";
};

export type NormalizedAdapterPayloadByMode = {
  send_now: GmailWebSendNowPayload;
  schedule_send: GmailWebScheduleSendPayload;
  create_draft: GmailApiCreateDraftPayload;
};

export interface NormalizedAdapterProposal<M extends OpenClawEmailMode = OpenClawEmailMode> {
  mode: M;
  kind: AdapterActionKindByMode[M];
  payload: NormalizedAdapterPayloadByMode[M];
  payloadHash: string;
}

export interface ProposalPreviewMetadata {
  mode: OpenClawEmailMode;
  kind: ActionKind;
  payloadHash: string;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
    toCount: number;
    ccCount: number;
    bccCount: number;
  };
  subject: string;
  bodyFormat: "text" | "html" | "both";
  bodyPreview: string;
  schedule: OpenClawEmailScheduleInput | null;
}

export interface CreateBrokerProposalResult {
  proposalId: string;
  status: ActionProposal["status"];
  kind: ActionKind;
  payloadHash: string;
  preview: ProposalPreviewMetadata;
}

export interface OpenClawAdapterClientOptions {
  brokerBaseUrl: string;
  requester?: ActionActor;
  fetchImpl?: typeof fetch;
}

export interface CreateProposalOptions {
  requester?: ActionActor;
  expiresAt?: string | null;
}

export interface ProposeEmailToolOptions extends CreateProposalOptions {
  name?: string;
  description?: string;
}
