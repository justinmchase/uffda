import { assertEquals } from "@std/assert";
import {
  CliContractErrorCode,
  CliExitCode,
  CliLanguage,
  CliMode,
  resolveCliProcessContract,
} from "../../cli/contract.ts";

Deno.test("req:cli-command-model-001 - CLI command model and process contract are deterministic", async (t) => {
  await t.step(
    "command families resolve to compile, parse, exec, and interactive",
    () => {
      const compile = resolveCliProcessContract({
        argv: ["compile", "main.uff"],
        processCwd: "/repo",
      });
      const parse = resolveCliProcessContract({
        argv: ["parse"],
        processCwd: "/repo",
      });
      const interactive = resolveCliProcessContract({
        argv: ["workbench"],
        processCwd: "/repo",
      });

      assertEquals(compile.ok, true);
      assertEquals(parse.ok, true);
      assertEquals(interactive.ok, true);
      if (!compile.ok || !parse.ok || !interactive.ok) return;

      assertEquals(compile.contract.mode, CliMode.Compile);
      assertEquals(parse.contract.mode, CliMode.Parse);
      assertEquals(interactive.contract.mode, CliMode.Interactive);
    },
  );

  await t.step(
    "default mode remains compile even when stdin is attached",
    () => {
      const withStdin = resolveCliProcessContract({
        argv: [],
        processCwd: "/repo",
        stdinAttached: true,
      });
      const defaultCompile = resolveCliProcessContract({
        argv: [],
        processCwd: "/repo",
        stdinAttached: false,
      });

      assertEquals(withStdin.ok, true);
      assertEquals(defaultCompile.ok, true);
      if (!withStdin.ok || !defaultCompile.ok) return;

      assertEquals(withStdin.contract.mode, CliMode.Compile);
      assertEquals(defaultCompile.contract.mode, CliMode.Compile);
      assertEquals(defaultCompile.contract.language, CliLanguage.FullUffda);
    },
  );

  await t.step(
    "conflicts and path-context failures map to stable exit codes",
    () => {
      const usage = resolveCliProcessContract({
        argv: ["parse", "--mode=compile"],
        processCwd: "/repo",
      });
      const config = resolveCliProcessContract({
        argv: ["compile", "main.uff"],
        processCwd: "repo",
      });

      assertEquals(usage.ok, false);
      assertEquals(config.ok, false);
      if (usage.ok || config.ok) return;

      assertEquals(usage.exitCode, CliExitCode.Usage);
      assertEquals(usage.error.code, CliContractErrorCode.Usage);
      assertEquals(config.exitCode, CliExitCode.Config);
      assertEquals(config.error.code, CliContractErrorCode.Config);
    },
  );
});
