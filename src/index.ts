#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dotenv from 'dotenv';
import { redashClient, CreateQueryRequest, UpdateQueryRequest, CreateVisualizationRequest, UpdateVisualizationRequest, CreateDashboardRequest, UpdateDashboardRequest, CreateAlertRequest, UpdateAlertRequest, CreateAlertSubscriptionRequest, CreateWidgetRequest, UpdateWidgetRequest, CreateQuerySnippetRequest, UpdateQuerySnippetRequest } from "./redashClient.js";
import { logger, LogLevel } from "./logger.js";

// Load environment variables
dotenv.config();

// Create MCP server instance
const server = new Server(
  {
    name: "redash-mcp",
    version: "1.1.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Set up server logging
logger.info('Starting Redash MCP server...');

// ----- Tools Implementation -----

// Tool: get_query
const getQuerySchema = z.object({
  queryId: z.coerce.number()
});

async function getQuery(params: z.infer<typeof getQuerySchema>) {
  try {
    const { queryId } = params;
    const query = await redashClient.getQuery(queryId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(query, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error getting query ${params.queryId}: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: create_query
const createQuerySchema = z.object({
  name: z.string(),
  data_source_id: z.coerce.number(),
  query: z.string(),
  description: z.string().optional(),
  options: z.any().optional(),
  schedule: z.any().optional(),
  tags: z.array(z.string()).optional()
});

async function createQuery(params: z.infer<typeof createQuerySchema>) {
  try {
    logger.debug(`Create query params: ${JSON.stringify(params)}`);

    // Convert params to CreateQueryRequest with proper defaults
    const queryData: CreateQueryRequest = {
      name: params.name,
      data_source_id: params.data_source_id,
      query: params.query,
      description: params.description || '',
      options: params.options || {},
      schedule: params.schedule || null,
      tags: params.tags || []
    };

    logger.debug(`Calling redashClient.createQuery with data: ${JSON.stringify(queryData)}`);
    const result = await redashClient.createQuery(queryData);
    logger.debug(`Create query result: ${JSON.stringify(result)}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error creating query: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error creating query: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: update_query
const updateQuerySchema = z.object({
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
});

async function updateQuery(params: z.infer<typeof updateQuerySchema>) {
  try {
    const { queryId, ...updateData } = params;

    logger.debug(`Update query ${queryId} params: ${JSON.stringify(updateData)}`);

    // Convert params to UpdateQueryRequest - only include non-undefined fields
    const queryData: UpdateQueryRequest = {};

    // Only add fields that are defined
    if (updateData.name !== undefined) queryData.name = updateData.name;
    if (updateData.data_source_id !== undefined) queryData.data_source_id = updateData.data_source_id;
    if (updateData.query !== undefined) queryData.query = updateData.query;
    if (updateData.description !== undefined) queryData.description = updateData.description;
    if (updateData.options !== undefined) queryData.options = updateData.options;
    if (updateData.schedule !== undefined) queryData.schedule = updateData.schedule;
    if (updateData.tags !== undefined) queryData.tags = updateData.tags;
    if (updateData.is_archived !== undefined) queryData.is_archived = updateData.is_archived;
    if (updateData.is_draft !== undefined) queryData.is_draft = updateData.is_draft;

    logger.debug(`Calling redashClient.updateQuery with data: ${JSON.stringify(queryData)}`);
    const result = await redashClient.updateQuery(queryId, queryData);
    logger.debug(`Update query result: ${JSON.stringify(result)}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error updating query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error updating query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: archive_query
const archiveQuerySchema = z.object({
  queryId: z.coerce.number()
});

async function archiveQuery(params: z.infer<typeof archiveQuerySchema>) {
  try {
    const { queryId } = params;
    const result = await redashClient.archiveQuery(queryId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error archiving query ${params.queryId}: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error archiving query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: list_data_sources
async function listDataSources() {
  try {
    const dataSources = await redashClient.getDataSources();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dataSources, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error listing data sources: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error listing data sources: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: list_queries
const listQueriesSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25),
  q: z.string().optional()
});

async function listQueries(params: z.infer<typeof listQueriesSchema>) {
  try {
    const { page, pageSize, q } = params;
    const queries = await redashClient.getQueries(page, pageSize, q);

    logger.debug(`Listed ${queries.results.length} queries`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(queries, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error listing queries: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error listing queries: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: execute_query
const executeQuerySchema = z.object({
  queryId: z.coerce.number(),
  parameters: z.record(z.any()).optional()
});

async function executeQuery(params: z.infer<typeof executeQuerySchema>) {
  try {
    const { queryId, parameters } = params;
    const result = await redashClient.executeQuery(queryId, parameters);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error executing query ${params.queryId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: get_query_results_csv
const getQueryResultsCsvSchema = z.object({
  queryId: z.coerce.number(),
  refresh: z.boolean().optional().default(false)
});

async function getQueryResultsCsv(params: z.infer<typeof getQueryResultsCsvSchema>) {
  try {
    const { queryId, refresh } = params;
    const csv = await redashClient.getQueryResultsAsCsv(queryId, refresh);

    return {
      content: [
        {
          type: "text",
          text: csv
        }
      ]
    };
  } catch (error) {
    logger.error(`Error getting CSV results for query ${params.queryId}: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting CSV results for query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: list_dashboards
const listDashboardsSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
});

async function listDashboards(params: z.infer<typeof listDashboardsSchema>) {
  try {
    const { page, pageSize } = params;
    const dashboards = await redashClient.getDashboards(page, pageSize);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dashboards, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Error listing dashboards:', error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error listing dashboards: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: get_dashboard
const getDashboardSchema = z.object({
  dashboardId: z.coerce.number()
});

async function getDashboard(params: z.infer<typeof getDashboardSchema>) {
  try {
    const { dashboardId } = params;
    const dashboard = await redashClient.getDashboard(dashboardId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dashboard, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting dashboard ${params.dashboardId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: get_visualization
const getVisualizationSchema = z.object({
  visualizationId: z.coerce.number()
});

async function getVisualization(params: z.infer<typeof getVisualizationSchema>) {
  try {
    const { visualizationId } = params;
    const visualization = await redashClient.getVisualization(visualizationId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(visualization, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting visualization ${params.visualizationId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting visualization ${params.visualizationId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: execute_adhoc_query
const executeAdhocQuerySchema = z.object({
  query: z.string(),
  dataSourceId: z.coerce.number()
});

async function executeAdhocQuery(params: z.infer<typeof executeAdhocQuerySchema>) {
  try {
    const { query, dataSourceId } = params;
    const result = await redashClient.executeAdhocQuery(query, dataSourceId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error executing adhoc query: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing adhoc query: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: create_visualization
const createVisualizationSchema = z.object({
  query_id: z.coerce.number(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  options: z.any()
});

async function createVisualization(params: z.infer<typeof createVisualizationSchema>) {
  try {
    const visualizationData: CreateVisualizationRequest = {
      query_id: params.query_id,
      type: params.type,
      name: params.name,
      description: params.description,
      options: params.options
    };

    const result = await redashClient.createVisualization(visualizationData);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Error creating visualization:', error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error creating visualization: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: update_visualization
const updateVisualizationSchema = z.object({
  visualizationId: z.coerce.number(),
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.any().optional()
});

async function updateVisualization(params: z.infer<typeof updateVisualizationSchema>) {
  try {
    const { visualizationId, ...updateData } = params;
    const result = await redashClient.updateVisualization(visualizationId, updateData);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error updating visualization ${params.visualizationId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error updating visualization ${params.visualizationId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: delete_visualization
const deleteVisualizationSchema = z.object({
  visualizationId: z.coerce.number()
});

async function deleteVisualization(params: z.infer<typeof deleteVisualizationSchema>) {
  try {
    const { visualizationId } = params;
    await redashClient.deleteVisualization(visualizationId);

    return {
      content: [
        {
          type: "text",
          text: `Visualization ${visualizationId} deleted successfully`
        }
      ]
    };
  } catch (error) {
    console.error(`Error deleting visualization ${params.visualizationId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error deleting visualization ${params.visualizationId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: get_schema
const getSchemaSchema = z.object({
  dataSourceId: z.coerce.number(),
});

async function getSchema(params: z.infer<typeof getSchemaSchema>) {
  try {
    const { dataSourceId } = params;
    const query = await redashClient.getSchema(dataSourceId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(query, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error(
      `Error getting data source ${params.dataSourceId} schema: ${error}`
    );
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting data source ${params.dataSourceId} schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// ----- Dashboard Tools -----

// Tool: create_dashboard
const createDashboardSchema = z.object({
  name: z.string(),
  tags: z.array(z.string()).optional()
});

async function createDashboard(params: z.infer<typeof createDashboardSchema>) {
  try {
    const dashboardData: CreateDashboardRequest = {
      name: params.name,
      tags: params.tags || []
    };
    const result = await redashClient.createDashboard(dashboardData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error creating dashboard: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error creating dashboard: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: update_dashboard
const updateDashboardSchema = z.object({
  dashboardId: z.coerce.number(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_archived: z.boolean().optional(),
  is_draft: z.boolean().optional(),
  dashboard_filters_enabled: z.boolean().optional()
});

async function updateDashboard(params: z.infer<typeof updateDashboardSchema>) {
  try {
    const { dashboardId, ...updateData } = params;
    const dashboardData: UpdateDashboardRequest = {};
    if (updateData.name !== undefined) dashboardData.name = updateData.name;
    if (updateData.tags !== undefined) dashboardData.tags = updateData.tags;
    if (updateData.is_archived !== undefined) dashboardData.is_archived = updateData.is_archived;
    if (updateData.is_draft !== undefined) dashboardData.is_draft = updateData.is_draft;
    if (updateData.dashboard_filters_enabled !== undefined) dashboardData.dashboard_filters_enabled = updateData.dashboard_filters_enabled;

    const result = await redashClient.updateDashboard(dashboardId, dashboardData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error updating dashboard ${params.dashboardId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error updating dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: archive_dashboard
const archiveDashboardSchema = z.object({
  dashboardId: z.coerce.number()
});

async function archiveDashboard(params: z.infer<typeof archiveDashboardSchema>) {
  try {
    const result = await redashClient.archiveDashboard(params.dashboardId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error archiving dashboard ${params.dashboardId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error archiving dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: fork_dashboard
const forkDashboardSchema = z.object({
  dashboardId: z.coerce.number()
});

async function forkDashboard(params: z.infer<typeof forkDashboardSchema>) {
  try {
    const result = await redashClient.forkDashboard(params.dashboardId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error forking dashboard ${params.dashboardId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error forking dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_public_dashboard
const getPublicDashboardSchema = z.object({
  token: z.string()
});

async function getPublicDashboard(params: z.infer<typeof getPublicDashboardSchema>) {
  try {
    const result = await redashClient.getPublicDashboard(params.token);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching public dashboard: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching public dashboard: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: share_dashboard
const shareDashboardSchema = z.object({
  dashboardId: z.coerce.number()
});

async function shareDashboard(params: z.infer<typeof shareDashboardSchema>) {
  try {
    const result = await redashClient.shareDashboard(params.dashboardId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error sharing dashboard ${params.dashboardId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error sharing dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: unshare_dashboard
const unshareDashboardSchema = z.object({
  dashboardId: z.coerce.number()
});

async function unshareDashboard(params: z.infer<typeof unshareDashboardSchema>) {
  try {
    const result = await redashClient.unshareDashboard(params.dashboardId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error unsharing dashboard ${params.dashboardId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error unsharing dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_my_dashboards
const getMyDashboardsSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
});

async function getMyDashboards(params: z.infer<typeof getMyDashboardsSchema>) {
  try {
    const result = await redashClient.getMyDashboards(params.page, params.pageSize);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching my dashboards: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching my dashboards: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_favorite_dashboards
const getFavoriteDashboardsSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
});

async function getFavoriteDashboards(params: z.infer<typeof getFavoriteDashboardsSchema>) {
  try {
    const result = await redashClient.getFavoriteDashboards(params.page, params.pageSize);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching favorite dashboards: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching favorite dashboards: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: add_dashboard_favorite
const addDashboardFavoriteSchema = z.object({
  dashboardId: z.coerce.number()
});

async function addDashboardFavorite(params: z.infer<typeof addDashboardFavoriteSchema>) {
  try {
    const result = await redashClient.addDashboardFavorite(params.dashboardId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error adding dashboard ${params.dashboardId} to favorites: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error adding dashboard ${params.dashboardId} to favorites: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: remove_dashboard_favorite
const removeDashboardFavoriteSchema = z.object({
  dashboardId: z.coerce.number()
});

async function removeDashboardFavorite(params: z.infer<typeof removeDashboardFavoriteSchema>) {
  try {
    const result = await redashClient.removeDashboardFavorite(params.dashboardId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error removing dashboard ${params.dashboardId} from favorites: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error removing dashboard ${params.dashboardId} from favorites: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_dashboard_tags
async function getDashboardTags() {
  try {
    const result = await redashClient.getDashboardTags();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching dashboard tags: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching dashboard tags: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// ----- Alert Tools -----

// Tool: list_alerts
async function listAlerts() {
  try {
    const result = await redashClient.getAlerts();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error listing alerts: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error listing alerts: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_alert
const getAlertSchema = z.object({
  alertId: z.coerce.number()
});

async function getAlert(params: z.infer<typeof getAlertSchema>) {
  try {
    const result = await redashClient.getAlert(params.alertId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error getting alert ${params.alertId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error getting alert ${params.alertId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: create_alert
const createAlertSchema = z.object({
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
});

async function createAlert(params: z.infer<typeof createAlertSchema>) {
  try {
    const alertData: CreateAlertRequest = {
      name: params.name,
      query_id: params.query_id,
      options: params.options,
      rearm: params.rearm
    };
    const result = await redashClient.createAlert(alertData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error creating alert: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error creating alert: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: update_alert
const updateAlertSchema = z.object({
  alertId: z.coerce.number(),
  name: z.string().optional(),
  query_id: z.coerce.number().optional(),
  options: z.object({
    column: z.string().optional(),
    op: z.string().optional(),
    value: z.union([z.coerce.number(), z.string()]).optional(),
    custom_subject: z.string().optional(),
    custom_body: z.string().optional()
  }).optional(),
  rearm: z.coerce.number().nullable().optional()
});

async function updateAlert(params: z.infer<typeof updateAlertSchema>) {
  try {
    const { alertId, ...updateData } = params;
    const alertData: UpdateAlertRequest = {};
    if (updateData.name !== undefined) alertData.name = updateData.name;
    if (updateData.query_id !== undefined) alertData.query_id = updateData.query_id;
    if (updateData.options !== undefined) alertData.options = updateData.options;
    if (updateData.rearm !== undefined) alertData.rearm = updateData.rearm;

    const result = await redashClient.updateAlert(alertId, alertData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error updating alert ${params.alertId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error updating alert ${params.alertId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: delete_alert
const deleteAlertSchema = z.object({
  alertId: z.coerce.number()
});

async function deleteAlert(params: z.infer<typeof deleteAlertSchema>) {
  try {
    const result = await redashClient.deleteAlert(params.alertId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error deleting alert ${params.alertId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error deleting alert ${params.alertId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: mute_alert
const muteAlertSchema = z.object({
  alertId: z.coerce.number()
});

async function muteAlert(params: z.infer<typeof muteAlertSchema>) {
  try {
    const result = await redashClient.muteAlert(params.alertId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error muting alert ${params.alertId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error muting alert ${params.alertId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_alert_subscriptions
const getAlertSubscriptionsSchema = z.object({
  alertId: z.coerce.number()
});

async function getAlertSubscriptions(params: z.infer<typeof getAlertSubscriptionsSchema>) {
  try {
    const result = await redashClient.getAlertSubscriptions(params.alertId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error getting alert ${params.alertId} subscriptions: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error getting alert ${params.alertId} subscriptions: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: add_alert_subscription
const addAlertSubscriptionSchema = z.object({
  alertId: z.coerce.number(),
  destination_id: z.coerce.number().optional()
});

async function addAlertSubscription(params: z.infer<typeof addAlertSubscriptionSchema>) {
  try {
    const subscriptionData: CreateAlertSubscriptionRequest = {};
    if (params.destination_id !== undefined) subscriptionData.destination_id = params.destination_id;

    const result = await redashClient.addAlertSubscription(params.alertId, subscriptionData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error adding subscription to alert ${params.alertId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error adding subscription to alert ${params.alertId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: remove_alert_subscription
const removeAlertSubscriptionSchema = z.object({
  alertId: z.coerce.number(),
  subscriptionId: z.coerce.number()
});

async function removeAlertSubscription(params: z.infer<typeof removeAlertSubscriptionSchema>) {
  try {
    const result = await redashClient.removeAlertSubscription(params.alertId, params.subscriptionId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error removing subscription ${params.subscriptionId} from alert ${params.alertId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error removing subscription ${params.subscriptionId} from alert ${params.alertId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// ----- Additional Query Tools -----

// Tool: fork_query
const forkQuerySchema = z.object({
  queryId: z.coerce.number()
});

async function forkQuery(params: z.infer<typeof forkQuerySchema>) {
  try {
    const result = await redashClient.forkQuery(params.queryId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error forking query ${params.queryId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error forking query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_my_queries
const getMyQueriesSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
});

async function getMyQueries(params: z.infer<typeof getMyQueriesSchema>) {
  try {
    const result = await redashClient.getMyQueries(params.page, params.pageSize);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching my queries: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching my queries: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_recent_queries
const getRecentQueriesSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
});

async function getRecentQueries(params: z.infer<typeof getRecentQueriesSchema>) {
  try {
    const result = await redashClient.getRecentQueries(params.page, params.pageSize);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching recent queries: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching recent queries: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_query_tags
async function getQueryTags() {
  try {
    const result = await redashClient.getQueryTags();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching query tags: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching query tags: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_favorite_queries
const getFavoriteQueriesSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25)
});

async function getFavoriteQueries(params: z.infer<typeof getFavoriteQueriesSchema>) {
  try {
    const result = await redashClient.getFavoriteQueries(params.page, params.pageSize);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error fetching favorite queries: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error fetching favorite queries: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: add_query_favorite
const addQueryFavoriteSchema = z.object({
  queryId: z.coerce.number()
});

async function addQueryFavorite(params: z.infer<typeof addQueryFavoriteSchema>) {
  try {
    const result = await redashClient.addQueryFavorite(params.queryId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error adding query ${params.queryId} to favorites: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error adding query ${params.queryId} to favorites: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: remove_query_favorite
const removeQueryFavoriteSchema = z.object({
  queryId: z.coerce.number()
});

async function removeQueryFavorite(params: z.infer<typeof removeQueryFavoriteSchema>) {
  try {
    const result = await redashClient.removeQueryFavorite(params.queryId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error removing query ${params.queryId} from favorites: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error removing query ${params.queryId} from favorites: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// ----- Widget Tools -----

// Tool: list_widgets
async function listWidgets() {
  try {
    const result = await redashClient.getWidgets();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error listing widgets: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error listing widgets: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_widget
const getWidgetSchema = z.object({
  widgetId: z.coerce.number()
});

async function getWidget(params: z.infer<typeof getWidgetSchema>) {
  try {
    const result = await redashClient.getWidget(params.widgetId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error getting widget ${params.widgetId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error getting widget ${params.widgetId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: create_widget
const createWidgetSchema = z.object({
  dashboard_id: z.coerce.number(),
  visualization_id: z.coerce.number().optional(),
  text: z.string().optional(),
  width: z.coerce.number(),
  options: z.any().optional()
});

async function createWidget(params: z.infer<typeof createWidgetSchema>) {
  try {
    const widgetData: CreateWidgetRequest = {
      dashboard_id: params.dashboard_id,
      visualization_id: params.visualization_id,
      text: params.text,
      width: params.width,
      options: params.options || {}
    };
    const result = await redashClient.createWidget(widgetData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error creating widget: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error creating widget: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: update_widget
const updateWidgetSchema = z.object({
  widgetId: z.coerce.number(),
  visualization_id: z.coerce.number().optional(),
  text: z.string().optional(),
  width: z.coerce.number().optional(),
  options: z.any().optional()
});

async function updateWidget(params: z.infer<typeof updateWidgetSchema>) {
  try {
    const { widgetId, ...updateData } = params;
    const widgetData: UpdateWidgetRequest = {};
    if (updateData.visualization_id !== undefined) widgetData.visualization_id = updateData.visualization_id;
    if (updateData.text !== undefined) widgetData.text = updateData.text;
    if (updateData.width !== undefined) widgetData.width = updateData.width;
    if (updateData.options !== undefined) widgetData.options = updateData.options;

    const result = await redashClient.updateWidget(widgetId, widgetData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error updating widget ${params.widgetId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error updating widget ${params.widgetId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: delete_widget
const deleteWidgetSchema = z.object({
  widgetId: z.coerce.number()
});

async function deleteWidget(params: z.infer<typeof deleteWidgetSchema>) {
  try {
    const result = await redashClient.deleteWidget(params.widgetId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error deleting widget ${params.widgetId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error deleting widget ${params.widgetId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// ----- Query Snippet Tools -----

// Tool: list_query_snippets
async function listQuerySnippets() {
  try {
    const result = await redashClient.getQuerySnippets();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error listing query snippets: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error listing query snippets: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: get_query_snippet
const getQuerySnippetSchema = z.object({
  snippetId: z.coerce.number()
});

async function getQuerySnippet(params: z.infer<typeof getQuerySnippetSchema>) {
  try {
    const result = await redashClient.getQuerySnippet(params.snippetId);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error getting query snippet ${params.snippetId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error getting query snippet ${params.snippetId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: create_query_snippet
const createQuerySnippetSchema = z.object({
  trigger: z.string(),
  description: z.string().optional(),
  snippet: z.string()
});

async function createQuerySnippet(params: z.infer<typeof createQuerySnippetSchema>) {
  try {
    const snippetData: CreateQuerySnippetRequest = {
      trigger: params.trigger,
      description: params.description,
      snippet: params.snippet
    };
    const result = await redashClient.createQuerySnippet(snippetData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error creating query snippet: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error creating query snippet: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: update_query_snippet
const updateQuerySnippetSchema = z.object({
  snippetId: z.coerce.number(),
  trigger: z.string().optional(),
  description: z.string().optional(),
  snippet: z.string().optional()
});

async function updateQuerySnippet(params: z.infer<typeof updateQuerySnippetSchema>) {
  try {
    const { snippetId, ...updateData } = params;
    const snippetData: UpdateQuerySnippetRequest = {};
    if (updateData.trigger !== undefined) snippetData.trigger = updateData.trigger;
    if (updateData.description !== undefined) snippetData.description = updateData.description;
    if (updateData.snippet !== undefined) snippetData.snippet = updateData.snippet;

    const result = await redashClient.updateQuerySnippet(snippetId, snippetData);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error updating query snippet ${params.snippetId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error updating query snippet ${params.snippetId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// Tool: delete_query_snippet
const deleteQuerySnippetSchema = z.object({
  snippetId: z.coerce.number()
});

async function deleteQuerySnippet(params: z.infer<typeof deleteQuerySnippetSchema>) {
  try {
    await redashClient.deleteQuerySnippet(params.snippetId);
    return {
      content: [{ type: "text", text: `Query snippet ${params.snippetId} deleted successfully` }]
    };
  } catch (error) {
    logger.error(`Error deleting query snippet ${params.snippetId}: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error deleting query snippet ${params.snippetId}: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// ----- Destination Tools -----

// Tool: list_destinations
async function listDestinations() {
  try {
    const result = await redashClient.getDestinations();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error listing alert destinations: ${error}`);
    return {
      isError: true,
      content: [{ type: "text", text: `Error listing alert destinations: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

// ----- Server Request Handlers -----

/**
 * Handle listing available tools.
 * All defined tools must be registered here.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: "get_query", description: "Get a specific query by ID", inputSchema: { type: "object", properties: { queryId: { type: "number" } }, required: ["queryId"] } },
      { name: "create_query", description: "Create a new query", inputSchema: { type: "object", properties: { name: { type: "string" }, data_source_id: { type: "number" }, query: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["name", "data_source_id", "query"] } },
      { name: "update_query", description: "Update an existing query", inputSchema: { type: "object", properties: { queryId: { type: "number" }, name: { type: "string" }, data_source_id: { type: "number" }, query: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" } }, is_archived: { type: "boolean" }, is_draft: { type: "boolean" } }, required: ["queryId"] } },
      { name: "archive_query", description: "Archive a query by ID", inputSchema: { type: "object", properties: { queryId: { type: "number" } }, required: ["queryId"] } },
      { name: "list_data_sources", description: "List all data sources", inputSchema: { type: "object", properties: {} } },
      { name: "list_queries", description: "List all queries (with pagination and search)", inputSchema: { type: "object", properties: { page: { type: "number" }, pageSize: { type: "number" }, q: { type: "string" } } } },
      { name: "execute_query", description: "Execute a query with parameters", inputSchema: { type: "object", properties: { queryId: { type: "number" }, parameters: { type: "object" } }, required: ["queryId"] } },
      { name: "get_query_results_csv", description: "Get query results as CSV string", inputSchema: { type: "object", properties: { queryId: { type: "number" }, refresh: { type: "boolean" } }, required: ["queryId"] } },
      { name: "list_dashboards", description: "List all dashboards", inputSchema: { type: "object", properties: { page: { type: "number" }, pageSize: { type: "number" } } } },
      { name: "get_dashboard", description: "Get a specific dashboard by ID", inputSchema: { type: "object", properties: { dashboardId: { type: "number" } }, required: ["dashboardId"] } },
      { name: "get_visualization", description: "Get a specific visualization by ID", inputSchema: { type: "object", properties: { visualizationId: { type: "number" } }, required: ["visualizationId"] } },
      { name: "execute_adhoc_query", description: "Execute an ad-hoc query string", inputSchema: { type: "object", properties: { query: { type: "string" }, dataSourceId: { type: "number" } }, required: ["query", "dataSourceId"] } },
      { name: "create_visualization", description: "Create a new visualization for a query", inputSchema: { type: "object", properties: { query_id: { type: "number" }, type: { type: "string" }, name: { type: "string" }, description: { type: "string" }, options: { type: "object" } }, required: ["query_id", "type", "name"] } },
      { name: "update_visualization", description: "Update an existing visualization", inputSchema: { type: "object", properties: { visualizationId: { type: "number" }, type: { type: "string" }, name: { type: "string" }, description: { type: "string" }, options: { type: "object" } }, required: ["visualizationId"] } },
      { name: "delete_visualization", description: "Delete a visualization by ID", inputSchema: { type: "object", properties: { visualizationId: { type: "number" } }, required: ["visualizationId"] } },
      { name: "get_schema", description: "Get the schema for a specific data source", inputSchema: { type: "object", properties: { dataSourceId: { type: "number" } }, required: ["dataSourceId"] } },
      { name: "create_dashboard", description: "Create a new dashboard", inputSchema: { type: "object", properties: { name: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["name"] } },
      { name: "update_dashboard", description: "Update an existing dashboard", inputSchema: { type: "object", properties: { dashboardId: { type: "number" }, name: { type: "string" }, tags: { type: "array", items: { type: "string" } }, is_archived: { type: "boolean" }, is_draft: { type: "boolean" }, dashboard_filters_enabled: { type: "boolean" } }, required: ["dashboardId"] } },
      { name: "archive_dashboard", description: "Archive a dashboard", inputSchema: { type: "object", properties: { dashboardId: { type: "number" } }, required: ["dashboardId"] } },
      { name: "fork_dashboard", description: "Fork an existing dashboard", inputSchema: { type: "object", properties: { dashboardId: { type: "number" } }, required: ["dashboardId"] } },
      { name: "share_dashboard", description: "Share a dashboard publicly", inputSchema: { type: "object", properties: { dashboardId: { type: "number" } }, required: ["dashboardId"] } },
      { name: "unshare_dashboard", description: "Remove public sharing from a dashboard", inputSchema: { type: "object", properties: { dashboardId: { type: "number" } }, required: ["dashboardId"] } },
      { name: "list_alerts", description: "List all alerts", inputSchema: { type: "object", properties: {} } },
      { name: "get_alert", description: "Get a specific alert by ID", inputSchema: { type: "object", properties: { alertId: { type: "number" } }, required: ["alertId"] } },
      { name: "create_alert", description: "Create a new alert", inputSchema: { type: "object", properties: { name: { type: "string" }, query_id: { type: "number" }, options: { type: "object" }, rearm: { type: "number" } }, required: ["name", "query_id", "options"] } },
      { name: "update_alert", description: "Update an existing alert", inputSchema: { type: "object", properties: { alertId: { type: "number" }, name: { type: "string" }, options: { type: "object" }, rearm: { type: "number" } }, required: ["alertId"] } },
      { name: "delete_alert", description: "Delete an alert by ID", inputSchema: { type: "object", properties: { alertId: { type: "number" } }, required: ["alertId"] } },
      { name: "mute_alert", description: "Mute/unmute an alert", inputSchema: { type: "object", properties: { alertId: { type: "number" } }, required: ["alertId"] } },
      { name: "list_widgets", description: "List all widgets", inputSchema: { type: "object", properties: {} } },
      { name: "create_widget", description: "Add a widget to a dashboard", inputSchema: { type: "object", properties: { dashboard_id: { type: "number" }, visualization_id: { type: "number" }, text: { type: "string" }, width: { type: "number" }, options: { type: "object" } }, required: ["dashboard_id", "width"] } },
      { name: "delete_widget", description: "Remove a widget from a dashboard", inputSchema: { type: "object", properties: { widgetId: { type: "number" } }, required: ["widgetId"] } },
      { name: "list_query_snippets", description: "List all query snippets", inputSchema: { type: "object", properties: {} } },
      { name: "create_query_snippet", description: "Create a new query snippet", inputSchema: { type: "object", properties: { trigger: { type: "string" }, description: { type: "string" }, snippet: { type: "string" } }, required: ["trigger", "snippet"] } },
      { name: "list_destinations", description: "List all alert destinations", inputSchema: { type: "object", properties: {} } }
    ]
  };
});

/**
 * Handle tool calls from the MCP client.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Query tools
      case "get_query":
        return await getQuery(getQuerySchema.parse(args));
      case "create_query":
        return await createQuery(createQuerySchema.parse(args));
      case "update_query":
        return await updateQuery(updateQuerySchema.parse(args));
      case "archive_query":
        return await archiveQuery(archiveQuerySchema.parse(args));
      case "list_queries":
        return await listQueries(listQueriesSchema.parse(args));
      case "execute_query":
        return await executeQuery(executeQuerySchema.parse(args));
      case "execute_adhoc_query":
        return await executeAdhocQuery(executeAdhocQuerySchema.parse(args));
      case "get_query_results_csv":
        return await getQueryResultsCsv(getQueryResultsCsvSchema.parse(args));
      case "list_data_sources":
        return await listDataSources();
      case "get_schema":
        return await getSchema(getSchemaSchema.parse(args));

      // Visualization tools
      case "get_visualization":
        return await getVisualization(getVisualizationSchema.parse(args));
      case "create_visualization":
        return await createVisualization(createVisualizationSchema.parse(args));
      case "update_visualization":
        return await updateVisualization(updateVisualizationSchema.parse(args));
      case "delete_visualization":
        return await deleteVisualization(deleteVisualizationSchema.parse(args));

      // Dashboard tools
      case "list_dashboards":
        return await listDashboards(listDashboardsSchema.parse(args));
      case "get_dashboard":
        return await getDashboard(getDashboardSchema.parse(args));
      case "create_dashboard":
        return await createDashboard(createDashboardSchema.parse(args));
      case "update_dashboard":
        return await updateDashboard(updateDashboardSchema.parse(args));
      case "archive_dashboard":
        return await archiveDashboard(archiveDashboardSchema.parse(args));
      case "fork_dashboard":
        return await forkDashboard(forkDashboardSchema.parse(args));
      case "share_dashboard":
        return await shareDashboard(shareDashboardSchema.parse(args));
      case "unshare_dashboard":
        return await unshareDashboard(unshareDashboardSchema.parse(args));

      // Alert tools
      case "list_alerts":
        return await listAlerts();
      case "get_alert":
        return await getAlert(getAlertSchema.parse(args));
      case "create_alert":
        return await createAlert(createAlertSchema.parse(args));
      case "update_alert":
        return await updateAlert(updateAlertSchema.parse(args));
      case "delete_alert":
        return await deleteAlert(deleteAlertSchema.parse(args));
      case "mute_alert":
        return await muteAlert(muteAlertSchema.parse(args));

      // Widget tools
      case "list_widgets":
        return await listWidgets();
      case "create_widget":
        return await createWidget(createWidgetSchema.parse(args));
      case "delete_widget":
        return await deleteWidget(deleteWidgetSchema.parse(args));

      // Query Snippet tools
      case "list_query_snippets":
        return await listQuerySnippets();
      case "create_query_snippet":
        return await createQuerySnippet(createQuerySnippetSchema.parse(args));
      case "update_query_snippet":
        return await updateQuerySnippet(updateQuerySnippetSchema.parse(args));
      case "delete_query_snippet":
        return await deleteQuerySnippet(deleteQuerySnippetSchema.parse(args));

      // Destination tools
      case "list_destinations":
        return await listDestinations();

      default:
        logger.error(`Unknown tool requested: ${name}`);
        return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return { isError: true, content: [{ type: "text", text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}` }] };
  }
});

// Start the server with stdio transport
async function main() {
  try {
    const transport = new StdioServerTransport();
    logger.info("Starting Redash MCP server...");
    await server.connect(transport);
    logger.info("Redash MCP server connected!");
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error(`Unhandled error in main: ${error}`);
  process.exit(1);
});
