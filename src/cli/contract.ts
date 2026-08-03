import { isAbsolute, resolve } from "@std/path";

export enum CliMode {
  Compile = "compile",
  Exec = "exec",
  Match = "match",
  Parse = "parse",
  Run = "run",
  Interactive = "interactive",
}

export enum CliLanguage {
  FullUffda = "uffda",
  Pattern = "pattern",
  Expression = "expression",
}

export enum CliExitCode {
  Ok = 0,
  Usage = 2,
  Config = 3,
  Internal = 70,
}

export enum CliContractErrorCode {
  Usage = "CLI_USAGE",
  Config = "CLI_CONFIG",
}

export type CliContractError = {
  code: CliContractErrorCode;
  message: string;
  phase: "parse" | "validation" | "configuration";
};

export type CliProcessInput = {
  argv: string[];
  processCwd: string;
  stdinAttached?: boolean;
};

export type CliProcessContract = {
  command: "compile" | "exec" | "match" | "parse" | "run" | "workbench";
  mode: CliMode;
  language: CliLanguage;
  inputPaths: string[];
  astInput: boolean;
  inlineSource?: string;
  matchInput?: string;
  matchInputJson?: string;
  matchInputPath?: string;
  jsonOutput: boolean;
  entryRuleName?: string;
  cwd: string;
  outputRootDir: string;
  stdinAttached: boolean;
};

export type CliProcessResolution =
  | {
    ok: true;
    exitCode: CliExitCode.Ok;
    contract: CliProcessContract;
  }
  | {
    ok: false;
    exitCode: Exclude<CliExitCode, CliExitCode.Ok>;
    error: CliContractError;
  };

type ParsedArgs = {
  commandToken?: "compile" | "exec" | "match" | "parse" | "run" | "workbench";
  modeFromLong?: CliMode;
  modeFlagOrder: CliMode[];
  language: CliLanguage;
  languageSpecified: boolean;
  astInput: boolean;
  inlineSource?: string;
  matchInput?: string;
  matchInputJson?: string;
  matchInputPath?: string;
  jsonOutput: boolean;
  entryRuleName?: string;
  outDirOpt?: string;
  inputPaths: string[];
};

type ParsedArgsError = {
  code: CliContractErrorCode.Usage;
  message: string;
  phase: "parse";
};

function usage(
  message: string,
  phase: CliContractError["phase"],
): CliProcessResolution {
  return {
    ok: false,
    exitCode: CliExitCode.Usage,
    error: {
      code: CliContractErrorCode.Usage,
      message,
      phase,
    },
  };
}

function config(message: string): CliProcessResolution {
  return {
    ok: false,
    exitCode: CliExitCode.Config,
    error: {
      code: CliContractErrorCode.Config,
      message,
      phase: "configuration",
    },
  };
}

function toCliMode(value: string): CliMode | undefined {
  switch (value) {
    case CliMode.Compile:
      return CliMode.Compile;
    case CliMode.Exec:
      return CliMode.Exec;
    case CliMode.Match:
      return CliMode.Match;
    case CliMode.Parse:
      return CliMode.Parse;
    case CliMode.Run:
      return CliMode.Run;
    case CliMode.Interactive:
      return CliMode.Interactive;
    default:
      return undefined;
  }
}

function toCliLanguage(value: string): CliLanguage | undefined {
  switch (value) {
    case CliLanguage.FullUffda:
      return CliLanguage.FullUffda;
    case CliLanguage.Pattern:
      return CliLanguage.Pattern;
    case CliLanguage.Expression:
      return CliLanguage.Expression;
    default:
      return undefined;
  }
}

function commandFromMode(
  mode: CliMode,
): "compile" | "exec" | "match" | "parse" | "run" | "workbench" {
  switch (mode) {
    case CliMode.Compile:
      return "compile";
    case CliMode.Exec:
      return "exec";
    case CliMode.Match:
      return "match";
    case CliMode.Parse:
      return "parse";
    case CliMode.Run:
      return "run";
    case CliMode.Interactive:
      return "workbench";
  }
}

function modeFromCommand(
  command: "compile" | "exec" | "match" | "parse" | "run" | "workbench",
): CliMode {
  switch (command) {
    case "compile":
      return CliMode.Compile;
    case "exec":
      return CliMode.Exec;
    case "match":
      return CliMode.Match;
    case "parse":
      return CliMode.Parse;
    case "run":
      return CliMode.Run;
    case "workbench":
      return CliMode.Interactive;
  }
}

