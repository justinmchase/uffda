import { type Match, MatchKind } from "./match.ts";
import type { Path } from "./path.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { Pattern } from "./runtime/patterns/pattern.ts";
import {
  type ValueSource,
  ValueSourceKind,
} from "./runtime/patterns/value_source.ts";
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

function currentValue(match: Match): unknown {
  if (match.kind === MatchKind.LR) return undefined;
  return match.scope.stream.next().value;
}

function formatValueSource(source: ValueSource): string {
  switch (source.kind) {
    case ValueSourceKind.Variable:
      return `$${source.name}`;
    case ValueSourceKind.Literal:
      return formatValue(source.value);
    default: {
      const _exhaustive: never = source;
      return formatValue(_exhaustive);
    }
  }
}

function formatValueSources(sources: ValueSource[]): string {
  return `[${sources.map(formatValueSource).join(", ")}]`;
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

function shortPattern(pattern: Pattern): string {
  switch (pattern.kind) {
    case PatternKind.Resolve:
      return "name" in pattern && pattern.name
        ? `resolve ${pattern.name}`
        : `resolve ${pattern.targetKind}`;
    case PatternKind.Equal:
      return `equal ${formatValueSource(pattern.value)}`;
    case PatternKind.Character:
      return `character ${pattern.characterClass}`;
    case PatternKind.Type:
      return `type ${pattern.type}`;
    default:
      return pattern.kind;
  }
}

function formatOptionalValueSource(
  source: ValueSource | undefined,
): string {
  return source == null ? "" : formatValueSource(source);
}

function describePattern(pattern: Pattern): string {
  switch (pattern.kind) {
    case PatternKind.Between:
      return `between ${formatOptionalValueSource(pattern.left)}..${
        formatOptionalValueSource(pattern.right)
      }`;
    case PatternKind.Includes:
      return `includes ${formatValueSources(pattern.values)}`;
    case PatternKind.Into:
      return `into -> ${shortPattern(pattern.pattern)}`;
    case PatternKind.Variable:
      return `${pattern.name}: ${shortPattern(pattern.pattern)}`;
    case PatternKind.RegExp:
      return `regexp ${pattern.pattern}`;
    default:
      return shortPattern(pattern);
  }
}

function expectation(pattern: Pattern): string | undefined {
  switch (pattern.kind) {
    case PatternKind.Between:
      return `${formatOptionalValueSource(pattern.left)}..${
        formatOptionalValueSource(pattern.right)
      }`;
    case PatternKind.Character:
      return `character class ${pattern.characterClass}`;
    case PatternKind.End:
      return "end of input";
    case PatternKind.Equal:
      return formatValueSource(pattern.value);
    case PatternKind.Fail:
      return "explicit failure";
    case PatternKind.Includes:
      return `one of ${formatValueSources(pattern.values)}`;
    case PatternKind.RegExp:
      return `${pattern.pattern}`;
    case PatternKind.Type:
      return `type ${pattern.type}`;
    default:
      return undefined;
  }
}

function collectNodes(root: Match): MatchNode[] {
  const nodes: MatchNode[] = [];
  const seen = new Set<Match>();

  function visit(match: Match, depth: number, suppressed: boolean): void {
    if (seen.has(match)) return;
    seen.add(match);
    nodes.push({
      match,
      depth,
      order: nodes.length,
      current: currentValue(match),
      suppressed,
    });
    const suppressChildren = suppressed ||
      (match.kind === MatchKind.Ok &&
        (match.pattern.kind === PatternKind.Or ||
          match.pattern.kind === PatternKind.Not ||
          match.pattern.kind === PatternKind.Except ||
          match.pattern.kind === PatternKind.Maybe));
    for (const child of childrenOf(match)) {
      visit(child, depth + 1, suppressChildren);
    }
  }

  visit(root, 0, false);
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

function selectFailure(
  nodes: MatchNode[],
  source: string | undefined,
): MatchNode | undefined {
  const failures = nodes.filter(({ match, suppressed }) =>
    !suppressed &&
    (match.kind === MatchKind.Fail || match.kind === MatchKind.Error)
  );
  let selected: MatchNode | undefined;
  let selectedOffset = -1;

  for (const node of failures) {
    if (node.match.kind === MatchKind.LR) continue;
    const offset = sourceOffset(source, node.current, node.match.span.start);
    if (!selected || offset > selectedOffset) {
      selected = node;
      selectedOffset = offset;
      continue;
    }
    if (offset === selectedOffset && node.depth < selected.depth) {
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

function renderFailureTree(
  root: Match,
  relevant: Set<Match>,
  candidate: MatchNode,
  ids: Map<Match, number>,
): string[] {
  const lines: string[] = [];
  const rendered = new Set<Match>();

  function render(match: Match, depth: number): void {
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
      Object.is(currentValue(match), candidate.current)
    ) {
      line += ` unexpected ${formatValue(candidate.current)}`;
    }
    if (match.kind === MatchKind.Error) {
      line += ` ${match.code}: ${match.message}`;
    }
    lines.push(line);

    for (const child of childrenOf(match)) render(child, depth + 1);
  }

  render(root, 0);
  return lines;
}

export function visualizeMatchFailure(match: Match): string {
  const nodes = collectNodes(match);
  const sourceValue = currentValue(match);
  const source = typeof sourceValue === "string" ? sourceValue : undefined;
  const candidate = selectPipelineBoundary(nodes, source) ??
    selectFailure(nodes, source);
  const lines = [
    "Match failure",
    `Outcome: ${match.kind}`,
    `Module: ${match.scope.module.moduleUrl.href}`,
  ];

  if (!candidate || candidate.match.kind === MatchKind.LR) {
    lines.push("No failed match was found.");
    return lines.join("\n");
  }

  const offset = sourceOffset(
    source,
    candidate.current,
    candidate.match.span.start,
  );
  lines.push(
    `Location: ${candidate.match.span.start.toString()}${
      offset >= 0 ? ` (source offset ${offset})` : ""
    }`,
    `Unexpected: ${
      candidate.current === undefined
        ? "<end of input>"
        : formatValue(candidate.current)
    }`,
    `Failure module: ${candidate.match.scope.module.moduleUrl.href}`,
  );

  const rules = candidate.match.scope.stack
    .filter((frame) => frame.kind === StackFrameKind.Rule)
    .map((frame) => frame.rule.name);
  if (rules.length > 0) lines.push(`Rules: ${rules.join(" > ")}`);

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
  const expectations = new Set<string>();
  for (const target of targets) {
    const description = expectation(target.pattern);
    if (description) expectations.add(description);
  }
  if (expectations.size > 0) {
    lines.push(`Expected: ${[...expectations].sort().join(", ")}`);
  }

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
    ...renderFailureTree(match, relevant, candidate, ids),
  );
  return lines.join("\n");
}
