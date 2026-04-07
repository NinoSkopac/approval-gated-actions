import { resolve } from "node:path";

import { z } from "zod";

const booleanishSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  });

const configSchema = z.object({
  brokerBaseUrl: z.string().url(),
  browserBackend: z.enum(["openclaw", "playwright"]).default("openclaw"),
  browserUserDataDir: z.string().trim().min(1),
  browserChannel: z.enum(["chrome", "msedge", "chromium"]).default("chrome"),
  openClawSessionId: z.string().trim().min(1).optional(),
  openClawChromeProfileName: z.string().trim().min(1).optional(),
  headless: booleanishSchema.default(false),
  pollIntervalMs: z.coerce.number().int().positive().default(10000),
  actorId: z.string().trim().min(1).default("gmail-web-executor"),
  actorDisplayName: z.string().trim().min(1).default("Gmail Web Executor"),
  gmailBaseUrl: z.string().url().default("https://mail.google.com/mail/u/0/?hl=en#inbox"),
  locale: z.string().trim().min(1).default("en-US"),
  navigationTimeoutMs: z.coerce.number().int().positive().default(45000),
  actionTimeoutMs: z.coerce.number().int().positive().default(45000)
});

export type ExecutorConfig = z.infer<typeof configSchema>;

export function parseExecutorConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): ExecutorConfig {
  return configSchema.parse({
    brokerBaseUrl: env.BROKER_BASE_URL ?? "http://127.0.0.1:3000",
    browserBackend: env.GMAIL_EXECUTOR_BROWSER_BACKEND ?? "openclaw",
    browserUserDataDir:
      env.GMAIL_EXECUTOR_USER_DATA_DIR ??
      resolve(cwd, "packages/executor-gmail-web/data/chromium-profile"),
    browserChannel: env.GMAIL_EXECUTOR_BROWSER_CHANNEL ?? "chrome",
    openClawSessionId: env.GMAIL_EXECUTOR_OPENCLAW_SESSION_ID,
    openClawChromeProfileName: env.GMAIL_EXECUTOR_OPENCLAW_CHROME_PROFILE_NAME,
    headless: env.GMAIL_EXECUTOR_HEADLESS ?? false,
    pollIntervalMs: env.GMAIL_EXECUTOR_POLL_INTERVAL_MS ?? 10000,
    actorId: env.GMAIL_EXECUTOR_ACTOR_ID ?? "gmail-web-executor",
    actorDisplayName: env.GMAIL_EXECUTOR_ACTOR_DISPLAY_NAME ?? "Gmail Web Executor",
    gmailBaseUrl: env.GMAIL_EXECUTOR_GMAIL_BASE_URL ?? "https://mail.google.com/mail/u/0/?hl=en#inbox",
    locale: env.GMAIL_EXECUTOR_LOCALE ?? "en-US",
    navigationTimeoutMs: env.GMAIL_EXECUTOR_NAVIGATION_TIMEOUT_MS ?? 45000,
    actionTimeoutMs: env.GMAIL_EXECUTOR_ACTION_TIMEOUT_MS ?? 45000
  });
}
