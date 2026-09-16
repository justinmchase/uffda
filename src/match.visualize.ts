import { getRightmostFailure, type Match, MatchKind } from "./match.ts";
import type { Path } from "./path.ts";
import {
  describePattern,
  expectation,
  formatValueSource,
  orAlternativeLabels,
} from "./match.describe_pattern.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { StackFrameKind } from "./runtime/stack/stackFrameKind.ts";

type MatchNode = {
  match: Match;
  depth: number;
  order: number;
  current: unknown;
  suppressed: boolean;
};

function childrenOf(match: Match): Match[] {
  if (match.kind === MatchKind.Ok || match.kind === MatchKind.Fail) {
    return match.matches;
  }
  return [];
}

function currentValue(match: Match): Promise<unknown> {
  if (match.kind === MatchKind.LR) return Promise.resolve(undefined);
  return match.scope.stream.next().then((input) => input.value);
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

async function collectNodes(root: Match): Promise<MatchNode[]> {
  const nodes: MatchNode[] = [];
  const seen = new Set<Match>();

  async function visit(
    match: Match,
    depth: number,
    suppressed: boolean,
  ): Promise<void> {
    if (seen.has(match)) return;
    seen.add(match);
    nodes.push({
      match,
      depth,
      order: nodes.length,
      current: await currentValue(match),
      suppressed,
    });
    const suppressChildren = suppressed ||
      (match.kind === MatchKind.Ok &&
        (match.pattern.kind === PatternKind.Or ||
          match.pattern.kind === PatternKind.Not ||
          match.pattern.kind === PatternKind.Except ||
          match.pattern.kind === PatternKind.Maybe));
    for (const child of childrenOf(match)) {
      await visit(child, depth + 1, suppressChildren);
    }
  }

  await visit(root, 0, false);
  return nodes;
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

/**
 * How far into the authored source a failure progressed. Uses
 * `originalSpan.start` (same notion as `getRightmostFailure`'s usefulness for
 * editors) rather than searching for the unexpected character with
 * `lastIndexOf`, which can rank a later tokenizer red herring (e.g. `WordToken`
 * on a trailing `;`) ahead of the real hole (e.g. a naked `|>`).
 */
function failureProgress(node: MatchNode): number {
  if (node.match.kind === MatchKind.LR) return -1;
  const original = node.match.originalSpan.start;
  if (typeof original === "number" && Number.isFinite(original)) {
    return original;
  }
  const segment = node.match.span.start.segments.at(-1);
  return typeof segment === "number" ? segment : -1;
}

function isLowSignalTokenizerFailure(node: MatchNode): boolean {
  if (node.match.kind === MatchKind.LR) return false;
  const href = node.match.scope.module.moduleUrl.href;
  // Tokenizer-module alternatives are almost never the author-facing focus:
  // they fire on later characters while an earlier syntactic hole is open.
  if (href.includes("/tokenizer/")) return true;

  const rules = node.match.scope.stack
    .filter((frame) => frame.kind === StackFrameKind.Rule)
    .map((frame) => frame.rule.name);
  if (
    rules.includes("WhitespaceToken") ||
    rules.includes("NewLineToken") ||
    rules.includes("WordToken") ||
    rules.includes("PunctuationToken") ||
    rules.includes("CommentToken")
  ) {
    return true;
  }
  const pattern = node.match.pattern;
  if (
    pattern.kind === PatternKind.Resolve &&
    "name" in pattern &&
    (pattern.name === "Whitespace" || pattern.name === "NewLine" ||
      pattern.name === "WordChar")
  ) {
    return true;
  }
  return false;
}

function hasTerminalExpectation(node: MatchNode): boolean {
  return expectation(node.match.pattern) !== undefined;
}

function selectDiagnosticCandidate(
  nodes: MatchNode[],
  source: string | undefined,
  root: Match,
): MatchNode | undefined {
  const pipeline = selectPipelineBoundary(nodes, source);
  const selected = pipeline && !isLowSignalTokenizerFailure(pipeline)
    ? pipeline
    : selectFailure(nodes);

  if (root.kind !== MatchKind.Fail) return selected;

  const rightmost = getRightmostFailure(root);
  const rightNode = nodes.find((node) => node.match === rightmost);
  if (!rightNode || isLowSignalTokenizerFailure(rightNode)) return selected;
  if (!selected) return rightNode;

  const selectedProgress = failureProgress(selected);
  const rightProgress = failureProgress(rightNode);

  // A candidate at or slightly past the rightmost failure is often a recovery
  // attempt after an incomplete pipeline (`|>` then later `)` / `;`). Prefer
  // the rightmost hole (e.g. Identifier in PipeTail) — do not pull back from
  // later high-signal unexpecteds like `#` in `(add 1 #)`.
  if (
    rightProgress <= selectedProgress &&
    selectedProgress - rightProgress <= 32
  ) {
    const selectedRules = selected.match.scope.stack
      .filter((frame) => frame.kind === StackFrameKind.Rule)
      .map((frame) => frame.rule.name);
    const incompletePipelineRecovery =
      selectedRules.includes("RulePatternTokenUntilProjection") ||
      selectedRules.includes("PipeTail") ||
      selected.current === "-" ||
      selected.current === ">";
    if (incompletePipelineRecovery) {
      const rightRules = rightNode.match.scope.stack
        .filter((frame) => frame.kind === StackFrameKind.Rule)
        .map((frame) => frame.rule.name);
      const rightIsPipelineHole = rightRules.includes("PipeTail") ||
        rightRules.includes("IdToken") ||
        (
          rightNode.match.pattern.kind === PatternKind.Resolve &&
          "name" in rightNode.match.pattern &&
          rightNode.match.pattern.name === "Identifier"
        );
      if (rightIsPipelineHole || rightProgress < selectedProgress) {
        return rightNode;
      }
    }
  }

  if (rightProgress === selectedProgress) {
    const selectedTerminal = hasTerminalExpectation(selected);
    const rightTerminal = hasTerminalExpectation(rightNode);
    if (selectedTerminal && !rightTerminal) return selected;
    if (rightTerminal && !selectedTerminal) return rightNode;
    // Prefer the shallower (more declaration-level) failure when tied.
    return selected.depth <= rightNode.depth ? selected : rightNode;
  }

  return selected;
}

function selectFailure(
  nodes: MatchNode[],
): MatchNode | undefined {
  const failures = nodes.filter(({ match, suppressed }) =>
    !suppressed &&
    (match.kind === MatchKind.Fail || match.kind === MatchKind.Error)
  );
  let selected: MatchNode | undefined;
  let selectedProgress = -1;

  for (const node of failures) {
    if (node.match.kind === MatchKind.LR) continue;
    if (isLowSignalTokenizerFailure(node)) continue;
    const progress = failureProgress(node);
    if (!selected || progress > selectedProgress) {
      selected = node;
      selectedProgress = progress;
      continue;
    }
    if (progress === selectedProgress && node.depth < selected.depth) {
      selected = node;
    }
  }
  // If every failure was low-signal, fall back to the unfiltered furthest.
  if (selected) return selected;
  for (const node of failures) {
    if (node.match.kind === MatchKind.LR) continue;
    const progress = failureProgress(node);
    if (!selected || progress > selectedProgress) {
      selected = node;
      selectedProgress = progress;
      continue;
    }
    if (progress === selectedProgress && node.depth < selected.depth) {
      selected = node;
    }
  }
  return selected;
}

function pipelineStages(match: Match): Match[] | undefined {
  if (match.pattern.kind !== PatternKind.Pipeline) return undefined;
  const { steps } = match.pattern;
  const direct = childrenOf(match);
  if (
    direct.length === steps.length &&
    direct.every((child, index) => Object.is(child.pattern, steps[index]))
  ) {
    return direct;
  }
  if (direct.length !== 1) return undefined;

  const nested = childrenOf(direct[0]);
  if (
    nested.length === steps.length &&
    nested.every((child, index) => Object.is(child.pattern, steps[index]))
  ) {
    return nested;
  }
  return undefined;
}

function selectPipelineBoundary(
  nodes: MatchNode[],
  source: string | undefined,
): MatchNode | undefined {
  if (!source) return undefined;

  for (const node of nodes) {
    const stages = pipelineStages(node.match);
    if (!stages) continue;
    const failedIndex = stages.findIndex((stage) =>
      stage.kind !== MatchKind.Ok
    );
    if (failedIndex <= 0) continue;

    const previous = stages[failedIndex - 1];
    if (previous.kind !== MatchKind.Ok || !Array.isArray(previous.value)) {
      continue;
    }
    const tokens = previous.value;
    if (!tokens.every((token) => typeof token === "string")) continue;

    let cursor = 0;
    let aligned = true;
    for (const token of tokens as string[]) {
      while (cursor < source.length && /\s/u.test(source[cursor])) cursor++;
      if (!source.startsWith(token, cursor)) {
        aligned = false;
        break;
      }
      cursor += token.length;
    }
    if (!aligned) continue;
    while (cursor < source.length && /\s/u.test(source[cursor])) cursor++;
    if (cursor >= source.length) continue;

    const boundary = source[cursor];
    const candidates = nodes.filter(({ match, current }) =>
      (match.kind === MatchKind.Fail || match.kind === MatchKind.Error) &&
      Object.is(current, boundary) &&
      sourceOffset(source, current, match.span.start) === cursor
    );
    candidates.sort((left, right) => left.depth - right.depth);
    if (candidates.length > 0) return candidates[0];
  }
  return undefined;
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

    const ruleName = ancestor.scope.stack
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

function analysisFromCandidate(
  match: Match,
  nodes: MatchNode[],
  source: string | undefined,
  candidate: MatchNode,
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

  const rules = candidate.match.scope.stack
    .filter((frame) => frame.kind === StackFrameKind.Rule)
    .map((frame) => frame.rule.name);

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
      const { match: nodeMatch, current, suppressed, depth, order } of nodes
    ) {
      if (suppressed && !candidate.suppressed) continue;
      if (
        nodeMatch.kind !== MatchKind.Fail && nodeMatch.kind !== MatchKind.Error
      ) {
        continue;
      }
      if (
        isLowSignalTokenizerFailure({
          match: nodeMatch,
          current,
          suppressed,
          depth,
          order,
        })
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
 * Selects the furthest-right failure (same focus as the terminal visualizer)
 * and collects unexpected input, expected alternatives at that site, and the
 * rule stack — without rendering the full failure tree.
 */
export async function analyzeMatchFailure(
  match: Match,
): Promise<MatchFailureAnalysis | undefined> {
  const nodes = await collectNodes(match);
  const sourceValue = await currentValue(match);
  const source = typeof sourceValue === "string" ? sourceValue : undefined;
  const candidate = selectDiagnosticCandidate(nodes, source, match);
  if (!candidate || candidate.match.kind === MatchKind.LR) return undefined;
  return analysisFromCandidate(match, nodes, source, candidate);
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
 * Editor/CLI diagnostic text: Expected first (the unclear part when the
 * squiggle already marks where), then optional FIRST-set value estimates,
 * then Unexpected, then the nearest rule.
 */
export function formatMatchFailureSummary(
  analysis: MatchFailureAnalysis,
): string {
  const lines = [
    `Expected ${expectedDisplay(analysis)}`,
  ];
  if (
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
  const candidate = selectDiagnosticCandidate(nodes, source, match);
  const lines = [
    "Match failure",
    `Outcome: ${match.kind}`,
    `Module: ${match.scope.module.moduleUrl.href}`,
  ];

  if (!candidate || candidate.match.kind === MatchKind.LR) {
    lines.push("No failed match was found.");
    return lines.join("\n");
  }

  const analysis = analysisFromCandidate(match, nodes, source, candidate);
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
      .filter(({ match: nodeMatch, current, suppressed }) =>
        (!suppressed || candidate.suppressed) &&
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
    if (!stages.some((stage) => stage.kind !== MatchKind.Ok)) continue;
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
      if (stage.kind === MatchKind.Ok) {
        pipelineLines.push(`      output: ${formatValue(stage.value)}`);
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
