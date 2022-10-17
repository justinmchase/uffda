import {
  assert,
  assertThrows,
  brightBlack,
  brightCyan,
  brightMagenta,
  equal,
} from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { Match } from "./match.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Pattern } from "./runtime/patterns/pattern.ts";
import { Expression } from "./runtime/expressions/expression.ts";

interface ITest {
  id: string;
  description?: string;
  errors?: { start: string; end: string }[];
  only?: boolean;
  trace?: boolean;
  future?: boolean;
}

interface IPatternTest extends ITest {
  input?: string | { toString(): string };
  pattern: () => Pattern;
}

interface IExpressionTest extends ITest {
  match: Match;
  expression: () => Expression;
}

interface IThrows {
  throws: true;
}

interface IPatternResults {
  throws?: false;
  specials?: Record<string, unknown>;
  input: Iterable<unknown> | Scope;
  value?: unknown;
  matched?: boolean;
  done?: boolean;
}

interface IExpressionResults {
  throws?: false;
  result?: unknown;
}

type PatternTest =
  & ITest
  & (
    | IPatternTest
      & (
        | IThrows
        | IPatternResults
      )
    | IExpressionTest
      & (
        | IThrows
        | IExpressionResults
      )
  );

export function isExpressionTest(value: unknown): value is IExpressionTest {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  const t = value as IExpressionTest;
  return typeof t.expression === "function";
}
export function isPatternTest(value: unknown): value is IPatternTest {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  const t = value as IPatternTest;
  return typeof t.pattern === "function";
}

export function tests(group: () => PatternTest[]) {
  const tests = group();
  for (const test of tests) {
    const {
      id,
      description,
      only,
      future,
      trace,
      errors = [],
    } = test;
    const futureMessage = future ? ` (${brightCyan("future")})` : "";
    const desc = description ??
      (isPatternTest(test) ? test.input?.toString() : "");
    const descMessage = desc ? brightBlack(desc) : "";
    Deno.test({
      ignore: future,
      only,
      name: [`[${brightMagenta(id)}]`, descMessage, futureMessage].filter((s) =>
        s
      )
        .join(" "),
      fn: () => {
        if (isPatternTest(test)) {
          const { pattern } = test;
          if (test.throws) {
            assertThrows(
              test.pattern,
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
        } else if (isExpressionTest(test)) {
          const { expression } = test;
          if (test.throws) {
            assertThrows(
              expression,
              `Expression was expected to throw during construction`,
            );
          } else {
            const { match, result } = test;
            const e = expression();
            const r = exec(e, match);
            assert(
              equal(r, result),
              `Expression result did not match expected value\n` +
                `expected value: ${
                  Deno.inspect(result, { colors: true, depth: 10 })
                }\n` +
                `  actual value: ${
                  Deno.inspect(r, { colors: true, depth: 10 })
                }`,
            );
          }
        } else {
          assert(
            false,
            `Unknown test kind, not a valid pattern or expression test`,
          );
        }
      },
    });
  }
}
