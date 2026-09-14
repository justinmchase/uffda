import { resolve } from "@std/path";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CliLanguage } from "./contract.ts";
import {
  type CliCompileResult,
  compileSourcesToAstArtifacts,
} from "./compile.ts";
import {
  type CliMatchFailure,
  isCliMatchFailure,
  matchCliPattern,
  parseCliMatchInput,
} from "./match.ts";
import { type CliStreamFailure, parseSourceToAst } from "./stream.ts";
import { type HighlightResult, highlightSource } from "./highlight.ts";

/**
 * Stateless operation tools: `uffda_compile`, `uffda_parse`, `uffda_match`,
 * `uffda_highlight`. These mirror the batch CLI's `compile`/`parse`/`match`
 * modes (see
 * `.agents/requirements/mcp-server/003-stateless-operation-tools.requirement.md`),
 * plus a standalone source-highlighting tool (see
 * `.agents/requirements/mcp-server/009-source-highlighting-tool.requirement.md`):
 * same deterministic output/diagnostic shape as the CLI's `--json` output,
 * no session id, no persisted state between calls.
 */

const languageSchema = z.nativeEnum(CliLanguage).describe(
  "Which grammar to parse the source with: 'uffda' (full module), " +
    "'pattern', or 'expression'.",
);

export const compileToolInputShape = {
  paths: z.array(z.string()).min(1).describe(
    "One or more source file paths or glob patterns to compile, resolved " +
      "relative to cwd.",
  ),
  cwd: z.string().describe(
    "Absolute working directory paths/globs are resolved against.",
  ),
  outputDir: z.string().optional().describe(
    "Absolute directory AST artifacts are written under. Defaults to " +
      "'<cwd>/.uffda/ast', matching the CLI's default.",
  ),
  overwrite: z.boolean().optional().describe(
    "Allow overwriting existing artifact files. Defaults to false.",
  ),
};
const compileToolInputSchema = z.object(compileToolInputShape);
export type CompileToolInput = z.infer<typeof compileToolInputSchema>;

export async function compileToolHandler(
  input: CompileToolInput,
): Promise<CliCompileResult> {
  const outputDir = input.outputDir ?? resolve(input.cwd, ".uffda", "ast");
  return await compileSourcesToAstArtifacts({
    cwd: input.cwd,
    sourcePaths: input.paths,
    outputDir,
    overwrite: input.overwrite,
  });
}

export const parseToolInputShape = {
  source: z.string().describe("Uffda (or sub-language) source text to parse."),
  language: languageSchema.optional().describe(
    "Defaults to 'uffda' (full module grammar).",
  ),
};
const parseToolInputSchema = z.object(parseToolInputShape);
export type ParseToolInput = z.infer<typeof parseToolInputSchema>;

export async function parseToolHandler(
  input: ParseToolInput,
): Promise<unknown> {
  const result = await parseSourceToAst(
    input.source,
    input.language ?? CliLanguage.FullUffda,
  );
  return result.ok ? { ok: true, ast: result.ast } : result;
}

export const matchToolInputShape = {
  pattern: z.string().describe(
    "Uffda pattern source text (parsed with the pattern grammar) to match " +
      "the input against.",
  ),
  input: z.string().describe(
    "The subject to match, as raw text or (if inputIsJson is true) JSON.",
  ),
  inputIsJson: z.boolean().optional().describe(
    "When true, `input` is parsed as JSON before matching. Defaults to " +
      "false (input is matched as raw text/iterable).",
  ),
};
const matchToolInputSchema = z.object(matchToolInputShape);
export type MatchToolInput = z.infer<typeof matchToolInputSchema>;

/**
 * `match`'s pattern text must itself be parsed before matching, so a failure
 * can occur at either phase: a `CliStreamFailure` (pattern text doesn't parse)
 * or a `CliMatchFailure` (input is invalid, or the parsed pattern doesn't
 * match it) — mirroring the CLI's `match` mode, which surfaces the same two
 * distinct failure shapes rather than coercing one into the other.
 */
export type MatchToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: CliStreamFailure | CliMatchFailure };

export async function matchToolHandler(
  input: MatchToolInput,
): Promise<MatchToolResult> {
  const parsedPattern = await parseSourceToAst(
    input.pattern,
    CliLanguage.Pattern,
  );
  if (!parsedPattern.ok) return parsedPattern;

  const jsonInput = input.inputIsJson ?? false;
  const parsedInput = parseCliMatchInput(input.input, jsonInput);
  if (!parsedInput.ok) return parsedInput;

  try {
    return await matchCliPattern(
      parsedPattern.ast,
      parsedInput.value,
      jsonInput,
      input.pattern,
    );
  } catch (error) {
    if (isCliMatchFailure(error)) return { ok: false, error };
    throw error;
  }
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function compileToolResult(value: CliCompileResult): CallToolResult {
  return jsonResult(value);
}
export function parseToolResult(value: unknown): CallToolResult {
  return jsonResult(value);
}
export function matchToolResult(value: MatchToolResult): CallToolResult {
  return jsonResult(value);
}

export const highlightToolInputShape = {
  source: z.string().describe(
    "Uffda (or a sub-language's) source text to highlight.",
  ),
  language: languageSchema.optional().describe(
    "Defaults to 'uffda' (full module grammar).",
  ),
};
const highlightToolInputSchema = z.object(highlightToolInputShape);
export type HighlightToolInput = z.infer<typeof highlightToolInputSchema>;

export async function highlightToolHandler(
  input: HighlightToolInput,
): Promise<HighlightResult> {
  return await highlightSource(
    input.source,
    input.language ?? CliLanguage.FullUffda,
  );
}

export function highlightToolResult(value: HighlightResult): CallToolResult {
  return jsonResult(value);
}
