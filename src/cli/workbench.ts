import { isAbsolute, resolve } from "@std/path";
import { InputNormalizationMode } from "../input.ts";
import { MatchKind } from "../match.ts";
import { visualizeMatchFailure } from "../match.visualize.ts";
import { CliLanguage } from "./contract.ts";
import { match } from "../runtime/match.ts";
import { isPattern } from "../runtime/patterns/pattern.ts";
import { Scope } from "../runtime/scope.ts";
import { type CliStreamResult, parseSourceToAst } from "./stream.ts";

export enum CliWorkbenchFailureCode {
  InvalidCommand = "CLI_WORKBENCH_INVALID_COMMAND",
  SessionInactive = "CLI_WORKBENCH_SESSION_INACTIVE",
  FileIo = "CLI_WORKBENCH_FILE_IO",
  ExportUnavailable = "CLI_WORKBENCH_EXPORT_UNAVAILABLE",
  MatchUnavailable = "CLI_WORKBENCH_MATCH_UNAVAILABLE",
}

export type CliWorkbenchFailure = {
  code: CliWorkbenchFailureCode;
  phase: "protocol" | "session" | "file" | "export" | "match";
  message: string;
};

const BANNER_LETTERS: Record<string, string[]> = {
  U: [
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    " █     █ ",
    "  █████  ",
  ],
  F: [
    "█████████",
    "█        ",
    "█        ",
    "█        ",
    "███████  ",
    "█        ",
    "█        ",
    "█        ",
    "█        ",
  ],
  D: [
    "████████ ",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
    "████████ ",
  ],
  A: [
    "   ███   ",
    "  █   █  ",
    " █     █ ",
    "█       █",
    "█████████",
    "█       █",
    "█       █",
    "█       █",
    "█       █",
  ],
};

const BANNER_SUBTITLE = "a parser generator for domain specific languages";
const BANNER_LETTER_HEIGHT = 9;
const BANNER_LETTER_WIDTH = 9;
const BANNER_WIDTH = BANNER_LETTER_WIDTH * 5 + 4;

function centered(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return " ".repeat(left) + text + " ".repeat(width - text.length - left);
}

export function workbenchBanner(): string {
  const rows: string[] = [];
  for (let row = 0; row < BANNER_LETTER_HEIGHT; row++) {
    rows.push(
      [..."UFFDA"].map((letter) => BANNER_LETTERS[letter][row]).join(" "),
    );
  }
  rows.push("─".repeat(BANNER_WIDTH));
  rows.push(centered(BANNER_SUBTITLE, BANNER_WIDTH));
  return rows.join("\n");
}

export type CliWorkbenchFileSystem = {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
};

export type CliWorkbenchSession = {
  active: boolean;
  language: CliLanguage;
  source: string;
  sourcePath: string;
  compilation?: CliStreamResult;
  visualization?: string;
};

export type CliWorkbenchResponse =
  | { ok: true; event: string; session: CliWorkbenchSession }
  | { ok: false; error: CliWorkbenchFailure; session: CliWorkbenchSession };

type WorkbenchCommand = {
  action: string;
  language?: CliLanguage;
  source?: string;
  path?: string;
  input?: unknown;
  jsonInput?: boolean;
};

function failure(
  session: CliWorkbenchSession,
  code: CliWorkbenchFailureCode,
  phase: CliWorkbenchFailure["phase"],
  message: string,
): CliWorkbenchResponse {
  return {
    ok: false,
    error: { code, phase, message },
    session: snapshot(session),
  };
}

function success(
  event: string,
  session: CliWorkbenchSession,
): CliWorkbenchResponse {
  return { ok: true, event, session: snapshot(session) };
}

function snapshot(session: CliWorkbenchSession): CliWorkbenchSession {
  return structuredClone(session);
}

function isLanguage(value: unknown): value is CliLanguage {
  return Object.values(CliLanguage).includes(value as CliLanguage);
}

function isCommand(value: unknown): value is WorkbenchCommand {
  return value !== null && typeof value === "object" &&
    typeof (value as { action?: unknown }).action === "string";
}

