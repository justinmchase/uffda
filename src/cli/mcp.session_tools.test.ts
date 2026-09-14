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
    "patches a loaded module's source and reports the same result as a full reload",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const opened = textOf(
          await client.callTool({
            name: "uffda_session_open",
            arguments: {},
          }),
        ) as { ok: boolean; sessionId: string };

        const before = 'export Main;\nrule Main = "a";';
        const editAt = before.indexOf('"a"');
        const loaded = textOf(
          await client.callTool({
            name: "uffda_session_load",
            arguments: { sessionId: opened.sessionId, source: before },
          }),
        ) as {
          ok: boolean;
          module?: { moduleUrl: string };
        };
        assertEquals(loaded.ok, true);

        const patched = textOf(
          await client.callTool({
            name: "uffda_session_patch",
            arguments: {
              sessionId: opened.sessionId,
              moduleUrl: loaded.module?.moduleUrl,
              start: editAt,
              end: editAt + 3,
              replacement: '"z"',
            },
          }),
        ) as {
          ok: boolean;
          module?: {
            declarations: { name: string; kind: string; exported: boolean }[];
          };
        };
        assertEquals(patched.ok, true);
        assertEquals(patched.module?.declarations, [
          { name: "Main", kind: "rule", exported: true },
        ]);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step("patching against an unknown session id fails", async () => {
    const { server, client } = await connectedClient();
    try {
      const result = textOf(
        await client.callTool({
          name: "uffda_session_patch",
          arguments: { sessionId: "nope", start: 0, end: 0, replacement: "" },
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
        ) as { ok: boolean; value?: unknown; matchResultId?: string };
        assertEquals(ruleResult.ok, true);
        assertEquals(ruleResult.value, "A");
        assert(typeof ruleResult.matchResultId === "string");

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

  await t.step(
    "lists modules, describes a decorated rule, and queries by metadata over MCP",
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
              source: `export Main Loud;
                       decorator Loud = { shout: true };
                       [Loud]
                       rule Main = any;`,
            },
          }),
        ) as { ok: boolean };
        assertEquals(loaded.ok, true);

        const modules = textOf(
          await client.callTool({
            name: "uffda_session_list_modules",
            arguments: { sessionId: opened.sessionId },
          }),
        ) as {
          ok: boolean;
          modules?: {
            moduleUrl: string;
            declarations: { name: string; kind: string }[];
          }[];
        };
        assertEquals(modules.ok, true);
        assertEquals(modules.modules?.length, 1);
        assertEquals(
          modules.modules?.[0].declarations.map((d) => d.name).sort(),
          ["Loud", "Main"],
        );

        const described = textOf(
          await client.callTool({
            name: "uffda_session_describe",
            arguments: { sessionId: opened.sessionId, name: "Main" },
          }),
        ) as {
          ok: boolean;
          declaration?: {
            kind: string;
            attributes: unknown;
            metadata: unknown;
          };
        };
        assertEquals(described.ok, true);
        assertEquals(described.declaration?.kind, "rule");
        assertEquals(described.declaration?.attributes, [
          { decorator: "Loud", args: [] },
        ]);
        assertEquals(described.declaration?.metadata, {
          Loud: { shout: true },
        });

        const queried = textOf(
          await client.callTool({
            name: "uffda_session_query",
            arguments: { sessionId: opened.sessionId, decorator: "Loud" },
          }),
        ) as {
          ok: boolean;
          matches?: {
            moduleUrl: string;
            name: string;
            kind: string;
            metadata: unknown;
          }[];
        };
        assertEquals(queried.ok, true);
        assertEquals(queried.matches, [
          {
            moduleUrl: modules.modules![0].moduleUrl,
            name: "Main",
            kind: "rule",
            metadata: { shout: true },
          },
        ]);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "listing modules, describing, querying, and walking against an unknown session id all fail",
    async () => {
      const { server, client } = await connectedClient();
      try {
        const listResult = textOf(
          await client.callTool({
            name: "uffda_session_list_modules",
            arguments: { sessionId: "nope" },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(listResult.ok, false);
        assertEquals(listResult.error?.code, "MCP_SESSION_UNKNOWN");

        const describeResult = textOf(
          await client.callTool({
            name: "uffda_session_describe",
            arguments: { sessionId: "nope", name: "Main" },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(describeResult.ok, false);
        assertEquals(describeResult.error?.code, "MCP_SESSION_UNKNOWN");

        const queryResult = textOf(
          await client.callTool({
            name: "uffda_session_query",
            arguments: { sessionId: "nope", decorator: "Loud" },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(queryResult.ok, false);
        assertEquals(queryResult.error?.code, "MCP_SESSION_UNKNOWN");

        const walkResult = textOf(
          await client.callTool({
            name: "uffda_session_walk",
            arguments: { sessionId: "nope", matchResultId: "1" },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(walkResult.ok, false);
        assertEquals(walkResult.error?.code, "MCP_SESSION_UNKNOWN");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "evaluates a rule, then walks its retained match result tree over MCP",
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
              source: `export Main Inner Loud;
                       decorator Loud = { shout: true };
                       [Loud]
                       rule Inner = any;
                       rule Main = Inner;`,
            },
          }),
        ) as { ok: boolean };
        assertEquals(loaded.ok, true);

        const evaluated = textOf(
          await client.callTool({
            name: "uffda_session_eval",
            arguments: {
              sessionId: opened.sessionId,
              rule: "Main",
              input: "x",
            },
          }),
        ) as { ok: boolean; value?: unknown; matchResultId?: string };
        assertEquals(evaluated.ok, true);
        assertEquals(evaluated.value, "x");
        assert(typeof evaluated.matchResultId === "string");

        const walked = textOf(
          await client.callTool({
            name: "uffda_session_walk",
            arguments: {
              sessionId: opened.sessionId,
              matchResultId: evaluated.matchResultId,
            },
          }),
        ) as {
          ok: boolean;
          truncated?: boolean;
          nodes?: {
            path: number[];
            kind: string;
            rule?: string;
            metadata: { rule: string; metadata: unknown }[];
          }[];
        };
        assertEquals(walked.ok, true);
        assertEquals(walked.truncated, false);
        assertEquals(walked.nodes?.length, 4);
        assertEquals(walked.nodes?.[0].rule, "Main");

        const innerNode = walked.nodes?.find((n) => n.rule === "Inner");
        assert(innerNode);
        assertEquals(innerNode.metadata, [
          { rule: "Inner", metadata: { Loud: { shout: true } } },
        ]);

        // Windowing: maxNodes bounds the response and reports truncated.
        const windowed = textOf(
          await client.callTool({
            name: "uffda_session_walk",
            arguments: {
              sessionId: opened.sessionId,
              matchResultId: evaluated.matchResultId,
              maxNodes: 1,
            },
          }),
        ) as { ok: boolean; truncated?: boolean; nodes?: unknown[] };
        assertEquals(windowed.ok, true);
        assertEquals(windowed.nodes?.length, 1);
        assertEquals(windowed.truncated, true);

        // An out-of-range path fails deterministically.
        const badPath = textOf(
          await client.callTool({
            name: "uffda_session_walk",
            arguments: {
              sessionId: opened.sessionId,
              matchResultId: evaluated.matchResultId,
              path: [9],
            },
          }),
        ) as { ok: boolean; error?: { code: string } };
        assertEquals(badPath.ok, false);
        assertEquals(badPath.error?.code, "MCP_SESSION_WALK_INVALID_PATH");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
});
