import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import * as dotenv from "dotenv";
import { redashClient } from "./redashClient.js";
import { logger } from "./logger.js";

dotenv.config();

if (!process.env.REDASH_API_KEY) {
  console.error("REDASH_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "redash-mcp",
  version: "1.2.0",
});

process.stdin.resume();

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

server.tool("get_query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQuery(id))
);

server.tool("list_queries", { 
  page: z.number().optional(), 
  page_size: z.number().optional(),
  q: z.string().optional()
}, (args) =>
  wrapTool(redashClient.getQueries(args as any))
);

server.tool("get_query_results", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQueryResultsAsCsv(id))
);

server.tool("get_dashboard", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getDashboard(id))
);

server.tool("list_dashboards", { 
  page: z.number().optional(), 
  page_size: z.number().optional() 
}, (args) =>
  wrapTool(redashClient.getDashboards(args as any))
);

server.tool("get_data_sources", {}, () =>
  wrapTool(redashClient.getDataSources())
);

server.tool("create_widget", { 
  dashboard_id: z.number(), 
  visualization_id: z.number().optional(), 
  text: z.string().optional(), 
  width: z.number().default(1),
  options: z.any() 
}, (args) =>
  wrapTool(redashClient.createWidget(args as any))
);

// ... (You can add the rest of the tools following the same pattern)

// --- EXPRESS SERVER (Matched to your working version) ---

const app = express();
app.use(express.json());

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection established");
  // The SDK handles headers internally when we use this constructor
  transport = new SSEServerTransport("/messages", res);
  
  // By awaiting this, we ensure the transport is ready before Cursor calls /messages
  await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE session found.");
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Redash MCP Server running on port ${PORT}`);
});

app.get("/", (req: Request, res: Response) => {
  res.send("Redash MCP Server is online.");
});

setInterval(() => {}, 60000);
