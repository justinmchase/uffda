import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { version } from "../version.ts";
import {
  compileToolHandler,
  type CompileToolInput,
  compileToolInputShape,
  compileToolResult,
  highlightToolHandler,
  type HighlightToolInput,
  highlightToolInputShape,
  highlightToolResult,
  matchToolHandler,
  type MatchToolInput,
  matchToolInputShape,
  matchToolResult,
  parseToolHandler,
  type ParseToolInput,
  parseToolInputShape,
  parseToolResult,
} from "./mcp.static_tools.ts";
import { registerSessionTools } from "./mcp.session_tools.ts";
import { registerDisplayTools } from "./mcp.display_tools.ts";
import { SessionManager } from "./mcp.sessions.ts";

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

  server.registerTool(
    "uffda_compile",
    {
      title: "uffda compile",
      description:
        "Compiles one or more Uffda source files/globs to Uffda syntax AST " +
        "artifacts on disk, equivalent to `uffda compile`. Stateless: does " +
        "not require or affect any session.",
      inputSchema: compileToolInputShape,
    },
    async (input: CompileToolInput) =>
      compileToolResult(await compileToolHandler(input)),
  );

  server.registerTool(
    "uffda_parse",
    {
      title: "uffda parse",
      description:
        "Parses Uffda (or a sub-language's) source text to a raw AST, " +
        "equivalent to `uffda parse`. Stateless: does not require or " +
        "affect any session.",
      inputSchema: parseToolInputShape,
    },
    async (input: ParseToolInput) =>
      parseToolResult(await parseToolHandler(input)),
  );

  server.registerTool(
    "uffda_match",
    {
      title: "uffda match",
      description:
        "Matches an explicit subject (text or JSON) against a Uffda " +
        "pattern, equivalent to `uffda match`. Stateless: does not require " +
        "or affect any session.",
      inputSchema: matchToolInputShape,
    },
    async (input: MatchToolInput) =>
      matchToolResult(await matchToolHandler(input)),
  );

  server.registerTool(
    "uffda_highlight",
    {
      title: "uffda highlight",
      description:
        "Classifies Uffda (or a sub-language's) source text by syntactic " +
        "role (keyword, identifier, string, comment, punctuation, ...) " +
        "derived from the same parse/AST information used elsewhere for " +
        "diagnostics, as a gap-free ordered span list covering the entire " +
        "input. Stateless: does not require or affect any session.",
      inputSchema: highlightToolInputShape,
    },
    async (input: HighlightToolInput) =>
      highlightToolResult(await highlightToolHandler(input)),
  );

  const sessions = new SessionManager();
  registerSessionTools(server, sessions);
  registerDisplayTools(server, sessions);

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
