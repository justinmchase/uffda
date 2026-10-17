import { fromFileUrl, join } from "@std/path";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CliLanguage } from "./contract.ts";
import { defaultGlobals } from "../runtime/globals/mod.ts";
import { metadataOf } from "../runtime/value_metadata.ts";
import {
  AUTHORING_EVIDENCE,
  type AuthoringEvidence,
  type CapabilityStatus,
  KEYWORD_EXPANSIONS,
} from "./mcp.authoring_evidence.ts";

/**
 * Stateless `uffda_authoring_context` tool: task-oriented, evidence-backed
 * authoring help for patterns and expressions (see
 * `.agents/requirements/mcp-server/013-authoring-context-tool.requirement.md`).
 */

const languageSchema = z.nativeEnum(CliLanguage).describe(
  "Optional grammar focus: 'uffda' (full module), 'pattern', or 'expression'.",
);

export const authoringContextToolInputShape = {
  task: z.string().describe(
    "What the caller wants to implement in Uffda (natural language). " +
      "The tool retrieves only evidence relevant to this task.",
  ),
  language: languageSchema.optional().describe(
    "When known, narrows syntax/examples to that grammar. Defaults to all " +
      "layers relevant to the task.",
  ),
};
const authoringContextToolInputSchema = z.object(
  authoringContextToolInputShape,
);
export type AuthoringContextToolInput = z.infer<
  typeof authoringContextToolInputSchema
>;

export enum AuthoringContextFailureCode {
  InvalidTask = "MCP_AUTHORING_CONTEXT_INVALID_TASK",
}

export type AuthoringContextFailure = {
  code: AuthoringContextFailureCode;
  phase: "validate";
  message: string;
};

export type SourceReference = {
  path: string;
  /** 1-based line when the file was readable and the anchor was found. */
  startLine?: number;
  endLine?: number;
  excerpt: string;
  /** True when the path could not be resolved or the anchor was missing. */
  unresolved?: boolean;
};

export type AuthoringSnippet = {
  id: string;
  topic: string;
  summary: string;
  examples?: string[];
  sources: SourceReference[];
};

export type CapabilityClaim = {
  capability: string;
  status: CapabilityStatus;
  note: string;
  sources: SourceReference[];
};

export type ExpressibilityAssessment = {
  status: "supported" | "partially_supported" | "unsupported" | "uncertain";
  summary: string;
  supported: CapabilityClaim[];
  unsupported: CapabilityClaim[];
  uncertain: CapabilityClaim[];
};

export type AuthoringContextSuccess = {
  ok: true;
  task: string;
  language?: CliLanguage;
  syntax: AuthoringSnippet[];
  semantics: AuthoringSnippet[];
  restrictions: AuthoringSnippet[];
  expressibility: ExpressibilityAssessment;
  /** Deduplicated source references cited by the result. */
  sources: SourceReference[];
  /** Default globals whose names or docs match the task, with live metadata. */
  relevantGlobals: Array<{
    name: string;
    description?: string;
    parameters?: Array<{ name: string; optional?: boolean; rest?: boolean }>;
  }>;
};

export type AuthoringContextResult =
  | AuthoringContextSuccess
  | { ok: false; error: AuthoringContextFailure };

const REPO_ROOT = fromFileUrl(new URL("../..", import.meta.url));

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
  "with",
  "from",
  "using",
  "that",
  "this",
  "want",
  "needs",
  "need",
  "implement",
  "write",
  "create",
  "make",
  "how",
  "can",
  "i",
  "my",
  "an",
]);

