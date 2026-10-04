import { isSuccess, type Match, MatchKind } from "./match.ts";
import type { Path } from "./path.ts";
import {
  describePattern,
  expectation,
  formatValueSource,
  orAlternativeLabels,
} from "./match.describe_pattern.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { Rule } from "./runtime/modules/rule.ts";
import type { RuleStackFrame } from "./runtime/stack/rule.ts";
import { StackFrameKind } from "./runtime/stack/stackFrameKind.ts";
import { sourceOffsetAt } from "./span.ts";
import { unwrap } from "./wrapped.ts";

type MatchNode = {
  match: Match;
  depth: number;
  order: number;
  current: unknown;
  /**
   * Whether the node cannot explain the failure being diagnosed (see
   * `excludesChildren`).
   */
  excluded: boolean;
  /**
   * How many of the node's ancestors succeeded. A failure under a successful
   * match was absorbed (an alternative or repetition moved on); one under
   * failures only is what made its ancestors fail.
   */
  absorbed: number;
  parent: MatchNode | undefined;
};

function childrenOf(match: Match): Match[] {
  if (isSuccess(match) || match.kind === MatchKind.Fail) {
    return match.matches;
  }
  return [];
}

function currentValue(match: Match): Promise<unknown> {
  if (match.kind === MatchKind.LR) return Promise.resolve(undefined);
  return Promise.resolve(match.scope.stream.step()).then((input) =>
    input ? unwrap(input.value) : undefined
  );
}

function formatValue(value: unknown): string {
  const inspected = Deno.inspect(value, {
    colors: false,
    compact: true,
    depth: 2,
    iterableLimit: 8,
    strAbbreviateSize: 160,
  }).replaceAll(/\s+/g, " ");
  return inspected.length > 240 ? `${inspected.slice(0, 237)}...` : inspected;
}

/**
 * Whether no failure under `match` can explain the failure being diagnosed: a
 * pipeline that succeeded transformed its input, so nothing it tried explains
 * what fails after it; a negative predicate that succeeded needed its child to
 * fail.
 */
function excludesChildren(match: Match): boolean {
  if (!isSuccess(match)) return false;
  switch (match.pattern.kind) {
    case PatternKind.Pipeline:
    case PatternKind.Not:
    case PatternKind.Except:
      return true;
    default:
      return false;
  }
}

async function collectNodes(
  root: Match,
  preceding: Match[] = [],
): Promise<MatchNode[]> {
  const nodes = new Map<Match, MatchNode>();
  // A failed pipeline's stages before the failing one succeeded and handed
  // their output on, so they cannot explain the failure either.
  const passedStages = new Set<Match>();

  // A memoized match can be reached along several paths. It takes its best
  // standing over all of them (least absorbed, excluded only if excluded on
  // every path), and is revisited when a path improves it.
  async function visit(
    match: Match,
    parent: MatchNode | undefined,
    excluded: boolean,
    absorbed: number,
  ): Promise<void> {
    const nodeExcluded = excluded || passedStages.has(match);
    let node = nodes.get(match);
    if (node) {
      const improves = absorbed < node.absorbed ||
        (node.excluded && !nodeExcluded);
      if (!improves) return;
      node.absorbed = Math.min(node.absorbed, absorbed);
      node.excluded = node.excluded && nodeExcluded;
      node.parent = parent;
      node.depth = parent ? parent.depth + 1 : 0;
    } else {
      node = {
        match,
        depth: parent ? parent.depth + 1 : 0,
        order: nodes.size,
        current: await currentValue(match),
        excluded: nodeExcluded,
        absorbed,
        parent,
      };
      nodes.set(match, node);
    }
    if (match.kind === MatchKind.Fail) {
      for (const stage of pipelineStages(match)?.slice(0, -1) ?? []) {
        passedStages.add(stage);
      }
    }
    const childrenExcluded = node.excluded || excludesChildren(match);
    for (const child of childrenOf(match)) {
      await visit(
        child,
        node,
        childrenExcluded,
        node.absorbed + (isSuccess(match) ? 1 : 0),
      );
    }
  }

  for (const match of preceding) await visit(match, undefined, false, 0);
  await visit(root, undefined, false, 0);
  return [...nodes.values()];
}

