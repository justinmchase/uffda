import { assert, assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import { CliExitCode } from "./contract.ts";
import { resolveProcessCwd, runCli, shouldReadStdin } from "./main.ts";
import { resolveCliProcessContract } from "./contract.ts";

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

    const fmtAll = resolveCliProcessContract({
      argv: ["fmt"],
      processCwd: "/workspace/project",
    });
    assertEquals(shouldReadStdin(fmtAll), false);

    const fmtStdin = resolveCliProcessContract({
      argv: ["fmt", "-"],
      processCwd: "/workspace/project",
    });
    assertEquals(shouldReadStdin(fmtStdin), true);
  });

  await t.step("prints root help when --help is requested", async () => {
    const result = await runCli(["--help"], "/workspace/project", false);
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(
      result.stdout?.includes("Usage: uffda <command> [options] [paths...]"),
    );
    assert(result.stdout?.includes("Commands:"));
  });

  await t.step("prints root help when invoked with no arguments", async () => {
    const result = await runCli([], "/workspace/project", false);
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(
      result.stdout?.includes("Usage: uffda <command> [options] [paths...]"),
    );
    assert(result.stdout?.includes("Commands:"));
  });

  await t.step("prints version when --version is requested", async () => {
    const result = await runCli(["--version"], "/workspace/project", false);
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert((result.stdout?.trim().length ?? 0) > 0);
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
        "Usage: uffda compile [options] <file-or-glob>",
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

  await t.step("prints command help for mcp context", async () => {
    const result = await runCli(
      ["mcp", "--help"],
      "/workspace/project",
      false,
    );
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(result.stdout?.includes("Usage: uffda mcp"));
  });

  await t.step("prints command help for lsp context", async () => {
    const result = await runCli(
      ["lsp", "--help"],
      "/workspace/project",
      false,
    );
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(result.stdout?.includes("Usage: uffda lsp"));
    assert(result.stdout?.includes("uffda.jsonc"));
  });

  await t.step("root usage text mentions both mcp and lsp", async () => {
    const result = await runCli([], "/workspace/project", false);
    assertEquals(result.exitCode, CliExitCode.Ok);
    assert(result.stdout?.includes("uffda mcp"));
    assert(result.stdout?.includes("uffda lsp"));
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
    assertEquals(JSON.parse(result.stdout ?? "{}"), {
      kind: "module",
      declarations: [{ kind: "export", name: "Main" }],
    });
    const diagnostic = JSON.parse(result.stderr ?? "{}") as {
      ok: boolean;
      error: { code: string; phase: string; sourcePath: string };
    };
    assertEquals(diagnostic.ok, false);
    assertEquals(diagnostic.error.code, "CLI_STREAM_PARSE_RECOVERED");
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
        result.stderr?.includes(
          "requires at least one file path or glob pattern",
        ),
      );
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

      const artifact = join(src, "bin", "ast", "main.uffda.ast.json");
      const exists = await Deno.stat(artifact).then(() => true, () => false);
      assertEquals(exists, true);
    },
  });

  await t.step({
    name: "compiles into the project file's outDir, mirroring the project",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({
        prefix: "uffda-cli-main-out-dir-",
      });
      await write(join(root, "uffda.jsonc"), '{ "outDir": "./build" }');
      const src = join(root, "src");
      const sourceFile = join(src, "nested", "main.uff");
      await write(sourceFile, "export Main; rule Main = any;");

      const result = await runCli(["compile", "nested/main.uff"], src, false);
      assertEquals(result.exitCode, CliExitCode.Ok);

      const artifact = join(
        root,
        "build",
        "ast",
        "src",
        "nested",
        "main.uffda.ast.json",
      );
      const exists = await Deno.stat(artifact).then(() => true, () => false);
      assertEquals(exists, true);
    },
  });

  await t.step({
    name: "accepts --out-dir only when it names the project's outDir",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      await write(join(root, "main.uff"), "export Main; rule Main = any;");

      const same = await runCli(
        ["compile", "main.uff", "--out-dir", "./bin"],
        root,
        false,
      );
      assertEquals(same.exitCode, CliExitCode.Ok, same.stdout);
      assert(
        await Deno.stat(join(root, "bin", "ast", "main.uffda.ast.json")).then(
          () => true,
          () => false,
        ),
      );

      const other = await runCli(
        ["compile", "main.uff", "--out-dir", "build"],
        root,
        false,
      );
      assertEquals(other.exitCode, CliExitCode.Usage);
      assert(other.stderr?.includes("in uffda.jsonc instead"), other.stderr);
      assertEquals(
        await Deno.stat(join(root, "build")).then(() => true, () => false),
        false,
      );
    },
  });

  await t.step({
    name: "fails for a source outside the project root",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      await write(join(root, "app", "uffda.jsonc"), "{}");
      await write(join(root, "other.uff"), "export Main; rule Main = any;");

      const result = await runCli(
        ["compile", "../other.uff"],
        join(root, "app"),
        false,
      );
      assertEquals(result.exitCode, CliExitCode.Usage);
      assert(result.stdout?.includes("CLI_COMPILE_SOURCE_OUTSIDE_ROOT"));
    },
  });
});

