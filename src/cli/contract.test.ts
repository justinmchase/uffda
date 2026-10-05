import { assert, assertEquals } from "@std/assert";
import {
  CliContractErrorCode,
  CliExitCode,
  CliLanguage,
  CliMode,
  resolveCliProcessContract,
} from "./contract.ts";

const cwd = "/workspace/project";

Deno.test("cli.contract resolves command model and process contracts deterministically", async (t) => {
  await t.step("defaults to compile mode and uffda language", () => {
    const resolution = resolveCliProcessContract({
      argv: ["source/main.uff"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.exitCode, CliExitCode.Ok);
    assertEquals(resolution.contract.mode, CliMode.Compile);
    assertEquals(resolution.contract.command, "compile");
    assertEquals(resolution.contract.language, CliLanguage.FullUffda);
    assertEquals(resolution.contract.inputPaths, ["source/main.uff"]);
  });

  await t.step("recognizes parse as a stdin command", () => {
    const resolution = resolveCliProcessContract({
      argv: ["parse"],
      processCwd: cwd,
      stdinAttached: true,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.mode, CliMode.Parse);
    assertEquals(resolution.contract.command, "parse");
  });

  await t.step("recognizes exec as an expression source command", () => {
    const resolution = resolveCliProcessContract({
      argv: ["exec"],
      processCwd: cwd,
      stdinAttached: true,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.mode, CliMode.Exec);
    assertEquals(resolution.contract.command, "exec");
  });

  await t.step("models source, AST, and match input options", () => {
    const resolution = resolveCliProcessContract({
      argv: ["match", "--ast", "pattern.json", "--input-json", "42", "--json"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.mode, CliMode.Match);
    assertEquals(resolution.contract.astInput, true);
    assertEquals(resolution.contract.inputPaths, ["pattern.json"]);
    assertEquals(resolution.contract.matchInputJson, "42");
    assertEquals(resolution.contract.jsonOutput, true);
  });

  await t.step("rejects language overrides for language-owned commands", () => {
    for (
      const argv of [
        ["exec", "--lang", "expression"],
        ["match", "--lang", "pattern"],
        ["run", "--lang", "uffda"],
        ["compile", "--lang", "pattern", "source.uff"],
      ]
    ) {
      const resolution = resolveCliProcessContract({
        argv,
        processCwd: cwd,
      });

      assertEquals(resolution.ok, false);
      if (resolution.ok) return;
      assertEquals(resolution.exitCode, CliExitCode.Usage);
    }
  });

  await t.step("rejects operational input selectors in compile mode", () => {
    const resolution = resolveCliProcessContract({
      argv: ["compile", "--ast", "source.uff"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, false);
    if (resolution.ok) return;
    assertEquals(resolution.exitCode, CliExitCode.Usage);
  });

  await t.step("limits JSON match input to match", () => {
    const resolution = resolveCliProcessContract({
      argv: ["exec", "--input-json", "42"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, false);
    if (resolution.ok) return;
    assertEquals(resolution.exitCode, CliExitCode.Usage);
  });

  await t.step(
    "last shorthand mode flag wins when no command token is present",
    () => {
      const resolution = resolveCliProcessContract({
        argv: ["--compile", "--parse"],
        processCwd: cwd,
      });

      assertEquals(resolution.ok, true);
      if (!resolution.ok) return;
      assertEquals(resolution.contract.mode, CliMode.Parse);
      assertEquals(resolution.contract.command, "parse");
    },
  );

  await t.step(
    "command and mode conflicts are deterministic usage failures",
    () => {
      const resolution = resolveCliProcessContract({
        argv: ["parse", "--mode=compile"],
        processCwd: cwd,
      });

      assertEquals(resolution.ok, false);
      if (resolution.ok) return;
      assertEquals(resolution.exitCode, CliExitCode.Usage);
      assertEquals(resolution.error.code, CliContractErrorCode.Usage);
      assertEquals(resolution.error.phase, "validation");
    },
  );

  await t.step("recognizes fmt with paths, globs, and --check", () => {
    const resolution = resolveCliProcessContract({
      argv: ["fmt", "--check", "a.uff", "src/**/*.uff"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.mode, CliMode.Fmt);
    assertEquals(resolution.contract.command, "fmt");
    assertEquals(resolution.contract.check, true);
    assertEquals(resolution.contract.inputPaths, ["a.uff", "src/**/*.uff"]);
  });

  await t.step("fmt accepts - alone for standard input", () => {
    const resolution = resolveCliProcessContract({
      argv: ["fmt", "-"],
      processCwd: cwd,
      stdinAttached: true,
    });
    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.check, false);
    assertEquals(resolution.contract.inputPaths, ["-"]);
  });

  await t.step("fmt accepts no paths", () => {
    const resolution = resolveCliProcessContract({
      argv: ["fmt", "--check"],
      processCwd: cwd,
      stdinAttached: true,
    });
    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.inputPaths, []);
  });

  await t.step("rejects invalid fmt invocations", () => {
    for (
      const argv of [
        ["fmt", "-", "a.uff"],
        ["fmt", "-e", "rule A = a;"],
        ["fmt", "--lang", "pattern", "a.uff"],
        ["fmt", "--ast", "a.uff"],
        ["compile", "--check", "a.uff"],
      ]
    ) {
      const resolution = resolveCliProcessContract({ argv, processCwd: cwd });
      assertEquals(resolution.ok, false, argv.join(" "));
      if (resolution.ok) return;
      assertEquals(resolution.exitCode, CliExitCode.Usage);
      assertEquals(resolution.error.phase, "validation");
    }
  });

  await t.step("cwd is derived from process cwd", () => {
    const resolution = resolveCliProcessContract({
      argv: ["compile", "a.uff"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.cwd, "/workspace/project");
  });

  await t.step("--out-dir is not a flag: outDir is the project's", () => {
    for (
      const argv of [
        ["compile", "a.uff", "--out-dir", "bin"],
        ["compile", "a.uff", "--out-dir=bin"],
      ]
    ) {
      const resolution = resolveCliProcessContract({ argv, processCwd: cwd });
      assert(!resolution.ok, argv.join(" "));
      assertEquals(resolution.exitCode, CliExitCode.Usage);
      assert(
        resolution.error.message.startsWith("Unknown flag: --out-dir"),
        resolution.error.message,
      );
    }
  });

  await t.step("--config is resolved relative to process cwd", () => {
    for (
      const argv of [
        ["compile", "a.uff", "--config", "conf/uffda.jsonc"],
        ["fmt", "--config=conf/uffda.jsonc"],
        ["run", "a.uff", "--config", "conf/uffda.jsonc"],
        ["exec", "-e", "1", "--config", "conf/uffda.jsonc"],
      ]
    ) {
      const resolution = resolveCliProcessContract({ argv, processCwd: cwd });
      assert(resolution.ok, argv.join(" "));
      assertEquals(
        resolution.contract.configPath,
        "/workspace/project/conf/uffda.jsonc",
      );
    }
  });

  await t.step("without --config there is no config path", () => {
    const resolution = resolveCliProcessContract({
      argv: ["compile", "a.uff"],
      processCwd: cwd,
    });
    assert(resolution.ok);
    assertEquals(resolution.contract.configPath, undefined);
  });

  await t.step(
    "--config needs a value and a command that loads modules",
    () => {
      for (
        const argv of [
          ["compile", "a.uff", "--config"],
          ["compile", "a.uff", "--config="],
          ["match", "-e", "any", "--input", "x", "--config", "u.jsonc"],
          ["parse", "a.uff", "--config", "u.jsonc"],
        ]
      ) {
        const resolution = resolveCliProcessContract({ argv, processCwd: cwd });
        assert(!resolution.ok, argv.join(" "));
        assertEquals(resolution.exitCode, CliExitCode.Usage);
      }
    },
  );

  await t.step(
    "non-absolute process cwd is a deterministic configuration failure",
    () => {
      const resolution = resolveCliProcessContract({
        argv: ["compile", "a.uff"],
        processCwd: "relative/path",
      });

      assertEquals(resolution.ok, false);
      if (resolution.ok) return;
      assertEquals(resolution.exitCode, CliExitCode.Config);
      assertEquals(resolution.error.code, CliContractErrorCode.Config);
      assertEquals(resolution.error.phase, "configuration");
    },
  );
});
