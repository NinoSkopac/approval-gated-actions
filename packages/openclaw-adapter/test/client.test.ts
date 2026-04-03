import { describe, expect, it, vi } from "vitest";

import { createActionProposal } from "@approval-gated-actions/core";

import {
  AdapterBrokerError,
  AdapterHashMismatchError,
  OpenClawAdapterClient
} from "../src";

describe("OpenClawAdapterClient", () => {
  it("creates broker proposals and returns preview metadata", async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const requestBody = JSON.parse(String(init?.body));
      const proposal = createActionProposal({
        kind: requestBody.kind,
        payload: requestBody.payload,
        requester: requestBody.requester,
        expiresAt: requestBody.expiresAt
      });

      return new Response(JSON.stringify({ proposal }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      });
    });

    const client = new OpenClawAdapterClient({
      brokerBaseUrl: "http://127.0.0.1:3000",
      fetchImpl: fakeFetch
    });

    const result = await client.createEmailProposal({
      mode: "send_now",
      to: ["lead@example.com"],
      subject: "Hello",
      text: "Body"
    });

    expect(result.proposalId).toBeTruthy();
    expect(result.kind).toBe("gmail.web.send_now");
    expect(result.preview.recipients.to).toEqual(["lead@example.com"]);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("throws a broker error for non-2xx responses", async () => {
    const client = new OpenClawAdapterClient({
      brokerBaseUrl: "http://127.0.0.1:3000",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: "boom" }), { status: 500 })
      )
    });

    await expect(
      client.createEmailProposal({
        mode: "send_now",
        to: ["lead@example.com"],
        subject: "Hello",
        text: "Body"
      })
    ).rejects.toBeInstanceOf(AdapterBrokerError);
  });

  it("throws if the broker hash does not match the local normalized hash", async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          proposal: {
            ...createActionProposal({
              kind: "gmail.web.send_now",
              payload: {
                to: ["lead@example.com"],
                subject: "Hello",
                text: "Body"
              },
              requester: {
                type: "agent",
                id: "adapter"
              }
            }),
            payloadHash: "f".repeat(64)
          }
        }),
        { status: 201 }
      )
    );

    const client = new OpenClawAdapterClient({
      brokerBaseUrl: "http://127.0.0.1:3000",
      fetchImpl: fakeFetch
    });

    await expect(
      client.createEmailProposal({
        mode: "send_now",
        to: ["lead@example.com"],
        subject: "Hello",
        text: "Body"
      })
    ).rejects.toBeInstanceOf(AdapterHashMismatchError);
  });
});
