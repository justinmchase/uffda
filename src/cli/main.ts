import type { ArtifactLayout } from "../runtime/resolvers/artifact_path.ts";
import { isAbsolute, resolve } from "@std/path";
import {
  CliContractErrorCode,
  CliExitCode,
  CliLanguage,
  CliMode,
  type CliProcessContract,
  resolveCliProcessContract,
} from "./contract.ts";
import { compileSourcesToAstArtifacts } from "./compile.ts";
import { commandProject } from "./command_project.ts";
import type { ImportMap } from "../runtime/resolvers/import_map.ts";
import {
  type CliModuleOrigin,
  executeCliExpression,
  executeCliModule,
  moduleUrlForCliOrigin,
  parseCliAst,
} from "./exec.ts";
import {
  type CliMatchFailure,
  CliMatchFailureCode,
  isCliMatchFailure,
  matchCliPattern,
  parseCliMatchInput,
} from "./match.ts";
import { parseSourceToAst } from "./stream.ts";
import {
  type CliFormatResult,
  CliFormatStatus,
  type CliFormatStdinResult,
  formatFiles,
  formatStdin,
  LanguageFormatting,
} from "./fmt.ts";
import { runMcpServer } from "./mcp.ts";
import { runLspServer } from "./lsp.ts";
import { version } from "../version.ts";

export type CliRunResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

type HelpTarget =
  | "root"
  | "compile"
  | "exec"
  | "fmt"
  | "match"
  | "parse"
  | "run"
  | "mcp"
  | "lsp";

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function configFailure(message: string): CliRunResult {
  return {
    exitCode: CliExitCode.Config,
    stderr: toJson({
      ok: false,
      error: {
        code: CliContractErrorCode.Config,
        phase: "configuration",
        message,
      },
    }),
  };
}

/**
 * The import map and artifact layout of the project the command uses (see
 * `commandProject`). An invalid project file fails the command.
 */
async function loadContractProject(
  contract: CliProcessContract,
): Promise<
  | { ok: true; imports: ImportMap; artifacts: ArtifactLayout }
  | { ok: false; result: CliRunResult }
> {
  const project = await commandProject(contract.cwd, contract.configPath);
  return project.ok
    ? project
    : { ok: false, result: configFailure(project.message) };
}

function usageError(message: string): CliRunResult {
  return {
    exitCode: CliExitCode.Usage,
    stderr: toJson({
      ok: false,
      error: {
        code: CliContractErrorCode.Usage,
        phase: "validation",
        message,
      },
    }),
  };
}

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function modeFlagToCommand(flag: string): HelpTarget | undefined {
  if (flag === "--compile") return "compile";
  if (flag === "--match") return "match";
  if (flag === "--parse") return "parse";
  if (flag === "--run") return "run";
  return undefined;
}

function modeValueToCommand(mode: string): HelpTarget | undefined {
  if (mode === "compile") return "compile";
  if (mode === "exec") return "exec";
  if (mode === "fmt") return "fmt";
  if (mode === "match") return "match";
  if (mode === "parse") return "parse";
  if (mode === "run") return "run";
  return undefined;
}

function resolveHelpTarget(argv: string[]): HelpTarget {
  let target: HelpTarget | undefined;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (
      token === "compile" || token === "exec" || token === "fmt" ||
      token === "match" || token === "parse" || token === "run" ||
      token === "mcp" || token === "lsp"
    ) {
      target = token;
      continue;
    }

    const modeFlagCommand = modeFlagToCommand(token);
    if (modeFlagCommand) {
      target = modeFlagCommand;
      continue;
    }

    if (token.startsWith("--mode=")) {
      const modeCommand = modeValueToCommand(token.slice("--mode=".length));
      if (modeCommand) target = modeCommand;
      continue;
    }

    if (token === "--mode") {
      const modeCommand = modeValueToCommand(argv[i + 1] ?? "");
      if (modeCommand) target = modeCommand;
      i += 1;
      continue;
    }
  }

  return target ?? "root";
}

