import { Type, type } from "@justinmchase/type";
import { isSuccess, type Match, MatchKind } from "../match.ts";
import { ExpressionKind } from "../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { isPattern } from "../runtime/patterns/pattern.ts";
import {
  type AnnotatableMatch,
  declaredName,
  EditorDecorator,
  hasEditorMetadata,
  nameReferenceKinds,
  walkAccepted,
} from "./editor_metadata.ts";
import type { LoadedDeclarationKind } from "./mcp.session.ts";
import { shallow } from "../wrapped.ts";

/**
 * Local bindings for LSP hover (requirement 006): the rule parameters,
 * captured variables, and lambda parameters an identifier can refer to,
 * found through the document's parse tree — `[Declaration]` /
 * `[NameReference]` metadata plus the runtime pattern/expression AST each
 * production projects — never through grammar rule names.
 */

type SuccessMatch = Extract<
  AnnotatableMatch,
  { kind: MatchKind.Ok | MatchKind.Skip }
>;

/**
 * Where an identifier sits in the parse tree: at the last covering node a
 * pre-order walk reaches. That is the deepest one, except that a later reading
 * of the same input (a later pipeline stage, which parses an earlier stage's
 * output) takes precedence over an earlier one however deep it is.
 */
export type IdentifierPosition = {
  /**
   * Nodes covering the identifier, outermost first: `Ok` nodes for a parsed
   * document, possibly `Fail` ones for a construct still being typed (see
   * `completionContextsAt`).
   */
  chain: AnnotatableMatch[];
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
  let chain: SuccessMatch[] = [];
  walkAccepted(match, (node, ancestors) => {
    if (!isSuccess(node)) return;
    if (ancestors.some((a) => !isSuccess(a))) return;
    if (
      node.originalSpan.start > span.start || node.originalSpan.end < span.end
    ) return;
    chain = [...ancestors, node] as SuccessMatch[];
  });
  return positionOf(chain);
}

function positionOf(chain: AnnotatableMatch[]): IdentifierPosition {
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
 * `identifierPosition` for each of `spans` (sorted by `start`, not
 * overlapping), in one walk of `match`.
 */
export function identifierPositions(
  match: Match,
  spans: readonly { start: number; end: number }[],
): IdentifierPosition[] {
  // The accepted parse of an `Ok` root is `Ok` throughout; a `Fail` root
  // leaves no node with only `Ok` ancestors.
  if (!isSuccess(match)) return spans.map(() => positionOf([]));
  const parent = new Map<AnnotatableMatch, AnnotatableMatch | undefined>();
  const last: (AnnotatableMatch | undefined)[] = spans.map(() => undefined);
  walkAccepted(match, (node, ancestors) => {
    const level = ancestors.length;
    const { start, end } = node.originalSpan;
    let lo = 0;
    let hi = spans.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (spans[mid].start < start) lo = mid + 1;
      else hi = mid;
    }
    let covers = false;
    for (let i = lo; i < spans.length && spans[i].start < end; i++) {
      if (spans[i].end > end) continue;
      covers = true;
      last[i] = node;
    }
    if (!covers) return;
    parent.set(node, ancestors.at(-1));
    for (let i = level - 1; i >= 0 && !parent.has(ancestors[i]); i--) {
      parent.set(ancestors[i], ancestors[i - 1]);
    }
  });
  return last.map((node) => {
    const chain: AnnotatableMatch[] = [];
    for (
      let at: AnnotatableMatch | undefined = node;
      at !== undefined;
      at = parent.get(at)
    ) {
      chain.push(at);
    }
    return positionOf(chain.reverse());
  });
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
    isPattern(shallow(field(value, "pattern")));
}

/**
 * A `[Declaration]` (parsed or still being typed) or a parsed lambda. A lambda
 * still being typed has no value yet, so its bindings count toward the
 * enclosing scope, which is where the cursor inside it sees them anyway.
 */
function isScope(node: AnnotatableMatch): boolean {
  return hasEditorMetadata(node, EditorDecorator.Declaration) ||
    (isSuccess(node) && isLambda(shallow(node.value)));
}

function variableName(value: unknown): string | undefined {
  return isPattern(value) && value.kind === PatternKind.Variable
    ? value.name
    : undefined;
}

/**
 * Visits each `Ok` node directly within `scope` once (nested scopes
 * excluded): the accepted parse, plus the attempts on `chain` — a construct
 * still being typed is a `Fail` reaching the position, and keeps the bindings
 * it parsed before failing. Other `Fail` branches are attempts the parse
 * rejected, whose would-be bindings bind nothing.
 */
function walkScope(
  scope: AnnotatableMatch,
  chain: ReadonlySet<AnnotatableMatch>,
  visit: (node: SuccessMatch) => void,
): void {
  const seen = new Set<Match>();
  const walk = (node: AnnotatableMatch) => {
    if (seen.has(node) || (node !== scope && isScope(node))) return;
    seen.add(node);
    if (isSuccess(node)) visit(node);
    for (const child of node.matches) {
      if (
        isSuccess(child) ||
        (child.kind === MatchKind.Fail && chain.has(child))
      ) walk(child);
    }
  };
  walk(scope);
}

