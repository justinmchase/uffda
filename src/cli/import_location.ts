import { Type, type } from "@justinmchase/type";
import { type Match, MatchKind } from "../match.ts";
import type { ImportFrame } from "../runtime/resolvers/resolver.ts";
import {
  type AnnotatableMatch,
  EditorDecorator,
  findAnnotated,
  hasEditorMetadata,
  nodeText,
  walkAnnotatable,
} from "./editor_metadata.ts";
import { type CliStreamFailureLocation, locationFromOffset } from "./stream.ts";

type ImportNode = { node: AnnotatableMatch; moduleUrl: unknown };

/**
 * Locates the source range of the import declaration `frame` names inside a
 * module's parse `Match`, using the grammar's editor metadata (see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`): within the
 * `[Import]` node, the `[ImportedName]` node denoting `frame.name` when set,
 * else the `[ModulePath]` node, else the whole declaration.
 * `frame.importIndex` counts the module's `[Import]` nodes in source order;
 * the node's projected `moduleUrl` must agree with `frame.moduleUrl`,
 * otherwise the first declaration importing that specifier is used. Returns
 * `undefined` when no declaration matches.
 */
export function importFrameLocation(
  match: Match,
  source: string,
  frame: ImportFrame,
): CliStreamFailureLocation | undefined {
  const imports = collectImportNodes(match);
  const indexed = imports[frame.importIndex];
  const chosen = indexed?.moduleUrl === frame.moduleUrl
    ? indexed
    : imports.find((i) => i.moduleUrl === frame.moduleUrl);
  if (!chosen) return undefined;

  const name = frame.name === undefined ? undefined : findAnnotated(
    chosen.node,
    EditorDecorator.ImportedName,
    (node) => nodeText(node, source) === frame.name,
  );
  const target = name ??
    findAnnotated(chosen.node, EditorDecorator.ModulePath) ??
    chosen.node;
  const { start, end } = target.originalSpan;
  if (end <= start) return undefined;
  return { ...locationFromOffset(source, start), endOffset: end };
}

function collectImportNodes(match: Match): ImportNode[] {
  const found: ImportNode[] = [];
  const seenStarts = new Set<number>();
  walkAnnotatable(match, (node) => {
    if (
      node.kind !== MatchKind.Ok ||
      !hasEditorMetadata(node, EditorDecorator.Import)
    ) return;
    const start = node.originalSpan.start;
    if (seenStarts.has(start)) return;
    seenStarts.add(start);
    found.push({ node, moduleUrl: projectedModuleUrl(node.value) });
  });
  return found;
}

function projectedModuleUrl(value: unknown): unknown {
  const [t, v] = type(value);
  return t === Type.Object
    ? (v as { moduleUrl?: unknown }).moduleUrl
    : undefined;
}