function rootUsageText(): string {
  return [
    "Usage: uffda <command> [options] [paths...]",
    "",
    "Commands:",
    "  compile     Compile source files to AST artifacts.",
    "  exec        Execute one expression source unit or expression AST.",
    "  fmt         Format source files with their language's formatter.",
    "  match       Match one pattern source unit or pattern AST against input.",
    "  parse       Parse one selected-language source unit to an AST.",
    "  run         Run one Uffda module source unit or module AST.",
    "  mcp         Start a Model Context Protocol stdio server.",
    "  lsp         Start a Language Server Protocol stdio server.",
    "",
    "Global options:",
    "  --help, -h             Show usage for the current command or command root.",
    "  --version, -V          Print the CLI version and exit.",
    "  --lang <value>         uffda | pattern | expression (parse only)",
    "  --mode <value>         compile | exec | fmt | match | parse | run",
    "  --config <path>        Project file (compile, exec, fmt, run); defaults",
    "                         to the nearest uffda.jsonc at or above the cwd.",
    "",
    "Examples:",
    "  uffda compile 'src/**/*.uff'",
    "  uffda fmt --check",
    "  uffda parse --lang expression ./hello.expr | uffda exec --ast",
    "  uffda exec -e '(echo \"hello\")'",
    "  uffda match ./word.pattern --input hello",
    "  uffda match -e 'number' --input-json 42 --json",
    "  uffda run ./app.uff --entry Main",
    "  uffda mcp",
    "  uffda lsp",
    "",
  ].join("\n");
}

function compileUsageText(): string {
  return [
    "Usage: uffda compile [options] <file-or-glob> [...more paths]",
    "",
    "Compile options:",
    "  --help, -h       Show compile command usage.",
    "  --config <path>  Project file whose imports module names resolve",
    "                   through and whose outDir artifacts are written to",
    "                   (default: the nearest uffda.jsonc).",
    "  --out-dir <path> Deprecated: must name the project's outDir.",
    "",
    "Output:",
    "  Writes ModuleDeclaration JSON under <outDir>/ast, mirroring each source's",
    "  path in the project (outDir defaults to ./bin; without a project, the",
    "  cwd is the project root).",
    "  Each import names a relative path or a full jsr: specifier: module",
    "  names are written out through the project file's imports.",
    "",
    "Examples:",
    "  uffda compile ./file.uff",
    "  uffda compile 'src/**/*.uff'",
    "",
  ].join("\n");
}

function parseUsageText(): string {
  return [
    "Usage: uffda parse [options] [source-path|-]",
    "",
    "Input and output:",
    "  Reads source from a path, stdin, or -e/--eval and emits its raw AST.",
    "  Parse failures emit a diagnostic payload to stderr.",
    "",
  ].join("\n");
}

function execUsageText(): string {
  return [
    "Usage: uffda exec [--ast] [expression-path|-]",
    "",
    "Input and output:",
    "  Executes expression source by default; --ast reads expression AST JSON.",
    "  Use -e/--eval for an inline expression.",
    "  Writes string results as text and other results as JSON.",
    "",
  ].join("\n");
}

function fmtUsageText(): string {
  return [
    "Usage: uffda fmt [--check] [--json] [--config <path>] [file-or-glob|-] [...]",
    "",
    "Formatting:",
    "  Formats files with the [Formatter] their language's entry rule names,",
    "  rewriting them in place and listing the files that changed. A file's",
    "  language is the .uff language or a language of the uffda.jsonc project",
    "  file, by extension. A file that does not parse cleanly is never",
    "  rewritten.",
    "",
    "  With no paths, formats every file under the working directory (except",
    "  .git and node_modules) and skips files whose extension has no language",
    "  or whose language has no formatter. Files matched by a glob are skipped",
    "  the same way. A file named explicitly must have a language with a",
    "  formatter. - formats standard input as .uff and writes standard output.",
    "",
    "Options:",
    "  --check    Write nothing; list files that are not formatted.",
    "  --json     Emit the per-file results as JSON.",
    "  --config   The project file (default: the nearest uffda.jsonc).",
    "",
    "Exits non-zero when a file fails to format, or with --check when a file",
    "is not formatted.",
    "",
  ].join("\n");
}

function matchUsageText(): string {
  return [
    "Usage: uffda match [--ast] [pattern-path|-] --input <text>",
    "       uffda match [--ast] [pattern-path|-] --input-json <json>",
    "       uffda match [--ast] [pattern-path|-] --input-file <path>",
    "",
    "Input and output:",
    "  Matches pattern source by default; --ast reads pattern AST JSON.",
    "  --input-json decodes one JSON match subject; --input remains text.",
    "  --json emits machine-readable output and diagnostics.",
    "  Writes the successful match value as JSON.",
    "",
  ].join("\n");
}

