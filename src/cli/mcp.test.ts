import { assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createUffdaMcpServer, versionToolHandler } from "./mcp.ts";
import { version } from "../version.ts";

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
            "uffda_compile",
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
            "uffda_session_query",
            "uffda_session_walk",
            "uffda_version",
          ].sort(),
        );

        const result = await client.callTool({ name: "uffda_version" });
        assertEquals(result, {
          content: [{ type: "text", text: version }],
        });
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