function sourceOffset(
  source: string | undefined,
  value: unknown,
  path: Path,
): number {
  if (!source || typeof value !== "string" || value.length === 0) return -1;

  const segment = path.segments.at(-1);
  if (
    typeof segment === "number" && segment >= 0 &&
    source.slice(segment, segment + value.length) === value
  ) {
    return segment;
  }
  return source.lastIndexOf(value);
}

/** How far into the original source a failure got. */
/**
 * Whether `match` fails only by reading a left-recursive head's initial
 * failing seed: a control signal of growth, not a failure of the input (see
 * `.agents/specifications/runtime/left-recursion.spec.md`).
 */
function readsOnlyFailingSeed(
  match: Match,
  known = new Map<Match, boolean>(),
): boolean {
  if (match.kind !== MatchKind.Fail) return false;
  const cached = known.get(match);
  if (cached !== undefined) return cached;
  known.set(match, false);
  const result = match.matches.length === 0
    ? match.origin?.seeded === true
    : match.matches.every((child) => readsOnlyFailingSeed(child, known));
  known.set(match, result);
  return result;
}

function failureProgress(node: MatchNode): number {
  if (node.match.kind === MatchKind.LR) return -1;
  return node.match.originalSpan.start;
}

function ruleFramesOf(node: MatchNode): RuleStackFrame[] {
  return node.match.scope.stack.frames()
    .filter((frame) => frame.kind === StackFrameKind.Rule);
}

/**
 * The failures of `tied` with no other of them inside: the failures that
 * enclose another only pass it on.
 */
function innermostOf(tied: MatchNode[]): MatchNode[] {
  const tiedMatches = new Set(tied.map(({ match }) => match));
  return tied.filter(({ match }) =>
    !childrenOf(match).some((child) => tiedMatches.has(child))
  );
}

/**
 * For each innermost tied failure, the rules around it that began where it
 * failed, innermost last. A rule that consumed input before failing was
 * underway, so its explanation of how it begins does not apply.
 */
function beganRuleFrames(tied: MatchNode[]): RuleStackFrame[][] {
  return innermostOf(tied).map((node) => {
    const failedAt = sourceOffsetAt(node.match.scope.stream);
    return ruleFramesOf(node).filter(({ input }) =>
      sourceOffsetAt(input) === failedAt
    );
  });
}

type DiagnosticFocus = {
  /** The failure reported. */
  node: MatchNode;
  /** The rules that can explain it (see `beganRuleFrames`). */
  began: RuleStackFrame[][];
};

/**
 * The failure a diagnostic reports: of the failures that can explain it (see
 * {@link MatchNode.excluded}), those furthest into the original source and,
 * of those, the least absorbed (see {@link MatchNode.absorbed}). The
 * shallowest of them is reported.
 */
function selectDiagnosticFocus(
  nodes: MatchNode[],
): DiagnosticFocus | undefined {
  const failures = nodes.filter(({ match }) =>
    match.kind === MatchKind.Fail || match.kind === MatchKind.Error
  );
  const seedReads = new Map<Match, boolean>();
  const relevant = failures.filter(({ match, excluded }) =>
    !excluded && !readsOnlyFailingSeed(match, seedReads)
  );
  const candidates = relevant.length > 0 ? relevant : failures;
  if (candidates.length === 0) return undefined;

  const furthest = Math.max(...candidates.map(failureProgress));
  const atFurthest = candidates.filter((node) =>
    failureProgress(node) === furthest
  );
  const leastAbsorbed = Math.min(...atFurthest.map(({ absorbed }) => absorbed));
  const tied = atFurthest.filter(({ absorbed }) => absorbed === leastAbsorbed);
  const [node] = [...tied].sort((a, b) =>
    a.depth - b.depth || a.order - b.order
  );
  return { node, began: beganRuleFrames(tied) };
}

/**
 * The stages a pipeline match ran, in order: every step when it succeeded,
 * through the failing step when it failed. `undefined` for any other match,
 * including a rule's match wrapping its pipeline body.
 */