function tokenize(task: string): string[] {
  return task
    .toLowerCase()
    .split(/[^a-z0-9_+-]+/g)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Expand task tokens with synonym sets, then unique. */
export function taskTokens(task: string): string[] {
  const tokens = new Set<string>();
  for (const token of tokenize(task)) {
    tokens.add(token);
    const expanded = KEYWORD_EXPANSIONS[token];
    if (expanded) {
      for (const extra of expanded) tokens.add(extra);
    }
  }
  return [...tokens];
}

function languageFilter(
  language: CliLanguage | undefined,
): AuthoringEvidence["languages"] | undefined {
  if (language === undefined) return undefined;
  switch (language) {
    case CliLanguage.FullUffda:
      return ["uffda", "pattern", "expression"];
    case CliLanguage.Pattern:
      return ["pattern", "uffda"];
    case CliLanguage.Expression:
      return ["expression", "uffda"];
  }
}

function matchesLanguage(
  entry: AuthoringEvidence,
  allowed: AuthoringEvidence["languages"] | undefined,
): boolean {
  if (allowed === undefined || entry.languages === undefined) return true;
  return entry.languages.some((lang) => allowed.includes(lang));
}

/** Score how strongly `entry` matches the task tokens (0 = irrelevant). */
export function scoreEvidence(
  entry: AuthoringEvidence,
  tokens: readonly string[],
): number {
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const keyword of entry.keywords) {
    if (tokens.includes(keyword)) hits += 1;
  }
  if (hits === 0) return 0;
  // Prefer denser keyword overlap and capability claims for ranking.
  const kindBoost = entry.kind === "capability"
    ? 2
    : entry.kind === "restriction"
    ? 1.5
    : 1;
  return hits * kindBoost + hits / entry.keywords.length;
}

function resolveSourceSync(
  path: string,
  anchor: string,
  excerpt?: string,
): SourceReference {
  const textExcerpt = (excerpt ?? anchor).replace(/\s+/g, " ").trim();
  try {
    const full = join(REPO_ROOT, path);
    const text = Deno.readTextFileSync(full);
    const index = text.indexOf(anchor);
    if (index < 0) {
      return { path, excerpt: textExcerpt, unresolved: true };
    }
    const before = text.slice(0, index);
    const startLine = before.split("\n").length;
    const endLine = startLine + anchor.split("\n").length - 1;
    return { path, startLine, endLine, excerpt: textExcerpt };
  } catch {
    return { path, excerpt: textExcerpt, unresolved: true };
  }
}

function resolveEntrySources(entry: AuthoringEvidence): SourceReference[] {
  return entry.sources.map((source) =>
    resolveSourceSync(source.path, source.anchor, source.excerpt)
  );
}

function snippetFrom(
  entry: AuthoringEvidence,
  sources: SourceReference[],
): AuthoringSnippet {
  return {
    id: entry.id,
    topic: entry.capability ?? entry.id,
    summary: entry.summary,
    ...(entry.examples && entry.examples.length > 0
      ? { examples: [...entry.examples] }
      : {}),
    sources,
  };
}

function claimFrom(
  entry: AuthoringEvidence,
  sources: SourceReference[],
): CapabilityClaim | undefined {
  if (entry.status === undefined || entry.capability === undefined) {
    return undefined;
  }
  return {
    capability: entry.capability,
    status: entry.status,
    note: entry.summary,
    sources,
  };
}

function assessExpressibility(
  claims: CapabilityClaim[],
): ExpressibilityAssessment {
  const supported = claims.filter((c) => c.status === "supported");
  const unsupported = claims.filter((c) => c.status === "unsupported");
  const uncertain = claims.filter((c) => c.status === "uncertain");

  let status: ExpressibilityAssessment["status"];
  let summary: string;
  if (claims.length === 0) {
    status = "uncertain";
    summary =
      "No curated evidence matched this task closely enough to assess " +
      "expressibility. Narrow the task or inspect specs/globals directly.";
  } else if (unsupported.length > 0 && supported.length > 0) {
    status = "partially_supported";
    summary =
      "Some required pieces appear supported by the current implementation, " +
      "but others are missing or out of contract. Do not invent the missing " +
      "surface; author around the supported primitives or treat the gap as a " +
      "language limitation.";
  } else if (unsupported.length > 0 && supported.length === 0) {
    status = "unsupported";
    summary =
      "The task implies capabilities that are not present in Uffda as " +
      "implemented. See unsupported claims for evidence.";
  } else if (uncertain.length > 0) {
    status = "uncertain";
    summary =
      "Matched evidence supports related primitives, but at least one " +
      "capability remains unproven in this repository. Cite uncertain claims " +
      "before assuming the full behavior works.";
  } else {
    status = "supported";
    summary =
      "Matched evidence indicates the behavior can be expressed with the " +
      "current pattern/expression surface and default globals.";
  }

  return { status, summary, supported, unsupported, uncertain };
}

