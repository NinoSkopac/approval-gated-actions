import { buildBrokerApp } from "./index";

async function seed(): Promise<void> {
  const app = buildBrokerApp();

  const response = await app.inject({
    method: "POST",
    url: "/proposals",
    payload: {
      kind: "gmail.web.schedule_send",
      payload: {
        to: ["lead@example.com"],
        cc: [],
        bcc: [],
        subject: "Checking in",
        text: "Wanted to follow up on our last conversation.",
        schedule: {
          sendAt: "2026-04-05T09:00:00-04:00",
          timezone: "America/New_York"
        }
      },
      requester: {
        type: "agent",
        id: "openclaw",
        displayName: "OpenClaw"
      },
      expiresAt: "2026-04-05T12:00:00-04:00"
    }
  });

  console.log(response.body);
  await app.close();
}

void seed();
