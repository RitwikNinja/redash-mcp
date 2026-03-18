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
  UpdateQuerySnippetRequest
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

const wrapTool = async (logic: Promise<any>) => {
  try {
    const result = await logic;
    return result?.content
      ? result
      : { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
};
// ------------------- FIXED TOOL (CRITICAL) -------------------

// 🔥 FIX: Remove incorrect type cast causing TS2345
server.tool(
  "add_alert_subscription",
  {
    alertId: z.coerce.number(),
    destination_id: z.coerce.number().optional()
  },
  async (args) =>
    wrapTool(
      redashClient.addAlertSubscription({
        alert_id: args.alertId,
        destination_id: args.destination_id
      })
    )
);

// ----- 1. QUERY TOOLS -----

server.tool("get_query", { queryId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getQuery(args.queryId)));

server.tool("list_queries", {
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25),
  q: z.string().optional()
}, async (args) => wrapTool(redashClient.getQueries(args.page, args.pageSize, args.q)));

server.tool("create_query", {
  name: z.string(),
  data_source_id: z.coerce.number(),
  query: z.string(),
  description: z.string().optional(),
  options: z.any().optional(),
  schedule: z.any().optional(),
  tags: z.array(z.string()).optional()
}, async (args) => wrapTool(redashClient.createQuery(args as CreateQueryRequest)));

server.tool("update_query", {
  queryId: z.coerce.number(),
  name: z.string().optional(),
  data_source_id: z.coerce.number().optional(),
  query: z.string().optional(),
  description: z.string().optional(),
  options: z.any().optional(),
  schedule: z.any().optional(),
  tags: z.array(z.string()).optional(),
  is_archived: z.boolean().optional(),
  is_draft: z.boolean().optional()
}, async ({ queryId, ...updateData }) => wrapTool(redashClient.updateQuery(queryId, updateData as UpdateQueryRequest)));

server.tool("archive_query", { queryId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.archiveQuery(args.queryId)));

server.tool("execute_query", {
  queryId: z.coerce.number(),
  parameters: z.record(z.any()).optional()
}, async (args) => wrapTool(redashClient.executeQuery(args.queryId, args.parameters)));

server.tool("execute_adhoc_query", {
  query: z.string(),
  dataSourceId: z.coerce.number()
}, async (args) => wrapTool(redashClient.executeAdhocQuery(args.query, args.dataSourceId)));

server.tool("get_query_results_csv", {
  queryId: z.coerce.number(),
  refresh: z.boolean().optional().default(false)
}, async (args) => {
  const csv = await redashClient.getQueryResultsAsCsv(args.queryId, args.refresh);
  return { content: [{ type: "text", text: csv }] };
});

server.tool("fork_query", { queryId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.forkQuery(args.queryId)));

server.tool("get_my_queries", { 
  page: z.coerce.number().optional().default(1), 
  pageSize: z.coerce.number().optional().default(25) 
}, async (args) => wrapTool(redashClient.getMyQueries(args.page, args.pageSize)));

server.tool("get_recent_queries", { 
  page: z.coerce.number().optional().default(1), 
  pageSize: z.coerce.number().optional().default(25) 
}, async (args) => wrapTool(redashClient.getRecentQueries(args.page, args.pageSize)));

server.tool("get_favorite_queries", { 
  page: z.coerce.number().optional().default(1), 
  pageSize: z.coerce.number().optional().default(25) 
}, async (args) => wrapTool(redashClient.getFavoriteQueries(args.page, args.pageSize)));

server.tool("add_query_favorite", { queryId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.addQueryFavorite(args.queryId)));

server.tool("remove_query_favorite", { queryId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.removeQueryFavorite(args.queryId)));

server.tool("get_query_tags", {}, async () => wrapTool(redashClient.getQueryTags()));

// ----- 2. DASHBOARD TOOLS -----

server.tool("list_dashboards", {
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
}, async (args) => wrapTool(redashClient.getDashboards(args.page, args.pageSize)));

server.tool("get_dashboard", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getDashboard(args.dashboardId)));

server.tool("create_dashboard", { name: z.string(), tags: z.array(z.string()).optional() }, 
  async (args) => wrapTool(redashClient.createDashboard(args as CreateDashboardRequest)));

server.tool("update_dashboard", {
  dashboardId: z.coerce.number(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_archived: z.boolean().optional(),
  is_draft: z.boolean().optional(),
  dashboard_filters_enabled: z.boolean().optional()
}, async ({ dashboardId, ...data }) => wrapTool(redashClient.updateDashboard(dashboardId, data as UpdateDashboardRequest)));

server.tool("archive_dashboard", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.archiveDashboard(args.dashboardId)));

server.tool("fork_dashboard", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.forkDashboard(args.dashboardId)));

server.tool("share_dashboard", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.shareDashboard(args.dashboardId)));

server.tool("unshare_dashboard", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.unshareDashboard(args.dashboardId)));

server.tool("get_my_dashboards", { 
  page: z.coerce.number().optional().default(1), 
  pageSize: z.coerce.number().optional().default(25) 
}, async (args) => wrapTool(redashClient.getMyDashboards(args.page, args.pageSize)));

server.tool("get_favorite_dashboards", { 
  page: z.coerce.number().optional().default(1), 
  pageSize: z.coerce.number().optional().default(25) 
}, async (args) => wrapTool(redashClient.getFavoriteDashboards(args.page, args.pageSize)));

server.tool("add_dashboard_favorite", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.addDashboardFavorite(args.dashboardId)));

server.tool("remove_dashboard_favorite", { dashboardId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.removeDashboardFavorite(args.dashboardId)));

server.tool("get_dashboard_tags", {}, async () => wrapTool(redashClient.getDashboardTags()));

// ----- 3. VISUALIZATION TOOLS -----