function pipelineStages(match: Match): Match[] | undefined {
  if (match.pattern.kind !== PatternKind.Pipeline) return undefined;
  const { steps } = match.pattern;
  const stages = childrenOf(match);
  const ran = stages.length > 0 && stages.length <= steps.length &&
    stages.every((stage, index) => Object.is(stage.pattern, steps[index]));
  return ran ? stages : undefined;
}

function markRelevant(
  match: Match,
  targets: Set<Match>,
  relevant: Set<Match>,
  memo: Map<Match, boolean>,
  visiting: Set<Match>,
): boolean {
  const known = memo.get(match);
  if (known !== undefined) return known;
  if (visiting.has(match)) return targets.has(match);

  visiting.add(match);
  let includesTarget = targets.has(match);
  for (const child of childrenOf(match)) {
    includesTarget = markRelevant(
      child,
      targets,
      relevant,
      memo,
      visiting,
    ) || includesTarget;
  }
  visiting.delete(match);
  memo.set(match, includesTarget);
  if (includesTarget) relevant.add(match);
  return includesTarget;
}

async function renderFailureTree(
  root: Match,
  relevant: Set<Match>,
  candidate: MatchNode,
  ids: Map<Match, number>,
): Promise<string[]> {
  const lines: string[] = [];
  const rendered = new Set<Match>();

  async function render(match: Match, depth: number): Promise<void> {
    if (!relevant.has(match)) return;
    const indent = "  ".repeat(depth);
    const id = ids.get(match);
    if (rendered.has(match)) {
      lines.push(`${indent}[shared or cyclic match #${id}]`);
      return;
    }
    rendered.add(match);

    const path = match.kind === MatchKind.LR
      ? ""
      : ` @ ${match.span.start.toString()}`;
    let line = `${indent}${match.kind.toUpperCase()} #${id} ${
      describePattern(match.pattern)
    }${path}`;
    if (
      (match.kind === MatchKind.Fail || match.kind === MatchKind.Error) &&
      Object.is(await currentValue(match), candidate.current)
    ) {
      line += ` unexpected ${formatValue(candidate.current)}`;
    }
    if (match.kind === MatchKind.Error) {
      line += ` ${match.code}: ${match.message}`;
    }
    lines.push(line);

    for (const child of childrenOf(match)) await render(child, depth + 1);
  }

  await render(root, 0);
  return lines;
}

/** Structured focus of a match failure (furthest-right candidate). */
export type MatchFailureAnalysis = {
  unexpected: string;
  expected: string[];
  /**
   * Estimated FIRST-set tokens/keywords for an Or choice (when `expected` is
   * rule names). Empty when Expected is already terminal literals.
   */
  expectedValues: string[];
  rules: string[];
  pattern: string;
  location: string;
  /** Source character offset of the unexpected token, or -1 when unknown. */
  sourceOffset: number;
  /** Length of the unexpected token in source (0 at end-of-input). */
  unexpectedLength: number;
  moduleUrl: string;
  failureModuleUrl: string;
  /**
   * What the nearest explained rule enclosing the failure says about errors
   * in it, from {@link MatchFailureOptions.explain}: asked of the innermost
   * rule (the one named on the `In` line) first, then outward.
   */
  explanation?: string;
};

/** Explains errors in `rule`, or `undefined` when it has nothing to say. */
export type ExplainRule = (rule: Rule) => string | undefined;

export type MatchFailureOptions = {
  /** Asked of the rules enclosing the failure; see `explanation`. */
  explain?: ExplainRule;
  /**
   * Matches that came before the failure in its sequence. Failures inside
   * them are candidates too: what they failed to match past their end can be
   * why the failure's input was left over.
   */
  preceding?: Match[];
};

function isNoisyExpectedLabel(item: string): boolean {
  if (item.startsWith("character class ")) return true;
  if (item === "character" || item === "Letter" || item === "WordChar") {
    return true;
  }
  if (
    item === "Identifier" || item === "IdentifierStartCharacter" ||
    item === "IdToken" || item === "Whitespace" || item === "W" ||
    item === "NewLine" || item === "Token"
  ) {
    return true;
  }
  if (item.startsWith('"')) {
    try {
      const value = JSON.parse(item);
      // Single-char identifier starters (`"_"`) and whitespace are noise when
      // listing Or arms; keep multi-char keywords and punctuation tokens.
      return typeof value === "string" &&
        (value.length === 0 || /^\s*$/u.test(value) ||
          (value.length === 1 && /[A-Za-z_]/u.test(value)));
    } catch {
      return item.length <= 4;
    }
  }
  return false;
}

