import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import * as dotenv from 'dotenv';
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
  CreateAlertSubscriptionRequest, 
  CreateWidgetRequest, 
  UpdateWidgetRequest, 
  CreateQuerySnippetRequest, 
  UpdateQuerySnippetRequest 
} from "./redashClient.js";
import { logger } from "./logger.js";

// Load environment variables
dotenv.config();

// Verify critical configuration
if (!process.env.REDASH_API_KEY) {
  console.error("REDASH_API_KEY environment variable is required");
  process.exit(1);
}

// Create MCP server instance
const server = new McpServer({
  name: "redash-mcp",
  version: "1.1.0",
});

// Helper for tool execution response formatting
const formatResponse = (data: any) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const formatError = (error: any, context: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: `${context}: ${error instanceof Error ? error.message : String(error)}` }],
});

// ----- TOOLS REGISTRATION -----

// Query Tools
server.tool("get_query", { queryId: z.coerce.number() }, async ({ queryId }) => {
  try { return formatResponse(await redashClient.getQuery(queryId)); }
  catch (e) { return formatError(e, `Error getting query ${queryId}`); }
});

server.tool("create_query", {
  name: z.string(),
  data_source_id: z.coerce.number(),
  query: z.string(),
  description: z.string().optional(),
  options: z.any().optional(),
  schedule: z.any().optional(),
  tags: z.array(z.string()).optional()
}, async (params) => {
  try { return formatResponse(await redashClient.createQuery(params as CreateQueryRequest)); }
  catch (e) { return formatError(e, "Error creating query"); }
});

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
}, async ({ queryId, ...updateData }) => {
  try { return formatResponse(await redashClient.updateQuery(queryId, updateData as UpdateQueryRequest)); }
  catch (e) { return formatError(e, `Error updating query ${queryId}`); }
});

server.tool("archive_query", { queryId: z.coerce.number() }, async ({ queryId }) => {
  try { return formatResponse(await redashClient.archiveQuery(queryId)); }
  catch (e) { return formatError(e, `Error archiving query ${queryId}`); }
});

server.tool("list_data_sources", {}, async () => {
  try { return formatResponse(await redashClient.getDataSources()); }
  catch (e) { return formatError(e, "Error listing data sources"); }
});

server.tool("list_queries", {
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25),
  q: z.string().optional()
}, async ({ page, pageSize, q }) => {
  try { return formatResponse(await redashClient.getQueries(page, pageSize, q)); }
  catch (e) { return formatError(e, "Error listing queries"); }
});

server.tool("execute_query", {
  queryId: z.coerce.number(),
  parameters: z.record(z.any()).optional()
}, async ({ queryId, parameters }) => {
  try { return formatResponse(await redashClient.executeQuery(queryId, parameters)); }
  catch (e) { return formatError(e, `Error executing query ${queryId}`); }
});

server.tool("get_query_results_csv", {
  queryId: z.coerce.number(),
  refresh: z.boolean().optional().default(false)
}, async ({ queryId, refresh }) => {
  try { return { content: [{ type: "text", text: await redashClient.getQueryResultsAsCsv(queryId, refresh) }] }; }
  catch (e) { return formatError(e, `Error getting CSV for query ${queryId}`); }
});

// Dashboard Tools
server.tool("list_dashboards", {
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
}, async ({ page, pageSize }) => {
  try { return formatResponse(await redashClient.getDashboards(page, pageSize)); }
  catch (e) { return formatError(e, "Error listing dashboards"); }
});

server.tool("get_dashboard", { dashboardId: z.coerce.number() }, async ({ dashboardId }) => {
  try { return formatResponse(await redashClient.getDashboard(dashboardId)); }
  catch (e) { return formatError(e, `Error getting dashboard ${dashboardId}`); }
});

server.tool("create_dashboard", { name: z.string(), tags: z.array(z.string()).optional() }, async (params) => {
  try { return formatResponse(await redashClient.createDashboard(params as CreateDashboardRequest)); }
  catch (e) { return formatError(e, "Error creating dashboard"); }
});