server.tool("get_visualization", { visualizationId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getVisualization(args.visualizationId)));

server.tool("create_visualization", {
  query_id: z.coerce.number(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  options: z.any()
}, async (args) => wrapTool(redashClient.createVisualization(args as CreateVisualizationRequest)));

server.tool("update_visualization", {
  visualizationId: z.coerce.number(),
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.any().optional()
}, async ({ visualizationId, ...data }) => wrapTool(redashClient.updateVisualization(visualizationId, data as UpdateVisualizationRequest)));

server.tool("delete_visualization", { visualizationId: z.coerce.number() }, 
  async (args) => { await redashClient.deleteVisualization(args.visualizationId); return { content: [{ type: "text", text: "Success" }] }; });

// ----- 4. ALERT TOOLS -----

server.tool("list_alerts", {}, async () => wrapTool(redashClient.getAlerts()));

server.tool("get_alert", { alertId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getAlert(args.alertId)));

server.tool("create_alert", {
  name: z.string(),
  query_id: z.coerce.number(),
  options: z.object({
    column: z.string(),
    op: z.string(),
    value: z.union([z.coerce.number(), z.string()]),
    custom_subject: z.string().optional(),
    custom_body: z.string().optional()
  }),
  rearm: z.coerce.number().nullable().optional()
}, async (args) => wrapTool(redashClient.createAlert(args as CreateAlertRequest)));

server.tool("update_alert", {
  alertId: z.coerce.number(),
  name: z.string().optional(),
  query_id: z.coerce.number().optional(),
  options: z.any().optional(),
  rearm: z.coerce.number().nullable().optional()
}, async ({ alertId, ...data }) => wrapTool(redashClient.updateAlert(alertId, data as UpdateAlertRequest)));

server.tool("delete_alert", { alertId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.deleteAlert(args.alertId)));

server.tool("mute_alert", { alertId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.muteAlert(args.alertId)));

server.tool("get_alert_subscriptions", { alertId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getAlertSubscriptions(args.alertId)));

server.tool("add_alert_subscription", {
  alertId: z.coerce.number(),
  destination_id: z.coerce.number().optional()
}, async (args) => wrapTool(redashClient.addAlertSubscription(args as CreateAlertSubscriptionRequest)));

// ----- 5. WIDGET TOOLS -----

server.tool("list_widgets", {}, async () => wrapTool(redashClient.getWidgets()));

server.tool("get_widget", { widgetId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getWidget(args.widgetId)));

server.tool("create_widget", {
  dashboard_id: z.coerce.number(),
  visualization_id: z.coerce.number().optional(),
  text: z.string().optional(),
  width: z.coerce.number().optional().default(1),
  options: z.any().optional()
}, async (args) => wrapTool(redashClient.createWidget(args as CreateWidgetRequest)));

server.tool("update_widget", {
  widgetId: z.coerce.number(),
  dashboard_id: z.coerce.number().optional(),
  visualization_id: z.coerce.number().optional(),
  text: z.string().optional(),
  width: z.coerce.number().optional(),
  options: z.any().optional()
}, async ({ widgetId, ...data }) => wrapTool(redashClient.updateWidget(widgetId, data as UpdateWidgetRequest)));

server.tool("delete_widget", { widgetId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.deleteWidget(args.widgetId)));

// ----- 6. QUERY SNIPPET TOOLS -----

server.tool("list_query_snippets", {}, async () => wrapTool(redashClient.getQuerySnippets()));

server.tool("get_query_snippet", { snippetId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getQuerySnippet(args.snippetId)));

server.tool("create_query_snippet", {
  trigger: z.string(),
  description: z.string(),
  snippet: z.string()
}, async (args) => wrapTool(redashClient.createQuerySnippet(args as CreateQuerySnippetRequest)));

server.tool("update_query_snippet", {
  snippetId: z.coerce.number(),
  trigger: z.string().optional(),
  description: z.string().optional(),
  snippet: z.string().optional()
}, async ({ snippetId, ...data }) => wrapTool(redashClient.updateQuerySnippet(snippetId, data as UpdateQuerySnippetRequest)));

server.tool("delete_query_snippet", { snippetId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.deleteQuerySnippet(args.snippetId)));

// ----- 7. SYSTEM TOOLS -----

server.tool("list_data_sources", {}, async () => wrapTool(redashClient.getDataSources()));

server.tool("get_schema", { dataSourceId: z.coerce.number() }, 
  async (args) => wrapTool(redashClient.getSchema(args.dataSourceId)));

server.tool("list_destinations", {}, async () => wrapTool(redashClient.getDestinations()));


// ------------------- EXPRESS SERVER -------------------

const app = express();
app.use(express.json());

// ✅ Health check (Render uses this)
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

// ✅ Start server IMMEDIATELY (critical)
const PORT = process.env.PORT || 3000;

const serverInstance = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

// 🔥 VERY IMPORTANT: keep process alive
setInterval(() => {}, 1000 * 60);

// ------------------- SSE SETUP -------------------

const activeTransports = new Set<SSEServerTransport>();

app.get("/sse", async (req: Request, res: Response) => {
  logger.info("SSE connection started");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const transport = new SSEServerTransport("/messages", res);
  activeTransports.add(transport);

  // ❗ DO NOT block startup — this runs only on request
  server.connect(transport).catch((err) => {
    logger.error("MCP connection error", err);
  });

  req.on("close", () => {
    logger.info("SSE connection closed");
    activeTransports.delete(transport);
  });
});

app.post("/messages", async (req: Request, res: Response) => {
  if (activeTransports.size === 0) {
    return res.status(400).send("No active SSE connection");
  }

  const transport = Array.from(activeTransports).pop()!;
  await transport.handlePostMessage(req, res);
});