Deno.test("cli.main compile resolves module names through the project file", async (t) => {
  const source = 'import "@acme/kv/tokens" T;\n\nrule Main = T;\n';
  const project = '{ "imports": { "@acme/kv": "jsr:@acme/kv@^1.2.0" } }';
  const artifactImports = async (root: string) =>
    (JSON.parse(
      await Deno.readTextFile(
        join(root, "bin", "ast", "src", "main.uffda.ast.json"),
      ),
    ) as { imports: { moduleUrl: string }[] }).imports.map(({ moduleUrl }) =>
      moduleUrl
    );

  await t.step({
    name: "uses the nearest uffda.jsonc at or above cwd",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      await write(join(root, "uffda.jsonc"), project);
      await write(join(root, "src", "main.uff"), source);
      const result = await runCli(
        ["compile", "main.uff"],
        join(root, "src"),
        false,
      );
      assertEquals(result.exitCode, CliExitCode.Ok, result.stdout);
      assertEquals(await artifactImports(root), [
        "jsr:@acme/kv@^1.2.0/tokens",
      ]);
    },
  });

  await t.step({
    name: "uses the project file --config names",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      await write(join(root, "project.jsonc"), project);
      await write(join(root, "src", "main.uff"), source);
      const result = await runCli(
        ["compile", "main.uff", "--config", "../project.jsonc"],
        join(root, "src"),
        false,
      );
      assertEquals(result.exitCode, CliExitCode.Ok, result.stdout);
      assertEquals(await artifactImports(root), [
        "jsr:@acme/kv@^1.2.0/tokens",
      ]);
    },
  });

  await t.step({
    name: "fails on an undeclared module name without a project",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      await write(join(root, "src", "main.uff"), source);
      const result = await runCli(
        ["compile", "main.uff"],
        join(root, "src"),
        false,
      );
      assertEquals(result.exitCode, CliExitCode.Usage);
      assert(result.stdout?.includes("CLI_COMPILE_UNDECLARED_MODULE_NAME"));
    },
  });

  await t.step({
    name: "an invalid project file is a configuration failure",
    ignore: writePermission.state !== "granted",
    fn: async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-main-" });
      await write(join(root, "uffda.jsonc"), '{ "imports": { "kv": 1 } }');
      await write(join(root, "src", "main.uff"), source);
      const result = await runCli(
        ["compile", "main.uff"],
        join(root, "src"),
        false,
      );
      assertEquals(result.exitCode, CliExitCode.Config);
      assert(result.stderr?.includes("uffda.jsonc"), result.stderr);
    },
  });
});

