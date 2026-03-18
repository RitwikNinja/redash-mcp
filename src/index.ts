import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

// ✅ EXPRESS FIRST — NO MCP YET
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ✅ Health check (Render needs this)
app.get("/", (req: Request, res: Response) => {
  res.send("OK");
});

// ✅ Keep Node alive
setInterval(() => {}, 60000);

// ---------------- MCP LAZY INIT ----------------

// ⚠️ Create server ONLY when needed
const createMcpServer = () => {
  const server = new McpServer({
    name: "redash-mcp",
    version: "1.2.0",
  });

  // 👉 Add ONE test tool (to confirm working)
  server.tool(
    "ping",
    {},
    async () => ({
      content: [{ type: "text", text: "pong" }]
    })
  );

  return server;
};

const activeTransports = new Set<SSEServerTransport>();

app.get("/sse", async (req: Request, res: Response) => {
  console.log("SSE connected");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const transport = new SSEServerTransport("/messages", res);
  activeTransports.add(transport);

  const server = createMcpServer();

  // ❗ DO NOT await
  server.connect(transport).catch(console.error);

  req.on("close", () => {
    console.log("SSE closed");
    activeTransports.delete(transport);
  });
});

app.post("/messages", async (req: Request, res: Response) => {
  if (activeTransports.size === 0) {
    return res.status(400).send("No SSE connection");
  }

  const transport = Array.from(activeTransports).pop()!;
  await transport.handlePostMessage(req, res);
});
