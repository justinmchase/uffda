import { magenta } from "std/fmt/colors.ts";
import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import { PatternKind } from "./pattern.kind.ts";
import { IPipelinePattern } from "./pattern.ts";

export function pipeline(args: IPipelinePattern, scope: Scope) {
  const { steps } = args;
  let result = Match.Default(scope);
  let nextScope = scope;
  for (let i = 0; i < steps.length; i++) {
    const pattern = steps[i];

    // The first pipeline step should operate on the original scope and stream
    // Its ok if it doesn't completely consume the entire stream, there may be more
    // patterns after this one. This enables the pipeline to operate like all other
    // patterns instead of requiring it to consume an entire stream.
    //
    // However steps beyond the first in the pipeline will operate like an entire pattern
    // match operation which will require the entire stream to be read.

    if (i > 0) {
      const iterable = result.value as Iterable<unknown>;
      const items = iterable?.[Symbol.iterator]
        ? iterable[Symbol.iterator]()
        : [result.value][Symbol.iterator]();
      const nextStream = new Input(
        items,
        result.end.stream.path.push(0),
      );
      nextScope = scope.withInput(nextStream);
    }

    if (scope.options.trace) {
      const name = pattern.kind === PatternKind.Reference
        ? pattern.name
        : pattern.kind;
      console.log(`${"ǂ".padStart(nextScope.depth)} ${magenta(name)}`);
    }

    nextScope = nextScope.pushPipeline(pattern);
    result = match(pattern, nextScope);

    if (!result.matched) {
      return result;
    }

    if (i > 0 && !result.end.stream.next().done) {
      return Match.Fail(scope);
    }
  }

  return result;
}
