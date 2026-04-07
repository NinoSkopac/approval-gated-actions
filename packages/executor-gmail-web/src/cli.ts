import { createGmailBrowserBackend } from "./backend-factory";
import { BrokerClient } from "./broker-client";
import { parseExecutorConfig } from "./config";
import { GmailWebExecutor } from "./executor";
import { GmailBrowserExecutionFlow } from "./gmail-browser-flow";
import { createExecutorLogger } from "./logger";
import { defaultGmailSelectors } from "./selectors";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "once";
  const config = parseExecutorConfig();
  const logger = createExecutorLogger();
  const actor = {
    type: "executor" as const,
    id: config.actorId,
    displayName: config.actorDisplayName
  };
  const brokerClient = new BrokerClient({
    baseUrl: config.brokerBaseUrl,
    actor
  });
  const browserBackend = createGmailBrowserBackend(
    config,
    logger,
    defaultGmailSelectors
  );
  const flow = new GmailBrowserExecutionFlow({ logger });
  const executor = new GmailWebExecutor({
    brokerClient,
    browserBackend,
    flow,
    logger
  });

  logger.info("Starting Gmail browser executor command.", {
    command,
    brokerBaseUrl: config.brokerBaseUrl,
    browserBackend: config.browserBackend,
    browserUserDataDir: config.browserUserDataDir,
    browserChannel: config.browserChannel,
    headless: config.headless
  });

  if (command === "login") {
    await flow.prepareSession(browserBackend);
    return;
  }

  if (command === "once") {
    await executor.runOnce();
    return;
  }

  if (command === "poll") {
    let keepRunning = true;
    process.on("SIGINT", () => {
      keepRunning = false;
      logger.info("Received SIGINT. Stopping poll loop.");
    });
    process.on("SIGTERM", () => {
      keepRunning = false;
      logger.info("Received SIGTERM. Stopping poll loop.");
    });

    await executor.poll(config.pollIntervalMs, () => keepRunning);
    return;
  }

  throw new Error(`Unknown executor command: ${command}`);
}

void main();
