import {
  assert,
  assertThrows,
  brightBlack,
  brightCyan,
  brightMagenta,
  equal,
} from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { match, Pattern } from "./runtime/mod.ts";

interface IPatternTest {
  id: string;
  description: string;
  pattern: () => Pattern;
  errors?: { start: string; end: string }[];
}

interface IPatternThrows {
  throws: true;
}

interface IPatternMatches {
  throws?: false;
  input: Iterable<unknown> | Scope;
  value?: unknown;
  matched?: boolean;
  done?: boolean;
}

type PatternTest =
  & IPatternTest
  & (
    | IPatternThrows
    | IPatternMatches
  );

export function tests(testGroupName: string, group: () => PatternTest[]) {
  const tests = group();
  for (const test of tests) {
    const { id, description, pattern, errors = [] } = test;
    Deno.test({
      name: `${brightCyan(testGroupName)} [${brightMagenta(id)}] (${
        brightBlack(description)
      })`,
      fn: () => {
        if (test.throws) {
          assertThrows(
            pattern,
            undefined,
            undefined,
            `Pattern was expected to throw during construction`,
          );
        } else {
          const { input, value, matched = true, done = true } = test;
          const p = pattern();
          const s = Scope.From(input);
          const m = match(p, s);
          const e = m.errors.map((e) => ({
            start: e.start.stream.path.toString(),
            end: e.end.stream.path.toString(),
          }));
          assert(
            equal(m.value, value),
            `Pattern matched value did not equal expected value\n` +
              `expected value: ${
                Deno.inspect(value, { colors: true, depth: 10 })
              }\n` +
              `  actual value: ${
                Deno.inspect(m.value, { colors: true, depth: 10 })
              }`,
          );
          assert(
            equal(m.matched, matched),
            `Pattern was ${matched ? "" : "not "}expected to match`,
          );
          assert(
            equal(m.done, done),
            `Pattern was ${done ? "" : "not "}expected to be done`,
          );
          assert(
            equal(e, errors),
            `Pattern had unexpected errors\n` +
              `expected errors: ${
                Deno.inspect(errors, { colors: true, depth: 10 })
              }\n` +
              `  actual errors: ${
                Deno.inspect(e, { colors: true, depth: 10 })
              }\n`,
          );
        }
      },
    });
  }
}
