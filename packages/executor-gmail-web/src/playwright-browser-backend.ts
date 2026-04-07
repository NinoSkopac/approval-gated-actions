import { buildGmailComposeUrl, formatScheduledInputs } from "./mapping";
import type { ExecutorConfig } from "./config";
import type {
  ExecutorLogger,
  GmailBrowserBackend,
  GmailBrowserConfirmation,
  GmailBrowserSession,
  GmailComposeRequest
} from "./types";
import type { GmailSelectors } from "./selectors";

export interface PlaywrightGmailBrowserBackendOptions {
  config: ExecutorConfig;
  logger: ExecutorLogger;
  selectors: GmailSelectors;
}

async function loadPlaywright(): Promise<typeof import("playwright")> {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      "Playwright backend is not available. Install the playwright dependency or select the OpenClaw backend.",
      { cause: error }
    );
  }
}

export class PlaywrightGmailBrowserBackend implements GmailBrowserBackend {
  public readonly kind = "playwright" as const;

  public readonly displayName = "Playwright Gmail Browser Backend";

  private readonly config: ExecutorConfig;

  private readonly logger: ExecutorLogger;

  private readonly selectors: GmailSelectors;

  public constructor(options: PlaywrightGmailBrowserBackendOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.selectors = options.selectors;
  }

  public async openSession(options?: {
    timezoneId?: string;
  }): Promise<GmailBrowserSession> {
    const playwright = await loadPlaywright();
    const channel =
      this.config.browserChannel === "chromium"
        ? undefined
        : this.config.browserChannel;
    const context = await playwright.chromium.launchPersistentContext(
      this.config.browserUserDataDir,
      {
        headless: this.config.headless,
        channel,
        locale: this.config.locale,
        timezoneId: options?.timezoneId,
        viewport: {
          width: 1440,
          height: 980
        }
      }
    );

    return new PlaywrightGmailBrowserSession({
      context,
      config: this.config,
      logger: this.logger,
      selectors: this.selectors
    });
  }
}

interface PlaywrightGmailBrowserSessionOptions {
  context: import("playwright").BrowserContext;
  config: ExecutorConfig;
  logger: ExecutorLogger;
  selectors: GmailSelectors;
}

class PlaywrightGmailBrowserSession implements GmailBrowserSession {
  private readonly context: import("playwright").BrowserContext;

  private readonly config: ExecutorConfig;

  private readonly logger: ExecutorLogger;

  private readonly selectors: GmailSelectors;

  private pagePromise: Promise<import("playwright").Page> | null = null;

  public constructor(options: PlaywrightGmailBrowserSessionOptions) {
    this.context = options.context;
    this.config = options.config;
    this.logger = options.logger;
    this.selectors = options.selectors;
  }

  public async ensureInboxReady(): Promise<void> {
    const page = await this.getPage();
    await page.goto(this.config.gmailBaseUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs
    });

