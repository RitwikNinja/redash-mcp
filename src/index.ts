import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import * as dotenv from "dotenv";
import {
  redashClient,
  CreateQueryRequest,
  UpdateQueryRequest,
  CreateVisualizationRequest,
  UpdateVisualizationRequest,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateAlertRequest,
  UpdateAlertRequest,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  CreateQuerySnippetRequest,
  UpdateQuerySnippetRequest,
  CreateAlertSubscriptionRequest
} from "./redashClient.js";
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
 * Helper to ensure tool responses match MCP format
 */
const wrapTool = async (logic: Promise<any>) => {
  try {
    const result = await logic;
    // Ensure we return the expected structure even if the client returns raw data
    return result?.content
      ? result
      : { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    logger.error("Tool execution error", { error: error.message });
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    };
  }
};

// ------------------- TOOLS REGISTRATION -------------------
// Note: Changed z.coerce to standard z types to ensure compatible JSON Schema for Cursor

server.tool("get_query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQuery(id))
);

server.tool("list_queries", { page: z.number().optional(), page_size: z.number().optional() }, (args) =>
  wrapTool(redashClient.listQueries(args))
);

server.tool("search_queries", { q: z.string() }, ({ q }) =>
  wrapTool(redashClient.searchQueries(q))
);

server.tool("create_query", CreateQueryRequest, (args) =>
  wrapTool(redashClient.createQuery(args))
);

server.tool("update_query", { id: z.number(), data: UpdateQueryRequest }, ({ id, data }) =>
  wrapTool(redashClient.updateQuery(id, data))
);

server.tool("archive_query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.archiveQuery(id))
);

server.tool("get_query_results", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQueryResults(id))
);

server.tool("refresh_query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.refreshQuery(id))
);

server.tool("get_job", { id: z.string() }, ({ id }) =>
  wrapTool(redashClient.getJob(id))
);

server.tool("get_dashboard", { slug: z.string() }, ({ slug }) =>
  wrapTool(redashClient.getDashboard(slug))
);

server.tool("list_dashboards", { page: z.number().optional(), page_size: z.number().optional() }, (args) =>
  wrapTool(redashClient.listDashboards(args))
);

server.tool("create_dashboard", CreateDashboardRequest, (args) =>
  wrapTool(redashClient.createDashboard(args))
);

server.tool("update_dashboard", { id: z.number(), data: UpdateDashboardRequest }, ({ id, data }) =>
  wrapTool(redashClient.updateDashboard(id, data))
);

server.tool("archive_dashboard", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.archiveDashboard(id))
);

server.tool("get_data_sources", {}, () =>
  wrapTool(redashClient.getDataSources())
);

server.tool("get_data_source_schema", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getDataSourceSchema(id))
);

server.tool("create_visualization", CreateVisualizationRequest, (args) =>
  wrapTool(redashClient.createVisualization(args))
);

server.tool("update_visualization", { id: z.number(), data: UpdateVisualizationRequest }, ({ id, data }) =>
  wrapTool(redashClient.updateVisualization(id, data))
);

server.tool("delete_visualization", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteVisualization(id))
);

server.tool("create_widget", CreateWidgetRequest, (args) =>
  wrapTool(redashClient.createWidget(args))
);

server.tool("update_widget", { id: z.number(), data: UpdateWidgetRequest }, ({ id, data }) =>
  wrapTool(redashClient.updateWidget(id, data))
);

server.tool("delete_widget", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteWidget(id))
);

server.tool("list_alerts", {}, () =>
  wrapTool(redashClient.listAlerts())
);

server.tool("get_alert", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getAlert(id))
);

server.tool("create_alert", CreateAlertRequest, (args) =>
  wrapTool(redashClient.createAlert(args))
);

server.tool("update_alert", { id: z.number(), data: UpdateAlertRequest }, ({ id, data }) =>
  wrapTool(redashClient.updateAlert(id, data))
);

server.tool("delete_alert", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteAlert(id))
);

server.tool("create_alert_subscription", { alert_id: z.number(), data: CreateAlertSubscriptionRequest }, ({ alert_id, data }) =>
  wrapTool(redashClient.createAlertSubscription(alert_id, data))
);

server.tool("list_alert_subscriptions", { alert_id: z.number() }, ({ alert_id }) =>
  wrapTool(redashClient.listAlertSubscriptions(alert_id))
);

server.tool("delete_alert_subscription", { alert_id: z.number(), subscription_id: z.number() }, ({ alert_id, subscription_id }) =>
  wrapTool(redashClient.deleteAlertSubscription(alert_id, subscription_id))
);

server.tool("list_query_snippets", {}, () =>
  wrapTool(redashClient.listQuerySnippets())
);

server.tool("create_query_snippet", CreateQuerySnippetRequest, (args) =>
  wrapTool(redashClient.createQuerySnippet(args))
);

server.tool("update_query_snippet", { id: z.number(), data: UpdateQuerySnippetRequest }, ({ id, data }) =>
  wrapTool(redashClient.updateQuerySnippet(id, data))
);

server.tool("delete_query_snippet", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.deleteQuerySnippet(id))
);

server.tool("get_settings", {}, () =>
  wrapTool(redashClient.getSettings())
);

server.tool("get_session", {}, () =>
  wrapTool(redashClient.getSession())
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
  
  // Initialize transport and let it handle the stream headers
  const transport = new SSEServerTransport("/messages", res);
  currentTransport = transport;

  // CRITICAL: Await the connection so MCP is ready before the route logic finishes
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
    res.status(400).send("No active SSE session found. Connect to /sse first.");
  }
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Redash MCP Server running on port ${PORT}`);
});

// Health check for hosting providers like Render
app.get("/", (req: Request, res: Response) => {
  res.send("Redash MCP Server is running.");
});

// Prevent process from sleeping in some environments
setInterval(() => {}, 60000);
