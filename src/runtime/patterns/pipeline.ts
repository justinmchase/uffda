import { magenta } from "../../../deps/std.ts";
import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { MetaStream } from "../../stream.ts";
import { match } from "../match.ts";
import { PatternKind } from "./pattern.kind.ts";
import { IPipelinePattern } from "./pattern.ts";

export function pipeline(args: IPipelinePattern, scope: Scope) {
  const { steps } = args;
  let result = Match.Default(scope);
  let items = scope.stream.items;
  for (let i = 0; i < steps.length; i++) {
    const pattern = steps[i];
    const nextStream = new MetaStream(
      scope.stream.path,
      items,
    );
    if (scope.options.trace) {
      const name = pattern.kind === PatternKind.Reference
        ? pattern.name
        : pattern.kind;
      console.log(`${"›".padStart(scope.depth)} ${magenta(name)}`);
    }

    const nextScope = scope.pushPipeline(pattern, nextStream);
    result = match(pattern, nextScope);

    if (!result.matched) {
      return result;
    }

    if (!result.end.stream.next().done || result.errors.length) {
      return Match.Incomplete(scope, result.end, result.value, result.errors);
    }

    const iterable = result.value as Iterable<unknown>;
    // if (scope.options.trace) {
    //   console.log('--- result ---');
    //   console.log(Deno.inspect(result.value, { colors: true, depth: 10 }));
    //   console.log('----  end  ---');
    // }
    items = iterable?.[Symbol.iterator]
      ? iterable[Symbol.iterator]()
      : [result.value][Symbol.iterator]();
  }

  return result;
}
