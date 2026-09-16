import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { Pattern } from "./runtime/patterns/pattern.ts";
import {
  type ValueSource,
  ValueSourceKind,
} from "./runtime/patterns/value_source.ts";

/**
 * Human-readable pattern descriptions shared by match visualization and CLI
 * parse-failure messages. Prefer this over printing only `pattern.kind` so
 * diagnostics can include expected values (`equal ":"`) and resolve targets
 * (`resolve RuleParameterList`).
 */

export function formatValueSource(source: ValueSource): string {
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

/** Compact description of a pattern for diagnostics and match trees. */
export function describePattern(pattern: Pattern): string {
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

/** Expected-value phrasing for a failed pattern, when one is meaningful. */
export function expectation(pattern: Pattern): string | undefined {
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
    case PatternKind.Variable:
      // Only surface a variable's expectation when its inner pattern is itself
      // a terminal expectation (equal/type/…); resolve wrappers are named in
      // `describePattern` / the rule stack instead.
      return expectation(pattern.pattern);
    case PatternKind.Resolve:
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Label one arm of an `Or` for diagnostics: a leading token/keyword when the
 * arm starts with `equal`, otherwise a referenced rule name. Recurses through
 * transparent wrappers (`then` head, `variable`, `into`) but does not expand
 * nested `or` arms (those are labeled by their parent `or`).
 */
export function orAlternativeLabel(pattern: Pattern): string | undefined {
  switch (pattern.kind) {
    case PatternKind.Equal:
      return formatValueSource(pattern.value);
    case PatternKind.Resolve:
      return "name" in pattern && pattern.name ? pattern.name : undefined;
    case PatternKind.Variable:
      return orAlternativeLabel(pattern.pattern);
    case PatternKind.Into:
      return orAlternativeLabel(pattern.pattern);
    case PatternKind.Then:
      return pattern.patterns[0]
        ? orAlternativeLabel(pattern.patterns[0])
        : undefined;
    default:
      return undefined;
  }
}

/** Labels for every arm of an `Or` pattern (skips unlabeled arms). */
export function orAlternativeLabels(pattern: Pattern): string[] {
  if (pattern.kind !== PatternKind.Or) return [];
  const labels: string[] = [];
  for (const arm of pattern.patterns) {
    const label = orAlternativeLabel(arm);
    if (label !== undefined) labels.push(label);
  }
  return labels;
}
