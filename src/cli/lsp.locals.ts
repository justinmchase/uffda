import { Type, type } from "@justinmchase/type";
import { type Match, MatchKind } from "../match.ts";
import { ExpressionKind } from "../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { isPattern } from "../runtime/patterns/pattern.ts";
import {
  type AnnotatableMatch,
  declaredName,
  EditorDecorator,
  hasEditorMetadata,
  nameReferenceKinds,
  walkAnnotatable,
} from "./editor_metadata.ts";
import type { LoadedDeclarationKind } from "./mcp.session.ts";

/**
 * Local bindings for LSP hover (requirement 006): the rule parameters,
 * captured variables, and lambda parameters an identifier can refer to,
 * found through the document's parse tree — `[Declaration]` /
 * `[NameReference]` metadata plus the runtime pattern/expression AST each
 * production projects — never through grammar rule names.
 */

type OkMatch = Extract<AnnotatableMatch, { kind: MatchKind.Ok }>;

/** Where an identifier sits in the parse tree. */
export type IdentifierPosition = {
  /** `Ok` nodes covering the identifier, outermost first. */
  chain: OkMatch[];
  /**
   * The declaration kinds the outermost covering `[NameReference]` names,
   * `undefined` when it names none (every kind); absent when the identifier
   * is not a reference at all (for example a binding site).
   */
  reference?: { kinds?: string[] };
};

export function identifierPosition(
  match: Match,
  span: { start: number; end: number },
): IdentifierPosition {
  let chain: OkMatch[] = [];
  walkAnnotatable(match, (node, ancestors) => {
    if (node.kind !== MatchKind.Ok) return;
    if (ancestors.some((a) => a.kind !== MatchKind.Ok)) return;
    if (
      node.originalSpan.start > span.start || node.originalSpan.end < span.end
    ) return;
    if (ancestors.length + 1 > chain.length) {
      chain = [...ancestors, node] as OkMatch[];
    }
  });
  const reference = chain.find((node) =>
    hasEditorMetadata(node, EditorDecorator.NameReference)
  );
  return {
    chain,
    ...(reference
      ? { reference: { kinds: nameReferenceKinds(reference) } }
      : {}),
  };
}

/**
 * Whether a name at `position` may resolve to a declaration of `kind`:
 * always at a non-reference position, otherwise per the reference's kinds.
 */
export function acceptsKind(
  position: IdentifierPosition,
  kind: LoadedDeclarationKind,
): boolean {
  const kinds = position.reference?.kinds;
  return kinds === undefined || kinds.includes(kind);
}

export enum LocalBindingKind {
  Parameter = "parameter",
  Variable = "variable",
}

export type LocalBinding =
  | {
    kind: LocalBindingKind.Parameter;
    name: string;
    /** The rule declaring the parameter. */
    declarationName?: string;
  }
  | {
    kind: LocalBindingKind.Variable;
    name: string;
    /** Source span of the binding pattern (`name:pattern`). */
    span: { start: number; end: number };
    /** The declaration whose own parameters/pattern bind it (not a lambda). */
    declarationName?: string;
  };

function field(value: unknown, name: string): unknown {
  const [t, v] = type(value);
  return t === Type.Object ? (v as Record<string, unknown>)[name] : undefined;
}

function isLambda(value: unknown): boolean {
  return field(value, "kind") === ExpressionKind.Lambda &&
    isPattern(field(value, "pattern"));
}

function isScope(node: OkMatch): boolean {
  return hasEditorMetadata(node, EditorDecorator.Declaration) ||
    isLambda(node.value);
}

function bindsVariable(value: unknown, name: string): boolean {
  return isPattern(value) && value.kind === PatternKind.Variable &&
    value.name === name;
}

/**
 * The first node binding variable `name` directly within `scope`, narrowed
 * to the innermost node projecting that binding (wrappers such as a
 * one-entry parameter list pass the same value through).
 */
function variableIn(scope: OkMatch, name: string): OkMatch | undefined {
  const walk = (node: Match): OkMatch | undefined => {
    if (node.kind !== MatchKind.Ok) return undefined;
    if (node !== scope && isScope(node)) return undefined;
    if (bindsVariable(node.value, name)) {
      return node.matches.map(walk).find((inner) => inner) ?? node;
    }
    for (const child of node.matches) {
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  };
  return walk(scope);
}

function hasParameter(declaration: OkMatch, name: string): boolean {
  const [t, parameters] = type(field(declaration.value, "parameters"));
  return t === Type.Array &&
    (parameters as unknown[]).some((p) => field(p, "name") === name);
}

/**
 * The innermost local binding of `name` visible at `position`, mirroring
 * reference resolution: variables (expression references) bound by an
 * enclosing lambda or declaration pattern, and parameters (pattern
 * references) of the enclosing rule.
 */
export function localBindingAt(
  position: IdentifierPosition,
  name: string,
): LocalBinding | undefined {
  const variables = acceptsKind(position, "func");
  const parameters = acceptsKind(position, "rule");
  for (const node of [...position.chain].reverse()) {
    if (!isScope(node)) continue;
    const isDeclaration = hasEditorMetadata(node, EditorDecorator.Declaration);
    const declarationName = isDeclaration ? declaredName(node) : undefined;
    const variable = variables ? variableIn(node, name) : undefined;
    if (variable) {
      return {
        kind: LocalBindingKind.Variable,
        name,
        span: {
          start: variable.originalSpan.start,
          end: variable.originalSpan.end,
        },
        ...(declarationName ? { declarationName } : {}),
      };
    }
    if (isDeclaration) {
      if (parameters && hasParameter(node, name)) {
        return {
          kind: LocalBindingKind.Parameter,
          name,
          ...(declarationName ? { declarationName } : {}),
        };
      }
      return undefined;
    }
  }
  return undefined;
}
