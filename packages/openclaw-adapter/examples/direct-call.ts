import { createOpenClawAdapterClient } from "../src";

async function main(): Promise<void> {
  const client = createOpenClawAdapterClient({
    brokerBaseUrl: process.env.BROKER_BASE_URL ?? "http://127.0.0.1:3000",
    requester: {
      type: "agent",
      id: "example-openclaw-agent",
      displayName: "Example OpenClaw Agent"
    }
  });

  const result = await client.createEmailProposal({
    mode: "schedule_send",
    to: ["lead@example.com"],
    subject: "Following up",
    text: "Wanted to follow up on our last conversation.",
    schedule: {
      sendAt: "2026-04-05T09:00:00-04:00",
      timezone: "America/New_York"
    }
  });

  console.log(JSON.stringify(result, null, 2));
}

void main();
