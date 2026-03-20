import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import * as dotenv from "dotenv";
import { logger } from "./logger.js";
import { registerRedashTools } from "./registerTools.js";
import { randomUUID } from "node:crypto";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

dotenv.config();

if (!process.env.REDASH_API_KEY) {
  console.error("REDASH_API_KEY environment variable is required");
  process.exit(1);
}

function createRedashMcpServer(): McpServer {
  const server = new McpServer({
    name: "redash-mcp",
    version: "1.2.0",
  });
  registerRedashTools(server);
  return server;
}

// --- EXPRESS SERVER ---
// Cursor supports remote MCP over Streamable HTTP. We expose `/mcp` for that.
// We keep legacy SSE endpoints (`/sse` + `/messages`) for compatibility.

const app = express();
app.use(express.json());

// One MCP server instance per session (SDK allows only one transport per Server/Protocol).
type McpTransportSession = {
  transport: StreamableHTTPServerTransport | SSEServerTransport;
  mcpServer: McpServer;
};
const sessions: Record<string, McpTransportSession> = Object.create(null);

// Streamable HTTP: single endpoint that supports GET/POST/DELETE.
app.all("/mcp", async (req: any, res: any) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId) {
      const existing = sessions[sessionId];
      if (existing?.transport instanceof StreamableHTTPServerTransport) {
        transport = existing.transport;
      } else if (existing) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: Session exists but uses a different transport protocol",
          },
          id: null,
        });
        return;
      }
    } else if (req.method === "POST" && isInitializeRequest(req.body)) {
      const mcpServer = createRedashMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions[sid] = { transport: transport!, mcpServer };
        },
      });

      transport.onclose = () => {
        const sid = transport?.sessionId;
        if (sid) delete sessions[sid];
        void mcpServer.close();
      };

      await mcpServer.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    if (!transport) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error: any) {
    logger.error(`Error handling /mcp request: ${error?.message ?? String(error)}`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Deprecated SSE: allow multiple sessions (one per /sse connection).
app.get("/sse", async (req: Request, res: Response) => {
  const mcpServer = createRedashMcpServer();
  const transport = new SSEServerTransport("/messages", res);
  sessions[transport.sessionId] = { transport, mcpServer };
  res.on("close", () => {
    delete sessions[transport.sessionId];
    void mcpServer.close();
  });
  await mcpServer.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string | undefined) ?? "";
  const existing = sessions[sessionId]?.transport;
  if (existing instanceof SSEServerTransport) {
    await existing.handlePostMessage(req, res, req.body);
    return;
  }
  res.status(400).send("No transport found for sessionId");
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Redash MCP Server listening on :${PORT} (Streamable HTTP: /mcp)`);
});

app.get("/", (req: Request, res: Response) => {
  res.send("Redash MCP Server is online.");
});