function runUsageText(): string {
  return [
    "Usage: uffda run [--ast] [module-path|-] [--entry <rule>]",
    "",
    "Input and output:",
    "  Runs Uffda module source by default; --ast reads module AST JSON.",
    "  --entry selects an exported rule; the first export is the default.",
    "",
  ].join("\n");
}

function mcpUsageText(): string {
  return [
    "Usage: uffda mcp",
    "",
    "Agent integration:",
    "  Starts a Model Context Protocol (MCP) server over standard input and",
    "  standard output. Standard input/output carry only MCP protocol traffic",
    "  once started; there are no other flags or positional arguments.",
    "",
  ].join("\n");
}

function lspUsageText(): string {
  return [
    "Usage: uffda lsp",
    "",
    "Editor integration:",
    "  Starts a Language Server Protocol (LSP) server over standard input and",
    "  standard output. Standard input/output carry only LSP protocol traffic",
    "  once started; there are no other flags or positional arguments.",
    "  Languages are read from the nearest uffda.jsonc project file at or above",
    "  the workspace; .uff is always available, even without one.",
    "",
  ].join("\n");
}

function usageText(target: HelpTarget): string {
  switch (target) {
    case "compile":
      return compileUsageText();
    case "exec":
      return execUsageText();
    case "fmt":
      return fmtUsageText();
    case "match":
      return matchUsageText();
    case "parse":
      return parseUsageText();
    case "run":
      return runUsageText();
    case "mcp":
      return mcpUsageText();
    case "lsp":
      return lspUsageText();
    case "root":
      return rootUsageText();
  }
}

export function resolveProcessCwd(
  getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
  getCwd: () => string = () => Deno.cwd(),
): string {
  const cwd = getCwd();

  try {
    const initCwd = getEnv("INIT_CWD");
    if (initCwd && initCwd.length > 0) {
      return isAbsolute(initCwd) ? initCwd : resolve(cwd, initCwd);
    }

    const pwd = getEnv("PWD");
    if (pwd && pwd.length > 0) {
      return isAbsolute(pwd) ? pwd : resolve(cwd, pwd);
    }
  } catch {
    // No env permission; fall back to process cwd.
  }

  return cwd;
}

type CommandInput = {
  source: string;
  /** Diagnostic label: absolute file path, `<stdin>`, or `<eval>`. */
  sourcePath: string;
  moduleOrigin: CliModuleOrigin;
};

async function readCommandInput(
  contract: CliProcessContract,
  stdinSource: string,
): Promise<CommandInput> {
  if (contract.inlineSource !== undefined) {
    return {
      source: contract.inlineSource,
      sourcePath: "<eval>",
      moduleOrigin: { kind: "eval" },
    };
  }

  const inputPath = contract.inputPaths[0];
  if (inputPath === undefined || inputPath === "-") {
    return {
      source: stdinSource,
      sourcePath: "<stdin>",
      moduleOrigin: { kind: "stdin" },
    };
  }

  const sourcePath = resolve(contract.cwd, inputPath);
  return {
    source: await Deno.readTextFile(sourcePath),
    sourcePath,
    moduleOrigin: { kind: "file", absolutePath: sourcePath },
  };
}

async function readMatchInput(
  contract: CliProcessContract,
): Promise<unknown | undefined> {
  let source: string | undefined;
  if (contract.matchInput !== undefined) {
    return contract.matchInput;
  } else if (contract.matchInputJson !== undefined) {
    source = contract.matchInputJson;
  } else if (contract.matchInputPath !== undefined) {
    source = await Deno.readTextFile(
      resolve(contract.cwd, contract.matchInputPath),
    );
  }
  if (source === undefined) return undefined;

  const parsed = parseCliMatchInput(source, true);
  if (!parsed.ok) throw parsed.error;
  return parsed.value;
}

async function readOperationAst(
  contract: CliProcessContract,
  stdinSource: string,
  language: CliLanguage,
): Promise<
  | {
    ok: true;
    ast: unknown;
    source: string;
    sourcePath: string;
    moduleOrigin: CliModuleOrigin;
  }
  | {
    ok: false;
    result: CliRunResult;
    /** The AST of a source that parsed only by recovering. */
    ast?: unknown;
  }