server.tool("update_dashboard", {
  dashboardId: z.coerce.number(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_archived: z.boolean().optional(),
  is_draft: z.boolean().optional(),
  dashboard_filters_enabled: z.boolean().optional()
}, async ({ dashboardId, ...updateData }) => {
  try { return formatResponse(await redashClient.updateDashboard(dashboardId, updateData as UpdateDashboardRequest)); }
  catch (e) { return formatError(e, `Error updating dashboard ${dashboardId}`); }
});

server.tool("archive_dashboard", { dashboardId: z.coerce.number() }, async ({ dashboardId }) => {
  try { return formatResponse(await redashClient.archiveDashboard(dashboardId)); }
  catch (e) { return formatError(e, `Error archiving dashboard ${dashboardId}`); }
});

server.tool("fork_dashboard", { dashboardId: z.coerce.number() }, async ({ dashboardId }) => {
  try { return formatResponse(await redashClient.forkDashboard(dashboardId)); }
  catch (e) { return formatError(e, `Error forking dashboard ${dashboardId}`); }
});

server.tool("share_dashboard", { dashboardId: z.coerce.number() }, async ({ dashboardId }) => {
  try { return formatResponse(await redashClient.shareDashboard(dashboardId)); }
  catch (e) { return formatError(e, `Error sharing dashboard ${dashboardId}`); }
});

server.tool("unshare_dashboard", { dashboardId: z.coerce.number() }, async ({ dashboardId }) => {
  try { return formatResponse(await redashClient.unshareDashboard(dashboardId)); }
  catch (e) { return formatError(e, `Error unsharing dashboard ${dashboardId}`); }
});

// Visualization Tools
server.tool("create_visualization", {
  query_id: z.coerce.number(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  options: z.any()
}, async (params) => {
  try { return formatResponse(await redashClient.createVisualization(params as CreateVisualizationRequest)); }
  catch (e) { return formatError(e, "Error creating visualization"); }
});

server.tool("update_visualization", {
  visualizationId: z.coerce.number(),
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.any().optional()
}, async ({ visualizationId, ...updateData }) => {
  try { return formatResponse(await redashClient.updateVisualization(visualizationId, updateData as UpdateVisualizationRequest)); }
  catch (e) { return formatError(e, `Error updating visualization ${visualizationId}`); }
});

server.tool("delete_visualization", { visualizationId: z.coerce.number() }, async ({ visualizationId }) => {
  try { await redashClient.deleteVisualization(visualizationId); return { content: [{ type: "text", text: `Visualization ${visualizationId} deleted` }] }; }
  catch (e) { return formatError(e, `Error deleting visualization ${visualizationId}`); }
});

// Alert Tools
server.tool("list_alerts", {}, async () => {
  try { return formatResponse(await redashClient.getAlerts()); }
  catch (e) { return formatError(e, "Error listing alerts"); }
});

server.tool("get_alert", { alertId: z.coerce.number() }, async ({ alertId }) => {
  try { return formatResponse(await redashClient.getAlert(alertId)); }
  catch (e) { return formatError(e, `Error getting alert ${alertId}`); }
});

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
}, async (params) => {
  try { return formatResponse(await redashClient.createAlert(params as CreateAlertRequest)); }
  catch (e) { return formatError(e, "Error creating alert"); }
});

server.tool("delete_alert", { alertId: z.coerce.number() }, async ({ alertId }) => {
  try { await redashClient.deleteAlert(alertId); return { content: [{ type: "text", text: `Alert ${alertId} deleted` }] }; }
  catch (e) { return formatError(e, `Error deleting alert ${alertId}`); }
});

server.tool("mute_alert", { alertId: z.coerce.number() }, async ({ alertId }) => {
  try { return formatResponse(await redashClient.muteAlert(alertId)); }
  catch (e) { return formatError(e, `Error muting alert ${alertId}`); }
});

// Widget Tools
server.tool("list_widgets", {}, async () => {
  try { return formatResponse(await redashClient.getWidgets()); }
  catch (e) { return formatError(e, "Error listing widgets"); }
});

server.tool("create_widget", {
  dashboard_id: z.coerce.number(),
  visualization_id: z.coerce.number().optional(),
  text: z.string().optional(),
  width: z.coerce.number().optional().default(1),
  options: z.any().optional().default({})
}, async (params) => {
  try { return formatResponse(await redashClient.createWidget(params as CreateWidgetRequest)); }
  catch (e) { return formatError(e, "Error creating widget"); }
});

// Snippet & Destination Tools
server.tool("list_query_snippets", {}, async () => {
  try { return formatResponse(await redashClient.getQuerySnippets()); }
  catch (e) { return formatError(e, "Error listing snippets"); }
});

server.tool("list_destinations", {}, async () => {
  try { return formatResponse(await redashClient.getDestinations()); }
  catch (e) { return formatError(e, "Error listing destinations"); }
});

// Schema Tool
server.tool("get_schema", { dataSourceId: z.coerce.number() }, async ({ dataSourceId }) => {
  try { return formatResponse(await redashClient.getSchema(dataSourceId)); }
  catch (e) { return formatError(e, `Error getting schema for data source ${dataSourceId}`); }
});

// Add other tools following the same pattern...

// --- EXPRESS SERVER & SSE TRANSPORT ---

const app = express();
let transport: SSEServerTransport | null = null;

/**
 * The GET endpoint Claude/Client connects to via EventSource
 */
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection established");
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

/**
 * The POST endpoint where the client sends tool requests
 */
app.post("/messages", async (req: Request, res: Response) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE transport connection");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Redash MCP server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/messages`);
});
