import { fail, MatchKind, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import {
  Input,
  InputNormalizationMode,
  type SourceProvenance,
  sourceProvenanceFrom,
} from "../../input.ts";
import { compile } from "../match.ts";
import { collect, isGenerator } from "../collect.ts";
import type { PipelinePattern } from "./pattern.ts";
import type { ItemSourceSpan } from "../../span.ts";
import { leafOffset } from "../../span.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

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

/** Compiles a `Pipeline` pattern into a flattened, reusable closure. */
export function pipeline(
  pattern: PipelinePattern,
  scope: Scope,
): CompiledPattern {
  const { steps } = pattern;
  const children = steps.map((p) => compile(p, scope));
  return async (invocationScope: Scope) => {
    let last = ok(invocationScope, invocationScope, pattern, undefined);
    let lastValue: unknown = last.value;
    let next = invocationScope;
    let outerEnd = invocationScope;
    const matches: Match[] = [];
    for (let i = 0; i < children.length; i++) {
      const stepPattern = steps[i];

      // The first pipeline step should operate on the original scope and stream
      // Its ok if it doesn't completely consume the entire stream, there may be more
      // patterns after this one. This enables the pipeline to operate like all other
      // patterns instead of requiring it to consume an entire stream.
      //
      // However steps beyond the first in the pipeline will operate like an entire pattern
      // match operation which will require the entire stream to be read.

      next = next.pushPipeline(stepPattern);
      const m = await children[i](next);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          matches.push(m);
          return m;
        case MatchKind.Fail:
          matches.push(m);
          return fail(invocationScope, stepPattern, matches);
        case MatchKind.Ok: {
          last = m;
          if (i === 0) {
            outerEnd = m.scope;
          }
          lastValue = m.value;
          if (isGenerator(lastValue)) {
            // Pipeline stage boundaries are eager "drain" points, exactly
            // like array/invocation spread: a lazily produced sequence (e.g.
            // from a `.uff` func built on `map`/`filter`/`enumerate`) must
            // become a concrete array here, both so the next stage's `Input`
            // can be re-inspected/backtracked over normally, so
            // `provenanceForPipelineValue` below can compute token spans by
            // indexing/length-comparing against it, and so diagnostics
            // (`match.visualize.ts`) render a real array rather than an
            // opaque, already-exhausted generator object. Only actual
            // generator instances are unwrapped this way — a plain domain
            // object that merely exposes `Symbol.asyncIterator` (e.g.
            // `SourceDocument`) is left untouched.
            lastValue = await collect(lastValue);
            last = { ...m, value: lastValue };
          }
          matches.push(last);
          break;
        }
      }

      const input = new Input(
        lastValue,
        last.scope.stream.path.push(0),
        0,
        undefined,
        InputNormalizationMode.Scalar,
        false,
        await provenanceForPipelineValue(
          lastValue,
          last,
          last.scope.stream.provenance,
        ),
      );
      next = invocationScope.withInput(input);

      // we do not fail if the last pattern in the pipeline does not consume the entire stream
      // it is up to the caller to utilize the end pattern to enforce this if desired.
    }

    return ok(
      invocationScope,
      outerEnd.addVariables(last.scope.variables),
      pattern,
      lastValue,
      matches,
    );
  };
}
