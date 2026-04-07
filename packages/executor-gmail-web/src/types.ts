import type {
  ActionProposalOf,
  GmailWebScheduleSendPayload,
  GmailWebSendNowPayload,
  JsonObject
} from "@approval-gated-actions/core";

export type SupportedExecutorActionKind =
  | "gmail.web.send_now"
  | "gmail.web.schedule_send";

export type ExecutableGmailProposal =
  | ActionProposalOf<"gmail.web.send_now">
  | ActionProposalOf<"gmail.web.schedule_send">;

export interface GmailComposeRequest {
  proposalId: string;
  kind: SupportedExecutorActionKind;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text?: string;
  html?: string;
  schedule?: {
    sendAt: string;
    timezone: string;
  };
}

export type GmailBrowserBackendKind = "openclaw" | "playwright";

export interface GmailBrowserConfirmation {
  verification: "toast" | "url" | "dialog";
  message: string;
  details?: JsonObject | null;
}

export interface GmailBrowserExecutionResult {
  verification: "toast" | "url" | "dialog";
  externalId?: string | null;
  details?: JsonObject | null;
}

export interface GmailBrowserSession {
  ensureInboxReady(): Promise<void>;
  openCompose(request: GmailComposeRequest): Promise<void>;
  submitSendNow(): Promise<void>;
  openScheduleSendDialog(): Promise<void>;
  applySchedule(schedule: { sendAt: string; timezone: string }): Promise<void>;
  confirmScheduleSend(): Promise<void>;
  readConfirmation(expectedFragments: string[]): Promise<GmailBrowserConfirmation>;
  close(): Promise<void>;
}

export interface GmailBrowserBackend {
  kind: GmailBrowserBackendKind;
  displayName: string;
  openSession(options?: { timezoneId?: string }): Promise<GmailBrowserSession>;
}

export interface BrokerClientLike {
  fetchApprovedExecutableProposals(): Promise<ExecutableGmailProposal[]>;
  markExecuting(proposalId: string): Promise<void>;
  markExecuted(
    proposalId: string,
    result: GmailBrowserExecutionResult
  ): Promise<void>;
  markFailed(proposalId: string, error: ExecutorFailureDetails): Promise<void>;
}

export interface ExecutorLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ExecutorFailureDetails {
  errorCode?: string | null;
  errorMessage: string;
  details?: JsonObject | null;
}

export interface ExecutorRunSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export type GmailPayload =
  | GmailWebSendNowPayload
  | GmailWebScheduleSendPayload;
