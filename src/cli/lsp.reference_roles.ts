import type { Match } from "../match.ts";
import { HighlightRole, type HighlightSpan } from "./highlight.ts";
import {
  acceptsKind,
  identifierPositions,
  localBindingsAt,
  LocalScopeMemo,
} from "./lsp.locals.ts";
import type { LoadedDeclarationKind, RuntimeSession } from "./mcp.session.ts";

const DECLARATION_ROLE: Record<LoadedDeclarationKind, HighlightRole> = {
  rule: HighlightRole.Type,
  func: HighlightRole.Function,
  decorator: HighlightRole.Type,
};

/**
 * Refines each `variable`-role span (a reference the grammar could not
 * classify further; see `highlight.ts`) by what its name resolves to, in the
 * order references resolve (as hover does): a local binding stays a
 * `variable`, a declared rule or decorator is a `type`, a declared func a
 * `function`, and — where a func may be named — a runtime global a
 * `function`. An unresolved name stays a `variable`. Read-only.
 */
export function resolveReferenceRoles(
  spans: readonly HighlightSpan[],
  match: Match,
  session: RuntimeSession,
): HighlightSpan[] {
  const references = spans.filter((span) =>
    span.role === HighlightRole.Variable
  );
  if (references.length === 0) return [...spans];

  const declarations = new Map(
    (session.listDeclarations()?.declarations ?? []).map((
      declaration,
    ) => [declaration.name, declaration.kind]),
  );
  const globals = new Set(session.listGlobals().map((global) => global.name));
  const positions = identifierPositions(
    match,
    references.map((span) => ({
      start: span.offset,
      end: span.offset + span.length,
    })),
  );
  const memo = new LocalScopeMemo();
  const roles = new Map<HighlightSpan, HighlightRole>();
  references.forEach((span, i) => {
    const position = positions[i];
    const name = span.text;
    if (localBindingsAt(position, memo).some((b) => b.name === name)) return;
    const kind = declarations.get(name);
    if (kind !== undefined) {
      roles.set(span, DECLARATION_ROLE[kind]);
    } else if (globals.has(name) && acceptsKind(position, "func")) {
      roles.set(span, HighlightRole.Function);
    }
  });
  return spans.map((span) => {
    const role = roles.get(span);
    return role === undefined ? span : { ...span, role };
  });
}
