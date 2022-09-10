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
  description?: string;
  input?: string | { toString(): string };
  pattern: () => Pattern;
  errors?: { start: string; end: string }[];
  only?: boolean;
  trace?: boolean;
  future?: boolean;
}

interface IPatternThrows {
  throws: true;
}

interface IPatternMatches {
  throws?: false;
  specials?: Record<string, unknown>;
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

export function tests(group: () => PatternTest[]) {
  const tests = group();
  for (const test of tests) {
    const {
      id,
      input,
      description,
      pattern,
      only,
      future,
      trace,
      errors = [],
    } = test;
    const futureMessage = future ? ` (${brightCyan("future")})` : "";
    Deno.test({
      ignore: future,
      only,
      name: `[${brightMagenta(id)}](${
        brightBlack(description ?? input?.toString() ?? "")
      })${futureMessage}`,
      fn: () => {
        if (test.throws) {
          assertThrows(
            pattern,
            `Pattern was expected to throw during construction`,
          );
        } else {
          const { input, specials = {}, value, matched = true, done = true } =
            test;
          const p = pattern();
          const s = Scope.From(input, { trace }).setSpecials(specials);
          const m = match(p, s);
          const e = m.errors.map((e) => ({
            name: e.name,
            message: e.message,
            start: e.start.stream.path.toString(),
            end: e.end.stream.path.toString(),
          }));
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
        }
      },
    });
  }
}
