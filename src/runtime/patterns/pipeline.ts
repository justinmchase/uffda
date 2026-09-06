import { fail, type Match, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import {
  Input,
  InputNormalizationMode,
  type SourceProvenance,
  sourceProvenanceFrom,
} from "../../input.ts";
import { match } from "../match.ts";
import type { PipelinePattern } from "./pattern.ts";
import type { ItemSourceSpan } from "../../span.ts";
import { leafOffset } from "../../span.ts";

function itemSpansFromParentSlice(
  value: string[],
  valueMatch: Match,
  parent: SourceProvenance | undefined,
): ItemSourceSpan[] | undefined {
  if (valueMatch.kind !== MatchKind.Ok || !parent?.itemSpans?.length) {
    return undefined;
  }
  const startLeaf = leafOffset(valueMatch.span.start);
  const endLeaf = leafOffset(valueMatch.span.end);
  if (endLeaf < startLeaf) return undefined;
  const slice = parent.itemSpans.slice(startLeaf, endLeaf);
  return slice.length === value.length ? [...slice] : undefined;
}

function normalizationMapFromSpan(
  value: string,
  start: number,
): SourceProvenance {
  return {
    normalizationMap: Array.from(
      { length: value.length + 1 },
      (_, offset) => start + offset,
    ),
  };
}

async function provenanceForPipelineValue(
  value: unknown,
  valueMatch: Match,
  parentProvenance: SourceProvenance | undefined,
): Promise<SourceProvenance | undefined> {
  const fromValue = sourceProvenanceFrom(value);
  if (valueMatch.kind !== MatchKind.Ok) {
    return fromValue ?? parentProvenance;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    // Dynamic import avoids a static cycle:
    // match -> patterns -> pipeline -> tokenizer -> match
    const { itemSpansFromTokenizerMatch } = await import(
      "../../lang/tokenizer/structured.ts"
    );
    const fromTokenizer = itemSpansFromTokenizerMatch(valueMatch);
    if (fromTokenizer.length === value.length && fromTokenizer.length > 0) {
      return {
        ...fromValue,
        itemSpans: fromTokenizer,
      };
    }
    const fromParent = itemSpansFromParentSlice(
      value,
      valueMatch,
      parentProvenance,
    );
    if (fromParent) {
      return {
        ...fromValue,
        itemSpans: fromParent,
      };
    }
  }

  if (typeof value === "string") {
    return normalizationMapFromSpan(value, valueMatch.originalSpan.start);
  }

  return fromValue ?? parentProvenance;
}

export async function pipeline(
  pattern: PipelinePattern,
  scope: Scope,
): Promise<Match> {
  const { steps } = pattern;
  let last = ok(scope, scope, pattern, undefined);
  let next = scope;
  let outerEnd = scope;
  const matches: Match[] = [];
  for (let i = 0; i < steps.length; i++) {
    const pattern = steps[i];

    // The first pipeline step should operate on the original scope and stream
    // Its ok if it doesn't completely consume the entire stream, there may be more
    // patterns after this one. This enables the pipeline to operate like all other
    // patterns instead of requiring it to consume an entire stream.
    //
    // However steps beyond the first in the pipeline will operate like an entire pattern
    // match operation which will require the entire stream to be read.

    next = next.pushPipeline(pattern);
    const m = await match(pattern, next);
    matches.push(m);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, pattern, matches);
      case MatchKind.Ok:
        last = m;
        if (i === 0) {
          outerEnd = m.scope;
        }
        break;
    }

    const input = new Input(
      last.value,
      last.scope.stream.path.push(0),
      0,
      undefined,
      InputNormalizationMode.Scalar,
      false,
      await provenanceForPipelineValue(
        last.value,
        last,
        last.scope.stream.provenance,
      ),
    );
    next = scope.withInput(input);

    // we do not fail if the last pattern in the pipeline does not consume the entire stream
    // it is up to the caller to utilize the end pattern to enforce this if desired.
  }

  return ok(
    scope,
    outerEnd.addVariables(last.scope.variables),
    pattern,
    last.value,
    matches,
  );
}
