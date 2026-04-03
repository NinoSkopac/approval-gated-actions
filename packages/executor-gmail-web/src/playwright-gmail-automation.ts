import { chromium, type BrowserContext, type Locator, type Page } from "playwright";

import { buildGmailComposeUrl, formatScheduledInputs } from "./mapping";
import type { ExecutorConfig } from "./config";
import type { ExecutorLogger, GmailAutomationBackend, GmailComposeRequest } from "./types";
import type { GmailSelectors } from "./selectors";

async function firstLocator(page: Page, selectors: string[]): Promise<Locator> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if ((await locator.count()) > 0) {
      return locator;
    }
  }

  throw new Error(`Unable to locate any selector: ${selectors.join(" | ")}`);
}

async function waitForVisible(page: Page, selectors: string[], timeout: number): Promise<Locator> {
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export interface PlaywrightGmailAutomationOptions {
  config: ExecutorConfig;
  logger: ExecutorLogger;
  selectors: GmailSelectors;
}

export class PlaywrightGmailAutomation implements GmailAutomationBackend {
  private readonly config: ExecutorConfig;

  private readonly logger: ExecutorLogger;

  private readonly selectors: GmailSelectors;

  public constructor(options: PlaywrightGmailAutomationOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.selectors = options.selectors;
  }

  public async prepareSession(): Promise<void> {
    const context = await this.launchContext();

    try {
      const page = await this.openInbox(context);
      await waitForVisible(page, this.selectors.readyIndicators, this.config.navigationTimeoutMs);
      this.logger.info("Gmail session is ready.", {
        userDataDir: this.config.browserUserDataDir
      });
    } finally {
      await context.close();
    }
  }

  public async execute(request: GmailComposeRequest) {
    const context = await this.launchContext(request.schedule?.timezone);

    try {
      const page = await this.openInbox(context);
      await this.openCompose(page, request);

      if (request.kind === "gmail.web.send_now") {
        return await this.sendNow(page, request);
      }

      return await this.scheduleSend(page, request);
    } finally {
      await context.close();
    }
  }

  private async launchContext(timezoneId?: string): Promise<BrowserContext> {
    const channel =
      this.config.browserChannel === "chromium"
        ? undefined
        : this.config.browserChannel;

    return chromium.launchPersistentContext(this.config.browserUserDataDir, {
      headless: this.config.headless,
      channel,
      locale: this.config.locale,
      timezoneId,
      viewport: {
        width: 1440,
        height: 980
      }
    });
  }

  private async openInbox(context: BrowserContext): Promise<Page> {
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(this.config.actionTimeoutMs);
    await page.goto(this.config.gmailBaseUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs
    });

    try {
      await waitForVisible(page, this.selectors.readyIndicators, this.config.navigationTimeoutMs);
    } catch (error) {
      throw new Error(
        "Gmail inbox did not become ready. Manual Gmail login may be required in the dedicated browser profile.",
        { cause: error }
      );
    }

    return page;
  }

  private async openCompose(page: Page, request: GmailComposeRequest): Promise<void> {
    const composeUrl = buildGmailComposeUrl(this.config.gmailBaseUrl, request);
    await page.goto(composeUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs
    });

    await waitForVisible(page, this.selectors.subjectInput, this.config.actionTimeoutMs);
    const subjectInput = await firstLocator(page, this.selectors.subjectInput);
    await subjectInput.fill(request.subject);

    const body = await firstLocator(page, this.selectors.messageBody);

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

    this.logger.debug("Compose form prepared.", {
      proposalId: request.proposalId,
      kind: request.kind
    });
  }

  private async sendNow(page: Page, request: GmailComposeRequest) {
    const sendButton = await waitForVisible(
      page,
      this.selectors.sendButton,
      this.config.actionTimeoutMs
    );
    await sendButton.click();

    const toastText = await this.waitForToast(page, ["Message sent", "Message send"]);

    return {
      verification: "toast" as const,
      externalId: null,
      details: {
        toast: toastText,
        subject: request.subject
      }
    };
  }

  private async scheduleSend(page: Page, request: GmailComposeRequest) {
    if (!request.schedule) {
      throw new Error("Schedule-send request is missing schedule data.");
    }

    const moreOptions = await waitForVisible(
      page,
      this.selectors.moreSendOptionsButton,
      this.config.actionTimeoutMs
    );
    await moreOptions.click();

    const scheduleMenu = await waitForVisible(
      page,
      this.selectors.scheduleSendMenuItem,
      this.config.actionTimeoutMs
    );
    await scheduleMenu.click();

    const customButton = await waitForVisible(
      page,
      this.selectors.customScheduleButton,
      this.config.actionTimeoutMs
    );
    await customButton.click();

    const { dateValue, timeValue } = formatScheduledInputs(
      request.schedule.sendAt,
      request.schedule.timezone
    );
    const dateInput = await waitForVisible(
      page,
      this.selectors.scheduleDateInput,
      this.config.actionTimeoutMs
    );
    const timeInput = await waitForVisible(
      page,
      this.selectors.scheduleTimeInput,
      this.config.actionTimeoutMs
    );

    const dateInputType = await dateInput.evaluate((element) => element.getAttribute("type"));
    await dateInput.fill(dateInputType === "date" ? this.toIsoDate(request.schedule.sendAt, request.schedule.timezone) : dateValue);
    await timeInput.fill(timeValue);

    const confirmButton = await waitForVisible(
      page,
      this.selectors.scheduleConfirmButton,
      this.config.actionTimeoutMs
    );
    await confirmButton.click();

    const toastText = await this.waitForToast(page, ["scheduled", "Schedule send"]);

    return {
      verification: "toast" as const,
      externalId: null,
      details: {
        toast: toastText,
        sendAt: request.schedule.sendAt,
        timezone: request.schedule.timezone,
        bodyMode: request.html ? "html" : "text"
      }
    };
  }

  private async waitForToast(page: Page, expectedFragments: string[]): Promise<string> {
    const toast = await waitForVisible(page, this.selectors.toast, this.config.actionTimeoutMs);
    const text = (await toast.textContent())?.trim() ?? "";

    if (
      expectedFragments.some((fragment) =>
        text.toLowerCase().includes(fragment.toLowerCase())
      )
    ) {
      return text;
    }

    // Gmail sometimes renders the toast late; one extra short wait is cheap.
    await page.waitForTimeout(1000);
    const fallbackText = (await toast.textContent())?.trim() ?? text;

    if (
      expectedFragments.some((fragment) =>
        fallbackText.toLowerCase().includes(fragment.toLowerCase())
      )
    ) {
      return fallbackText;
    }

    throw new Error(`Did not observe expected Gmail confirmation toast. Saw: "${fallbackText}"`);
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
