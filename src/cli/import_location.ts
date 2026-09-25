import { Type, type } from "@justinmchase/type";
import { type Match, MatchKind } from "../match.ts";
import type { ImportFrame } from "../runtime/resolvers/resolver.ts";
import { type CliStreamFailureLocation, locationFromOffset } from "./stream.ts";

const IMPORT_DECLARATION_RULE = "ImportDeclarationSyntax";
const IMPORT_SPECIFIER_RULE = "ImportModuleSpecifier";
const IMPORT_NAME_LIST_RULE = "ImportNameList";
const IMPORT_NAME_RULE = "IdentifierToken";

type ImportNode = { node: Match; moduleUrl: unknown };

/**
 * Locates the source range of the import declaration `frame` names inside a
 * module's parse `Match`: the imported name `frame.name` when set and found
 * in the declaration's name list, else the module specifier string, else the
 * whole declaration. `frame.importIndex` counts the module's import
 * declarations in source order; the node's projected `moduleUrl` must agree
 * with `frame.moduleUrl`, otherwise the first declaration importing that
 * specifier is used. Returns `undefined` when no declaration matches.
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

  const nameList = frame.name === undefined
    ? undefined
    : findChild(chosen.node, IMPORT_NAME_LIST_RULE);
  const target = (nameList && findNameNode(nameList, source, frame.name!)) ??
    findChild(chosen.node, IMPORT_SPECIFIER_RULE) ??
    chosen.node;
  if (target.kind !== MatchKind.Ok) return undefined;
  const { start, end } = target.originalSpan;
  if (end <= start) return undefined;
  return { ...locationFromOffset(source, start), endOffset: end };
}

/** The `IdentifierToken` node in `nameList` whose source text is `name`. */
function findNameNode(
  nameList: Match,
  source: string,
  name: string,
): Match | undefined {
  if (nameList.kind !== MatchKind.Ok) return undefined;
  for (const child of nameList.matches) {
    if (child.kind !== MatchKind.Ok) continue;
    const { start, end } = child.originalSpan;
    if (
      child.origin?.rule.name === IMPORT_NAME_RULE &&
      source.slice(start, end) === name
    ) {
      return child;
    }
    const nested = findNameNode(child, source, name);
    if (nested) return nested;
  }
  return undefined;
}

function collectImportNodes(match: Match): ImportNode[] {
  const found: ImportNode[] = [];
  const seenStarts = new Set<number>();
  const walk = (node: Match) => {
    if (node.kind !== MatchKind.Ok) return;
    if (node.origin?.rule.name === IMPORT_DECLARATION_RULE) {
      const start = node.originalSpan.start;
      if (!seenStarts.has(start)) {
        seenStarts.add(start);
        found.push({ node, moduleUrl: projectedModuleUrl(node.value) });
      }
      return;
    }
    for (const child of node.matches) walk(child);
  };
  walk(match);
  return found;
}

function findChild(node: Match, ruleName: string): Match | undefined {
  if (node.kind !== MatchKind.Ok) return undefined;
  for (const child of node.matches) {
    if (child.kind !== MatchKind.Ok) continue;
    if (child.origin?.rule.name === ruleName) return child;
    const nested = findChild(child, ruleName);
    if (nested) return nested;
  }
  return undefined;
}

function projectedModuleUrl(value: unknown): unknown {
  const [t, v] = type(value);
  return t === Type.Object
    ? (v as { moduleUrl?: unknown }).moduleUrl
    : undefined;
}
