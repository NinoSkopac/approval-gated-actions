import { createServer } from "node:http";

import { createOpenClawAdapterClient, createProposeEmailTool } from "../src";

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body.length > 0 ? JSON.parse(body) : {};
}

async function main(): Promise<void> {
  const client = createOpenClawAdapterClient({
    brokerBaseUrl: process.env.BROKER_BASE_URL ?? "http://127.0.0.1:3000",
    requester: {
      type: "agent",
      id: "example-openclaw-tool",
      displayName: "Example OpenClaw Tool"
    }
  });
  const tool = createProposeEmailTool(client);
  const port = Number(process.env.PORT ?? 4010);

  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/tools/propose-email") {
      try {
        const body = await readJsonBody(request);
        const result = await tool.invoke(body);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(result));
      } catch (error) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error)
          })
        );
      }

      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "NotFound" }));
  });

  server.listen(port, () => {
    console.log(`Example tool server listening on http://127.0.0.1:${port}`);
  });
}

void main();
