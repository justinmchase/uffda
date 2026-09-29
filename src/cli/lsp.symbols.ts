import { isSuccess, type Match } from "../match.ts";
import {
  type AnnotatableMatch,
  declaredName,
  EditorDecorator,
  findAnnotated,
  hasEditorMetadata,
  nodeText,
  walkAccepted,
} from "./editor_metadata.ts";
import {
  HighlightRole,
  highlightSpansFromMatch,
  isNameRole,
} from "./highlight.ts";
import {
  acceptsKind,
  type IdentifierPosition,
  identifierPositions,
  LocalBindingKind,
  localBindingsAt,
  LocalScopeMemo,
} from "./lsp.locals.ts";

/**
 * Name occurrences for LSP find-references and rename (requirement 006):
 * every name in a document paired with the symbol it denotes, found through
 * the parse tree's editor metadata (`[Declaration]`, `[Parameter]`,
 * `[NameReference]`, `[Import]`, `[ModulePath]`, `[ImportedName]`) the same
 * way hover resolves names — never through grammar rule names.
 */

export enum NameSymbolKind {
  Local = "local",
  Declaration = "declaration",
  Global = "global",
}

export type NameSymbol =
  | {
    kind: NameSymbolKind.Local;
    /** Identifies the binding within its document. */
    key: string;
  }
  | {
    kind: NameSymbolKind.Declaration;
    /** The module declaring it (imports resolve to their target module). */
    moduleUrl: string;
    name: string;
  }
  | { kind: NameSymbolKind.Global; name: string };

export type NameOccurrence = {
  start: number;
  end: number;
  name: string;
  symbol: NameSymbol;
  /** Whether this occurrence declares or binds the symbol. */
  declaration: boolean;
};

export function sameSymbol(a: NameSymbol, b: NameSymbol): boolean {
  switch (a.kind) {
    case NameSymbolKind.Local:
      return b.kind === NameSymbolKind.Local && a.key === b.key;
    case NameSymbolKind.Declaration:
      return b.kind === NameSymbolKind.Declaration &&
        a.moduleUrl === b.moduleUrl && a.name === b.name;
    case NameSymbolKind.Global:
      return b.kind === NameSymbolKind.Global && a.name === b.name;
    default:
      throw new Error(`Unknown symbol kind: ${JSON.stringify(a)}`);
  }
}

type ModuleScope = {
  /** Names the document declares, each with its `[Declaration]` node. */
  declared: Map<string, AnnotatableMatch>;
  /** Imported names mapped to the module URL their import resolves to. */
  imported: Map<string, string>;
};

/**
 * The document's declarations and imports. An import's module path resolves
 * against `moduleUrl` the way the runtime resolver resolves it.
 */
function moduleScope(
  match: Match,
  source: string,
  moduleUrl: string,
): ModuleScope {
  const scope: ModuleScope = { declared: new Map(), imported: new Map() };
  walkAccepted(match, (node) => {
    if (!isSuccess(node)) return;
    if (hasEditorMetadata(node, EditorDecorator.Declaration)) {
      const name = declaredName(node);
      if (name !== undefined && !scope.declared.has(name)) {
        scope.declared.set(name, node);
      }
    }
    if (!hasEditorMetadata(node, EditorDecorator.Import)) return;
    const pathNode = findAnnotated(node, EditorDecorator.ModulePath);
    if (!pathNode) return;
    let target: string;
    try {
      target = new URL(nodeText(pathNode, source), moduleUrl).href;
    } catch {
      return;
    }
    walkAccepted(node, (inner) => {
      if (
        isSuccess(inner) &&
        hasEditorMetadata(inner, EditorDecorator.ImportedName)
      ) {
        scope.imported.set(nodeText(inner, source), target);
      }
    });
  });
  return scope;
}

function annotatedOnChain(
  position: IdentifierPosition,
  decorator: EditorDecorator,
): AnnotatableMatch | undefined {
  return position.chain.find((node) => hasEditorMetadata(node, decorator));
}

function covers(node: AnnotatableMatch, start: number, end: number): boolean {
  return node.originalSpan.start <= start && node.originalSpan.end >= end;
}

