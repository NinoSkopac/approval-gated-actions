import type { ExecutorConfig } from "./config";
import type { ExecutorLogger, GmailBrowserBackend } from "./types";
import type { GmailSelectors } from "./selectors";

import { OpenClawGmailBrowserBackend } from "./openclaw-browser-backend";
import { PlaywrightGmailBrowserBackend } from "./playwright-browser-backend";

export function createGmailBrowserBackend(
  config: ExecutorConfig,
  logger: ExecutorLogger,
  selectors: GmailSelectors
): GmailBrowserBackend {
  switch (config.browserBackend) {
    case "openclaw":
      return new OpenClawGmailBrowserBackend({ config });
    case "playwright":
      return new PlaywrightGmailBrowserBackend({
        config,
        logger,
        selectors
      });
  }
}
