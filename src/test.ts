import { assert, assertThrows, equal } from "std/assert/mod.ts";
import { Scope } from "./runtime/scope.ts";
import {
  MatchError,
  MatchErrorCode,
  MatchFail,
  MatchKind,
  MatchLR,
  MatchOk,
} from "./match.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Pattern } from "./runtime/patterns/pattern.ts";
import { Expression } from "./runtime/expressions/expression.ts";
import { ModuleDeclaration } from "./runtime/declarations/module.ts";
import { Input } from "./input.ts";
import { ok, Resolver } from "./mod.ts";
import { Path } from "./path.ts";
import { run } from "./runtime/patterns/mod.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";

type ExpressionTestOptions = {
  scope?: Scope;
  match?: (scope: Scope) => MatchOk;
  expression: Expression;
  result?: unknown;
  throws?: boolean;
};
export function expressionTest(options: ExpressionTestOptions) {
  const {
    match,
    scope,
    expression,
    result,
    throws,
  } = options;

  const s = scope ?? Scope.Default();
  const m = match ? match(s) : ok(s, s, { kind: PatternKind.Ok }, undefined);
  return async () => {
    if (throws) {
      assertThrows(
        () => {
          exec(expression, m);
        },
        `Expression was expected to throw`,
      );
    } else {
      const r = await exec(expression, m);
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
};
export function patternTest(options: PatternTestOptions & MatchAssertion) {
  const {
    pattern,
    input = Input.Default(),
    variables = new Map(),
  } = options;
  return async () => {
    const s = new Scope(
      undefined,
      undefined,
      variables,
      new Map(),
      input,
    );
    const m = await match(pattern, s);
    switch (m.kind) {
      case MatchKind.LR:
        return assertLR(m, options);
      case MatchKind.Error:
        return assertError(m, options);
      case MatchKind.Fail:
        return assertFail(m, options);
      case MatchKind.Ok:
        return assertOk(m, options);
    }
  };
}

type MatchAssertion =
  | MatchAssertionLR
  | MatchAssertionError
  | MatchAssertionFail
  | MatchAssertionOk;

type MatchAssertionLR = {
  kind: MatchKind.LR;
};
type MatchAssertionError = {
  kind: MatchKind.Error;
  // pattern: Pattern;
  // scope: Scope;
  // span: Span;
  code: MatchErrorCode;
  message: string;
  start: Path;
  end: Path;
};
type MatchAssertionFail = {
  kind: MatchKind.Fail;
  // pattern: Pattern;
  // scope: Scope;
  // span: Span;
  // matches: Match[];
  start?: Path;
  end?: Path;
  done?: boolean;
};

type MatchAssertionOk = {
  kind: MatchKind.Ok;
  value?: unknown;
  done?: boolean;
};

type ModuleDeclarationTestOptions = MatchAssertion & {
  moduleUrl: string;
  declarations?: Record<string, ModuleDeclaration>;
  input?: Input;
  variables?: Map<string, unknown>;
};

export function moduleDeclarationTest(options: ModuleDeclarationTestOptions) {
  const {
    moduleUrl,
    declarations,
    input,
    variables,
  } = options;
  return async () => {
    const resolver = new Resolver({ declarations });
    const module = await resolver.import(new URL(moduleUrl));
    const scope = new Scope(
      module,
      undefined,
      variables,
      new Map(),
      input,
      undefined,
      undefined,
      {
        resolver,
      },
    );

    const m = run(scope, { kind: PatternKind.Run });
    switch (m.kind) {
      case MatchKind.LR:
        return assertLR(m, options);
      case MatchKind.Error:
        return assertError(m, options);
      case MatchKind.Fail:
        return assertFail(m, options);
      case MatchKind.Ok:
        return assertOk(m, options);
    }
  };
}

function assertLR(m: MatchLR, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was ${m.kind} but expected to be ${assertion.kind}`,
  );
}

function assertError(m: MatchError, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was ${m.kind} but expected to be ${assertion.kind}`,
  );
  assert(
    m.code === assertion.code,
    `Match error code was ${m.code} but expected to be ${assertion.code}`,
  );
  assert(
    m.message === assertion.message,
    `Match error message was '${m.message}' but expected to be '${assertion.message}'`,
  );
  assert(
    equal(m.span.start, assertion.start),
    `Match error start was ${m.span.start} but expected to be ${assertion.start}`,
  );
  assert(
    equal(m.span.end, assertion.end),
    `Match error end was ${m.span.end} but expected to be ${assertion.end}`,
  );
}

function assertFail(m: MatchFail, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was ${m.kind} but expected to be ${assertion.kind}`,
  );
  if (assertion.start) {
    assert(
      equal(m.span.start, assertion.start),
      `Match error start was ${m.span.start} but expected to be ${assertion.start}`,
    );
  }
  if (assertion.end) {
    assert(
      equal(m.span.end, assertion.end),
      `Match error end was ${m.span.end} but expected to be ${assertion.end}`,
    );
  }
  const done = assertion.done ?? false;
  assert(
    equal(m.scope.stream.done, done),
    `Pattern was ${done ? "" : "not "}expected to be done`,
  );
  // todo: Find the right most leaf fails...
  // const matchErrors = [...m.errors()];
  // assert(
  //   equal(matchErrors, errors),
  //   `Pattern matched value did not equal expected errors\n` +
  //     `expected errors: ${
  //       Deno.inspect(errors, { colors: true, depth: 10 })
  //     }\n` +
  //     `  actual errors: ${
  //       Deno.inspect(matchErrors, { colors: true, depth: 10 })
  //     }`,
  // );
}

function assertOk(m: MatchOk, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was ${m.kind} but expected to be ${assertion.kind}`,
  );
  assert(
    equal(m.value, assertion.value),
    `Match value did not equal expected value\n` +
      `expected value: ${
        Deno.inspect(assertion.value, { colors: true, depth: 10 })
      }\n` +
      `  actual value: ${Deno.inspect(m.value, { colors: true, depth: 10 })}`,
  );
  const done = assertion.done ?? true;
  assert(
    equal(m.scope.stream.done, done),
    `Pattern was ${done ? "" : "not "}expected to be done`,
  );
}