Deno.test("cli.main runCli reports recoveries", async (t) => {
  const recovering = `(ope "a" sneak by any)* end`;

  await t.step(
    "match prints the recovered value, lists recoveries, and exits non-zero",
    async () => {
      const result = await runCli(
        ["match", "-e", recovering, "--input", "axa"],
        Deno.cwd(),
      );
      assertEquals(result.exitCode, CliExitCode.Usage);
      assertEquals(JSON.parse(result.stdout!), [["a", "x", "a"], null]);
      assertEquals(
        result.stderr,
        'Match recovered at input 1..2: Expected "a"\nUnexpected "x"\n',
      );
    },
  );

  await t.step("match --json writes every diagnostic", async () => {
    const result = await runCli(
      ["match", "-e", recovering, "--input", "axay", "--json"],
      Deno.cwd(),
    );
    assertEquals(result.exitCode, CliExitCode.Usage);
    const payload = JSON.parse(result.stderr!);
    assertEquals(payload.ok, false);
    assertEquals(
      payload.diagnostics.map((d: { inputSpan: unknown }) => d.inputSpan),
      [{ start: 1, end: 2 }, { start: 3, end: 4 }],
    );
    assertEquals(payload.error, payload.diagnostics[0]);
  });

  await t.step("a clean match still exits zero", async () => {
    const result = await runCli(
      ["match", "-e", recovering, "--input", "aa"],
      Deno.cwd(),
    );
    assertEquals(result.exitCode, CliExitCode.Ok);
    assertEquals(result.stderr, undefined);
  });

  await t.step(
    "run prints the recovered value and its diagnostics",
    async () => {
      const result = await runCli(
        [
          "run",
          "-e",
          `export Main; rule Main = (ok -> "axa") |> [(ope "a" sneak by any)* end];`,
        ],
        Deno.cwd(),
      );
      assertEquals(result.exitCode, CliExitCode.Usage);
      assertEquals(JSON.parse(result.stdout!), [["a", "x", "a"], null]);
      const payload = JSON.parse(result.stderr!);
      assertEquals(payload.error.code, "CLI_EXEC_RECOVERED");
      assertEquals(payload.diagnostics, [payload.error]);
    },
  );

  await t.step("a parse failure writes its diagnostics", async () => {
    const result = await runCli(
      ["parse", "--lang", "pattern", "-e", ")"],
      Deno.cwd(),
    );
    assertEquals(result.exitCode, CliExitCode.Usage);
    assertEquals(result.stdout, undefined);
    const payload = JSON.parse(result.stderr!);
    assertEquals(payload.diagnostics, [payload.error]);
  });
});

Deno.test("cli.main runCli routes fmt", async (t) => {
  const cwd = await Deno.makeTempDir();
  const unformatted = `rule   A =   "a"  ;\n`;
  const formatted = `rule A = "a";\n`;
  try {
    await t.step("prints fmt help", async () => {
      const result = await runCli(["fmt", "--help"], cwd);
      assertEquals(result.exitCode, CliExitCode.Ok);
      assert(result.stdout?.includes("Usage: uffda fmt"));
      assert(result.stdout?.includes("uffda.jsonc"));
    });

    await t.step(
      "--check lists unformatted files and exits non-zero",
      async () => {
        await write(join(cwd, "a.uff"), unformatted);
        const result = await runCli(["fmt", "--check", "a.uff"], cwd);
        assertEquals(result.exitCode, CliExitCode.Usage);
        assertEquals(result.stdout, "a.uff\n");
        assertEquals(await Deno.readTextFile(join(cwd, "a.uff")), unformatted);
      },
    );

    await t.step("rewrites and lists changed files", async () => {
      const result = await runCli(["fmt", "a.uff"], cwd);
      assertEquals(result.exitCode, CliExitCode.Ok);
      assertEquals(result.stdout, "a.uff\n");
      assertEquals(await Deno.readTextFile(join(cwd, "a.uff")), formatted);
      const again = await runCli(["fmt", "a.uff"], cwd);
      assertEquals(again, { exitCode: CliExitCode.Ok });
    });

    await t.step("- formats standard input to standard output", async () => {
      const result = await runCli(["fmt", "-"], cwd, true, unformatted);
      assertEquals(result, { exitCode: CliExitCode.Ok, stdout: formatted });
    });

    await t.step("failures are written to stderr with locations", async () => {
      await write(join(cwd, "bad.uff"), "rule = ;\n");
      const result = await runCli(["fmt", "bad.uff", "a.txt"], cwd);
      assertEquals(result.exitCode, CliExitCode.Usage);
      assertEquals(result.stdout, undefined);
      assert(result.stderr?.startsWith("a.txt: "));
      assert(result.stderr?.includes("bad.uff:1:1: "));
    });

    await t.step("--json emits the per-file results", async () => {
      const result = await runCli(["fmt", "--json", "a.uff"], cwd);
      assertEquals(result.exitCode, CliExitCode.Ok);
      assertEquals(JSON.parse(result.stdout!), {
        ok: true,
        check: false,
        files: [{
          sourcePath: "a.uff",
          status: "unchanged",
          language: "uffda",
        }],
      });
    });
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});