/** Noise filter for FIRST-set value estimates (allows `Identifier` / `type`). */
function isNoisyExpectedValue(item: string): boolean {
  if (item === "Identifier" || item === "type") return false;
  if (item.startsWith("character class ")) return true;
  if (!item.startsWith('"')) {
    // Bare rule names left over from incomplete peels are not values.
    return true;
  }
  if (item.startsWith('"')) {
    try {
      const value = JSON.parse(item);
      return typeof value === "string" &&
        (value.length === 0 || /^\s*$/u.test(value) ||
          (value.length === 1 && /[A-Za-z_]/u.test(value)));
    } catch {
      // Deno.inspect may emit `'"'` for a quote character — keep it.
      return false;
    }
  }
  return false;
}

/**
 * Estimate FIRST-set tokens/keywords under a failed Or arm by walking its
 * match subtree: leading `equal` literals, `Identifier` for id-token heads,
 * and flattened unions for productive Ors (`Atomic`, `Postfix`, …).
 */
function leadingValuesFromMatch(match: Match, depth = 0): string[] {
  if (depth > 14 || match.kind === MatchKind.LR) return [];
  const pattern = match.pattern;

  if (pattern.kind === PatternKind.Equal) {
    return [formatValueSource(pattern.value)];
  }

  if (pattern.kind === PatternKind.Resolve) {
    const name = "name" in pattern ? pattern.name : undefined;
    if (
      name === "IdToken" || name === "Identifier" ||
      name === "IdentifierToken"
    ) {
      return ["Identifier"];
    }
    // Collapse large closed sets to a single hint instead of enumerating.
    if (name === "TypeKeyword") return ["type"];
    if (name === "CharacterClass") return [];

    const expand = name === "Atomic" || name === "Postfix" ||
      name === "Structure" || name === "Literals" || name === "Atoms" ||
      name === "Star" || name === "Plus" || name === "Optional" ||
      name === "StarMinMax" || name === "StarBare" || name === "StarMinOpen" ||
      name === "StarMaxOnly" || name === "StarMinOnly";
    if (expand) {
      const values: string[] = [];
      for (const child of childrenOf(match)) {
        values.push(...leadingValuesFromMatch(child, depth + 1));
      }
      return values;
    }
    for (const child of childrenOf(match)) {
      const values = leadingValuesFromMatch(child, depth + 1);
      if (values.length > 0) return values;
    }
    return [];
  }

  if (pattern.kind === PatternKind.Variable) {
    for (const child of childrenOf(match)) {
      const values = leadingValuesFromMatch(child, depth + 1);
      if (values.length > 0) return values;
    }
    return [];
  }

  if (pattern.kind === PatternKind.Then) {
    const first = childrenOf(match)[0];
    return first ? leadingValuesFromMatch(first, depth + 1) : [];
  }

  if (pattern.kind === PatternKind.Or) {
    const values: string[] = [];
    for (const child of childrenOf(match)) {
      values.push(...leadingValuesFromMatch(child, depth + 1));
    }
    return values;
  }

  for (const child of childrenOf(match)) {
    const values = leadingValuesFromMatch(child, depth + 1);
    if (values.length > 0) return values;
  }
  return [];
}

/**
 * Walk from the focus failure up through Or ancestors and pick the nearest
 * alternative set that looks like a grammar product (rule names and/or
 * keywords), not a character-class or identifier-start split.
 *
 * Only Ors whose choice point is still near the focus are used. An Or whose
 * start is far behind the focus (e.g. `ModuleDeclarationSyntax` after
 * `rule Name = …`) is a committed production — listing sibling arms would be
 * misleading. Nested `into` explorations can produce spurious Ok descendants,
 * so progress is measured by authored-span proximity instead.
 */