function relevantGlobals(tokens: readonly string[]) {
  const globals: AuthoringContextSuccess["relevantGlobals"] = [];
  for (const [name, value] of defaultGlobals) {
    const meta = metadataOf(value);
    const haystack = [
      name,
      meta?.description ?? "",
      ...(meta?.parameters.map((p) => p.name) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    const hit = tokens.some((token) =>
      token === name || haystack.includes(token)
    );
    if (!hit) continue;
    globals.push({
      name,
      ...(meta
        ? {
          description: meta.description,
          parameters: meta.parameters.map((p) => ({
            name: p.name,
            ...(p.optional ? { optional: true } : {}),
            ...(p.rest ? { rest: true } : {}),
          })),
        }
        : {}),
    });
  }
  return globals.sort((a, b) => a.name.localeCompare(b.name));
}

const MAX_SNIPPETS_PER_SECTION = 6;

/**
 * Builds authoring context for `task`. Pure over the curated evidence catalog
 * plus live `defaultGlobals` metadata; resolves source line numbers when the
 * repository files are readable beside the package.
 */
export function authoringContextToolHandler(
  input: AuthoringContextToolInput,
): AuthoringContextResult {
  const task = input.task.trim();
  if (task.length === 0) {
    return {
      ok: false,
      error: {
        code: AuthoringContextFailureCode.InvalidTask,
        phase: "validate",
        message: "task must be a non-empty string describing what to implement",
      },
    };
  }

  const tokens = taskTokens(task);
  const allowed = languageFilter(input.language);
  const scored = AUTHORING_EVIDENCE
    .map((entry) => ({ entry, score: scoreEvidence(entry, tokens) }))
    .filter(({ entry, score }) => score > 0 && matchesLanguage(entry, allowed))
    .sort((a, b) => b.score - a.score);

  const syntax: AuthoringSnippet[] = [];
  const semantics: AuthoringSnippet[] = [];
  const restrictions: AuthoringSnippet[] = [];
  const claims: CapabilityClaim[] = [];
  const allSources: SourceReference[] = [];
  const seenSource = new Set<string>();

  const pushSources = (sources: SourceReference[]) => {
    for (const source of sources) {
      const key = `${source.path}:${source.startLine ?? "?"}:${source.excerpt}`;
      if (seenSource.has(key)) continue;
      seenSource.add(key);
      allSources.push(source);
    }
  };

  for (const { entry } of scored) {
    const sources = resolveEntrySources(entry);
    pushSources(sources);
    const claim = claimFrom(entry, sources);
    if (claim) claims.push(claim);

    const snippet = snippetFrom(entry, sources);
    switch (entry.kind) {
      case "syntax":
        if (syntax.length < MAX_SNIPPETS_PER_SECTION) syntax.push(snippet);
        break;
      case "semantics":
      case "capability":
        if (semantics.length < MAX_SNIPPETS_PER_SECTION) {
          semantics.push(snippet);
        }
        break;
      case "restriction":
        if (restrictions.length < MAX_SNIPPETS_PER_SECTION) {
          restrictions.push(snippet);
        }
        break;
    }
  }

  return {
    ok: true,
    task,
    ...(input.language !== undefined ? { language: input.language } : {}),
    syntax,
    semantics,
    restrictions,
    expressibility: assessExpressibility(claims),
    sources: allSources,
    relevantGlobals: relevantGlobals(tokens),
  };
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function authoringContextToolResult(
  value: AuthoringContextResult,
): CallToolResult {
  return jsonResult(value);
}
