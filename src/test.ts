import { brightBlack, brightCyan, brightMagenta, red } from "std/fmt/colors.ts";
import { assert, assertThrows, equal } from "std/assert/mod.ts";
import { Scope } from "./runtime/scope.ts";
import { Match } from "./match.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Pattern } from "./runtime/patterns/pattern.ts";
import { Expression } from "./runtime/expressions/expression.ts";
import { IModuleDeclaration } from "./runtime/declarations/module.ts";
import { Resolver, run } from "./mod.ts";
import { Special } from "./runtime/modules/mod.ts";
import { Input } from "./input.ts";

interface ITest {
  id: string;
  description?: string;
  errors?: { name?: string; message?: string; start: string; end: string }[];
  only?: boolean;
  trace?: boolean;
  future?: boolean;
}

interface IPatternTest extends ITest {
  input?: Iterable<unknown>;
  moduleUrl?: string;
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
  input?: Iterable<unknown>;
  throws?: false;
  specials?: Record<string, Special>;
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
            try {
              const {
                input,
                value,
                matched = true,
                done = true,
                trace,
              } = test;
              const resolver = new Resolver({ trace });
              const specials = new Map(Object.entries(test.specials ?? {}));
              const p = pattern();
              const s = new Scope(
                undefined,
                undefined,
                undefined,
                new Input(input ?? []),
                undefined,
                undefined,
                {
                  trace,
                  specials,
                  resolver,
                },
              );
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
            } catch (err) {
              const { name, message, stack: _stack, metadata } = err;
              console.log(
                `${red("error")}: ${
                  JSON.stringify({ name, message, metadata }, null, 2)
                }`,
              );
              throw err;
            }
          }
        } else if (isExpressionTest(test)) {
          const { expression } = test;
          if (test.throws) {
            assertThrows(
              () => {
                const e = expression();
                exec(e, test.match);
              },
              `Expression was expected to throw`,
            );
          } else {
            try {
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
            } catch (err) {
              const { name, message, stack: _stack, metadata } = err;
              console.log(
                `${red("error")}: ${
                  JSON.stringify({ name, message, metadata }, null, 2)
                }`,
              );
              throw err;
            }
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

type ExpressionTestOptions = {
  expression: Expression;
  match: Match;
  result?: unknown;
  throws?: boolean;
};
export function expressionTest(options: ExpressionTestOptions) {
  const {
    expression,
    match,
    result,
    throws,
  } = options;
  return async () => {
    if (throws) {
      assertThrows(
        () => {
          exec(expression, match);
        },
        `Expression was expected to throw`,
      );
    } else {
      const r = await exec(expression, match);
      assert(
        equal(r, result),
        `Expression result did not match expected value\n` +
          `expected value: ${
            Deno.inspect(result, { colors: true, depth: 10 })
          }\n` +
          `  actual value: ${Deno.inspect(r, { colors: true, depth: 10 })}`,
      );
    }
  };
}

type PatternTestOptions = {
  pattern: Pattern;
  input?: Input;
  variables?: Map<string, unknown>;
  value?: unknown;
  errors?: { name: string; message: string; start: string; end: string }[];
  matched?: boolean;
  done?: boolean;
};
export function patternTest(options: PatternTestOptions) {
  const {
    pattern,
    input = Input.Default(),
    variables = new Map(),
    value = undefined,
    errors = [],
    matched = true,
    done = true,
  } = options;
  return async () => {
    const s = new Scope(
      undefined,
      undefined,
      variables,
      input,
    );
    const m = await match(pattern, s);
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
        `  actual errors: ${Deno.inspect(e, { colors: true, depth: 10 })}\n`,
    );
    assert(
      equal(m.value, value),
      `Pattern matched value did not equal expected value\n` +
        `expected value: ${
          Deno.inspect(value, { colors: true, depth: 10 })
        }\n` +
        `  actual value: ${Deno.inspect(m.value, { colors: true, depth: 10 })}`,
    );
    assert(
      equal(m.matched, matched),
      `Pattern was ${matched ? "" : "not "}expected to match`,
    );
    assert(
      equal(m.done, done),
      `Pattern was ${done ? "" : "not "}expected to be done`,
    );
  };
}

type ModuleDeclarationTestOptions = {
  moduleUrl: string;
  declarations?: Record<string, IModuleDeclaration>;
  input?: Input;
  variables?: Map<string, unknown>;
  value?: unknown;
  errors?: { name: string; message: string; start: string; end: string }[];
  matched?: boolean;
  done?: boolean;
};
export function moduleDeclarationTest(options: ModuleDeclarationTestOptions) {
  const {
    moduleUrl,
    declarations,
    input,
    variables,
    value,
    matched = true,
    done = true,
    errors = [],
  } = options;
  return async () => {
    const resolver = new Resolver({ declarations });
    const module = await resolver.import(new URL(moduleUrl));
    const scope = new Scope(
      module,
      undefined,
      variables,
      input,
      undefined,
      undefined,
      {
        resolver,
      },
    );

    const match = run(scope);
    const e = match.errors.map(({ name, message, start, end }) => ({
      name,
      message,
      start: start.stream.path.toString(),
      end: end.stream.path.toString(),
    }));
    assert(
      equal(e, errors),
      `Pattern had unexpected errors\n` +
        `expected errors: ${
          Deno.inspect(errors, { colors: true, depth: 10 })
        }\n` +
        `  actual errors: ${Deno.inspect(e, { colors: true, depth: 10 })}\n`,
    );
    assert(
      equal(match.value, value),
      `Pattern matched value did not equal expected value\n` +
        `expected value: ${
          Deno.inspect(value, { colors: true, depth: 10 })
        }\n` +
        `  actual value: ${
          Deno.inspect(match.value, { colors: true, depth: 10 })
        }`,
    );
    assert(
      equal(match.matched, matched),
      `Pattern was ${matched ? "" : "not "}expected to match`,
    );
    assert(
      equal(match.done, done),
      `Pattern was ${done ? "" : "not "}expected to be done`,
    );
  };
}
