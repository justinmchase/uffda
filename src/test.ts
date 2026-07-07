import { assert, assertRejects, equal } from "@std/assert";
import { Scope } from "./runtime/scope.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Input } from "./input.ts";
import { ok, Resolver } from "./mod.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./runtime/patterns/pattern.ts";
import { resolve } from "./runtime/patterns/resolve.ts";
import { ExportDeclarationKind } from "./runtime/declarations/mod.ts";
import { ModuleImportResultKind } from "./runtime/resolvers/resolver.ts";
import { MatchKind } from "./match.ts";
import type {
  MatchError,
  MatchErrorCode,
  MatchFail,
  MatchLR,
  MatchOk,
} from "./match.ts";
import type { Pattern } from "./runtime/patterns/pattern.ts";
import type { Expression } from "./runtime/expressions/expression.ts";
import type { ModuleDeclaration } from "./runtime/declarations/module.ts";
import type { Match } from "./mod.ts";
import type { Path } from "./path.ts";
import type { RuleDeclaration } from "./runtime/declarations/mod.ts";

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
      await assertRejects(
        async () => {
          await exec(expression, m);
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
  code: MatchErrorCode;
  message: string;
  start: Path;
  end: Path;
};
type MatchAssertionFail = {
  kind: MatchKind.Fail;
  start?: Path;
  end?: Path;
  done?: boolean;

  failures?: {
    pattern: Pattern;
    start: Path;
    end: Path;
  }[];
};

type MatchAssertionOk = {
  kind: MatchKind.Ok;
  value?: unknown;
  done?: boolean;
};

type ThrowsAssertion = {
  throws: boolean | {
    name?: string;
    message?: string;
  };
};

type ModuleDeclarationTestOptions = (ThrowsAssertion | MatchAssertion) & {
  moduleUrl: string;
  declarations?: Record<string, ModuleDeclaration>;
  input?: Input;
  variables?: Map<string, unknown>;
};

function isThrowsAssertion(value: unknown): value is ThrowsAssertion {
  return value != null && typeof value === "object" && "throws" in value;
}

function thrownName(err: unknown): string | undefined {
  if (err instanceof Error) {
    return err.name;
  }
  if (err != null && typeof err === "object" && "kind" in err) {
    return "Error";
  }
  return undefined;
}

function thrownMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (err != null && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export function moduleDeclarationTest(options: ModuleDeclarationTestOptions) {
  const {
    moduleUrl,
    declarations,
    input,
    variables,
  } = options;
  return async () => {
    const resolver = new Resolver({ declarations });
    const importScope = new Scope(
      undefined,
      undefined,
      variables,
      new Map(),
      input,
      undefined,
      undefined,
      { resolver },
    );
    try {
      const module = await resolver.import(new URL(moduleUrl), {
        scope: importScope,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      if (module.kind === ModuleImportResultKind.Error) {
        if (isThrowsAssertion(options)) {
          throw module.error;
        }
        return assertError(module.error, options);
      }
      if (isThrowsAssertion(options)) {
        throw new Error(`Expected to throw but didn't`);
      }
      const scope = new Scope(
        module.module,
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

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );
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
    } catch (err) {
      const name = thrownName(err);
      const message = thrownMessage(err);
      if (isThrowsAssertion(options)) {
        const { throws } = options;
        if (throws === true) {
          return;
        }
        if (throws) {
          if (throws.name) {
            assert(
              equal(name, throws.name),
              `Error name was ${name} but expected to be ${throws.name}`,
            );
          }
          if (throws.message) {
            assert(
              equal(message, throws.message),
              `Error message was ${message} but expected to be ${throws.message}`,
            );
          }
          return;
        }
      }

      throw err;
    }
  };
}

type RuleTestOptions = (ThrowsAssertion | MatchAssertion) & {
  rule: RuleDeclaration;
  input?: Input;
  variables?: Map<string, unknown>;
};

export function ruleTest(options: RuleTestOptions) {
  const {
    rule,
    input,
    variables,
  } = options;
  return async () => {
    const resolver = new Resolver({
      declarations: {
        "file:///test.ts": {
          imports: [],
          exports: [
            {
              kind: ExportDeclarationKind.Rule,
              name: rule.name,
              default: true,
            },
          ],
          rules: [rule],
        },
      },
    });
    const importScope = new Scope(
      undefined,
      undefined,
      variables,
      new Map(),
      input,
      undefined,
      undefined,
      { resolver },
    );
    try {
      const module = await resolver.import(new URL("file:///test.ts"), {
        scope: importScope,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      if (module.kind === ModuleImportResultKind.Error) {
        if (isThrowsAssertion(options)) {
          throw module.error;
        }
        return assertError(module.error, options);
      }
      if (isThrowsAssertion(options)) {
        throw new Error(`Expected to throw but didn't`);
      }

      const scope = new Scope(
        module.module,
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

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );
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
    } catch (err) {
      const name = thrownName(err);
      const message = thrownMessage(err);
      if (isThrowsAssertion(options)) {
        const { throws } = options;
        if (throws === true) {
          return;
        }
        if (throws) {
          if (throws.name) {
            assert(
              equal(name, throws.name),
              `Error name was ${name} but expected to be ${throws.name}`,
            );
          }
          if (throws.message) {
            assert(
              equal(message, throws.message),
              `Error message was ${message} but expected to be ${throws.message}`,
            );
          }
          return;
        }
      }

      throw err;
    }
  };
}

function* fails(match: Match): Iterable<MatchFail> {
  const { kind } = match;
  switch (kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      break;
    case MatchKind.Fail: {
      if (match.matches.length === 0) {
        yield match;
      } else {
        yield* fails(match.matches.slice(-1)[0]);
      }
      break;
    }
    case MatchKind.Ok:
      if (match.matches.length > 0) {
        yield* fails(match.matches.slice(-1)[0]);
      }
      break;
  }
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
    `Match was [${m.kind}] with message "${m.message}" but expected to be [${assertion.kind}]`,
  );
  assert(
    m.message === assertion.message,
    `Match error message was '${m.message}' but expected to be '${assertion.message}'`,
  );
  assert(
    m.code === assertion.code,
    `Match error code was ${m.code} but expected to be ${assertion.code}`,
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

  if (assertion.failures) {
    const matchFailures = [...fails(m)];
    for (let i = 0; i < matchFailures.length; i++) {
      const fl = matchFailures[i];
      const fr = assertion.failures[i];
      assert(
        equal(fl.span.start, fr.start),
        `Match failure start was ${fl.span.start} but expected to be ${fr.start}`,
      );
      assert(
        equal(fl.span.end, fr.end),
        `Match failure end was ${fl.span.end} but expected to be ${fr.end}`,
      );
    }
  } else {
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
  }

  const done = assertion.done ?? false;
  assert(
    equal(m.scope.stream.done, done),
    `Pattern was ${done ? "" : "not "}expected to be done`,
  );
}

function assertOk(m: MatchOk, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was [${m.kind}] but expected to be ${assertion.kind}`,
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