function valueAfter(
  argv: string[],
  index: number,
): [string | undefined, number] {
  return [argv[index + 1], index + 1];
}

function parseUsage(message: string): ParsedArgsError {
  return {
    code: CliContractErrorCode.Usage,
    message,
    phase: "parse",
  };
}

function parseArgs(argv: string[]): ParsedArgs | ParsedArgsError {
  const parsed: ParsedArgs = {
    modeFlagOrder: [],
    language: CliLanguage.FullUffda,
    languageSpecified: false,
    astInput: false,
    jsonOutput: false,
    inputPaths: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "-") {
      parsed.inputPaths.push(token);
      continue;
    }

    if (!token.startsWith("-")) {
      if (
        !parsed.commandToken &&
        (
          token === "compile" || token === "exec" || token === "match" ||
          token === "parse" || token === "run" || token === "workbench"
        )
      ) {
        parsed.commandToken = token;
      } else {
        parsed.inputPaths.push(token);
      }
      continue;
    }

    if (token === "--compile") {
      parsed.modeFlagOrder.push(CliMode.Compile);
      continue;
    }
    if (token === "--parse") {
      parsed.modeFlagOrder.push(CliMode.Parse);
      continue;
    }
    if (token === "--match") {
      parsed.modeFlagOrder.push(CliMode.Match);
      continue;
    }
    if (token === "--run") {
      parsed.modeFlagOrder.push(CliMode.Run);
      continue;
    }
    if (token === "--interactive") {
      parsed.modeFlagOrder.push(CliMode.Interactive);
      continue;
    }
    if (token === "--help" || token === "-h") {
      continue;
    }

    if (token.startsWith("--mode=")) {
      const mode = toCliMode(token.slice("--mode=".length));
      if (!mode) {
        return parseUsage(
          `Unknown --mode value: ${token.slice("--mode=".length)}`,
        );
      }
      parsed.modeFromLong = mode;
      continue;
    }
    if (token === "--mode") {
      const [value, next] = valueAfter(argv, i);
      if (!value) return parseUsage("Missing value for --mode");
      const mode = toCliMode(value);
      if (!mode) return parseUsage(`Unknown --mode value: ${value}`);
      parsed.modeFromLong = mode;
      i = next;
      continue;
    }

    if (token.startsWith("--lang=")) {
      const language = toCliLanguage(token.slice("--lang=".length));
      if (!language) {
        return parseUsage(
          `Unknown --lang value: ${token.slice("--lang=".length)}`,
        );
      }
      parsed.language = language;
      parsed.languageSpecified = true;
      continue;
    }
    if (token === "--lang") {
      const [value, next] = valueAfter(argv, i);
      if (!value) return parseUsage("Missing value for --lang");
      const language = toCliLanguage(value);
      if (!language) return parseUsage(`Unknown --lang value: ${value}`);
      parsed.language = language;
      parsed.languageSpecified = true;
      i = next;
      continue;
    }

    if (token === "--ast") {
      parsed.astInput = true;
      continue;
    }
    if (token === "-e" || token === "--eval") {
      const [value, next] = valueAfter(argv, i);
      if (value === undefined) return parseUsage(`Missing value for ${token}`);
      parsed.inlineSource = value;
      i = next;
      continue;
    }
    if (token === "--input") {
      const [value, next] = valueAfter(argv, i);
      if (value === undefined) return parseUsage("Missing value for --input");
      parsed.matchInput = value;
      i = next;
      continue;
    }
    if (token === "--input-json") {
      const [value, next] = valueAfter(argv, i);
      if (value === undefined) {
        return parseUsage("Missing value for --input-json");
      }
      parsed.matchInputJson = value;
      i = next;
      continue;
    }
    if (token === "--input-file") {
      const [value, next] = valueAfter(argv, i);
      if (value === undefined) {
        return parseUsage("Missing value for --input-file");
      }
      parsed.matchInputPath = value;
      i = next;
      continue;
    }
    if (token === "--json") {
      parsed.jsonOutput = true;
      continue;
    }
    if (token === "--entry") {
      const [value, next] = valueAfter(argv, i);
      if (value === undefined) return parseUsage("Missing value for --entry");
      parsed.entryRuleName = value;
      i = next;
      continue;
    }

    if (token.startsWith("--out-dir=")) {
      parsed.outDirOpt = token.slice("--out-dir=".length);
      continue;
    }
    if (token === "--out-dir") {
      const [value, next] = valueAfter(argv, i);
      if (!value) return parseUsage("Missing value for --out-dir");
      parsed.outDirOpt = value;
      i = next;
      continue;
    }

    return parseUsage(`Unknown flag: ${token}`);
  }

  return parsed;
}

