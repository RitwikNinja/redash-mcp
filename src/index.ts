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
    if (result?.content) return result;
    if (typeof result === "string") {
      return { content: [{ type: "text", text: result }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    logger.error(`Tool execution error: ${error.message}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    };
  }
};

// --- TOOLS REGISTRATION ---

const zPagination = {
  page: z.number().optional(),
  page_size: z.number().optional(),
};

const zId = { id: z.number() };

// ----- Queries -----
server.tool("get-query", { id: z.number() }, ({ id }) =>
  wrapTool(redashClient.getQuery(id))
);

server.tool(
  "list-queries",
  {
    ...zPagination,
    q: z.string().optional(),
  },
  ({ page, page_size, q }) =>
    wrapTool(redashClient.getQueries(page ?? 1, page_size ?? 25, q))
);

server.tool(
  "create-query",
  {
    name: z.string(),
    data_source_id: z.number(),
    query: z.string(),
    description: z.string().optional(),
    options: z.any().optional(),
    schedule: z.any().optional(),
    tags: z.array(z.string()).optional(),
  },
  (args) => wrapTool(redashClient.createQuery(args as any))
);

server.tool(
  "update-query",
  {
    id: z.number(),
    name: z.string().optional(),
    data_source_id: z.number().optional(),
    query: z.string().optional(),
    description: z.string().optional(),
    options: z.any().optional(),
    schedule: z.any().optional(),
    tags: z.array(z.string()).optional(),
    is_archived: z.boolean().optional(),
    is_draft: z.boolean().optional(),
  },
  ({ id, ...data }) => wrapTool(redashClient.updateQuery(id, data as any))
);

server.tool("archive-query", zId, ({ id }) =>
  wrapTool(redashClient.archiveQuery(id))
);

server.tool(
  "execute-query",
  { id: z.number(), parameters: z.record(z.any()).optional() },
  ({ id, parameters }) => wrapTool(redashClient.executeQuery(id, parameters))
);

server.tool(
  "execute-adhoc-query",
  { query: z.string(), data_source_id: z.number() },
  ({ query, data_source_id }) =>
    wrapTool(redashClient.executeAdhocQuery(query, data_source_id))
);

server.tool(
  "get-query-results-csv",
  { id: z.number(), refresh: z.boolean().optional() },
  ({ id, refresh }) => wrapTool(redashClient.getQueryResultsAsCsv(id, !!refresh))
);

server.tool("fork-query", zId, ({ id }) => wrapTool(redashClient.forkQuery(id)));

server.tool("list-my-queries", zPagination, ({ page, page_size }) =>
  wrapTool(redashClient.getMyQueries(page ?? 1, page_size ?? 25))
);

server.tool("list-recent-queries", zPagination, ({ page, page_size }) =>
  wrapTool(redashClient.getRecentQueries(page ?? 1, page_size ?? 25))
);

server.tool("get-query-tags", {}, () => wrapTool(redashClient.getQueryTags()));

server.tool("list-favorite-queries", zPagination, ({ page, page_size }) =>
  wrapTool(redashClient.getFavoriteQueries(page ?? 1, page_size ?? 25))
);

server.tool("add-query-favorite", zId, ({ id }) =>
  wrapTool(redashClient.addQueryFavorite(id))
);

server.tool("remove-query-favorite", zId, ({ id }) =>
  wrapTool(redashClient.removeQueryFavorite(id))
);

// ----- Dashboards -----

server.tool("get-dashboard", zId, ({ id }) => wrapTool(redashClient.getDashboard(id)));

server.tool("list-dashboards", zPagination, ({ page, page_size }) =>
  wrapTool(redashClient.getDashboards(page ?? 1, page_size ?? 25))
);

server.tool(
  "create-dashboard",
  { name: z.string(), tags: z.array(z.string()).optional() },
  (args) => wrapTool(redashClient.createDashboard(args as any))
);

server.tool(
  "update-dashboard",
  {
    id: z.number(),
    name: z.string().optional(),
    tags: z.array(z.string()).optional(),
    is_archived: z.boolean().optional(),
    is_draft: z.boolean().optional(),
    dashboard_filters_enabled: z.boolean().optional(),
  },
  ({ id, ...data }) => wrapTool(redashClient.updateDashboard(id, data as any))
);

server.tool("archive-dashboard", zId, ({ id }) =>
  wrapTool(redashClient.archiveDashboard(id))
);

server.tool("fork-dashboard", zId, ({ id }) =>
  wrapTool(redashClient.forkDashboard(id))
);

server.tool("get-public-dashboard", { token: z.string() }, ({ token }) =>
  wrapTool(redashClient.getPublicDashboard(token))
);

server.tool("share-dashboard", zId, ({ id }) =>
  wrapTool(redashClient.shareDashboard(id))
);

server.tool("unshare-dashboard", zId, ({ id }) =>
  wrapTool(redashClient.unshareDashboard(id))
);

server.tool("list-my-dashboards", zPagination, ({ page, page_size }) =>
  wrapTool(redashClient.getMyDashboards(page ?? 1, page_size ?? 25))
);

server.tool("list-favorite-dashboards", zPagination, ({ page, page_size }) =>
  wrapTool(redashClient.getFavoriteDashboards(page ?? 1, page_size ?? 25))
);

server.tool("add-dashboard-favorite", zId, ({ id }) =>
  wrapTool(redashClient.addDashboardFavorite(id))
);

server.tool("remove-dashboard-favorite", zId, ({ id }) =>
  wrapTool(redashClient.removeDashboardFavorite(id))
);

server.tool("get-dashboard-tags", {}, () =>
  wrapTool(redashClient.getDashboardTags())
);

// ----- Visualizations -----

server.tool("get-visualization", zId, ({ id }) =>
  wrapTool(redashClient.getVisualization(id))
);

server.tool(
  "create-visualization",
  {
    query_id: z.number(),
    type: z.string(),
    name: z.string(),
    description: z.string().optional(),
    options: z.any(),
  },
  (args) => wrapTool(redashClient.createVisualization(args as any))
);

server.tool(
  "update-visualization",
  {
    id: z.number(),
    type: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    options: z.any().optional(),
  },
  ({ id, ...data }) => wrapTool(redashClient.updateVisualization(id, data as any))
);

server.tool("delete-visualization", zId, async ({ id }) =>
  wrapTool(redashClient.deleteVisualization(id))
);

// ----- Data sources -----

server.tool("list-data-sources", {}, () => wrapTool(redashClient.getDataSources()));

server.tool("get-schema", { data_source_id: z.number() }, ({ data_source_id }) =>
  wrapTool(redashClient.getSchema(data_source_id))
);

// ----- Alerts -----

server.tool("list-alerts", {}, () => wrapTool(redashClient.getAlerts()));

server.tool("get-alert", zId, ({ id }) => wrapTool(redashClient.getAlert(id)));

server.tool(
  "create-alert",
  {
    name: z.string(),
    query_id: z.number(),
    options: z.object({
      column: z.string(),
      op: z.string(),
      value: z.union([z.number(), z.string()]),
      custom_subject: z.string().optional(),
      custom_body: z.string().optional(),
    }),
    rearm: z.number().nullable().optional(),
  },
  (args) => wrapTool(redashClient.createAlert(args as any))
);

server.tool(
  "update-alert",
  {
    id: z.number(),
    name: z.string().optional(),
    query_id: z.number().optional(),
    options: z
      .object({
        column: z.string().optional(),
        op: z.string().optional(),
        value: z.union([z.number(), z.string()]).optional(),
        custom_subject: z.string().optional(),
        custom_body: z.string().optional(),
      })
      .optional(),
    rearm: z.number().nullable().optional(),
  },
  ({ id, ...data }) => wrapTool(redashClient.updateAlert(id, data as any))
);

server.tool("delete-alert", zId, ({ id }) =>
  wrapTool(redashClient.deleteAlert(id))
);

server.tool("mute-alert", zId, ({ id }) => wrapTool(redashClient.muteAlert(id)));

server.tool("list-alert-subscriptions", { alert_id: z.number() }, ({ alert_id }) =>
  wrapTool(redashClient.getAlertSubscriptions(alert_id))
);

server.tool(
  "add-alert-subscription",
  { alert_id: z.number(), destination_id: z.number().optional() },
  ({ alert_id, destination_id }) =>
    wrapTool(
      redashClient.addAlertSubscription(
        alert_id,
        destination_id !== undefined ? ({ destination_id } as any) : undefined
      )
    )
);

server.tool(
  "remove-alert-subscription",
  { alert_id: z.number(), subscription_id: z.number() },
  ({ alert_id, subscription_id }) =>
    wrapTool(redashClient.removeAlertSubscription(alert_id, subscription_id))
);

// ----- Widgets -----

server.tool("list-widgets", {}, () => wrapTool(redashClient.getWidgets()));

server.tool("get-widget", zId, ({ id }) => wrapTool(redashClient.getWidget(id)));

server.tool(
  "create-widget",
  {
    dashboard_id: z.number(),
    visualization_id: z.number().optional(),
    text: z.string().optional(),
    width: z.number().optional(),
    options: z.any().optional(),
  },
  (args) =>
    wrapTool(
      redashClient.createWidget({
        ...(args as any),
        width: (args as any).width ?? 1,
        options: (args as any).options ?? {},
      })
    )
);

server.tool(
  "update-widget",
  {
    id: z.number(),
    visualization_id: z.number().optional(),
    text: z.string().optional(),
    width: z.number().optional(),
    options: z.any().optional(),
  },
  ({ id, ...data }) => wrapTool(redashClient.updateWidget(id, data as any))
);

server.tool("delete-widget", zId, ({ id }) =>
  wrapTool(redashClient.deleteWidget(id))
);

// ----- Query snippets -----

server.tool("list-query-snippets", {}, () =>
  wrapTool(redashClient.getQuerySnippets())
);

server.tool("get-query-snippet", zId, ({ id }) =>
  wrapTool(redashClient.getQuerySnippet(id))
);

server.tool(
  "create-query-snippet",
  { trigger: z.string(), description: z.string().optional(), snippet: z.string() },
  (args) => wrapTool(redashClient.createQuerySnippet(args as any))
);

server.tool(
  "update-query-snippet",
  { id: z.number(), trigger: z.string().optional(), description: z.string().optional(), snippet: z.string().optional() },
  ({ id, ...data }) => wrapTool(redashClient.updateQuerySnippet(id, data as any))
);

server.tool("delete-query-snippet", zId, ({ id }) =>
  wrapTool(redashClient.deleteQuerySnippet(id))
);

// ----- Destinations -----

server.tool("list-destinations", {}, () => wrapTool(redashClient.getDestinations()));

// (All available RedashClient methods are registered as MCP tools above.)

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