/**
 * Every name occurrence in the document at `moduleUrl` (optionally only those
 * spelled `name`) with the symbol it denotes: declaring names, imported
 * names, rule parameters, variable binding sites, and references, resolved as
 * references resolve (a local binding, then a declared or imported name, then
 * — where a func may be named — a runtime global in `globals`). Names that
 * denote nothing (object keys, member names, unresolved references) are
 * omitted.
 */
export function nameOccurrences(
  moduleUrl: string,
  source: string,
  match: Match,
  globals: ReadonlySet<string>,
  name?: string,
): NameOccurrence[] {
  const spans = highlightSpansFromMatch(match, source).filter((span) =>
    isNameRole(span.role) && span.role !== HighlightRole.Property &&
    (name === undefined || span.text === name)
  );
  if (spans.length === 0) return [];

  const scope = moduleScope(match, source, moduleUrl);
  const positions = identifierPositions(
    match,
    spans.map((span) => ({
      start: span.offset,
      end: span.offset + span.length,
    })),
  );
  const memo = new LocalScopeMemo();
  const claimed = new Set<AnnotatableMatch>();
  const occurrences: NameOccurrence[] = [];
  spans.forEach((span, i) => {
    const start = span.offset;
    const end = start + span.length;
    const found = resolveOccurrence(
      moduleUrl,
      span.text,
      start,
      end,
      positions[i],
      scope,
      globals,
      memo,
      claimed,
    );
    if (found) {
      occurrences.push({ start, end, name: span.text, ...found });
    }
  });
  return occurrences;
}

function resolveOccurrence(
  moduleUrl: string,
  text: string,
  start: number,
  end: number,
  position: IdentifierPosition,
  scope: ModuleScope,
  globals: ReadonlySet<string>,
  memo: LocalScopeMemo,
  claimed: Set<AnnotatableMatch>,
): { symbol: NameSymbol; declaration: boolean } | undefined {
  if (annotatedOnChain(position, EditorDecorator.ImportedName)) {
    const target = scope.imported.get(text);
    return target === undefined ? undefined : {
      symbol: {
        kind: NameSymbolKind.Declaration,
        moduleUrl: target,
        name: text,
      },
      declaration: false,
    };
  }

  if (position.reference === undefined) {
    const declaring = scope.declared.get(text);
    if (
      declaring && !claimed.has(declaring) && covers(declaring, start, end)
    ) {
      claimed.add(declaring);
      return {
        symbol: { kind: NameSymbolKind.Declaration, moduleUrl, name: text },
        declaration: true,
      };
    }
    const parameter = annotatedOnChain(position, EditorDecorator.Parameter);
    const binding = localBindingsAt(position, memo).find((b) =>
      b.name === text &&
      (b.kind === LocalBindingKind.Parameter
        ? parameter !== undefined
        : b.span.start === start)
    );
    return binding && {
      symbol: { kind: NameSymbolKind.Local, key: localKey(moduleUrl, binding) },
      declaration: true,
    };
  }

  const local = localBindingsAt(position, memo).find((b) => b.name === text);
  if (local) {
    return {
      symbol: { kind: NameSymbolKind.Local, key: localKey(moduleUrl, local) },
      declaration: false,
    };
  }
  if (scope.declared.has(text)) {
    return {
      symbol: { kind: NameSymbolKind.Declaration, moduleUrl, name: text },
      declaration: false,
    };
  }
  const target = scope.imported.get(text);
  if (target !== undefined) {
    return {
      symbol: {
        kind: NameSymbolKind.Declaration,
        moduleUrl: target,
        name: text,
      },
      declaration: false,
    };
  }
  if (globals.has(text) && acceptsKind(position, "func")) {
    return {
      symbol: { kind: NameSymbolKind.Global, name: text },
      declaration: false,
    };
  }
  return undefined;
}

function localKey(
  moduleUrl: string,
  binding: ReturnType<typeof localBindingsAt>[number],
): string {
  return binding.kind === LocalBindingKind.Parameter
    ? `${moduleUrl}#parameter:${binding.declarationName ?? ""}:${binding.name}`
    : `${moduleUrl}#variable:${binding.span.start}`;
}