/**
 * The first node binding each variable directly within `scope`, narrowed to
 * the innermost node projecting that binding (wrappers such as a one-entry
 * parameter list pass the same value through).
 */
function variablesIn(
  scope: AnnotatableMatch,
  chain: ReadonlySet<AnnotatableMatch>,
): Map<string, SuccessMatch> {
  const found = new Map<string, SuccessMatch>();
  walkScope(scope, chain, (node) => {
    const name = variableName(shallow(node.value));
    if (name === undefined || found.has(name)) return;
    found.set(name, narrowed(node, name));
  });
  return found;
}

function narrowed(node: SuccessMatch, name: string): SuccessMatch {
  for (const child of node.matches) {
    const inner = firstBinding(child, name);
    if (inner) return inner;
  }
  return node;
}

function firstBinding(node: Match, name: string): SuccessMatch | undefined {
  if (!isSuccess(node) || isScope(node)) return undefined;
  if (variableName(shallow(node.value)) === name) return narrowed(node, name);
  for (const child of node.matches) {
    const inner = firstBinding(child, name);
    if (inner) return inner;
  }
  return undefined;
}

/** The names a declaration's `[Parameter]` productions bind. */
function parametersOf(
  declaration: AnnotatableMatch,
  chain: ReadonlySet<AnnotatableMatch>,
): string[] {
  const names: string[] = [];
  walkScope(declaration, chain, (node) => {
    if (!hasEditorMetadata(node, EditorDecorator.Parameter)) return;
    const [t, name] = type(field(shallow(node.value), "name"));
    if (t === Type.String && !names.includes(name as string)) {
      names.push(name as string);
    }
  });
  return names;
}

/** Per-scope bindings shared across `localBindingsAt` calls. */
export class LocalScopeMemo {
  readonly variables = new Map<AnnotatableMatch, Map<string, SuccessMatch>>();
  readonly parameters = new Map<AnnotatableMatch, string[]>();
}

function cached<T>(
  memo: Map<AnnotatableMatch, T> | undefined,
  scope: AnnotatableMatch,
  compute: () => T,
): T {
  if (!memo) return compute();
  let value = memo.get(scope);
  if (value === undefined) {
    value = compute();
    memo.set(scope, value);
  }
  return value;
}

/**
 * Every local binding visible at `position`, innermost first (a name bound
 * by an inner scope shadows the same name further out), mirroring reference
 * resolution: variables (expression references) bound by an enclosing lambda
 * or declaration pattern, and parameters (pattern references) of the
 * enclosing declaration.
 *
 * `memo` shares each scope's bindings across calls; it applies only to
 * positions in the accepted parse (a chain of `Ok` nodes), whose scopes bind
 * the same names wherever in them the position is.
 */
export function localBindingsAt(
  position: IdentifierPosition,
  memo?: LocalScopeMemo,
): LocalBinding[] {
  const variables = acceptsKind(position, "func");
  const parameters = acceptsKind(position, "rule");
  const bindings: LocalBinding[] = [];
  const bound = new Set<string>();
  const chain = new Set(position.chain);
  const shared = memo &&
      position.chain.every((node) => isSuccess(node))
    ? memo
    : undefined;
  const variablesOf = (scope: AnnotatableMatch) =>
    cached(shared?.variables, scope, () => variablesIn(scope, chain));
  const parameterNamesOf = (scope: AnnotatableMatch) =>
    cached(shared?.parameters, scope, () => parametersOf(scope, chain));
  const add = (binding: LocalBinding) => {
    if (bound.has(binding.name)) return;
    bound.add(binding.name);
    bindings.push(binding);
  };
  for (const node of [...position.chain].reverse()) {
    if (!isScope(node)) continue;
    const isDeclaration = hasEditorMetadata(node, EditorDecorator.Declaration);
    const declarationName = isDeclaration ? declaredName(node) : undefined;
    const owner = declarationName ? { declarationName } : {};
    if (variables) {
      for (const [name, variable] of variablesOf(node)) {
        add({
          kind: LocalBindingKind.Variable,
          name,
          span: {
            start: variable.originalSpan.start,
            end: variable.originalSpan.end,
          },
          ...owner,
        });
      }
    }
    if (isDeclaration) {
      if (parameters) {
        for (const name of parameterNamesOf(node)) {
          add({ kind: LocalBindingKind.Parameter, name, ...owner });
        }
      }
      break;
    }
  }
  return bindings;
}

/** The innermost local binding of `name` visible at `position`. */
export function localBindingAt(
  position: IdentifierPosition,
  name: string,
): LocalBinding | undefined {
  return localBindingsAt(position).find((binding) => binding.name === name);
}
