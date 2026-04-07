import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildBrokerApp } from "../src";

describe("broker api", () => {
  let app: ReturnType<typeof buildBrokerApp>;

  beforeEach(() => {
    app = buildBrokerApp({
      databasePath: ":memory:"
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
  });

  it("creates, fetches, and filters proposals", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/proposals",
      payload: {
        kind: "gmail.web.schedule_send",
        payload: {
          to: ["lead@example.com"],
          subject: "Follow up",
          text: "Checking in.",
          schedule: {
            sendAt: "2099-04-05T09:00:00-04:00",
            timezone: "America/New_York"
          }
        },
        requester: {
          type: "agent",
          id: "openclaw"
        },
        expiresAt: "2099-04-05T12:00:00-04:00"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const createdProposal = createResponse.json().proposal;

    const getResponse = await app.inject({
      method: "GET",
      url: `/proposals/${createdProposal.id}`
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().proposal.payload.schedule.timezone).toBe("America/New_York");

    const listResponse = await app.inject({
      method: "GET",
      url: "/proposals?kind=gmail.web.schedule_send&status=proposed"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().count).toBe(1);
  });

  it("supports edit-on-approve and tracks terminal execution states", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/proposals",
      payload: {
        kind: "gmail.web.send_now",
        payload: {
          to: ["lead@example.com"],
          subject: "Intro",
          text: "First draft"
        },
        requester: {
          type: "agent",
          id: "openclaw"
        }
      }
    });

    const proposalId = createResponse.json().proposal.id;

    const approveResponse = await app.inject({
      method: "POST",
      url: `/proposals/${proposalId}/approve`,
      payload: {
        actor: {
          type: "human",
          id: "reviewer-1"
        },
        comment: "Edited before approval",
        payload: {
          to: ["lead@example.com"],
          subject: "Updated intro",
          text: "Approved copy"
        }
      }
    });

    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json().proposal.status).toBe("approved");
    expect(approveResponse.json().auditCount).toBe(2);

    const executingResponse = await app.inject({
      method: "POST",
      url: `/proposals/${proposalId}/executing`,
      payload: {
        actor: {
          type: "executor",
          id: "gmail-web-executor"
        }
      }
    });

    expect(executingResponse.json().proposal.status).toBe("executing");

    const executedResponse = await app.inject({
      method: "POST",
      url: `/proposals/${proposalId}/executed`,
      payload: {
        actor: {
          type: "executor",
          id: "gmail-web-executor"
        },
        externalId: "gmail-123"
      }
    });

    expect(executedResponse.statusCode).toBe(200);
    expect(executedResponse.json().proposal.status).toBe("executed");
    expect(executedResponse.json().proposal.execution.externalId).toBe("gmail-123");
  });

  it("returns explicit invalid transition errors", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/proposals",
      payload: {
        kind: "gmail.api.create_draft",
        payload: {
          to: [],
          subject: "Draft"
        },
        requester: {
          type: "agent",
          id: "openclaw"
        }
      }
    });

    const proposalId = createResponse.json().proposal.id;

    const invalidResponse = await app.inject({
      method: "POST",
      url: `/proposals/${proposalId}/executing`,
      payload: {
        actor: {
          type: "executor",
          id: "gmail-web-executor"
        }
      }
    });

    expect(invalidResponse.statusCode).toBe(409);
    expect(invalidResponse.json()).toMatchObject({
      error: "INVALID_TRANSITION",
      currentStatus: "proposed",
      requestedStatus: "executing"
    });
  });
});
