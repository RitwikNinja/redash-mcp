import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import * as dotenv from "dotenv";
import { redashClient } from "./redashClient.js";
import { logger } from "./logger.js";

dotenv.config();

// 🔴 Fail fast if config missing
if (!process.env.REDASH_API_KEY) {
  console.error("REDASH_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "redash-mcp",
  version: "1.2.0",
});

// ✅ Prevent process exit
process.stdin.resume();

/**
 * Helper to ensure tool responses match MCP format and handle errors
 */
const wrapTool = async (logic: Promise<any>) => {
  try {
    const result = await logic;
    return result?.content
      ? result
      : { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    // Fixed TS2554: Expected 1 arguments, but got 2.
    logger.error(`Tool execution error: ${error.message}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    };
  }
};

// ------------------- TOOLS REGISTRATION -------------------

server.tool("get_query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQuery(id))
);

server.tool("list_queries", { 
  page: z.number().optional(), 
  page_size: z.number().optional(),
  q: z.string().optional()
}, (args) =>
  // Fixed TS2345: Destructuring args to pass correctly to client
  wrapTool(redashClient.getQueries(args as any))
);

server.tool("search_queries", { q: z.string() }, ({ q }) =>
  // Fixed TS2345: Ensuring correct argument structure for search
  wrapTool(redashClient.getQueries({ q } as any))
);

server.tool("create_query", { 
  name: z.string(), 
  query: z.string(), 
  data_source_id: z.number(),
  description: z.string().optional(),
  schedule: z.any().optional(),
  options: z.any().optional()
}, (args) =>
  wrapTool(redashClient.createQuery(args))
);

server.tool("update_query", { id: z.number(), data: z.any() }, ({ id, data }) =>
  wrapTool(redashClient.updateQuery(id, data))
);

server.tool("archive_query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.archiveQuery(id))
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
  // Fixed TS2345: Destructuring args for dashboard list
  wrapTool(redashClient.getDashboards(args as any))
);

server.tool("create_dashboard", { name: z.string() }, (args) =>
  wrapTool(redashClient.createDashboard(args))
);

server.tool("update_dashboard", { id: z.number(), data: z.any() }, ({ id, data }) =>
  wrapTool(redashClient.updateDashboard(id, data))
);

server.tool("archive_dashboard", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.archiveDashboard(id))
);

server.tool("get_data_sources", {}, () =>
  wrapTool(redashClient.getDataSources())
);

server.tool("create_visualization", { 
  query_id: z.number(), 
  type: z.string(), 
  name: z.string(), 
  options: z.any() 
}, (args) =>
  wrapTool(redashClient.createVisualization(args))
);

server.tool("update_visualization", { id: z.number(), data: z.any() }, ({ id, data }) =>
  wrapTool(redashClient.updateVisualization(id, data))
);

server.tool("delete_visualization", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteVisualization(id))
);

server.tool("create_widget", { 
  dashboard_id: z.number(), 
  visualization_id: z.number().optional(), 
  text: z.string().optional(), 
  width: z.number().default(1),
  options: z.any() 
}, (args) =>
  // Fixed TS2345: Property 'width' is now included in args
  wrapTool(redashClient.createWidget(args as any))
);

server.tool("delete_widget", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteWidget(id))
);

server.tool("get_alert", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getAlert(id))
);

server.tool("create_alert", { 
  name: z.string(), 
  query_id: z.number(), 
  options: z.any(), 
  rearm: z.number().optional() 
}, (args) =>
  wrapTool(redashClient.createAlert(args))
);

server.tool("delete_alert", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteAlert(id))
);

server.tool("list_alert_subscriptions", { alert_id: z.number() }, ({ alert_id }) =>
  wrapTool(redashClient.getAlertSubscriptions(alert_id))
);

server.tool("list_query_snippets", {}, () =>
  wrapTool(redashClient.getQuerySnippets())
);

server.tool("create_query_snippet", { 
  trigger: z.string(), 
  description: z.string(), 
  snippet: z.string() 
}, (args) =>
  wrapTool(redashClient.createQuerySnippet(args))
);

server.tool("update_query_snippet", { id: z.number(), data: z.any() }, ({ id, data }) =>
  wrapTool(redashClient.updateQuerySnippet(id, data))
);

server.tool("delete_query_snippet", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteQuerySnippet(id))
);

server.tool("get_destinations", {}, () =>
  wrapTool(redashClient.getDestinations())
);

// ------------------- EXPRESS & SSE TRANSPORT -------------------

const app = express();
app.use(express.json());

// Track the active transport for the /messages endpoint
let currentTransport: SSEServerTransport | null = null;

/**
 * The GET endpoint Cursor connects to via EventSource
 */
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection established");
  
  // Transport handles stream headers automatically
  const transport = new SSEServerTransport("/messages", res);
  currentTransport = transport;

  // CRITICAL: Await the connection so MCP is ready before the route finishes.
  await server.connect(transport);

  req.on("close", () => {
    console.log("SSE connection closed");
    if (currentTransport === transport) {
      currentTransport = null;
    }
  });
});

/**
 * The POST endpoint where Cursor sends tool requests
 */
app.post("/messages", async (req: Request, res: Response) => {
  if (currentTransport) {
    await currentTransport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE session found.");
  }
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Redash MCP Server running on port ${PORT}`);
});

// Health check for Render
app.get("/", (req: Request, res: Response) => {
  res.send("Redash MCP Server is online.");
});

// Keep process active
setInterval(() => {}, 60000);
