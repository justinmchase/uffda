import { Type, type } from "@justinmchase/type";
import { type Match, MatchKind } from "../match.ts";
import { rawOf, shallow } from "../wrapped.ts";

/**
 * Readers for the editor metadata vocabulary declared in
 * `src/lang/editor/editor.uff` (see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`). Editor
 * tooling locates syntax exclusively through these decorator names on a
 * parse tree's rule origins — never through a grammar's rule names or text
 * patterns — so any grammar that applies them gets the same tooling.
 */
export enum EditorDecorator {
  Highlight = "Highlight",
  Declaration = "Declaration",
  Parameter = "Parameter",
  NameReference = "NameReference",
  Import = "Import",
  ModulePath = "ModulePath",
  ImportedName = "ImportedName",
  Documentation = "Documentation",
}

/** A parse node that carries rule metadata (`Ok` or `Fail`). */
export type AnnotatableMatch = Extract<
  Match,
  { kind: MatchKind.Ok | MatchKind.Fail }
>;

/** The raw value of `decorator`'s metadata on `node`'s rule, if applied. */
export function editorMetadata(
  node: Match,
  decorator: EditorDecorator,
): unknown {
  if (node.kind !== MatchKind.Ok && node.kind !== MatchKind.Fail) {
    return undefined;
  }
  return node.origin?.rule.metadata?.[decorator];
}

export function hasEditorMetadata(
  node: Match,
  decorator: EditorDecorator,
): boolean {
  return editorMetadata(node, decorator) !== undefined;
}

function field(value: unknown, name: string): unknown {
  const [t, v] = type(value);
  return t === Type.Object ? (v as Record<string, unknown>)[name] : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  const [t, v] = type(value);
  if (t !== Type.Array) return undefined;
  return (v as unknown[]).filter((item): item is string =>
    type(item)[0] === Type.String
  );
}

/**
 * The declaration kinds a `[NameReference]` node refers to, or `undefined`
 * when it names no kinds (every kind applies). Only meaningful for nodes
 * that carry `NameReference` metadata.
 */
export function nameReferenceKinds(node: Match): string[] | undefined {
  return stringArray(
    field(editorMetadata(node, EditorDecorator.NameReference), "kinds"),
  );
}

/**
 * The file extensions (with leading dot) a `[ModulePath]` node's modules
 * use, or `undefined` when unrestricted.
 */
export function modulePathExtensions(node: Match): string[] | undefined {
  return stringArray(
    field(editorMetadata(node, EditorDecorator.ModulePath), "extensions"),
  );
}

/** A declaration's `[Documentation]`, as normalized by the decorator. */
export type Documentation = {
  description: string;
  /** Parameter name -> description. */
  parameters: Record<string, string>;
};

/**
 * The `[Documentation]` a declaration's metadata carries, validated; a
 * missing or malformed entry yields `undefined`, and non-string parameter
 * descriptions are dropped.
 */
export function documentationOf(
  metadata: Record<string, unknown> | undefined,
): Documentation | undefined {
  const value = metadata?.[EditorDecorator.Documentation];
  const description = field(value, "description");
  if (type(description)[0] !== Type.String) return undefined;
  const [t, raw] = type(field(value, "parameters"));
  const parameters = t === Type.Object
    ? Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter((
        entry,
      ): entry is [string, string] => type(entry[1])[0] === Type.String),
    )
    : {};
  return { description: description as string, parameters };
}

/** The `name` field of a node's projected value (a `[Declaration]`). */
export function declaredName(node: Match): string | undefined {
  if (node.kind !== MatchKind.Ok) return undefined;
  const name = field(shallow(node.value), "name");
  return type(name)[0] === Type.String ? name as string : undefined;
}

/**
 * The text an annotated node denotes: its projected value when that is a
 * string (e.g. an unescaped module path), otherwise its source text.
 */
export function nodeText(node: AnnotatableMatch, source: string): string {
  const value = node.kind === MatchKind.Ok ? rawOf(node.value) : undefined;
  if (type(value)[0] === Type.String) {
    return value as string;
  }
  return source.slice(node.originalSpan.start, node.originalSpan.end);
}

function isAnnotatable(node: Match): node is AnnotatableMatch {
  return node.kind === MatchKind.Ok || node.kind === MatchKind.Fail;
}

/**
 * Visits every `Ok`/`Fail` node of `root` exactly once in pre-order, passing
 * the chain of its annotatable ancestors (outermost first).
 *
 * A parse `Match` is a DAG, not a tree: memoized sub-matches are shared by
 * every attempt that reached them, including attempts the parse rejected (a
 * `Fail` beneath an `Ok`, such as alternatives that did not match). Those
 * keep the sub-matches they accumulated before failing (the progress of a
 * partially typed construct), so they are walked too, but walking every path
 * would revisit shared sub-matches exponentially often. The accepted parse
 * (`Ok` beneath `Ok`, and everything beneath a `Fail` root) is walked first,
 * so a node that belongs to it is visited with its accepted ancestors; the
 * rest of the DAG follows, each node visited on the first path reaching it.
 */
export function walkAnnotatable(
  root: Match,
  visit: (
    node: AnnotatableMatch,
    ancestors: readonly AnnotatableMatch[],
  ) => void,
): void {
  walkDag(root, visit, true);
}

/**
 * The first phase of `walkAnnotatable` alone: visits each node of the
 * accepted parse (`Ok` beneath `Ok`, and everything beneath a `Fail` root)
 * once in pre-order, skipping attempts the parse rejected.
 */
export function walkAccepted(
  root: Match,
  visit: (
    node: AnnotatableMatch,
    ancestors: readonly AnnotatableMatch[],
  ) => void,
): void {
  walkDag(root, visit, false);
}

function walkDag(
  root: Match,
  visit: (
    node: AnnotatableMatch,
    ancestors: readonly AnnotatableMatch[],
  ) => void,
  rejected: boolean,
): void {
  const visited = new Set<Match>();
  const ancestors: AnnotatableMatch[] = [];
  const walk = (
    node: Match,
    children: (node: AnnotatableMatch) => readonly Match[],
    expanded: Set<Match>,
  ) => {
    if (!isAnnotatable(node) || expanded.has(node)) return;
    expanded.add(node);
    if (!visited.has(node)) {
      visited.add(node);
      visit(node, ancestors);
    }
    ancestors.push(node);
    for (const child of children(node)) walk(child, children, expanded);
    ancestors.pop();
  };
  walk(
    root,
    (node) =>
      node.kind === MatchKind.Ok
        ? node.matches.filter((child) => child.kind === MatchKind.Ok)
        : node.matches,
    new Set(),
  );
  if (rejected) walk(root, (node) => node.matches, new Set());
}

/**
 * The first `Ok` node in `root`'s subtree (including `root`) carrying
 * `decorator` metadata and satisfying `predicate`.
 */
export function findAnnotated(
  root: Match,
  decorator: EditorDecorator,
  predicate: (node: AnnotatableMatch) => boolean = () => true,
): AnnotatableMatch | undefined {
  let found: AnnotatableMatch | undefined;
  walkAnnotatable(root, (node) => {
    if (
      !found && node.kind === MatchKind.Ok &&
      hasEditorMetadata(node, decorator) && predicate(node)
    ) {
      found = node;
    }
  });
  return found;
}
