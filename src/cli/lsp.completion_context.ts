import { type Match, MatchKind } from "../match.ts";
import {
  type AnnotatableMatch,
  EditorDecorator,
  findAnnotated,
  hasEditorMetadata,
  modulePathExtensions,
  nameReferenceKinds,
  nodeText,
  walkAnnotatable,
} from "./editor_metadata.ts";
import { highlightSpansFromMatch, isTriviaRole } from "./highlight.ts";
import { type LocalBinding, localBindingsAt } from "./lsp.locals.ts";

/**
 * Grammar-derived completion contexts (requirement 006, see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`). The text
 * before the cursor is parsed with the document's own grammar; the editor
 * metadata on the nodes that reach the cursor says what may be completed
 * there. Nothing about any language's syntax is known here: a grammar that
 * applies no editor metadata simply has no completion contexts.
 */

export enum CompletionContextKind {
  ModulePath = "modulePath",
  ImportedName = "importedName",
  NameReference = "nameReference",
}

export type CompletionReplace = { start: number; end: number };

export type CompletionContext =
  | {
    kind: CompletionContextKind.ModulePath;
    /** Module path text typed so far. */
    typed: string;
    /** Extensions the grammar's modules use (`undefined`: any file). */
    extensions?: string[];
    /** Range of the path segment being typed (after the last `/`). */
    replace: CompletionReplace;
  }
  | {
    kind: CompletionContextKind.ImportedName;
    /** The enclosing import's module path, if it has one. */
    modulePath?: string;
    /** Names the enclosing import already binds. */
    listed: string[];
    /** Range of the name being typed (possibly empty). */
    replace: CompletionReplace;
  }
  | {
    kind: CompletionContextKind.NameReference;
    /** Declaration kinds that may be named (`undefined`: every kind). */
    kinds?: string[];
    /**
     * Local bindings visible at the cursor that the reference may name,
     * innermost first (see `localBindingsAt`).
     */
    locals: LocalBinding[];
    /** Range of the name being typed (possibly empty). */
    replace: CompletionReplace;
  };

const CONTEXT_DECORATORS: readonly EditorDecorator[] = [
  EditorDecorator.ModulePath,
  EditorDecorator.ImportedName,
  EditorDecorator.NameReference,
];

/**
 * The completion contexts at the end of `prefix` — the document text before
 * the cursor — given `match`, the document grammar's parse of `prefix`.
 *
 * `match` should be a parse of `prefix` as an open input (`Input.From(prefix,
 * { open: true })`), so repetitions record the element they expect at the
 * cursor. A node reaches the cursor when it is an `Ok` node ending exactly
 * there (the token being typed) or a `Fail` node attempted after the last
 * significant token, i.e. separated from the cursor by trivia only (a token
 * the grammar expected next). A non-empty token being typed wins over tokens
 * expected after it. Only the outermost node carrying a given decorator on a
 * path counts. Distinct contexts are returned in tree order.
 */
export function completionContextsAt(
  match: Match,
  prefix: string,
): CompletionContext[] {
  const cursor = prefix.length;
  const significantEnd = lastSignificantEnd(match, prefix);
  const typed: CompletionContext[] = [];
  const expected: CompletionContext[] = [];

  walkAnnotatable(match, (node, ancestors) => {
    const typing = node.kind === MatchKind.Ok &&
      node.originalSpan.end === cursor &&
      node.originalSpan.start < cursor;
    const reaches = typing ||
      (node.kind === MatchKind.Ok
        ? node.originalSpan.end === cursor
        : node.originalSpan.start >= significantEnd &&
          node.originalSpan.start <= cursor);
    if (!reaches) return;
    for (const decorator of CONTEXT_DECORATORS) {
      if (!hasEditorMetadata(node, decorator)) continue;
      if (ancestors.some((a) => hasEditorMetadata(a, decorator))) continue;
      (typing ? typed : expected).push(
        contextFor(decorator, node, ancestors, prefix),
      );
    }
  });
  return distinct(typed.length > 0 ? typed : expected);
}

function distinct(contexts: CompletionContext[]): CompletionContext[] {
  const seen = new Set<string>();
  return contexts.filter((context) => {
    const key = JSON.stringify(context);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** End offset of the last non-trivia token span in `prefix`, or 0. */
function lastSignificantEnd(match: Match, prefix: string): number {
  let end = 0;
  for (const span of highlightSpansFromMatch(match, prefix)) {
    if (!isTriviaRole(span.role)) end = span.offset + span.length;
  }
  return end;
}

function typedRange(node: AnnotatableMatch, cursor: number): CompletionReplace {
  return node.kind === MatchKind.Ok
    ? { start: node.originalSpan.start, end: cursor }
    : { start: cursor, end: cursor };
}

function contextFor(
  decorator: EditorDecorator,
  node: AnnotatableMatch,
  ancestors: readonly AnnotatableMatch[],
  prefix: string,
): CompletionContext {
  const cursor = prefix.length;
  const replace = typedRange(node, cursor);
  switch (decorator) {
    case EditorDecorator.ModulePath: {
      const typed = prefix.slice(replace.start, cursor);
      return {
        kind: CompletionContextKind.ModulePath,
        typed,
        extensions: modulePathExtensions(node),
        replace: {
          start: replace.start + typed.lastIndexOf("/") + 1,
          end: cursor,
        },
      };
    }
    case EditorDecorator.ImportedName: {
      const importNode = ancestors.findLast((a) =>
        hasEditorMetadata(a, EditorDecorator.Import)
      );
      const modulePathNode = importNode &&
        findAnnotated(importNode, EditorDecorator.ModulePath);
      return {
        kind: CompletionContextKind.ImportedName,
        modulePath: modulePathNode && nodeText(modulePathNode, prefix),
        listed: importNode ? listedNames(importNode, node, prefix) : [],
        replace,
      };
    }
    case EditorDecorator.NameReference: {
      const kinds = nameReferenceKinds(node);
      return {
        kind: CompletionContextKind.NameReference,
        kinds,
        locals: localBindingsAt({
          chain: [...ancestors, node],
          reference: { kinds },
        }),
        replace,
      };
    }
    default:
      throw new Error(`Not a completion context decorator: ${decorator}`);
  }
}

/** Names bound by `importNode`'s `[ImportedName]` nodes, except `typing`. */
function listedNames(
  importNode: AnnotatableMatch,
  typing: AnnotatableMatch,
  prefix: string,
): string[] {
  const names = new Set<string>();
  walkAnnotatable(importNode, (node) => {
    if (
      node.kind === MatchKind.Ok &&
      node.originalSpan.start !== typing.originalSpan.start &&
      hasEditorMetadata(node, EditorDecorator.ImportedName)
    ) {
      names.add(nodeText(node, prefix));
    }
  });
  return [...names];
}
