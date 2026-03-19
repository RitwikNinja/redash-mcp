import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import * as dotenv from "dotenv";
import { redashClient } from "./redashClient.js";
import { logger } from "./logger.js";
import { randomUUID } from "node:crypto";

dotenv.config();

if (!process.env.REDASH_API_KEY) {
  console.error("REDASH_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "redash-mcp",
  version: "1.2.0",
});

const wrapTool = async (logic: Promise<any>) => {
  try {
    const result = await logic;
    return result?.content
      ? result
      : { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    logger.error(`Tool execution error: ${error.message}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    };
  }
};

// --- TOOLS REGISTRATION (Fixed Types) ---

server.tool("get-query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQuery(id))
);

server.tool(
  "list-queries",
  {
  page: z.number().optional(), 
  page_size: z.number().optional(),
  q: z.string().optional()
  },
  (args) => wrapTool(redashClient.getQueries(args as any))
);

server.tool("get-query-results-csv", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQueryResultsAsCsv(id))
);

server.tool("get-dashboard", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getDashboard(id))
);

server.tool(
  "list-dashboards",
  {
    page: z.number().optional(),
    page_size: z.number().optional(),
  },
  (args) => wrapTool(redashClient.getDashboards(args as any))
);

server.tool("list-data-sources", {}, () =>
  wrapTool(redashClient.getDataSources())
);

server.tool(
  "create-widget",
  {
    dashboard_id: z.number(),
    visualization_id: z.number().optional(),
    text: z.string().optional(),
    width: z.number().default(1),
    options: z.any(),
  },
  (args) => wrapTool(redashClient.createWidget(args as any))
);

// ... (You can add the rest of the tools following the same pattern)

// --- EXPRESS SERVER ---
// Cursor supports remote MCP over Streamable HTTP. We expose `/mcp` for that.
// We keep legacy SSE endpoints (`/sse` + `/messages`) for compatibility.

const app = express();
app.use(express.json());

// Streamable HTTP transport (recommended for remote deployments)
const streamableTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// Legacy SSE transport (deprecated, but supported by some clients)
let sseTransport: SSEServerTransport | null = null;

// Connect server to transports once at startup.
// Streamable HTTP is per-request under the hood, but the server still "connects" to the transport instance.
server.connect(streamableTransport).catch((error) => {
  logger.error(`Failed to connect Streamable HTTP transport: ${error.message}`);
  process.exit(1);
});

app.all("/mcp", async (req: any, res: any) => {
  // Express req/res are compatible with Node IncomingMessage/ServerResponse expected by the SDK.
  await streamableTransport.handleRequest(req, res, req.body);
});

app.get("/sse", async (req: Request, res: Response) => {
  // Avoid noisy stdout logs; they can confuse stdio clients if this file is ever run that way.
  sseTransport = new SSEServerTransport("/messages", res);
  await server.connect(sseTransport);
});

app.post("/messages", async (req: Request, res: Response) => {
  if (sseTransport) {
    await sseTransport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE session found.");
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Redash MCP Server listening on :${PORT} (Streamable HTTP: /mcp)`);
});

app.get("/", (req: Request, res: Response) => {
  res.send("Redash MCP Server is online.");
});
