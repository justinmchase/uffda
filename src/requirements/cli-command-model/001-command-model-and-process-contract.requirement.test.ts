import { assertEquals } from "@std/assert";
import {
  CliContractErrorCode,
  CliExitCode,
  CliMode,
  resolveCliProcessContract,
} from "../../cli/contract.ts";

Deno.test("req:cli-command-model-001 - CLI command model and process contract are deterministic", async (t) => {
  await t.step(
    "command families resolve to compile, parse, exec, match, and run",
    () => {
      const compile = resolveCliProcessContract({
        argv: ["compile", "main.uff"],
        processCwd: "/repo",
      });
      const parse = resolveCliProcessContract({
        argv: ["parse"],
        processCwd: "/repo",
      });
      const exec = resolveCliProcessContract({
        argv: ["exec", "-e", "1"],
        processCwd: "/repo",
      });
      const match = resolveCliProcessContract({
        argv: ["match", "-e", "any", "--input", "x"],
        processCwd: "/repo",
      });
      const run = resolveCliProcessContract({
        argv: ["run", "app.uff"],
        processCwd: "/repo",
      });
      assertEquals(compile.ok, true);
      assertEquals(parse.ok, true);
      assertEquals(exec.ok, true);
      assertEquals(match.ok, true);
      assertEquals(run.ok, true);
      if (!compile.ok || !parse.ok || !exec.ok || !match.ok || !run.ok) {
        return;
      }

      assertEquals(compile.contract.mode, CliMode.Compile);
      assertEquals(parse.contract.mode, CliMode.Parse);
      assertEquals(exec.contract.mode, CliMode.Exec);
      assertEquals(match.contract.mode, CliMode.Match);
      assertEquals(run.contract.mode, CliMode.Run);
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
