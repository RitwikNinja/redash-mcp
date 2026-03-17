import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

// --- REDASH CONFIGURATION ---
const REDASH_URL = process.env.REDASH_URL || "https://analytics-new-k8s.ninjacart.in";
const REDASH_API_KEY = process.env.REDASH_API_KEY;

if (!REDASH_API_KEY) {
  console.error("REDASH_API_KEY environment variable is required");
  process.exit(1);
}

// --- MCP SERVER SETUP ---
const server = new McpServer({
  name: "redash-mcp-server",
  version: "1.0.0",
});

/**
 * Helper to fetch data from Redash
 */
async function fetchRedash(endpoint: string) {
  const response = await fetch(`${REDASH_URL}${endpoint}`, {
    headers: {
      Authorization: `Key ${REDASH_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Redash API error: ${response.statusText}`);
  }

  return response.json();
}

// --- TOOLS REGISTRATION ---

// Tool: List Dashboards
server.tool("list_dashboards", {}, async () => {
  const data = await fetchRedash("/api/dashboards");
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
});

// Tool: Get Specific Query Results
server.tool(
  "get_query_results",
  { query_id: z.number() },
  async ({ query_id }) => {
    const data = await fetchRedash(`/api/queries/${query_id}/results`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// --- EXPRESS SERVER & SSE TRANSPORT ---

const app = express();
let transport: SSEServerTransport | null = null;

// The GET endpoint Claude connects to via EventSource
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");
  // This transport handles the persistent connection
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

// The POST endpoint where the client sends tool requests
app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE session. Connect to /sse first.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🚀 Redash MCP Server is live!
----------------------------------
SSE Endpoint:  http://localhost:${PORT}/sse
Redash URL:    ${REDASH_URL}
  `);
});