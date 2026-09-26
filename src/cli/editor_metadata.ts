import { Type, type } from "@justinmchase/type";
import { type Match, MatchKind } from "../match.ts";

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
  NameReference = "NameReference",
  Import = "Import",
  ModulePath = "ModulePath",
  ImportedName = "ImportedName",
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

/** The `name` field of a node's projected value (a `[Declaration]`). */
export function declaredName(node: Match): string | undefined {
  if (node.kind !== MatchKind.Ok) return undefined;
  const name = field(node.value, "name");
  return type(name)[0] === Type.String ? name as string : undefined;
}

/**
 * The text an annotated node denotes: its projected value when that is a
 * string (e.g. an unescaped module path), otherwise its source text.
 */
export function nodeText(node: AnnotatableMatch, source: string): string {
  if (node.kind === MatchKind.Ok && type(node.value)[0] === Type.String) {
    return node.value as string;
  }
  return source.slice(node.originalSpan.start, node.originalSpan.end);
}

/**
 * Visits every `Ok`/`Fail` node of `root` in pre-order, passing the chain of
 * its annotatable ancestors (outermost first). A `Fail` keeps the sub-matches
 * it accumulated before failing, so both branches are walked.
 */
export function walkAnnotatable(
  root: Match,
  visit: (
    node: AnnotatableMatch,
    ancestors: readonly AnnotatableMatch[],
  ) => void,
): void {
  const ancestors: AnnotatableMatch[] = [];
  const walk = (node: Match) => {
    if (node.kind !== MatchKind.Ok && node.kind !== MatchKind.Fail) return;
    visit(node, ancestors);
    ancestors.push(node);
    for (const child of node.matches) walk(child);
    ancestors.pop();
  };
  walk(root);
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