function expectedFromOrAncestors(
  root: Match,
  focus: Match,
): { rules: string[]; values: string[] } | undefined {
  const path: Match[] = [];
  const seen = new Set<Match>();

  const find = (node: Match): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (node === focus) return true;
    for (const child of childrenOf(node)) {
      if (find(child)) {
        path.push(node);
        return true;
      }
    }
    return false;
  };
  if (!find(root)) return undefined;

  const focusStart = focus.kind === MatchKind.LR
    ? undefined
    : focus.originalSpan.start;

  // `path` is parent-first from focus upward.
  for (const ancestor of path) {
    if (ancestor.kind !== MatchKind.Fail) continue;
    if (ancestor.pattern.kind !== PatternKind.Or) continue;

    const ruleName = ancestor.scope.stack.frames()
      .filter((frame) => frame.kind === StackFrameKind.Rule)
      .at(-1)
      ?.rule.name;
    if (
      ruleName &&
      (ruleName === "Identifier" ||
        ruleName === "IdentifierStartCharacter" ||
        ruleName === "Letter" ||
        ruleName === "Whitespace" ||
        ruleName === "W" ||
        ruleName === "WordToken" ||
        ruleName === "WordChar")
    ) {
      continue;
    }

    const orStart = ancestor.originalSpan.start;
    if (
      typeof focusStart === "number" &&
      typeof orStart === "number" &&
      focusStart - orStart > 8
    ) {
      // Focus is deep inside one arm past the choice point.
      continue;
    }

    const labels = orAlternativeLabels(ancestor.pattern);
    const rules = [...new Set(labels)].filter((item) =>
      !isNoisyExpectedLabel(item)
    );
    if (rules.length < 2 || rules.length > 24) continue;

    const valueSet = new Set<string>();
    for (const arm of childrenOf(ancestor)) {
      for (const value of leadingValuesFromMatch(arm)) {
        if (!isNoisyExpectedValue(value)) valueSet.add(value);
      }
    }
    return { rules: rules.sort(), values: [...valueSet].sort() };
  }
  return undefined;
}

/**
 * The explanation of the innermost explained rule that began where the
 * innermost failures failed and encloses every one of them. A rule around
 * only some of them is one of several alternatives that failed at the same
 * place, not the reason for the failure.
 */
function sharedExplanation(
  began: RuleStackFrame[][],
  explain: ExplainRule | undefined,
): string | undefined {
  if (!explain || began.length === 0) return undefined;
  const [first, ...rest] = began.map((frames) =>
    frames.map(({ rule }) => rule).filter((rule) => explain(rule))
  );
  const shared = first.findLast((rule) =>
    rest.every((rules) => rules.includes(rule))
  );
  return shared && explain(shared);
}

