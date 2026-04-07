import type {
  ExecutorLogger,
  GmailBrowserBackend,
  GmailBrowserExecutionResult,
  GmailComposeRequest
} from "./types";

export interface GmailBrowserExecutionFlowOptions {
  logger: ExecutorLogger;
}

export class GmailBrowserExecutionFlow {
  private readonly logger: ExecutorLogger;

  public constructor(options: GmailBrowserExecutionFlowOptions) {
    this.logger = options.logger;
  }

  public async prepareSession(backend: GmailBrowserBackend): Promise<void> {
    const session = await backend.openSession();

    try {
      await session.ensureInboxReady();
      this.logger.info("Browser backend session is ready.", {
        backend: backend.kind
      });
    } finally {
      await session.close();
    }
  }

  public async execute(
    backend: GmailBrowserBackend,
    request: GmailComposeRequest
  ): Promise<GmailBrowserExecutionResult> {
    const session = await backend.openSession({
      timezoneId: request.schedule?.timezone
    });

    try {
      await session.ensureInboxReady();
      await session.openCompose(request);

      if (request.kind === "gmail.web.send_now") {
        await session.submitSendNow();
        const confirmation = await session.readConfirmation([
          "Message sent",
          "Message send"
        ]);

        return {
          verification: confirmation.verification,
          externalId: null,
          details: {
            backend: backend.kind,
            confirmation: confirmation.message,
            subject: request.subject,
            ...(confirmation.details ?? {})
          }
        };
      }

      if (!request.schedule) {
        throw new Error("Schedule-send request is missing schedule data.");
      }

      await session.openScheduleSendDialog();
      await session.applySchedule(request.schedule);
      await session.confirmScheduleSend();
      const confirmation = await session.readConfirmation([
        "scheduled",
        "Schedule send"
      ]);

      return {
        verification: confirmation.verification,
        externalId: null,
        details: {
          backend: backend.kind,
          confirmation: confirmation.message,
          sendAt: request.schedule.sendAt,
          timezone: request.schedule.timezone,
          bodyMode: request.html ? "html" : "text",
          ...(confirmation.details ?? {})
        }
      };
    } finally {
      await session.close();
    }
  }
}