export function resolveCliProcessContract(
  input: CliProcessInput,
): CliProcessResolution {
  const { argv, processCwd, stdinAttached = false } = input;

  if (!isAbsolute(processCwd)) {
    return config(
      `Process working directory must be absolute: ${processCwd}`,
    );
  }

  const parsed = parseArgs(argv);
  if ("code" in parsed) {
    return usage(parsed.message, parsed.phase);
  }

  const commandMode = parsed.commandToken
    ? modeFromCommand(parsed.commandToken)
    : undefined;
  const flagMode = parsed.modeFromLong ?? parsed.modeFlagOrder.slice(-1)[0];

  if (commandMode && flagMode && commandMode !== flagMode) {
    return usage(
      `Conflicting mode selection: command '${parsed.commandToken}' does not match '${flagMode}'`,
      "validation",
    );
  }

  const mode = commandMode ?? flagMode ?? CliMode.Compile;
  const command = parsed.commandToken ?? commandFromMode(mode);

  if (mode !== CliMode.Compile && parsed.inputPaths.length > 1) {
    return usage(
      `${command} accepts at most one source or AST input path`,
      "validation",
    );
  }

  if (
    mode !== CliMode.Compile && parsed.inlineSource !== undefined &&
    parsed.inputPaths.length > 0
  ) {
    return usage(
      `${command} cannot combine -e/--eval with an input path`,
      "validation",
    );
  }

  if (
    mode !== CliMode.Compile && parsed.astInput &&
    parsed.inlineSource !== undefined
  ) {
    return usage(
      `${command} cannot combine --ast with -e/--eval`,
      "validation",
    );
  }

  if (mode === CliMode.Parse && parsed.astInput) {
    return usage(
      "parse accepts source input and cannot use --ast",
      "validation",
    );
  }

  if (
    mode === CliMode.Compile &&
    (parsed.astInput || parsed.inlineSource !== undefined)
  ) {
    return usage(
      "compile does not accept --ast, -e, or --eval",
      "validation",
    );
  }

  if (
    (mode === CliMode.Exec || mode === CliMode.Match || mode === CliMode.Run) &&
    parsed.languageSpecified
  ) {
    return usage(
      `${command} selects its language and does not accept --lang`,
      "validation",
    );
  }

  if (
    mode !== CliMode.Match &&
    (parsed.matchInput || parsed.matchInputJson || parsed.matchInputPath)
  ) {
    return usage(
      "--input, --input-json, and --input-file are only valid for match",
      "validation",
    );
  }

  if (
    [parsed.matchInput, parsed.matchInputJson, parsed.matchInputPath].filter(
      (value) => value !== undefined,
    ).length > 1
  ) {
    return usage(
      "match accepts only one of --input, --input-json, or --input-file",
      "validation",
    );
  }

  if (mode !== CliMode.Run && parsed.entryRuleName) {
    return usage("--entry is only valid for run", "validation");
  }

  const cwd = resolve(processCwd);
  const outputRootDir = resolve(cwd, parsed.outDirOpt ?? ".uffda");

  return {
    ok: true,
    exitCode: CliExitCode.Ok,
    contract: {
      command,
      mode,
      language: parsed.language,
      inputPaths: parsed.inputPaths,
      astInput: parsed.astInput,
      inlineSource: parsed.inlineSource,
      matchInput: parsed.matchInput,
      matchInputJson: parsed.matchInputJson,
      matchInputPath: parsed.matchInputPath,
      jsonOutput: parsed.jsonOutput,
      entryRuleName: parsed.entryRuleName,
      cwd,
      outputRootDir,
      stdinAttached,
    },
  };
}