    try {
      await this.waitForVisible(page, this.selectors.readyIndicators, this.config.navigationTimeoutMs);
    } catch (error) {
      throw new Error(
        "Gmail inbox did not become ready. Manual Gmail login may be required in the dedicated browser profile.",
        { cause: error }
      );
    }
  }

  public async openCompose(request: GmailComposeRequest): Promise<void> {
    const page = await this.getPage();
    const composeUrl = buildGmailComposeUrl(this.config.gmailBaseUrl, request);
    await page.goto(composeUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs
    });

    await this.waitForVisible(page, this.selectors.subjectInput, this.config.actionTimeoutMs);
    const subjectInput = await this.firstLocator(page, this.selectors.subjectInput);
    await subjectInput.fill(request.subject);

    const body = await this.firstLocator(page, this.selectors.messageBody);

    if (request.html && request.html.trim().length > 0) {
      await body.evaluate(
        (element, html) => {
          element.innerHTML = html;
          element.dispatchEvent(new Event("input", { bubbles: true }));
        },
        request.html
      );
    } else {
      await body.fill(request.text ?? "");
    }

    this.logger.debug("Compose form prepared through Playwright backend.", {
      proposalId: request.proposalId,
      kind: request.kind
    });
  }

  public async submitSendNow(): Promise<void> {
    const page = await this.getPage();
    const sendButton = await this.waitForVisible(
      page,
      this.selectors.sendButton,
      this.config.actionTimeoutMs
    );
    await sendButton.click();
  }

  public async openScheduleSendDialog(): Promise<void> {
    const page = await this.getPage();
    const moreOptions = await this.waitForVisible(
      page,
      this.selectors.moreSendOptionsButton,
      this.config.actionTimeoutMs
    );
    await moreOptions.click();

    const scheduleMenu = await this.waitForVisible(
      page,
      this.selectors.scheduleSendMenuItem,
      this.config.actionTimeoutMs
    );
    await scheduleMenu.click();

    const customButton = await this.waitForVisible(
      page,
      this.selectors.customScheduleButton,
      this.config.actionTimeoutMs
    );
    await customButton.click();
  }

  public async applySchedule(schedule: {
    sendAt: string;
    timezone: string;
  }): Promise<void> {
    const page = await this.getPage();
    const { dateValue, timeValue } = formatScheduledInputs(
      schedule.sendAt,
      schedule.timezone
    );
    const dateInput = await this.waitForVisible(
      page,
      this.selectors.scheduleDateInput,
      this.config.actionTimeoutMs
    );
    const timeInput = await this.waitForVisible(
      page,
      this.selectors.scheduleTimeInput,
      this.config.actionTimeoutMs
    );

    const dateInputType = await dateInput.evaluate((element) =>
      element.getAttribute("type")
    );
    await dateInput.fill(
      dateInputType === "date"
        ? this.toIsoDate(schedule.sendAt, schedule.timezone)
        : dateValue
    );
    await timeInput.fill(timeValue);
  }

  public async confirmScheduleSend(): Promise<void> {
    const page = await this.getPage();
    const confirmButton = await this.waitForVisible(
      page,
      this.selectors.scheduleConfirmButton,
      this.config.actionTimeoutMs
    );
    await confirmButton.click();
  }

  public async readConfirmation(
    expectedFragments: string[]
  ): Promise<GmailBrowserConfirmation> {
    const page = await this.getPage();
    const toast = await this.waitForVisible(
      page,
      this.selectors.toast,
      this.config.actionTimeoutMs
    );
    const firstText = (await toast.textContent())?.trim() ?? "";

    if (this.matchesExpected(firstText, expectedFragments)) {
      return {
        verification: "toast",
        message: firstText
      };
    }

    await page.waitForTimeout(1000);
    const secondText = (await toast.textContent())?.trim() ?? firstText;

    if (this.matchesExpected(secondText, expectedFragments)) {
      return {
        verification: "toast",
        message: secondText
      };
    }

    throw new Error(
      `Did not observe expected Gmail confirmation toast. Saw: "${secondText}"`
    );
  }

  public async close(): Promise<void> {
    await this.context.close();
  }

  private async getPage(): Promise<import("playwright").Page> {
    if (!this.pagePromise) {
      this.pagePromise = (async () => {
        const page = this.context.pages()[0] ?? (await this.context.newPage());
        page.setDefaultTimeout(this.config.actionTimeoutMs);
        return page;
      })();
    }

    return this.pagePromise;
  }

  private async firstLocator(
    page: import("playwright").Page,
    selectors: string[]
  ): Promise<import("playwright").Locator> {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();

      if ((await locator.count()) > 0) {
        return locator;
      }
    }

    throw new Error(`Unable to locate any selector: ${selectors.join(" | ")}`);
  }

  private async waitForVisible(
    page: import("playwright").Page,
    selectors: string[],
    timeout: number
  ): Promise<import("playwright").Locator> {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();

      try {
        await locator.waitFor({ state: "visible", timeout });
        return locator;
      } catch {
        continue;
      }
    }

    throw new Error(`Timed out waiting for selectors: ${selectors.join(" | ")}`);
  }

  private matchesExpected(text: string, expectedFragments: string[]): boolean {
    return expectedFragments.some((fragment) =>
      text.toLowerCase().includes(fragment.toLowerCase())
    );
  }

  private toIsoDate(sendAt: string, timezone: string): string {
    const date = new Date(sendAt);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const getPart = (type: string): string =>
      parts.find((part) => part.type === type)?.value ?? "";

    return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  }
}
