import { assertEquals } from "@std/assert";
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
    assertEquals(
      resolution.contract.outputRootDir,
      "/workspace/project/.uffda",
    );
  });

  await t.step("defaults to interactive workbench with no arguments", () => {
    const resolution = resolveCliProcessContract({
      argv: [],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.mode, CliMode.Interactive);
    assertEquals(resolution.contract.command, "workbench");
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
    const resolution = resolveCliProcessContract({
      argv: ["exec", "--lang", "expression"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, false);
    if (resolution.ok) return;
    assertEquals(resolution.exitCode, CliExitCode.Usage);
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
        argv: ["--compile", "--interactive"],
        processCwd: cwd,
      });

      assertEquals(resolution.ok, true);
      if (!resolution.ok) return;
      assertEquals(resolution.contract.mode, CliMode.Interactive);
      assertEquals(resolution.contract.command, "workbench");
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

  await t.step("cwd is derived from process cwd", () => {
    const resolution = resolveCliProcessContract({
      argv: ["compile", "a.uff"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(resolution.contract.cwd, "/workspace/project");
  });

  await t.step("out-dir is resolved relative to process cwd", () => {
    const resolution = resolveCliProcessContract({
      argv: ["compile", "a.uff", "--out-dir", "build-output"],
      processCwd: cwd,
    });

    assertEquals(resolution.ok, true);
    if (!resolution.ok) return;
    assertEquals(
      resolution.contract.outputRootDir,
      "/workspace/project/build-output",
    );
  });

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
