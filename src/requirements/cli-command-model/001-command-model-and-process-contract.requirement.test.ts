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
    "default mode is the interactive workbench with no arguments at all",
    () => {
      const withStdin = resolveCliProcessContract({
        argv: [],
        processCwd: "/repo",
        stdinAttached: true,
      });
      const withoutStdin = resolveCliProcessContract({
        argv: [],
        processCwd: "/repo",
        stdinAttached: false,
      });

      assertEquals(withStdin.ok, true);
      assertEquals(withoutStdin.ok, true);
      if (!withStdin.ok || !withoutStdin.ok) return;

      assertEquals(withStdin.contract.mode, CliMode.Interactive);
      assertEquals(withoutStdin.contract.mode, CliMode.Interactive);
      assertEquals(withoutStdin.contract.language, CliLanguage.FullUffda);
    },
  );

  await t.step(
    "default mode remains compile once any argument is present",
    () => {
      const resolution = resolveCliProcessContract({
        argv: ["main.uff"],
        processCwd: "/repo",
        stdinAttached: true,
      });

      assertEquals(resolution.ok, true);
      if (!resolution.ok) return;
      assertEquals(resolution.contract.mode, CliMode.Compile);
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
