import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { version } from "../version.ts";

/**
 * Wraps a single string as an MCP tool text result. Kept tiny and reused by
 * every tool handler so the shape stays consistent as more tools are added
 * (see `.agents/specifications/languages/cli/mcp-server.spec.md`).
 */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * Plain, testable handler for the `uffda_version` tool. Deliberately has no
 * dependency on the MCP SDK's callback shape (`extra`, transports, etc.) so it
 * can be unit tested directly; `createUffdaMcpServer` adapts it to the SDK's
 * `ToolCallback` signature at registration time.
 */
export function versionToolHandler(): CallToolResult {
  return textResult(version);
}

/**
 * Builds the uffda MCP server and registers its tools. Kept separate from
 * `runMcpServer` so tests can drive it over an in-memory transport instead of
 * real stdio (see `mcp.test.ts`).
 */
export function createUffdaMcpServer(): McpServer {
  const server = new McpServer({ name: "uffda", version });

  server.registerTool(
    "uffda_version",
    {
      title: "uffda version",
      description:
        "Returns the installed uffda CLI/library version. Useful as a " +
        "trivial connectivity check for the MCP server.",
    },
    () => versionToolHandler(),
  );

  return server;
}

/**
 * Connects the uffda MCP server to the standard MCP stdio transport and runs
 * until that transport closes. Per
 * `.agents/specifications/languages/cli/mcp-server.spec.md#transport-contract`,
 * standard input/output MUST carry only MCP protocol traffic once this is
 * running, so no other CLI output must ever be written after this is called.
 *
 * `server.connect()` only resolves once the transport has started (i.e. it
 * is ready to accept messages) — it does NOT wait for the session to end.
 * The returned promise therefore only resolves once the transport actually
 * closes (stdin reaches EOF, or the client disconnects), so callers can
 * safely exit the process once this promise settles.
 */
export async function runMcpServer(): Promise<void> {
  const server = createUffdaMcpServer();
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    transport.onclose = resolve;
  });
  // `StdioServerTransport` itself never observes stdin EOF (it only listens
  // for "data"/"error"), so without this a client that closes its end of the
  // pipe (rather than killing the process) would leave this promise pending
  // forever. Closing the transport ourselves on "end" makes shutdown match
  // ordinary stdio-process expectations either way.
  process.stdin.on("end", () => {
    transport.close().catch(() => {});
  });
  await server.connect(transport);
  await closed;
}
