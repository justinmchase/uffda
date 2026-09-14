import { assert, assertEquals } from "@std/assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSessionTools } from "./mcp.session_tools.ts";
import { registerDisplayTools } from "./mcp.display_tools.ts";
import { SessionManager } from "./mcp.sessions.ts";
import { DisplaySurfaceManager } from "./display.ts";
import type {
  DisplaySurfaceHandle,
  DisplaySurfaceLauncher,
} from "./display.ts";

/**
 * Coverage for `uffda_session_display_open`/`uffda_session_display_render`
 * (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`).
 * Uses a fake `DisplaySurfaceLauncher` (see `display.test.ts`) so this suite
 * never compiles/spawns a real `deno desktop` window.
 */

function fakeLauncher(): DisplaySurfaceLauncher {
  return (_url, _title) => {
    const handle: DisplaySurfaceHandle = { close: () => Promise.resolve() };
    return Promise.resolve(handle);
  };
}

async function connectedClient() {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const sessions = new SessionManager();
  const displays = new DisplaySurfaceManager(fakeLauncher());
  registerSessionTools(server, sessions);
  registerDisplayTools(server, sessions, displays);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client, sessions, displays };
}

function textOf(result: { content?: unknown }): unknown {
  const content = result.content as { text: string }[];
  return JSON.parse(content[0].text);
}

Deno.test("cli.mcp.display_tools session display tools end to end", async (t) => {
  await t.step(
    "open then render a highlight result into a session's display surface",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };
        assertEquals(opened.ok, true);

        const displayOpened = textOf(
          await client.callTool({
            name: "uffda_session_display_open",
            arguments: { sessionId: opened.sessionId },
          }),
        ) as { ok: boolean };
        assertEquals(displayOpened.ok, true);

        const rendered = textOf(
          await client.callTool({
            name: "uffda_session_display_render",
            arguments: {
              sessionId: opened.sessionId,
              source: "// hi\nexport Main;",
            },
          }),
        ) as { ok: boolean };
        assertEquals(rendered.ok, true);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "opening a display surface twice for the same session is idempotent",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };

        const first = textOf(
          await client.callTool({
            name: "uffda_session_display_open",
            arguments: { sessionId: opened.sessionId },
          }),
        ) as { ok: boolean };
        assertEquals(first.ok, true);

        const second = textOf(
          await client.callTool({
            name: "uffda_session_display_open",
            arguments: { sessionId: opened.sessionId },
          }),
        ) as { ok: boolean };
        assertEquals(second.ok, true);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "opening a display surface for an unknown session fails deterministically",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const result = textOf(
          await client.callTool({
            name: "uffda_session_display_open",
            arguments: { sessionId: "nope" },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(result.ok, false);
        assertEquals(result.error?.code, "MCP_DISPLAY_UNKNOWN_SESSION");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "rendering before opening a display surface fails deterministically",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };

        const result = textOf(
          await client.callTool({
            name: "uffda_session_display_render",
            arguments: { sessionId: opened.sessionId, source: "export Main;" },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(result.ok, false);
        assertEquals(result.error?.code, "MCP_DISPLAY_NO_OPEN_SURFACE");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "rendering both matchResultId and source at once fails deterministically",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };
        await client.callTool({
          name: "uffda_session_display_open",
          arguments: { sessionId: opened.sessionId },
        });

        const result = textOf(
          await client.callTool({
            name: "uffda_session_display_render",
            arguments: {
              sessionId: opened.sessionId,
              source: "export Main;",
              matchResultId: "match-1",
            },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(result.ok, false);
        assertEquals(result.error?.code, "MCP_DISPLAY_INVALID_INPUT");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "rendering an unknown matchResultId fails deterministically",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };
        await client.callTool({
          name: "uffda_session_display_open",
          arguments: { sessionId: opened.sessionId },
        });

        const result = textOf(
          await client.callTool({
            name: "uffda_session_display_render",
            arguments: {
              sessionId: opened.sessionId,
              matchResultId: "nope",
            },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(result.ok, false);
        assertEquals(result.error?.code, "MCP_DISPLAY_UNKNOWN_MATCH_RESULT");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "renders a retained match result tree by id",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };
        await client.callTool({
          name: "uffda_session_load",
          arguments: {
            sessionId: opened.sessionId,
            source: "export Main; rule Main = any;",
          },
        });
        const evaluated = textOf(
          await client.callTool({
            name: "uffda_session_eval",
            arguments: {
              sessionId: opened.sessionId,
              rule: "Main",
              input: "x",
            },
          }),
        ) as { ok: boolean; matchResultId?: string };
        assertEquals(evaluated.ok, true);
        assert(typeof evaluated.matchResultId === "string");

        await client.callTool({
          name: "uffda_session_display_open",
          arguments: { sessionId: opened.sessionId },
        });
        const rendered = textOf(
          await client.callTool({
            name: "uffda_session_display_render",
            arguments: {
              sessionId: opened.sessionId,
              matchResultId: evaluated.matchResultId,
            },
          }),
        ) as { ok: boolean };
        assertEquals(rendered.ok, true);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "closing a session releases its display surface",
    async () => {
      const { server, client, displays } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };
        await client.callTool({
          name: "uffda_session_display_open",
          arguments: { sessionId: opened.sessionId },
        });
        assertEquals(displays.has(opened.sessionId), true);

        await client.callTool({
          name: "uffda_session_close",
          arguments: { sessionId: opened.sessionId },
        });
        assertEquals(displays.has(opened.sessionId), false);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
});