function analysisFromFocus(
  match: Match,
  nodes: MatchNode[],
  source: string | undefined,
  { node: candidate, began }: DiagnosticFocus,
  options: MatchFailureOptions = {},
): MatchFailureAnalysis | undefined {
  if (candidate.match.kind === MatchKind.LR) return undefined;

  const originalStart = candidate.match.originalSpan.start;
  const offsetFromCurrent = sourceOffset(
    source,
    candidate.current,
    candidate.match.span.start,
  );
  // Prefer locating the unexpected token by value when that search lands near
  // the authored span (avoids lastIndexOf jumping to a later identical `;`).
  let offset = -1;
  if (typeof candidate.current === "string" && offsetFromCurrent >= 0) {
    const slop = Math.max(1, candidate.current.length);
    if (
      typeof originalStart !== "number" ||
      Math.abs(offsetFromCurrent - originalStart) <= slop
    ) {
      offset = offsetFromCurrent;
    }
  }
  if (
    offset < 0 && typeof originalStart === "number" &&
    Number.isFinite(originalStart)
  ) {
    offset = originalStart;
  } else if (offset < 0) {
    offset = offsetFromCurrent;
  }

  const location = `${candidate.match.span.start.toString()}${
    offset >= 0 ? ` (source offset ${offset})` : ""
  }`;

  const ruleFrames = ruleFramesOf(candidate);
  const rules = ruleFrames.map((frame) => frame.rule.name);
  const explanation = sharedExplanation(began, options.explain);

  const focusTerminal = expectation(candidate.match.pattern);
  const focusHasTerminal = focusTerminal !== undefined &&
    !isNoisyExpectedLabel(focusTerminal);

  // Prefer a nearby Or FIRST-set when the focus itself is not already a
  // concrete terminal (`equal ";"`, etc.).
  const fromOr = focusHasTerminal
    ? undefined
    : expectedFromOrAncestors(match, candidate.match);

  const expectations = new Set<string>(fromOr?.rules ?? []);
  if (focusHasTerminal && focusTerminal) {
    expectations.add(focusTerminal);
  }
  if (!fromOr) {
    for (
      const { match: nodeMatch, current, excluded } of nodes
    ) {
      if (excluded && !candidate.excluded) continue;
      if (
        nodeMatch.kind !== MatchKind.Fail && nodeMatch.kind !== MatchKind.Error
      ) {
        continue;
      }
      // Gather expectations at the same authored position as the focus.
      if (
        typeof originalStart === "number" &&
        nodeMatch.originalSpan.start !== originalStart
      ) {
        continue;
      }
      if (
        typeof originalStart !== "number" &&
        (!Object.is(current, candidate.current) ||
          sourceOffset(source, current, nodeMatch.span.start) !== offset)
      ) {
        continue;
      }
      const description = expectation(nodeMatch.pattern);
      if (description) expectations.add(description);
    }
  }

  const unexpectedLength = typeof candidate.current === "string"
    ? candidate.current.length
    : 0;

  return {
    unexpected: candidate.current === undefined
      ? "<end of input>"
      : formatValue(candidate.current),
    expected: refineExpected([...expectations]),
    expectedValues: fromOr?.values ?? [],
    rules,
    pattern: describePattern(candidate.match.pattern),
    location,
    sourceOffset: offset,
    unexpectedLength,
    moduleUrl: match.scope.module.moduleUrl.href,
    failureModuleUrl: candidate.match.scope.module.moduleUrl.href,
    ...(explanation ? { explanation } : {}),
  };
}

/** Drop whitespace-only / character-class noise when better expectations exist. */
function refineExpected(items: string[]): string[] {
  const sorted = [...items].sort();
  const meaningful = sorted.filter((item) => !isNoisyExpectedLabel(item));
  // Prefer non-noise labels; if that emptied the list, keep originals so the
  // caller still has pattern/rules context.
  return meaningful.length > 0 ? meaningful : sorted;
}

/**
 * Selects the reported failure (see `selectDiagnosticFocus`; the same focus
 * as the terminal visualizer)
 * and collects unexpected input, expected alternatives at that site, and the
 * rule stack — without rendering the full failure tree.
 */
export async function analyzeMatchFailure(
  match: Match,
  options: MatchFailureOptions = {},
): Promise<MatchFailureAnalysis | undefined> {
  const nodes = await collectNodes(match, options.preceding);
  const sourceValue = await currentValue(match);
  const source = typeof sourceValue === "string" ? sourceValue : undefined;
  const focus = selectDiagnosticFocus(nodes);
  if (!focus || focus.node.match.kind === MatchKind.LR) return undefined;
  return analysisFromFocus(match, nodes, source, focus, options);
}

/** What to show as "Expected …" — Or alternatives, terminals, else the pattern. */
export function expectedDisplay(analysis: MatchFailureAnalysis): string {
  const resolveName = /\bresolve (\S+)$/.exec(analysis.pattern)?.[1];
  const refined = analysis.expected.filter((item) =>
    !isNoisyExpectedLabel(item)
  );
  // Prefer an Or-derived (or terminal) alternative list when we have one.
  if (refined.length > 0) return refined.join(", ");
  // Identifier holes with no richer Or list: say `Identifier`, not Letter|"_".
  if (
    analysis.rules.includes("IdToken") ||
    resolveName === "Identifier" ||
    /\bIdentifier\b/.test(analysis.pattern)
  ) {
    return "Identifier";
  }
  if (resolveName) return resolveName;
  // `equal ";"` is clearer as `";"` when that is the pattern itself.
  if (analysis.pattern.startsWith("equal ")) {
    return analysis.pattern.slice("equal ".length);
  }
  return analysis.pattern;
}

