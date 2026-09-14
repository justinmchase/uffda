import { assert, assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import { CliLanguage } from "./contract.ts";
import {
  compileToolHandler,
  matchToolHandler,
  parseToolHandler,
} from "./mcp.static_tools.ts";

const writePermission = await Deno.permissions.query({ name: "write" });

async function write(path: string, content: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, content);
}

Deno.test({
  name: "cli.mcp.static_tools compileToolHandler",
  ignore: writePermission.state !== "granted",
  fn: async (t) => {
    await t.step(
      "compiles a source file to an artifact under the default output dir",
      async () => {
        const root = await Deno.makeTempDir({
          prefix: "uffda-mcp-compile-",
        });
        const src = join(root, "src");
        await write(join(src, "main.uff"), "export Main; rule Main = any;");

        const result = await compileToolHandler({
          cwd: src,
          paths: ["main.uff"],
        });

        assertEquals(result.ok, true);
        assertEquals(result.successes.length, 1);
        assertEquals(
          result.successes[0].outputPath,
          join(src, ".uffda", "ast", "main.uffda.ast.json"),
        );
      },
    );

    await t.step("reports a failure for an unreadable source", async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-mcp-compile-" });
      const result = await compileToolHandler({
        cwd: root,
        paths: ["missing.uff"],
      });
      assertEquals(result.ok, false);
      assertEquals(result.failures.length, 1);
    });
  },
});

Deno.test("cli.mcp.static_tools parseToolHandler", async (t) => {
  await t.step("parses a full Uffda module by default", async () => {
    const result = await parseToolHandler({
      source: "export Main; rule Main = any;",
    });
    assert(result && typeof result === "object" && "ok" in result);
    assertEquals((result as { ok: boolean }).ok, true);
  });

  await t.step("parses using the requested language", async () => {
    const result = await parseToolHandler({
      source: "any",
      language: CliLanguage.Pattern,
    });
    assertEquals((result as { ok: boolean }).ok, true);
  });

  await t.step("reports a parse failure", async () => {
    const result = await parseToolHandler({
      source: "rule Main = ",
    }) as { ok: false; error: { phase: string } };
    assertEquals(result.ok, false);
    assertEquals(result.error.phase, "parse");
  });
});

Deno.test("cli.mcp.static_tools matchToolHandler", async (t) => {
  await t.step("matches raw text input against a pattern", async () => {
    const result = await matchToolHandler({
      pattern: "any",
      input: "x",
    });
    assertEquals(result.ok, true);
  });

  await t.step("matches JSON input when inputIsJson is set", async () => {
    const result = await matchToolHandler({
      pattern: "any",
      input: "42",
      inputIsJson: true,
    });
    assertEquals(result.ok, true);
    assert(result.ok && result.value === 42);
  });

  await t.step(
    "reports a parse-phase failure for bad pattern text",
    async () => {
      const result = await matchToolHandler({
        pattern: "(",
        input: "x",
      });
      assertEquals(result.ok, false);
      assert(!result.ok && result.error.phase === "parse");
    },
  );

  await t.step(
    "reports a match-phase failure for non-matching input",
    async () => {
      const result = await matchToolHandler({
        pattern: '"specific"',
        input: "other",
      });
      assertEquals(result.ok, false);
      assert(!result.ok && result.error.phase === "match");
    },
  );

  await t.step("reports an input-phase failure for invalid JSON", async () => {
    const result = await matchToolHandler({
      pattern: "any",
      input: "{not json",
      inputIsJson: true,
    });
    assertEquals(result.ok, false);
    assert(!result.ok && result.error.phase === "input");
  });
});
