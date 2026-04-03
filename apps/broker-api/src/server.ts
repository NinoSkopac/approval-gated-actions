import { buildBrokerApp } from "./index";
import { getBrokerConfig } from "./config";

async function start(): Promise<void> {
  const config = getBrokerConfig();
  const app = buildBrokerApp({
    databasePath: config.databasePath
  });

  await app.listen({
    host: config.host,
    port: config.port
  });
}

void start();
