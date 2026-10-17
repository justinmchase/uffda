import { assert, assertEquals, assertExists } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createUffdaMcpServer, versionToolHandler } from "./mcp.ts";
import { version } from "../version.ts";
import { experimentToolInputShape } from "./mcp.experiment.ts";
import { authoringContextToolInputShape } from "./mcp.authoring_context.ts";

Deno.test("cli.mcp", async (t) => {
  await t.step("versionToolHandler returns the CLI version as text", () => {
    const result = versionToolHandler();
    assertEquals(result, { content: [{ type: "text", text: version }] });
  });

  await t.step(
    "createUffdaMcpServer registers uffda_version and serves it end to end",
    async () => {
      const server = createUffdaMcpServer();
      const client = new Client({ name: "test-client", version: "0.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport
        .createLinkedPair();

      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      try {
        const tools = await client.listTools();
        assertEquals(
          tools.tools.map((tool: Tool) => tool.name).sort(),
          [
            "uffda_authoring_context",
            "uffda_compile",
            "uffda_experiment",
            "uffda_highlight",
            "uffda_match",
            "uffda_parse",
            "uffda_session_close",
            "uffda_session_describe",
            "uffda_session_display_open",
            "uffda_session_display_render",
            "uffda_session_eval",
            "uffda_session_list_modules",
            "uffda_session_load",
            "uffda_session_open",
            "uffda_session_patch",
            "uffda_session_query",
            "uffda_session_walk",
            "uffda_version",
          ].sort(),
        );

        const result = await client.callTool({ name: "uffda_version" });
        assertEquals(result, {
          content: [{ type: "text", text: version }],
        });

        // req:mcp-server-014 — experiment advertised once with matching schema.
        const experimentTools = tools.tools.filter(
          (tool: Tool) => tool.name === "uffda_experiment",
        );
        assertEquals(experimentTools.length, 1);
        const experiment = experimentTools[0];
        assert(
          experiment.description?.toLowerCase().includes("in-memory"),
          experiment.description,
        );
        assert(
          experiment.description?.toLowerCase().includes("assert") ||
            experiment.description?.toLowerCase().includes("cases"),
          experiment.description,
        );
        const experimentProps = (experiment.inputSchema as {
          properties?: Record<string, unknown>;
        }).properties ?? {};
        for (const key of Object.keys(experimentToolInputShape)) {
          assertExists(
            experimentProps[key],
            `tools/list schema missing ${key}`,
          );
        }

        // req:mcp-server-015 — authoring context advertises topics.
        const authoring = tools.tools.find(
          (tool: Tool) => tool.name === "uffda_authoring_context",
        );
        assertExists(authoring);
        const authoringProps = (authoring.inputSchema as {
          properties?: Record<string, unknown>;
        }).properties ?? {};
        for (const key of Object.keys(authoringContextToolInputShape)) {
          assertExists(
            authoringProps[key],
            `authoring tools/list schema missing ${key}`,
          );
        }

        const experimentCall = await client.callTool({
          name: "uffda_experiment",
          arguments: {
            language: "pattern",
            source: '"x"',
            cases: [{ name: "hit", input: "x", expect: "x" }],
          },
        });
        const experimentPayload = JSON.parse(
          (experimentCall.content as { text: string }[])[0].text,
        );
        assertEquals(
          experimentPayload.ok,
          true,
          Deno.inspect(experimentPayload),
        );
        assertEquals(experimentPayload.summary.passed, 1);
        assertEquals(experimentPayload.summary.failed, 0);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  await t.step(
    "uffda_parse and uffda_match tools are callable end to end",
    async () => {
      const server = createUffdaMcpServer();
      const client = new Client({ name: "test-client", version: "0.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport
        .createLinkedPair();

      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      try {
        const parseResult = await client.callTool({
          name: "uffda_parse",
          arguments: { source: "any", language: "pattern" },
        });
        const parseContent = (parseResult.content as { text: string }[])[0]
          .text;
        assertEquals(JSON.parse(parseContent).ok, true);

        const matchResult = await client.callTool({
          name: "uffda_match",
          arguments: { pattern: "any", input: "x" },
        });
        const matchContent = (matchResult.content as { text: string }[])[0]
          .text;
        assertEquals(JSON.parse(matchContent).ok, true);

        const highlightResult = await client.callTool({
          name: "uffda_highlight",
          arguments: { source: "rule A = any;\n" },
        });
        const highlightContent =
          (highlightResult.content as { text: string }[])[0].text;
        const highlight = JSON.parse(highlightContent);
        assertEquals(highlight.ok, true);
        assertEquals(
          highlight.spans.find((s: { role: string }) => s.role === "keyword")
            ?.text,
          "rule",
        );
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
});
