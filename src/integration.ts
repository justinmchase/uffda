import { equal, green, magenta, red } from "../deps/std.ts";
import { assert } from "../deps/std.ts";
import { Resolver, run, Scope } from "./mod.ts";

type IntegrationArgs = {
  // Debug
  only?: boolean;
  trace?: boolean;

  // Naming
  area: string;
  name: string;
  index: number;

  // Input
  importMetaUrl: string;
  moduleUrl: string;
  input: string;

  // Assertions
  matched?: boolean;
  done?: boolean;
  expected?: unknown;
};

export function integration(args: IntegrationArgs) {
  const {
    only,
    trace,
    area,
    name,
    index,
    importMetaUrl,
    moduleUrl,
    input,
    expected,
    matched = true,
    done = true,
  } = args;
  const fullName = `INTEGRATION.${area.toUpperCase()}.${name.toUpperCase()}.${
    index.toString().padStart(2, "0")
  }`;
  return {
    only,
    name: `[${magenta(fullName)}] ${moduleUrl}`,
    fn: async () => {
      const resolver = new Resolver(importMetaUrl);
      const mod = await resolver.load(moduleUrl);
      const scope = Scope.From(input, {
        module: mod,
        trace,
      });
      const match = run(scope);
      // const actual = await resolver.resolve(moduleUrl);
      assert(
        equal(match.matched, matched) && equal(match.done, done) &&
          equal(match.value, expected),
        `Module failed to parse:\n` +
          `moduleUrl: ${moduleUrl}\n` +
          `matched: ${
            match.matched === matched
              ? green(match.matched.toString())
              : red(match.matched.toString())
          }\n` +
          `done: ${
            match.done === done
              ? green(match.done.toString())
              : red(match.done.toString())
          }\n` +
          `expected: ${Deno.inspect(expected, { colors: true, depth: 10 })}\n` +
          `actual: ${Deno.inspect(match.value, { colors: true, depth: 10 })}\n`,
      );
    },
  };
}
