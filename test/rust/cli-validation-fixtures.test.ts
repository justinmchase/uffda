import { assertEquals } from "@std/assert";
import { runCli } from "../../src/cli/main.ts";
import fixtures from "./cli-validation-fixtures.json" with { type: "json" };

Deno.test("req:cli-command-model-004 - reference CLI shares exact Rust validation outcomes", async (t) => {
  for (const fixture of fixtures) {
    await t.step(fixture.name, async () => {
      const result = await runCli(fixture.args, Deno.cwd(), false);
      assertEquals(result.exitCode, 2);
      assertEquals(result.stdout ?? "", "");
      assertEquals(JSON.parse(result.stderr!), {
        ok: false,
        error: {
          code: "CLI_USAGE",
          phase: fixture.phase,
          message: fixture.message,
        },
      });
    });
  }
});
