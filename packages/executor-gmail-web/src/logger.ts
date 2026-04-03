import { inspect } from "node:util";

import type { ExecutorLogger } from "./types";

function log(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  message: string,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const suffix =
    context && Object.keys(context).length > 0
      ? ` ${inspect(context, { depth: 6, colors: false, breakLength: Infinity })}`
      : "";

  console.log(`[${timestamp}] ${level} ${message}${suffix}`);
}

export function createExecutorLogger(): ExecutorLogger {
  return {
    debug(message, context) {
      log("DEBUG", message, context);
    },
    info(message, context) {
      log("INFO", message, context);
    },
    warn(message, context) {
      log("WARN", message, context);
    },
    error(message, context) {
      log("ERROR", message, context);
    }
  };
}
