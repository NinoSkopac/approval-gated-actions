import type { ExecutorConfig } from "./config";
import type {
  GmailBrowserBackend,
  GmailBrowserSession
} from "./types";

export const OPENCLAW_BACKEND_INTEGRATION_NOTES = [
  "Connect this backend to an OpenClaw-controlled Chrome session rather than launching a separate automation browser.",
  "OpenClaw should target an existing signed-in Chrome profile dedicated to Gmail execution.",
  "The backend should map Gmail browser operations to OpenClaw browser controls: ensure inbox ready, open compose, populate fields, open native schedule-send UI, apply date/time, confirm, and read the Gmail confirmation UI.",
  "The backend should keep selector/config updates localized behind this package so broker and adapter code remain unchanged.",
  "For personal deployment, prefer Gmail API for draft creation and non-native send-now flows, and use this browser backend when native Gmail schedule-send behavior is required."
] as const;

export class OpenClawBrowserBackendNotImplementedError extends Error {
  public readonly integrationNotes: readonly string[];

  public constructor(details?: string) {
    super(
      details
        ? `OpenClaw browser backend is the preferred personal-deployment path, but it is not fully wired in this slice.\n${details}`
        : "OpenClaw browser backend is the preferred personal-deployment path, but it is not fully wired in this slice."
    );
    this.name = "OpenClawBrowserBackendNotImplementedError";
    this.integrationNotes = OPENCLAW_BACKEND_INTEGRATION_NOTES;
  }
}

export interface OpenClawGmailBrowserBackendOptions {
  config: ExecutorConfig;
}

export class OpenClawGmailBrowserBackend implements GmailBrowserBackend {
  public readonly kind = "openclaw" as const;

  public readonly displayName = "OpenClaw Chrome Browser Backend";

  private readonly config: ExecutorConfig;

  public constructor(options: OpenClawGmailBrowserBackendOptions) {
    this.config = options.config;
  }

  public async openSession(): Promise<GmailBrowserSession> {
    const details = [
      `Configured backend: ${this.kind}`,
      `Configured OpenClaw session id: ${this.config.openClawSessionId ?? "(not set)"}`,
      `Configured Chrome profile name: ${this.config.openClawChromeProfileName ?? "(not set)"}`,
      ...OPENCLAW_BACKEND_INTEGRATION_NOTES
    ].join("\n");

    throw new OpenClawBrowserBackendNotImplementedError(details);
  }
}
