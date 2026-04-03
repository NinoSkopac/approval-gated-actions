import { resolve } from "node:path";

export interface BrokerConfig {
  databasePath: string;
  host: string;
  port: number;
}

export function getBrokerConfig(): BrokerConfig {
  return {
    databasePath:
      process.env.BROKER_DATABASE_PATH ??
      resolve(process.cwd(), "apps/broker-api/data/broker.sqlite"),
    host: process.env.BROKER_HOST ?? "0.0.0.0",
    port: Number(process.env.BROKER_PORT ?? 3000)
  };
}
