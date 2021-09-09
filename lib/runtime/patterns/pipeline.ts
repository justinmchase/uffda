import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { MetaStream } from "../../stream.ts";
import { match } from "../match.ts";
import { IPipelinePattern } from "./pattern.ts";

export function pipeline(args: IPipelinePattern, scope: Scope) {
  const { steps } = args;
  let result = Match.Default(scope);
  let items = scope.stream.items;
  for (let i = 0; i < steps.length; i++) {
    const pattern = steps[i];
    const nextStream = new MetaStream(
      scope.stream.path.add(`(${i})`).add(-1),
      items,
    );
    const nextScope = scope.withStream(nextStream);
    result = match(pattern, nextScope);
    // console.log(
    //   `pipeline: ${Deno.inspect(result.value, { colors: true, depth: 10 })}`,
    // );

    if (!result.matched) {
      return result;
    }

    if (!result.end.stream.next().done || result.errors.length) {
      return Match.Incomplete(scope, result.end, result.value, result.errors);
    }

    const iterable = result.value as Iterable<unknown>;
    items = iterable?.[Symbol.iterator]
      ? iterable[Symbol.iterator]()
      : [result.value][Symbol.iterator]();
  }

  return result;
}
