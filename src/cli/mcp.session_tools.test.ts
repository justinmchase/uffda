import { assert, assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createUffdaMcpServer } from "./mcp.ts";

async function connectedClient() {
  const server = createUffdaMcpServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}

function textOf(result: { content?: unknown }): unknown {
  const content = result.content as { text: string }[];
  return JSON.parse(content[0].text);
}

Deno.test("cli.mcp session tools end to end", async (t) => {
  await t.step(
    "open, load, and close a session round-trip over MCP",
    async () => {
      const { server, client } = await connectedClient();
      try {
        // Note: even though `cwd` is optional, this SDK version requires
        // callers to pass an (empty) `arguments` object explicitly for a
        // zero-required-field inputSchema — omitting it entirely fails
        // input validation with a spurious "Required" error.
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };
        assertEquals(opened.ok, true);
        assert(typeof opened.sessionId === "string");

        const loaded = textOf(
          await client.callTool({
            name: "uffda_session_load",
            arguments: {
              sessionId: opened.sessionId,
              source: "export Main; rule Main = any;",
            },
          }),
        ) as {
          ok: boolean;
          module?: {
            declarations: { name: string; kind: string; exported: boolean }[];
          };
        };
        assertEquals(loaded.ok, true);
        assertEquals(loaded.module?.declarations, [
          { name: "Main", kind: "rule", exported: true },
        ]);

        const closed = textOf(
          await client.callTool({
            name: "uffda_session_close",
            arguments: { sessionId: opened.sessionId },
          }),
        ) as { ok: boolean };
        assertEquals(closed.ok, true);

        const afterClose = textOf(
          await client.callTool({
            name: "uffda_session_load",
            arguments: {
              sessionId: opened.sessionId,
              source: "export Main; rule Main = any;",
            },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(afterClose.ok, false);
        assertEquals(afterClose.error?.code, "MCP_SESSION_UNKNOWN");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step("loading against an unknown session id fails", async () => {
    const { server, client } = await connectedClient();
    try {
      const result = textOf(
        await client.callTool({
          name: "uffda_session_load",
          arguments: { sessionId: "nope", source: "export Main;" },
        }),
      ) as { ok: boolean; error?: { code: string } };
      assertEquals(result.ok, false);
      assertEquals(result.error?.code, "MCP_SESSION_UNKNOWN");
    } finally {
      await client.close();
      await server.close();
    }
  });

  await t.step(
    "evaluates an expression and invokes a named rule over MCP",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };

        const loaded = textOf(
          await client.callTool({
            name: "uffda_session_load",
            arguments: {
              sessionId: opened.sessionId,
              source:
                'export Add Main;\nfunc Add<a:number b:number> = (add a b);\nrule Main = "A";',
            },
          }),
        ) as { ok: boolean };
        assertEquals(loaded.ok, true);

        const exprResult = textOf(
          await client.callTool({
            name: "uffda_session_eval",
            arguments: {
              sessionId: opened.sessionId,
              expression: "(Add 1 2)",
            },
          }),
        ) as { ok: boolean; value?: unknown };
        assertEquals(exprResult, { ok: true, value: 3 });

        const ruleResult = textOf(
          await client.callTool({
            name: "uffda_session_eval",
            arguments: {
              sessionId: opened.sessionId,
              rule: "Main",
              input: "A",
            },
          }),
        ) as { ok: boolean; value?: unknown };
        assertEquals(ruleResult, { ok: true, value: "A" });

        const failResult = textOf(
          await client.callTool({
            name: "uffda_session_eval",
            arguments: {
              sessionId: opened.sessionId,
              rule: "Main",
              input: "B",
            },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(failResult.ok, false);
        assertEquals(failResult.error?.code, "MCP_SESSION_EVAL_MATCH_FAILURE");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step("evaluating against an unknown session id fails", async () => {
    const { server, client } = await connectedClient();
    try {
      const result = textOf(
        await client.callTool({
          name: "uffda_session_eval",
          arguments: { sessionId: "nope", expression: "1" },
        }),
      ) as { ok: boolean; error?: { code: string } };
      assertEquals(result.ok, false);
      assertEquals(result.error?.code, "MCP_SESSION_UNKNOWN");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
