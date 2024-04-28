import { assert, assertThrows, equal } from "std/assert/mod.ts";
import { Scope } from "./runtime/scope.ts";
import { Match } from "./match.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Pattern } from "./runtime/patterns/pattern.ts";
import { Expression } from "./runtime/expressions/expression.ts";
import { IModuleDeclaration } from "./runtime/declarations/module.ts";
import { Resolver, run } from "./mod.ts";
import { Input } from "./input.ts";
import { MatchError } from "./mod.ts";

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
  matched?: boolean;
  done?: boolean;
  errors?: MatchError[];
};
export function patternTest(options: PatternTestOptions) {
  const {
    pattern,
    input = Input.Default(),
    variables = new Map(),
    value = undefined,
    matched = true,
    done = true,
    errors = undefined,
  } = options;
  return async () => {
    const s = new Scope(
      undefined,
      undefined,
      variables,
      input,
    );
    const m = await match(pattern, s);
    if (!m.matched && errors) {
      const matchErrors = [...m.errors()];
      assert(
        equal(matchErrors, errors),
        `Pattern matched value did not equal expected errors\n` +
          `expected errors: ${
            Deno.inspect(errors, { colors: true, depth: 10 })
          }\n` +
          `  actual errors: ${
            Deno.inspect(matchErrors, { colors: true, depth: 10 })
          }`,
      );
    }

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
