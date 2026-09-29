import { fail, forward, MatchKind, ok } from "../../match.ts";
import type { Match, MatchSuccess } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { compile } from "../match.ts";
import { collect, isGenerator } from "../collect.ts";
import type { PipelinePattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import { Wrapped } from "../../wrapped.ts";

/** Compiles a `Pipeline` pattern into a flattened, reusable closure. */
export function pipeline(
  pattern: PipelinePattern,
  scope: Scope,
): CompiledPattern {
  const { steps } = pattern;
  const children = steps.map((p) => compile(p, scope));
  return async (invocationScope: Scope) => {
    let last: MatchSuccess = ok(
      invocationScope,
      invocationScope,
      pattern,
      undefined,
    );
    let lastValue: Wrapped = last.value;
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
          if (isGenerator(lastValue.raw)) {
            // Pipeline stage boundaries are eager "drain" points, exactly
            // like array/invocation spread: a lazily produced sequence (e.g.
            // from a `.uff` func built on `map`/`filter`/`enumerate`) must
            // become a concrete array here, both so the next stage's `Input`
            // can be re-inspected/backtracked over normally, and so diagnostics
            // (`match.visualize.ts`) render a real array rather than an
            // opaque, already-exhausted generator object. Only actual
            // generator instances are unwrapped this way — a plain domain
            // object that merely exposes `Symbol.asyncIterator` (e.g.
            // `SourceDocument`) is left untouched.
            lastValue = new Wrapped(
              await collect(lastValue),
              lastValue.origin,
            );
            last = { ...m, value: lastValue };
          }
          matches.push(last);
          break;
        }
        case MatchKind.Skip:
          last = m;
          if (i === 0) {
            outerEnd = m.scope;
          }
          lastValue = m.value;
          matches.push(m);
          break;
      }

      // A stage that read an open input to its end may produce more once
      // that input continues, so its value is open too.
      const consumed = last.scope.stream;
      const input = new Input(
        lastValue,
        consumed.path.push(0),
        0,
        undefined,
        InputNormalizationMode.Scalar,
        false,
        false,
        consumed.open && await consumed.done(),
      );
      next = invocationScope.withInput(input);

      // we do not fail if the last pattern in the pipeline does not consume the entire stream
      // it is up to the caller to utilize the end pattern to enforce this if desired.
    }

    return forward(
      invocationScope,
      outerEnd.addVariables(last.scope.variables),
      pattern,
      last,
      matches,
    );
  };
}
