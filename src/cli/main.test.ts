import { assert, assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import { CliExitCode } from "./contract.ts";
import { resolveProcessCwd, runCli, shouldReadStdin } from "./main.ts";
import { resolveCliProcessContract } from "./contract.ts";
import { workbenchBanner } from "./workbench.ts";

const writePermission = await Deno.permissions.query({
  name: "write",
});

async function write(path: string, content: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, content);
}

Deno.test("cli.main runCli validates mode support and compile routing", async (t) => {
  await t.step("resolveProcessCwd prefers INIT_CWD, then PWD, then cwd", () => {
    const withInit = resolveProcessCwd(
      (name) => name === "INIT_CWD" ? "/tmp/invocation" : undefined,
      () => "/tmp/task-root",
    );
    assertEquals(withInit, "/tmp/invocation");

    const withPwd = resolveProcessCwd(
      (name) => name === "PWD" ? "/tmp/pwd" : undefined,
      () => "/tmp/task-root",
    );
    assertEquals(withPwd, "/tmp/pwd");

    const fallback = resolveProcessCwd(
      () => undefined,
      () => "/tmp/task-root",
    );
    assertEquals(fallback, "/tmp/task-root");
  });

  await t.step("reads stdin only when the command selects it as input", () => {
    const inline = resolveCliProcessContract({
      argv: ["exec", "-e", '(echo "hello")'],
      processCwd: "/workspace/project",
    });
    assertEquals(shouldReadStdin(inline), false);

    const sourceFile = resolveCliProcessContract({
      argv: ["run", "app.uff"],
      processCwd: "/workspace/project",
    });
    assertEquals(shouldReadStdin(sourceFile), false);

    const standardInput = resolveCliProcessContract({
      argv: ["parse", "--lang", "expression"],
      processCwd: "/workspace/project",
    });
    assertEquals(shouldReadStdin(standardInput), true);
  });

  await t.step("prints root help when --help is requested", async () => {
    const result = await runCli(["--help"], "/workspace/project", false);
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(
      result.stdout?.includes("Usage: uffda <command> [options] [paths...]"),
    );
    assert(result.stdout?.includes("Commands:"));
  });

  await t.step("prints command help for compile context", async () => {
    const result = await runCli(
      ["compile", "--help"],
      "/workspace/project",
      false,
    );
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(
      result.stdout?.includes(
        "Usage: uffda compile [options] <file-or-folder>",
      ),
    );
  });

  await t.step("prints command help for mode flag context", async () => {
    const result = await runCli(
      ["parse", "-h"],
      "/workspace/project",
      false,
    );
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(result.stdout?.includes("Usage: uffda parse [options]"));
  });

  await t.step("writes a full-Uffda AST from stdin to stdout", async () => {
    const result = await runCli(
      ["parse"],
      "/workspace/project",
      true,
      "export Main; rule Main = any;",
    );

    assertEquals(result.exitCode, CliExitCode.Ok);
    assertEquals(result.stderr, undefined);
    const ast = JSON.parse(result.stdout ?? "{}") as {
      kind: string;
    };
    assertEquals(ast.kind, "module");
  });

  await t.step("streams parse diagnostics to stderr", async () => {
    const result = await runCli(
      ["parse"],
      "/workspace/project",
      true,
      "export Main; rule Main =",
    );

    assertEquals(result.exitCode, CliExitCode.Usage);
    assertEquals(result.stdout, undefined);
    const diagnostic = JSON.parse(result.stderr ?? "{}") as {
      ok: boolean;
      error: { code: string; phase: string; sourcePath: string };
    };
    assertEquals(diagnostic.ok, false);
    assertEquals(diagnostic.error.code, "CLI_STREAM_PARSE_FAILURE");
    assertEquals(diagnostic.error.phase, "parse");
    assertEquals(diagnostic.error.sourcePath, "<stdin>");
  });

  await t.step(
    "writes a pattern AST when --lang pattern is selected",
    async () => {
      const result = await runCli(
        ["parse", "--lang", "pattern"],
        "/workspace/project",
        true,
        "X | Y",
      );

      assertEquals(result.exitCode, CliExitCode.Ok);
      const ast = JSON.parse(result.stdout ?? "{}") as {
        kind: string;
      };
      assertEquals(ast.kind, "or");
    },
  );

  await t.step(
    "executes an explicit raw expression AST from stdin",
    async () => {
      const ast = {
        kind: "invocation",
        expression: { kind: "reference", name: "echo" },
        args: [{ kind: "string", values: ["hello"] }],
      };
      const result = await runCli(
        ["exec", "--ast"],
        "/workspace/project",
        true,
        JSON.stringify(ast),
      );

      assertEquals(result.exitCode, CliExitCode.Ok);
      assertEquals(result.stdout, "hello\n");
      assertEquals(result.stderr, undefined);
    },
  );

  await t.step("executes direct expression source", async () => {
    const result = await runCli(
      ["exec", "-e", '(echo "hello")'],
      "/workspace/project",
      false,
    );

    assertEquals(result.exitCode, CliExitCode.Ok);
    assertEquals(result.stdout, "hello\n");
  });

  await t.step("matches direct pattern source against input", async () => {
    const result = await runCli(
      ["match", "-e", "any", "--input", "hello"],
      "/workspace/project",
      false,
    );

    assertEquals(result.exitCode, CliExitCode.Ok);
    assertEquals(result.stdout, "h\n");
  });

  await t.step(
    "emits string match results as JSON when requested",
    async () => {
      const result = await runCli(
        ["match", "-e", "any", "--input", "hello", "--json"],
        "/workspace/project",
        false,
      );

      assertEquals(result.exitCode, CliExitCode.Ok);
      assertEquals(result.stdout, '"h"\n');
    },
  );

  await t.step("matches a JSON value from --input-json", async () => {
    const result = await runCli(
      ["match", "-e", "number", "--input-json", "42"],
      "/workspace/project",
      false,
    );

    assertEquals(result.exitCode, CliExitCode.Ok);
    assertEquals(result.stdout, "42\n");
  });

  await t.step("renders match failures for people by default", async () => {
    const result = await runCli(
      [
        "match",
        "-e",
        "object { hello: boolean }",
        "--input-json",
        '{"hello":true}',
      ],
      "/workspace/project",
      false,
    );

    assertEquals(result.exitCode, CliExitCode.Usage);
    assertEquals(
      result.stderr,
      "Match failure: Pattern 'over' did not match input at [1]\n" +
        "Input [1]: end of input.\n" +
        "1 | object { hello: boolean }\n" +
        "  |        ^\n",
    );
  });

  await t.step("reports match failure source line numbers", async () => {
    const result = await runCli(
      [
        "match",
        "-e",
        "object\n{ hello: boolean }",
        "--input-json",
        '{"hello":true}',
      ],
      "/workspace/project",
      false,
    );

    assertEquals(result.exitCode, CliExitCode.Usage);
    assertEquals(
      result.stderr,
      "Match failure: Pattern 'over' did not match input at [1]\n" +
        "Input [1]: end of input.\n" +
        "2 | { hello: boolean }\n" +
        "  | ^\n",
    );
  });

  await t.step(
    "emits JSON match diagnostics only when --json is supplied",
    async () => {
      const result = await runCli(
        ["match", "-e", "number", "--input-json", "{", "--json"],
        "/workspace/project",
        false,
      );

      assertEquals(result.exitCode, CliExitCode.Usage);
      const diagnostic = JSON.parse(result.stderr ?? "{}") as {
        error: { code: string; phase: string };
      };
      assertEquals(diagnostic.error.code, "CLI_MATCH_INVALID_JSON");
      assertEquals(diagnostic.error.phase, "input");
    },
  );

  await t.step("runs direct Uffda module source", async () => {
    const result = await runCli(
      ["run", "-e", "export Main; rule Main = ok -> 42;"],
      "/workspace/project",
      false,
    );

    assertEquals(result.exitCode, CliExitCode.Ok);
    assertEquals(result.stdout, "42\n");
  });

  await t.step(
    "reports usage when compile mode has no input paths",
    async () => {
      const result = await runCli(["compile"], "/workspace/project", false);
      assertEquals(result.exitCode, CliExitCode.Usage);
      assert(
        result.stderr?.includes("requires at least one file or folder path"),
      );
    },
  );

  await t.step(
    "runs the workbench when invoked with no arguments",
    async () => {
      const result = await runCli(
        [],
        "/workspace/project",
        false,
        '{"action":"start"}\n{"action":"end"}\n',
      );

      assertEquals(result.exitCode, CliExitCode.Ok);
      const responses = (result.stdout ?? "").trim().split("\n").map((line) =>
        JSON.parse(line)
      ) as Array<{ event: string }>;
      assertEquals(responses.map((response) => response.event), [
        "started",
        "ended",
      ]);
    },
  );

  await t.step("runs the workbench command protocol", async () => {
    const result = await runCli(
      ["workbench"],
      "/workspace/project",
      false,
      '{"action":"start","language":"pattern","source":"any"}\n' +
        '{"action":"end"}\n',
    );

    assertEquals(result.exitCode, CliExitCode.Ok);
    const responses = (result.stdout ?? "").trim().split("\n").map((line) =>
      JSON.parse(line)
    ) as Array<{ event: string }>;
    assertEquals(responses.map((response) => response.event), [
      "started",
      "ended",
    ]);
  });

  await t.step(
    "displays the ascii art banner when workbench runs",
    async () => {
      const result = await runCli(
        ["workbench"],
        "/workspace/project",
        false,
        '{"action":"start"}\n{"action":"end"}\n',
      );

      assertEquals(result.exitCode, CliExitCode.Ok);
      assertEquals(result.stderr, `${workbenchBanner()}\n`);
    },
  );

  await t.step({
    name: "parses and executes source files",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-input-" });
      const expressionFile = join(root, "hello.expr");
      const patternFile = join(root, "any.pattern");
      await write(expressionFile, '(echo "hello")');
      await write(patternFile, "any");

      const parsed = await runCli(
        ["parse", "--lang", "expression", "hello.expr"],
        root,
        false,
      );
      assertEquals(parsed.exitCode, CliExitCode.Ok);
      assertEquals(
        (JSON.parse(parsed.stdout ?? "{}") as { kind: string }).kind,
        "invocation",
      );

      const executed = await runCli(["exec", "hello.expr"], root, false);
      assertEquals(executed.exitCode, CliExitCode.Ok);
      assertEquals(executed.stdout, "hello\n");

      const matched = await runCli(
        ["match", "any.pattern", "--input", "hello"],
        root,
        false,
      );
      assertEquals(matched.exitCode, CliExitCode.Ok);
      assertEquals(matched.stdout, "h\n");
    },
  });

  await t.step({
    name: "compiles source paths and emits JSON summary",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      const src = join(root, "src");
      const sourceFile = join(src, "main.uff");
      await write(sourceFile, "export Main; rule Main = any;");

      const result = await runCli(["compile", "main.uff"], src, false);
      assertEquals(result.exitCode, CliExitCode.Ok);
      assert(result.stdout != null);

      const summary = JSON.parse(result.stdout ?? "{}") as {
        ok: boolean;
        successes: Array<{ sourcePath: string; outputPath: string }>;
      };
      assertEquals(summary.ok, true);
      assertEquals(summary.successes.length, 1);
      assertEquals(summary.successes[0].sourcePath, "main.uff");

      const artifact = join(src, ".uffda", "ast", "main.uffda.ast.json");
      const exists = await Deno.stat(artifact).then(() => true, () => false);
      assertEquals(exists, true);
    },
  });

  await t.step({
    name: "compiles into custom output root via --out-dir",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({
        prefix: "uffda-cli-main-out-dir-",
      });
      const src = join(root, "src");
      const sourceFile = join(src, "nested", "main.uff");
      await write(sourceFile, "export Main; rule Main = any;");

      const result = await runCli(
        ["compile", "nested/main.uff", "--out-dir", "build"],
        src,
        false,
      );
      assertEquals(result.exitCode, CliExitCode.Ok);

      const artifact = join(
        src,
        "build",
        "ast",
        "nested",
        "main.uffda.ast.json",
      );
      const exists = await Deno.stat(artifact).then(() => true, () => false);
      assertEquals(exists, true);
    },
  });
});