/**
 * Editor/CLI diagnostic text: the nearest enclosing rule's explanation when
 * one has it, in place of Expected and its FIRST-set value estimates; otherwise
 * Expected (the unclear part when the squiggle already marks where) and the
 * estimates. Then Unexpected, then the nearest rule.
 */
export function formatMatchFailureSummary(
  analysis: MatchFailureAnalysis,
): string {
  const lines = analysis.explanation
    ? [analysis.explanation]
    : [`Expected ${expectedDisplay(analysis)}`];
  if (
    !analysis.explanation &&
    analysis.expectedValues.length > 0 &&
    // Avoid repeating the same list when Expected is already the values.
    analysis.expectedValues.join(", ") !== expectedDisplay(analysis)
  ) {
    lines.push(`e.g. ${analysis.expectedValues.join(", ")}`);
  }
  lines.push(`Unexpected ${analysis.unexpected}`);
  const rule = analysis.rules.at(-1);
  if (rule) lines.push(`In ${rule}`);
  return lines.join("\n");
}

export async function visualizeMatchFailure(match: Match): Promise<string> {
  const nodes = await collectNodes(match);
  const sourceValue = await currentValue(match);
  const source = typeof sourceValue === "string" ? sourceValue : undefined;
  const focus = selectDiagnosticFocus(nodes);
  const lines = [
    "Match failure",
    `Outcome: ${match.kind}`,
    `Module: ${match.scope.module.moduleUrl.href}`,
  ];

  const candidate = focus?.node;
  if (!focus || !candidate || candidate.match.kind === MatchKind.LR) {
    lines.push("No failed match was found.");
    return lines.join("\n");
  }

  const analysis = analysisFromFocus(match, nodes, source, focus);
  if (!analysis) {
    lines.push("No failed match was found.");
    return lines.join("\n");
  }
  lines.push(
    `Location: ${analysis.location}`,
    `Unexpected: ${analysis.unexpected}`,
    `Failure module: ${analysis.failureModuleUrl}`,
  );

  if (analysis.rules.length > 0) {
    lines.push(`Rules: ${analysis.rules.join(" > ")}`);
  }
  if (analysis.expected.length > 0) {
    lines.push(`Expected: ${analysis.expected.join(", ")}`);
  }

  const offset = sourceOffset(
    source,
    candidate.current,
    candidate.match.span.start,
  );
  const targets = new Set(
    nodes
      .filter(({ match: nodeMatch, current, excluded }) =>
        (!excluded || candidate.excluded) &&
        (nodeMatch.kind === MatchKind.Fail ||
          nodeMatch.kind === MatchKind.Error) &&
        Object.is(current, candidate.current) &&
        sourceOffset(source, current, nodeMatch.span.start) === offset
      )
      .map(({ match: nodeMatch }) => nodeMatch),
  );

  const seenStageLists = new Set<Match[]>();
  const pipelineLines: string[] = [];
  let pipelineCount = 0;
  for (const node of nodes) {
    const stages = pipelineStages(node.match);
    if (!stages || seenStageLists.has(stages)) continue;
    if (!stages.some((stage) => !isSuccess(stage))) continue;
    seenStageLists.add(stages);
    pipelineCount++;
    pipelineLines.push(
      `Pipeline ${pipelineCount}: ${node.match.scope.module.moduleUrl.href}`,
    );
    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index];
      pipelineLines.push(
        `  [${index + 1}] ${stage.kind.toUpperCase()} ${
          describePattern(stage.pattern)
        }`,
      );
      if (isSuccess(stage)) {
        pipelineLines.push(`      output: ${formatValue(unwrap(stage.value))}`);
      }
    }
  }
  if (pipelineLines.length > 0) {
    lines.push("", "Pipelines:", ...pipelineLines);
  }

  const relevant = new Set<Match>();
  markRelevant(match, targets, relevant, new Map(), new Set());
  const ids = new Map(nodes.map((node) => [node.match, node.order + 1]));
  lines.push(
    "",
    "Failure tree:",
    ...(await renderFailureTree(match, relevant, candidate, ids)),
  );
  return lines.join("\n");
}