> {
  let input: CommandInput;
  try {
    input = await readCommandInput(contract, stdinSource);
  } catch (error) {
    return {
      ok: false,
      result: usageError(
        `Unable to read input: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    };
  }

  if (contract.astInput) {
    const parsed = parseCliAst(input.source);
    return parsed.ok
      ? {
        ok: true,
        ast: parsed.ast,
        source: input.source,
        sourcePath: input.sourcePath,
        moduleOrigin: input.moduleOrigin,
      }
      : {
        ok: false,
        result: {
          exitCode: CliExitCode.Usage,
          stderr: toJson({ ok: false, error: parsed.error }),
        },
      };
  }

  const parsed = await parseSourceToAst(
    input.source,
    language,
    input.sourcePath,
  );
  return parsed.ok
    ? {
      ok: true,
      ast: parsed.ast,
      source: input.source,
      sourcePath: input.sourcePath,
      moduleOrigin: input.moduleOrigin,
    }
    : {
      ok: false,
      result: {
        exitCode: CliExitCode.Usage,
        stderr: toJson({
          ok: false,
          error: parsed.error,
          diagnostics: parsed.diagnostics,
        }),
      },
      ...(parsed.ast !== undefined ? { ast: parsed.ast } : {}),
    };
}

function operationResult(value: unknown, jsonOutput = false): CliRunResult {
  return {
    exitCode: CliExitCode.Ok,
    stdout: jsonOutput
      ? toJson(value)
      : typeof value === "string"
      ? `${value}\n`
      : value === undefined
      ? undefined
      : toJson(value),
  };
}

/**
 * A failed operation's result: its diagnostics payload on STDERR and, when it
 * succeeded only by recovering, its value on STDOUT.
 */
function operationFailure(
  failure: { error: unknown; diagnostics?: unknown[]; value?: unknown },
  jsonOutput: boolean,
): CliRunResult {
  const { error, diagnostics } = failure;
  return {
    exitCode: CliExitCode.Usage,
    ...("value" in failure
      ? { stdout: operationResult(failure.value, jsonOutput).stdout }
      : {}),
    stderr: toJson({
      ok: false,
      error,
      ...(diagnostics ? { diagnostics } : {}),
    }),
  };
}

function sourceExcerpt(source: string, offset: number): string[] {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = source.indexOf("\n", offset);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const lineNumber = source.slice(0, lineStart).split("\n").length;
  const lineLabel = String(lineNumber);
  const gutter = `${lineLabel} | `;

  return [
    `${gutter}${line}`,
    `${" ".repeat(lineLabel.length)} | ${" ".repeat(offset - lineStart)}^`,
  ];
}

function matchFailureResult(
  failure: {
    error: CliMatchFailure;
    diagnostics?: CliMatchFailure[];
    value?: unknown;
  },
  jsonOutput: boolean,
): CliRunResult {
  if (jsonOutput) return operationFailure(failure, jsonOutput);

  const lines = (failure.diagnostics ?? [failure.error]).flatMap(
    matchFailureLines,
  );
  return {
    exitCode: CliExitCode.Usage,
    ...("value" in failure
      ? { stdout: operationResult(failure.value).stdout }
      : {}),
    stderr: `${lines.join("\n")}\n`,
  };
}

function matchFailureLines(error: CliMatchFailure): string[] {
  if (error.code === CliMatchFailureCode.Recovered && error.inputSpan) {
    const { start, end } = error.inputSpan;
    return [`Match recovered at input ${start}..${end}: ${error.message}`];
  }
  const lines = [`Match failure: ${error.message}`];
  if (error.inputPosition && error.inputDescription) {
    lines.push(`Input ${error.inputPosition}: ${error.inputDescription}.`);
  }
  if (
    error.source !== undefined && error.sourceOffset !== undefined &&
    error.sourceOffset >= 0
  ) {
    lines.push(...sourceExcerpt(error.source, error.sourceOffset));
  }
  return lines;
}

function fmtDiagnosticLines(result: CliFormatResult): string[] {
  return result.files.flatMap(({ sourcePath, diagnostics = [] }) =>
    diagnostics.map(({ message, location }) =>
      location
        ? `${sourcePath}:${location.line + 1}:${
          location.column + 1
        }: ${message}`
        : `${sourcePath}: ${message}`
    )
  );
}

async function runFmt(
  contract: CliProcessContract,
  stdinSource: string,
): Promise<CliRunResult> {
  const formatting = await LanguageFormatting.load(
    contract.cwd,
    contract.configPath,
  );
  if ("error" in formatting) return configFailure(formatting.error);

  const stdin = contract.inputPaths[0] === "-";
  const result: CliFormatStdinResult = stdin
    ? await formatStdin({
      formatting,
      source: stdinSource,
      check: contract.check,
    })
    : await formatFiles({
      formatting,
      cwd: contract.cwd,
      sourcePaths: contract.inputPaths,
      check: contract.check,
    });
  const exitCode = result.ok ? CliExitCode.Ok : CliExitCode.Usage;
  if (contract.jsonOutput) return { exitCode, stdout: toJson(result) };

  const diagnostics = fmtDiagnosticLines(result);
  const changed = result.files
    .filter((file) => file.status === CliFormatStatus.Changed)
    .map((file) => file.sourcePath);
  const stdout = stdin && !contract.check
    ? result.text
    : changed.length > 0
    ? `${changed.join("\n")}\n`
    : undefined;
  return {
    exitCode,
    ...(stdout !== undefined ? { stdout } : {}),
    ...(diagnostics.length > 0
      ? { stderr: `${diagnostics.join("\n")}\n` }
      : {}),
  };
}

export function shouldReadStdin(
  resolution: ReturnType<typeof resolveCliProcessContract>,
): boolean {
  if (!resolution.ok || resolution.contract.mode === CliMode.Compile) {
    return false;
  }

  const { inlineSource, inputPaths } = resolution.contract;
  if (resolution.contract.mode === CliMode.Fmt) return inputPaths[0] === "-";
  return inlineSource === undefined &&
    (inputPaths.length === 0 || inputPaths[0] === "-");
}

function hasVersionFlag(argv: string[]): boolean {
  return argv.includes("--version") || argv.includes("-V");
}

/**
 * `mcp` is dispatched entirely outside `runCli`/`resolveCliProcessContract`:
 * unlike every other command, it is a live, indefinitely-running stdio server
 * rather than a one-shot argv-in/CliRunResult-out invocation, so it cannot be
 * expressed as a `CliMode` (see
 * `.agents/specifications/languages/cli/mcp-server.spec.md`).
 */
function hasMcpCommand(argv: string[]): boolean {
  for (const token of argv) {
    if (token.startsWith("-")) continue;
    return token === "mcp";
  }
  return false;
}

/**
 * `lsp` mirrors `mcp`'s dispatch: a live, indefinitely-running stdio server,
 * not a one-shot `CliMode` (see
 * `.agents/specifications/languages/cli/language-server.spec.md`).
 */
function hasLspCommand(argv: string[]): boolean {
  for (const token of argv) {
    if (token.startsWith("-")) continue;
    return token === "lsp";
  }
  return false;
}

export async function runCli(
  argv: string[],
  processCwd: string,
  stdinAttached = false,
  stdinSource = "",
): Promise<CliRunResult> {
  if (argv.length === 0) {
    return {
      exitCode: CliExitCode.Ok,
      stdout: usageText("root"),
    };
  }

  if (hasHelpFlag(argv)) {
    return {
      exitCode: CliExitCode.Ok,
      stdout: usageText(resolveHelpTarget(argv)),
    };
  }

  if (hasVersionFlag(argv)) {
    return {
      exitCode: CliExitCode.Ok,
      stdout: `${version}\n`,
    };
  }

  const resolution = resolveCliProcessContract({
    argv,
    processCwd,
    stdinAttached,
  });

  if (!resolution.ok) {
    return {
      exitCode: resolution.exitCode,
      stderr: toJson({
        ok: false,
        error: resolution.error,
      }),
    };
  }

  const contract = resolution.contract;
  if (contract.mode === CliMode.Exec) {
    const parsed = await readOperationAst(
      contract,
      stdinSource,
      CliLanguage.Expression,
    );
    if (!parsed.ok) return parsed.result;
    const project = await loadContractProject(contract);
    if (!project.ok) return project.result;

    const result = await executeCliExpression(parsed.ast, {
      artifacts: project.artifacts,
      imports: project.imports,
      moduleUrl: moduleUrlForCliOrigin(contract.cwd, parsed.moduleOrigin),
    });
    if (!result.ok) return operationFailure(result, contract.jsonOutput);

    return operationResult(result.value, contract.jsonOutput);
  }

  if (contract.mode === CliMode.Fmt) {
    return await runFmt(contract, stdinSource);
  }

  if (contract.mode === CliMode.Match) {
    const parsed = await readOperationAst(
      contract,
      stdinSource,
      CliLanguage.Pattern,
    );
    if (!parsed.ok) return parsed.result;

    let input: unknown | undefined;
    try {
      input = await readMatchInput(contract);
    } catch (error) {
      if (isCliMatchFailure(error)) {
        return matchFailureResult({ error }, contract.jsonOutput);
      }
      return usageError(
        `Unable to read match input: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (input === undefined) {
      return usageError("match requires --input or --input-file");
    }

    const result = await matchCliPattern(
      parsed.ast,
      input,
      contract.matchInputJson !== undefined,
      contract.astInput ? undefined : parsed.source,
    );
    if (!result.ok) return matchFailureResult(result, contract.jsonOutput);
    return operationResult(result.value, contract.jsonOutput);
  }

  if (contract.mode === CliMode.Parse) {
    const parsed = await readOperationAst(
      contract,
      stdinSource,
      contract.language,
    );
    if (parsed.ok) {
      return { exitCode: CliExitCode.Ok, stdout: toJson(parsed.ast) };
    }
    return parsed.ast === undefined
      ? parsed.result
      : { ...parsed.result, stdout: toJson(parsed.ast) };
  }

  if (contract.mode === CliMode.Run) {
    const parsed = await readOperationAst(
      contract,
      stdinSource,
      CliLanguage.FullUffda,
    );
    if (!parsed.ok) return parsed.result;
    const project = await loadContractProject(contract);
    if (!project.ok) return project.result;

    const result = await executeCliModule(parsed.ast, contract.entryRuleName, {
      artifacts: project.artifacts,
      imports: project.imports,
      moduleUrl: moduleUrlForCliOrigin(contract.cwd, parsed.moduleOrigin),
    });
    if (result.ok) return operationResult(result.value, contract.jsonOutput);
    return operationFailure(result, contract.jsonOutput);
  }

  if (contract.mode !== CliMode.Compile) {
    return usageError(
      `Mode '${contract.mode}' is not wired yet. Compile mode is currently supported.`,
    );
  }

  if (contract.inputPaths.length === 0) {
    return usageError(
      "Compile mode requires at least one file path or glob pattern.",
    );
  }

  const project = await loadContractProject(contract);
  if (!project.ok) return project.result;
  if (
    contract.outDirPath !== undefined &&
    contract.outDirPath !== project.artifacts.outDir
  ) {
    return usageError(
      `--out-dir ${contract.outDirPath} is not the project's outDir ` +
        `(${project.artifacts.outDir}); set "outDir" in uffda.jsonc instead`,
    );
  }

  const result = await compileSourcesToAstArtifacts({
    cwd: contract.cwd,
    sourcePaths: contract.inputPaths,
    artifacts: project.artifacts,
    imports: project.imports,
  });

  return {
    exitCode: result.ok ? CliExitCode.Ok : CliExitCode.Usage,
    stdout: toJson(result),
  };
}

if (import.meta.main) {
  const processCwd = resolveProcessCwd();
  const stdinAttached = !Deno.stdin.isTerminal();

  if (!hasHelpFlag(Deno.args) && hasMcpCommand(Deno.args)) {
    await runMcpServer();
    Deno.exit(CliExitCode.Ok);
  }

  if (!hasHelpFlag(Deno.args) && hasLspCommand(Deno.args)) {
    await runLspServer();
    Deno.exit(CliExitCode.Ok);
  }

  const resolution = resolveCliProcessContract({
    argv: Deno.args,
    processCwd,
    stdinAttached,
  });

  const result = await runCli(
    Deno.args,
    processCwd,
    stdinAttached,
    shouldReadStdin(resolution)
      ? await new Response(Deno.stdin.readable).text()
      : "",
  );
  if (result.stderr) {
    Deno.stderr.writeSync(new TextEncoder().encode(result.stderr));
  }
  if (result.stdout) {
    Deno.stdout.writeSync(new TextEncoder().encode(result.stdout));
  }
  Deno.exit(result.exitCode);
}
