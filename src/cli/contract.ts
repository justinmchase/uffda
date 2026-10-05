import { isAbsolute, resolve } from "@std/path";

export enum CliMode {
  Compile = "compile",
  Exec = "exec",
  Fmt = "fmt",
  Match = "match",
  Parse = "parse",
  Run = "run",
}

export type CliCommand = "compile" | "exec" | "fmt" | "match" | "parse" | "run";

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
  command: CliCommand;
  mode: CliMode;
  language: CliLanguage;
  inputPaths: string[];
  astInput: boolean;
  inlineSource?: string;
  matchInput?: string;
  matchInputJson?: string;
  matchInputPath?: string;
  jsonOutput: boolean;
  /** `fmt --check`: report non-canonical files without writing them. */
  check: boolean;
  entryRuleName?: string;
  /**
   * `--config`: the project file to use, absolute. When absent, the project
   * file is the nearest `uffda.jsonc` at or above `cwd`.
   */
  configPath?: string;
  cwd: string;
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
  commandToken?: CliCommand;
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
  check: boolean;
  entryRuleName?: string;
  configOpt?: string;
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
    case CliMode.Fmt:
      return CliMode.Fmt;
    case CliMode.Match:
      return CliMode.Match;
    case CliMode.Parse:
      return CliMode.Parse;
    case CliMode.Run:
      return CliMode.Run;
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
): CliCommand {
  switch (mode) {
    case CliMode.Compile:
      return "compile";
    case CliMode.Exec:
      return "exec";
    case CliMode.Fmt:
      return "fmt";
    case CliMode.Match:
      return "match";
    case CliMode.Parse:
      return "parse";
    case CliMode.Run:
      return "run";
  }
}

function modeFromCommand(
  command: CliCommand,
): CliMode {
  switch (command) {
    case "compile":
      return CliMode.Compile;
    case "exec":
      return CliMode.Exec;
    case "fmt":
      return CliMode.Fmt;
    case "match":
      return CliMode.Match;
    case "parse":
      return CliMode.Parse;
    case "run":
      return CliMode.Run;
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
    check: false,
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
          token === "compile" || token === "exec" || token === "fmt" ||
          token === "match" || token === "parse" || token === "run"
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
    if (token === "--check") {
      parsed.check = true;
      continue;
    }
    if (token === "--entry") {
      const [value, next] = valueAfter(argv, i);
      if (value === undefined) return parseUsage("Missing value for --entry");
      parsed.entryRuleName = value;
      i = next;
      continue;
    }

    if (token.startsWith("--config=")) {
      parsed.configOpt = token.slice("--config=".length);
      if (!parsed.configOpt) return parseUsage("Missing value for --config");
      continue;
    }
    if (token === "--config") {
      const [value, next] = valueAfter(argv, i);
      if (!value) return parseUsage("Missing value for --config");
      parsed.configOpt = value;
      i = next;
      continue;
    }

    return parseUsage(`Unknown flag: ${token}`);
  }

  return parsed;
}

function fmtValidationError(parsed: ParsedArgs): string | undefined {
  if (
    parsed.astInput || parsed.inlineSource !== undefined ||
    parsed.languageSpecified || parsed.entryRuleName !== undefined ||
    parsed.matchInput !== undefined ||
    parsed.matchInputJson !== undefined || parsed.matchInputPath !== undefined
  ) {
    return "fmt accepts only paths, globs, -, --check, --json, and --config";
  }
  if (parsed.inputPaths.includes("-") && parsed.inputPaths.length > 1) {
    return "fmt cannot combine - with file paths";
  }
  return undefined;
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

  if (mode === CliMode.Fmt) {
    const invalid = fmtValidationError(parsed);
    if (invalid) return usage(invalid, "validation");
  } else if (parsed.check) {
    return usage("--check is only valid for fmt", "validation");
  }

  if (
    mode !== CliMode.Compile && mode !== CliMode.Fmt &&
    parsed.inputPaths.length > 1
  ) {
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
    (
      mode === CliMode.Compile || mode === CliMode.Exec ||
      mode === CliMode.Match || mode === CliMode.Run
    ) &&
    parsed.languageSpecified
  ) {
    return usage(
      `${command} selects its language and does not accept --lang`,
      "validation",
    );
  }

  if (
    mode !== CliMode.Match && mode !== CliMode.Run &&
    (parsed.matchInput !== undefined || parsed.matchInputJson !== undefined ||
      parsed.matchInputPath !== undefined)
  ) {
    return usage(
      "--input, --input-json, and --input-file are only valid for match and run",
      "validation",
    );
  }

  if (
    [parsed.matchInput, parsed.matchInputJson, parsed.matchInputPath].filter(
      (value) => value !== undefined,
    ).length > 1
  ) {
    return usage(
      `${command} accepts only one of --input, --input-json, or --input-file`,
      "validation",
    );
  }

  if (mode !== CliMode.Run && parsed.entryRuleName) {
    return usage("--entry is only valid for run", "validation");
  }

  if (
    parsed.configOpt !== undefined &&
    (mode === CliMode.Match || mode === CliMode.Parse)
  ) {
    return usage(
      "--config is only valid for compile, exec, fmt, and run",
      "validation",
    );
  }

  const cwd = resolve(processCwd);
  const configPath = parsed.configOpt === undefined
    ? undefined
    : resolve(cwd, parsed.configOpt);

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
      check: parsed.check,
      entryRuleName: parsed.entryRuleName,
      configPath,
      cwd,
      stdinAttached,
    },
  };
}
