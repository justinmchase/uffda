import {
  assert,
  assertRejects,
  assertThrows,
  brightBlack,
  brightCyan,
  brightMagenta,
  equal,
  red,
} from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { Match } from "./match.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Pattern } from "./runtime/patterns/pattern.ts";
import { Expression } from "./runtime/expressions/expression.ts";
import { IModuleDeclaration } from "./runtime/declarations/module.ts";
import { Resolver, run } from "./mod.ts";
import { IImport, IModule, IRule } from "./modules.ts";

interface ITest {
  id: string;
  description?: string;
  errors?: { name?: string; message?: string; start: string; end: string }[];
  only?: boolean;
  trace?: boolean;
  future?: boolean;
}

interface IModuleDeclarationTest extends ITest {
  input?: string | { toString(): string };
  moduleUrl?: string;
  main?: string;
  module: () => IModuleDeclaration;
}

interface IPatternTest extends ITest {
  input?: string | { toString(): string };
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
  input?: string | { toString(): string };
  throws?: false;
  specials?: Record<
    string,
    IModule | IRule | IImport | ((...args: unknown[]) => unknown)
  >;
  value?: unknown;
  matched?: boolean;
  done?: boolean;
}

interface IExpressionResults {
  throws?: false;
  result?: unknown;
}

interface IModuleDeclarationResults {
  throws?: false;
  value?: unknown;
  specials?: Record<
    string,
    IModule | IRule | IImport | ((...args: unknown[]) => unknown)
  >;
  matched?: boolean;
  done?: boolean;
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
    | IModuleDeclarationTest
      & (
        | IThrows
        | IModuleDeclarationResults
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
export function isModuleDeclarationTest(
  value: unknown,
): value is IModuleDeclarationTest {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  const t = value as IModuleDeclarationTest;
  return typeof t.module == "function";
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
      fn: async () => {
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
                moduleUrl = import.meta.url,
              } = test;
              const resolver = new Resolver({ moduleUrl });
              const specials = new Map(Object.entries(test.specials ?? {}));
              const p = pattern();
              const s = Scope.From(input as Iterable<unknown> ?? "", {
                trace,
                specials,
                resolver,
              });
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
        } else if (isModuleDeclarationTest(test)) {
          const { module, input, moduleUrl = import.meta.url } = test;
          const resolver = new Resolver({ moduleUrl });
          const moduleDeclaration = module();
          if (test.throws) {
            await assertRejects(
              async () => {
                const main = await resolver.load(moduleUrl, moduleDeclaration);
                const scope = Scope.From(input as Iterable<unknown> ?? "", {
                  module: main,
                  resolver,
                });
                run(scope, test.main);
              },
              "Module was expected to throw",
            );
          } else {
            try {
              const { value, done = true, matched = true, trace } = test;
              const main = await resolver.load(moduleUrl, moduleDeclaration);
              const specials = new Map(Object.entries(test.specials ?? {}));
              const scope = Scope.From(input as Iterable<unknown> ?? "", {
                module: main,
                trace,
                specials,
                resolver,
              });
              const m = run(scope, test.main);
              const e = m.errors.map((e) => ({
                name: e.name,
                message: e.message,
                start: e.start.stream.path.toString(),
                end: e.end.stream.path.toString(),
              }));
              const actual = {
                matched: m.matched,
                done: m.done,
                errors: e,
                value: m.value,
              };
              const expected = {
                matched,
                done,
                errors,
                value,
              };
              assert(
                equal(actual, expected),
                `Module failed to run:\n` +
                  `expected: ${
                    Deno.inspect(expected, { colors: true, depth: 10 })
                  }\n` +
                  `actual: ${
                    Deno.inspect(actual, { colors: true, depth: 10 })
                  }\n`,
              );
            } catch (err) {
              const { name, message, stack: _stack, ...rest } = err;
              console.log(
                `${red("error")}: ${
                  Deno.inspect({ name, message, ...rest }, {
                    colors: true,
                    depth: 3,
                  })
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
