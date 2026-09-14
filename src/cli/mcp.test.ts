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
          tools.tools.map((tool: Tool) => tool.name),
          ["uffda_version"],
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
});