export class CliWorkbench {
  #session: CliWorkbenchSession = {
    active: false,
    language: CliLanguage.FullUffda,
    source: "",
    sourcePath: "<workbench>",
  };

  constructor(
    private readonly cwd: string,
    private readonly fileSystem: CliWorkbenchFileSystem = Deno,
  ) {}

  get session(): CliWorkbenchSession {
    return this.#session;
  }

  async execute(value: unknown): Promise<CliWorkbenchResponse> {
    if (!isCommand(value)) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "Workbench commands must be JSON objects with an action.",
      );
    }

    const command = value;
    if (command.action === "start") return await this.#start(command);
    if (!this.#session.active) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.SessionInactive,
        "session",
        "Start a workbench session before sending commands.",
      );
    }

    switch (command.action) {
      case "status":
        return success("status", this.#session);
      case "set-source":
        if (typeof command.source !== "string") {
          return failure(
            this.#session,
            CliWorkbenchFailureCode.InvalidCommand,
            "protocol",
            "set-source requires a string source.",
          );
        }
        this.#session.source = command.source;
        await this.#compile();
        return success("source-updated", this.#session);
      case "set-language":
        if (!isLanguage(command.language)) {
          return failure(
            this.#session,
            CliWorkbenchFailureCode.InvalidCommand,
            "protocol",
            "set-language requires uffda, pattern, or expression.",
          );
        }
        this.#session.language = command.language;
        await this.#compile();
        return success("language-updated", this.#session);
      case "compile":
        await this.#compile();
        return success("compiled", this.#session);
      case "visualize":
        this.#session.visualization = visualization(this.#session);
        return success("visualized", this.#session);
      case "match":
        return await this.#match(command);
      case "open":
        return await this.#open(command);
      case "save":
        return await this.#save(command);
      case "export-ast":
        return await this.#exportAst(command);
      case "end":
        this.#session.active = false;
        return success("ended", this.#session);
      default:
        return failure(
          this.#session,
          CliWorkbenchFailureCode.InvalidCommand,
          "protocol",
          `Unknown workbench action: ${command.action}`,
        );
    }
  }

  async #start(command: WorkbenchCommand): Promise<CliWorkbenchResponse> {
    if (this.#session.active) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "The workbench session is already active.",
      );
    }
    if (command.language !== undefined && !isLanguage(command.language)) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "start language must be uffda, pattern, or expression.",
      );
    }
    if (command.source !== undefined && typeof command.source !== "string") {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "start source must be a string.",
      );
    }

    this.#session = {
      active: true,
      language: command.language ?? CliLanguage.FullUffda,
      source: command.source ?? "",
      sourcePath: "<workbench>",
    };
    await this.#compile();
    return success("started", this.#session);
  }

  async #open(command: WorkbenchCommand): Promise<CliWorkbenchResponse> {
    if (typeof command.path !== "string") {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "open requires a path.",
      );
    }
    const path = this.resolvePath(command.path);
    try {
      const source = await this.fileSystem.readTextFile(path);
      this.#session.source = source;
      this.#session.sourcePath = path;
      await this.#compile();
      return success("opened", this.#session);
    } catch (error) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.FileIo,
        "file",
        `Unable to open ${path}: ${errorMessage(error)}`,
      );
    }
  }

  async #save(command: WorkbenchCommand): Promise<CliWorkbenchResponse> {
    const path = this.resolvePath(command.path ?? this.#session.sourcePath);
    if (path === "<workbench>") {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "save requires a path for an in-memory document.",
      );
    }
    try {
      await this.fileSystem.writeTextFile(path, this.#session.source);
      this.#session.sourcePath = path;
      return success("saved", this.#session);
    } catch (error) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.FileIo,
        "file",
        `Unable to save ${path}: ${errorMessage(error)}`,
      );
    }
  }

  async #exportAst(command: WorkbenchCommand): Promise<CliWorkbenchResponse> {
    if (typeof command.path !== "string") {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "export-ast requires a path.",
      );
    }
    if (!this.#session.compilation?.ok) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.ExportUnavailable,
        "export",
        "Compile successfully before exporting an AST.",
      );
    }

    const path = this.resolvePath(command.path);
    try {
      await this.fileSystem.writeTextFile(
        path,
        `${JSON.stringify(this.#session.compilation.ast, null, 2)}\n`,
      );
      return success("ast-exported", this.#session);
    } catch (error) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.FileIo,
        "file",
        `Unable to export ${path}: ${errorMessage(error)}`,
      );
    }
  }

  async #match(command: WorkbenchCommand): Promise<CliWorkbenchResponse> {
    if (this.#session.language !== CliLanguage.Pattern) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.MatchUnavailable,
        "match",
        "match requires a pattern-language workbench session.",
      );
    }
    if (command.input === undefined) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        "match requires an input value.",
      );
    }
    if (
      !this.#session.compilation?.ok ||
      !isPattern(this.#session.compilation.ast)
    ) {
      return failure(
        this.#session,
        CliWorkbenchFailureCode.MatchUnavailable,
        "match",
        "Compile a valid pattern before matching.",
      );
    }

    const result = await match(
      this.#session.compilation.ast,
      Scope.From(command.input, {
        kind: command.jsonInput
          ? InputNormalizationMode.Scalar
          : InputNormalizationMode.Iterable,
      }),
    );
    this.#session.visualization = result.kind === MatchKind.Fail
      ? visualizeMatchFailure(result)
      : result.kind === MatchKind.Ok
      ? matchVisualization(result.kind, result.value)
      : matchVisualization(result.kind);
    return success("matched", this.#session);
  }

  async #compile(): Promise<void> {
    this.#session.compilation = await parseSourceToAst(
      this.#session.source,
      this.#session.language,
      this.#session.sourcePath,
    );
  }

  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : resolve(this.cwd, path);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function visualization(session: CliWorkbenchSession): string {
  const heading = [
    "Compilation",
    `Language: ${session.language}`,
    `Source: ${session.sourcePath}`,
  ];
  if (!session.compilation) {
    return [...heading, "Status: not compiled"].join("\n");
  }
  if (!session.compilation.ok) {
    return [
      ...heading,
      "Status: failed",
      `Phase: ${session.compilation.error.phase}`,
      `Diagnostic: ${session.compilation.error.message}`,
    ].join("\n");
  }
  return [
    ...heading,
    "Status: succeeded",
    "AST:",
    JSON.stringify(session.compilation.ast, null, 2),
  ].join("\n");
}

function matchVisualization(kind: MatchKind, value?: unknown): string {
  return [
    "Match",
    `Outcome: ${kind}`,
    kind === MatchKind.Ok ? `Value: ${Deno.inspect(value)}` : "",
  ].filter((line) => line.length > 0).join("\n");
}

export async function runWorkbenchProtocol(
  source: string,
  cwd: string,
): Promise<string> {
  const workbench = new CliWorkbench(cwd);
  const responses: CliWorkbenchResponse[] = [];

  for (const line of source.split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      responses.push(await workbench.execute(JSON.parse(line)));
    } catch (error) {
      responses.push(failure(
        workbench.session,
        CliWorkbenchFailureCode.InvalidCommand,
        "protocol",
        `Invalid JSON command: ${errorMessage(error)}`,
      ));
    }
  }

  return responses.map((response) => JSON.stringify(response)).join("\n") +
    (responses.length > 0 ? "\n" : "");
}
