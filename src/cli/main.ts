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
import { executeCliExpression, executeCliModule, parseCliAst } from "./exec.ts";
import {
  isCliMatchFailure,
  matchCliPattern,
  parseCliMatchInput,
} from "./match.ts";
import { parseSourceToAst } from "./stream.ts";
import { runWorkbenchProtocol } from "./workbench.ts";

export type CliRunResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

type HelpTarget =
  | "root"
  | "compile"
  | "exec"
  | "match"
  | "parse"
  | "run"
  | "workbench";

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
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
  if (flag === "--interactive") return "workbench";
  return undefined;
}

function modeValueToCommand(mode: string): HelpTarget | undefined {
  if (mode === "compile") return "compile";
  if (mode === "exec") return "exec";
  if (mode === "match") return "match";
  if (mode === "parse") return "parse";
  if (mode === "run") return "run";
  if (mode === "interactive") return "workbench";
  return undefined;
}

function resolveHelpTarget(argv: string[]): HelpTarget {
  let target: HelpTarget | undefined;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (
      token === "compile" || token === "exec" || token === "match" ||
      token === "parse" || token === "run" || token === "workbench"
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
    "  match       Match one pattern source unit or pattern AST against input.",
    "  parse       Parse one selected-language source unit to an AST.",
    "  run         Run one Uffda module source unit or module AST.",
    "  workbench   Run an interactive JSON-lines workbench session.",
    "",
    "Global options:",
    "  --help, -h             Show usage for the current command or command root.",
    "  --lang <value>         uffda | pattern | expression",
    "  --mode <value>         compile | exec | match | parse | run | interactive",
    "",
    "Examples:",
    "  uffda compile ./src",
    "  uffda compile --lang pattern ./grammar.uff",
    "  uffda parse --lang expression ./hello.expr | uffda exec --ast",
    "  uffda exec -e '(echo \"hello\")'",
    "  uffda match ./word.pattern --input hello",
    "  uffda match -e 'number' --input-json 42 --json",
    "  uffda run ./app.uff --entry Main",
    "  uffda workbench",
    "",
  ].join("\n");
}

function compileUsageText(): string {
  return [
    "Usage: uffda compile [options] <file-or-folder> [...more paths]",
    "",
    "Compile options:",
    "  --help, -h       Show compile command usage.",
    "  --lang <value>   uffda | pattern | expression",
    "  --out-dir <path> Output root directory (replaces .uffda).",
    "",
    "Output:",
    "  Writes artifacts under <out-dir>/ast (default: .uffda/ast).",
    "",
    "Examples:",
    "  uffda compile ./file.uff",
    "  uffda compile ./src",
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

function workbenchUsageText(): string {
  return [
    "Usage: uffda workbench < commands.jsonl",
    "",
    "Protocol:",
    "  Reads one JSON command per line and emits one JSON response per line.",
    '  Start with {"action":"start","language":"pattern","source":"any"}.',
    "  Actions: status, set-source, set-language, compile, open, save,",
    "  export-ast, and end.",
    "",
  ].join("\n");
}

function usageText(target: HelpTarget): string {
  switch (target) {
    case "compile":
      return compileUsageText();
    case "exec":
      return execUsageText();
    case "match":
      return matchUsageText();
    case "parse":
      return parseUsageText();
    case "run":
      return runUsageText();
    case "workbench":
      return workbenchUsageText();
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
  sourcePath: string;
};

async function readCommandInput(
  contract: CliProcessContract,
  stdinSource: string,
): Promise<CommandInput> {
  if (contract.inlineSource !== undefined) {
    return { source: contract.inlineSource, sourcePath: "<eval>" };
  }

  const inputPath = contract.inputPaths[0];
  if (inputPath === undefined || inputPath === "-") {
    return { source: stdinSource, sourcePath: "<stdin>" };
  }

  const sourcePath = resolve(contract.cwd, inputPath);
  return { source: await Deno.readTextFile(sourcePath), sourcePath };
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
  | { ok: true; ast: unknown; source: string }
  | { ok: false; result: CliRunResult }
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
    return parsed.ok ? { ok: true, ast: parsed.ast, source: input.source } : {
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
  return parsed.ok ? { ok: true, ast: parsed.ast, source: input.source } : {
    ok: false,
    result: {
      exitCode: CliExitCode.Usage,
      stderr: toJson({ ok: false, error: parsed.error }),
    },
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
  error: import("./match.ts").CliMatchFailure,
  jsonOutput: boolean,
): CliRunResult {
  if (jsonOutput) {
    return {
      exitCode: CliExitCode.Usage,
      stderr: toJson({ ok: false, error }),
    };
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
  return { exitCode: CliExitCode.Usage, stderr: `${lines.join("\n")}\n` };
}

export function shouldReadStdin(
  resolution: ReturnType<typeof resolveCliProcessContract>,
): boolean {
  if (!resolution.ok || resolution.contract.mode === CliMode.Compile) {
    return false;
  }

  const { inlineSource, inputPaths } = resolution.contract;
  return inlineSource === undefined &&
    (inputPaths.length === 0 || inputPaths[0] === "-");
}

export async function runCli(
  argv: string[],
  processCwd: string,
  stdinAttached = false,
  stdinSource = "",
): Promise<CliRunResult> {
  if (hasHelpFlag(argv)) {
    return {
      exitCode: CliExitCode.Ok,
      stdout: usageText(resolveHelpTarget(argv)),
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

    const result = await executeCliExpression(parsed.ast);
    if (!result.ok) {
      return {
        exitCode: CliExitCode.Usage,
        stderr: toJson({ ok: false, error: result.error }),
      };
    }

    return operationResult(result.value, contract.jsonOutput);
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
        return matchFailureResult(error, contract.jsonOutput);
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
    if (!result.ok) {
      return matchFailureResult(result.error, contract.jsonOutput);
    }
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
    return parsed.result;
  }

  if (contract.mode === CliMode.Run) {
    const parsed = await readOperationAst(
      contract,
      stdinSource,
      CliLanguage.FullUffda,
    );
    if (!parsed.ok) return parsed.result;

    const result = await executeCliModule(parsed.ast, contract.entryRuleName);
    if (result.ok) return operationResult(result.value, contract.jsonOutput);
    return {
      exitCode: CliExitCode.Usage,
      stderr: toJson({ ok: false, error: result.error }),
    };
  }

  if (contract.mode === CliMode.Interactive) {
    return {
      exitCode: CliExitCode.Ok,
      stdout: await runWorkbenchProtocol(stdinSource, contract.cwd),
    };
  }

  if (contract.mode !== CliMode.Compile) {
    return usageError(
      `Mode '${contract.mode}' is not wired yet. Compile mode is currently supported.`,
    );
  }

  if (contract.inputPaths.length === 0) {
    return usageError(
      "Compile mode requires at least one file or folder path.",
    );
  }

  const result = await compileSourcesToAstArtifacts({
    cwd: contract.cwd,
    sourcePaths: contract.inputPaths,
    outputDir: resolve(contract.outputRootDir, "ast"),
  });

  return {
    exitCode: result.ok ? CliExitCode.Ok : CliExitCode.Usage,
    stdout: toJson(result),
  };
}

if (import.meta.main) {
  const processCwd = resolveProcessCwd();
  const stdinAttached = !Deno.stdin.isTerminal();
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
  if (result.stdout) {
    Deno.stdout.writeSync(new TextEncoder().encode(result.stdout));
  }
  if (result.stderr) {
    Deno.stderr.writeSync(new TextEncoder().encode(result.stderr));
  }
  Deno.exit(result.exitCode);
}
