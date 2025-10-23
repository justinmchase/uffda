import { fail, type Match, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import type { PipelinePattern } from "./pattern.ts";

export function pipeline(pattern: PipelinePattern, scope: Scope) {
  const { steps } = pattern;
  let last = ok(scope, scope, pattern, undefined);
  let next = scope;
  const matches: Match[] = [];
  for (let i = 0; i < steps.length; i++) {
    const p = steps[i];

    // The first pipeline step should operate on the original scope and stream
    // Its ok if it doesn't completely consume the entire stream, there may be more
    // patterns after this one. This enables the pipeline to operate like all other
    // patterns instead of requiring it to consume an entire stream.
    //
    // However steps beyond the first in the pipeline will operate like an entire pattern
    // match operation which will require the entire stream to be read.

    next = next.pushPipeline(p);
    const m = match(p, next);
    matches.push(m);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, p, matches);
      case MatchKind.Ok:
        last = m;
        break;
    }

    const iterable = last.value as Iterable<unknown>;
    const items = iterable?.[Symbol.iterator] ? iterable : [last.value];
    const input = new Input(
      items,
      last.scope.stream.path.push(0),
    );
    next = scope.withInput(input);

    // we do not fail if the last pattern in the pipeline does not consume the entire stream
    // it is up to the caller to utilize the end pattern to enforce this if desired.
  }

  return ok(scope, last.scope, pattern, last.value, matches);
}
