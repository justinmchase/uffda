import { assert, assertEquals, assertRejects, equal } from "@std/assert";
import { Scope } from "./runtime/scope.ts";
import { match } from "./runtime/match.ts";
import { exec } from "./runtime/exec.ts";
import { Input } from "./input.ts";
import { ok, Resolver } from "./mod.ts";
import { collect, isGenerator } from "./runtime/collect.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./runtime/patterns/pattern.ts";
import { resolve } from "./runtime/patterns/resolve.ts";
import { ExportDeclarationKind } from "./runtime/declarations/mod.ts";
import { ModuleImportResultKind } from "./runtime/resolvers/resolver.ts";
import { getRightmostFailure, isSuccess, MatchKind } from "./match.ts";
import type {
  MatchError,
  MatchErrorCode,
  MatchFail,
  MatchLR,
  MatchOk,
  MatchSuccess,
} from "./match.ts";
import type { Pattern } from "./runtime/patterns/pattern.ts";
import type { Expression } from "./runtime/expressions/expression.ts";
import type { ModuleDeclaration } from "./runtime/declarations/module.ts";
import type { Match } from "./mod.ts";
import type { Path } from "./path.ts";
import type { RuleDeclaration } from "./runtime/declarations/mod.ts";
import { unwrap } from "./wrapped.ts";
import { analyzeMatchFailure, diagnoseRecoveries } from "./cli/diagnostics.ts";
import { uffdaGrammar } from "./lang/uffda/uffda.lang.ts";

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
      const r = unwrap(await exec(expression, m));
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

/**
 * Asserts `expression` evaluates synchronously to `result` (the value itself,
 * not a promise) when everything it depends on is immediately available.
 * See `.agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary`.
 */
export function immediateExpressionTest(
  options: Omit<ExpressionTestOptions, "throws">,
) {
  const { match, scope, expression, result } = options;
  const s = scope ?? Scope.Default();
  const m = match ? match(s) : ok(s, s, { kind: PatternKind.Ok }, undefined);
  return () => {
    const r = exec(expression, m);
    assert(
      !(r instanceof Promise),
      "expected synchronous evaluation over immediate values",
    );
    assertEquals(unwrap(r), result);
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
        return await assertLR(m, options);
      case MatchKind.Error:
        return await assertError(m, options);
      case MatchKind.Fail:
        return await assertFail(m, options);
      case MatchKind.Ok:
      case MatchKind.Skip:
        return await assertOk(m, options);
    }
  };
}

type AwaitableAgreementOptions = {
  pattern: Pattern;
  items: unknown[];
  variables?: Map<string, unknown>;
};

/**
 * Asserts `pattern` completes synchronously over `items` supplied as an
 * immediately available iterable, and produces the same outcome (kind,
 * value, end position) over the same items supplied as an async iterable.
 * See `.agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary`.
 */
export function awaitableAgreementTest(options: AwaitableAgreementOptions) {
  const { pattern, items, variables = new Map() } = options;
  const run = (input: Input) =>
    match(
      pattern,
      new Scope(undefined, undefined, variables, new Map(), input),
    );
  const outcome = (m: Match) => ({
    kind: m.kind,
    value: isSuccess(m) ? unwrap(m.value) : undefined,
    end: m.scope.stream.path.toString(),
  });
  return async () => {
    const immediate = run(Input.Iterable(items));
    assert(
      !(immediate instanceof Promise),
      "expected synchronous completion over immediately available input",
    );
    const awaitable = await run(Input.Iterable((async function* () {
      yield* items;
    })()));
    assertEquals(outcome(awaitable), outcome(immediate));
  };
}

type MatchAssertion =
  | MatchAssertionLR
  | MatchAssertionError
  | MatchAssertionFail
  | MatchAssertionOk
  | MatchAssertionSkip;

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

/** A skipped success; its value is always `undefined`. */
type MatchAssertionSkip = {
  kind: MatchKind.Skip;
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
  /** Named export to run; omit to use the module default export. */
  entryRuleName?: string;
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
    entryRuleName,
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
          name: entryRuleName,
        },
      });
      if (module.kind === ModuleImportResultKind.Error) {
        if (isThrowsAssertion(options)) {
          throw module.error;
        }
        return await assertError(module.error, options);
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
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
          name: entryRuleName,
        },
        scope,
      );
      switch (m.kind) {
        case MatchKind.LR:
          return await assertLR(m, options);
        case MatchKind.Error:
          return await assertError(m, options);
        case MatchKind.Fail:
          return await assertFail(m, options);
        case MatchKind.Ok:
        case MatchKind.Skip:
          return await assertOk(m, options);
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
        return await assertError(module.error, options);
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
          return await assertLR(m, options);
        case MatchKind.Error:
          return await assertError(m, options);
        case MatchKind.Fail:
          return await assertFail(m, options);
        case MatchKind.Ok:
        case MatchKind.Skip:
          return await assertOk(m, options);
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
    case MatchKind.Skip:
      if (match.matches.length > 0) {
        yield* fails(match.matches.slice(-1)[0]);
      }
      break;
  }
}

function spanText(match: MatchFail | MatchSuccess | MatchError): string {
  return `${match.span.start.toString()} -> ${match.span.end.toString()}`;
}

async function matchDebug(match: Match): Promise<string> {
  const lines: string[] = [
    "Match debug:",
    `  kind: ${match.kind}`,
    `  pattern: ${match.pattern.kind}`,
  ];

  if (match.kind !== MatchKind.LR) {
    lines.push(`  span: ${spanText(match)}`);
    lines.push(
      `  originalSpan: ${match.originalSpan.start} -> ${match.originalSpan.end}`,
    );
    lines.push(`  stream done: ${await match.scope.stream.done()}`);
  }

  if (match.kind === MatchKind.Fail || isSuccess(match)) {
    lines.push(`  child matches: ${match.matches.length}`);
  }

  if (match.kind === MatchKind.Fail) {
    const rightmost = getRightmostFailure(match);
    lines.push(`  rightmost failure pattern: ${rightmost.pattern.kind}`);
    lines.push(`  rightmost failure span: ${spanText(rightmost)}`);
  }

  if (match.kind === MatchKind.Error) {
    lines.push(`  code: ${match.code}`);
    lines.push(`  message: ${match.message}`);
  }

  return `\n${lines.join("\n")}`;
}

async function assertLR(m: MatchLR, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was ${m.kind} but expected to be ${assertion.kind}${await matchDebug(
      m,
    )}`,
  );
}

async function assertError(m: MatchError, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was [${m.kind}] with message "${m.message}" but expected to be [${assertion.kind}]${await matchDebug(
      m,
    )}`,
  );
  assert(
    m.message === assertion.message,
    `Match error message was '${m.message}' but expected to be '${assertion.message}'${await matchDebug(
      m,
    )}`,
  );
  assert(
    m.code === assertion.code,
    `Match error code was ${m.code} but expected to be ${assertion.code}${await matchDebug(
      m,
    )}`,
  );
  assert(
    equal(m.span.start, assertion.start),
    `Match error start was ${m.span.start} but expected to be ${assertion.start}${await matchDebug(
      m,
    )}`,
  );
  assert(
    equal(m.span.end, assertion.end),
    `Match error end was ${m.span.end} but expected to be ${assertion.end}${await matchDebug(
      m,
    )}`,
  );
}

async function assertFail(m: MatchFail, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was ${m.kind} but expected to be ${assertion.kind}${await matchDebug(
      m,
    )}`,
  );

  if (assertion.failures) {
    const matchFailures = [...fails(m)];
    for (let i = 0; i < matchFailures.length; i++) {
      const fl = matchFailures[i];
      const fr = assertion.failures[i];
      assert(
        equal(fl.span.start, fr.start),
        `Match failure start was ${fl.span.start} but expected to be ${fr.start}${await matchDebug(
          m,
        )}`,
      );
      assert(
        equal(fl.span.end, fr.end),
        `Match failure end was ${fl.span.end} but expected to be ${fr.end}${await matchDebug(
          m,
        )}`,
      );
    }
  } else {
    if (assertion.start) {
      assert(
        equal(m.span.start, assertion.start),
        `Match error start was ${m.span.start} but expected to be ${assertion.start}${await matchDebug(
          m,
        )}`,
      );
    }
    if (assertion.end) {
      assert(
        equal(m.span.end, assertion.end),
        `Match error end was ${m.span.end} but expected to be ${assertion.end}${await matchDebug(
          m,
        )}`,
      );
    }
  }

  const done = assertion.done ?? false;
  assert(
    equal(await m.scope.stream.done(), done),
    `Pattern was ${done ? "" : "not "}expected to be done${await matchDebug(
      m,
    )}`,
  );
}

async function assertOk(m: MatchSuccess, assertion: MatchAssertion) {
  assert(
    m.kind === assertion.kind,
    `Match was [${m.kind}] but expected to be ${assertion.kind}${await matchDebug(
      m,
    )}`,
  );
  // A rule/func result may be a lazily produced sequence (an actual
  // generator instance from `map`/`filter`/`enumerate`), which `equal`
  // can't meaningfully compare against a literal array — drain it first.
  const actualValue = unwrap(
    isGenerator(m.value) ? await collect(m.value) : m.value,
  );
  const expectedValue = "value" in assertion ? assertion.value : undefined;
  assert(
    equal(actualValue, expectedValue),
    `Match value did not equal expected value\n` +
      `expected value: ${
        Deno.inspect(expectedValue, { colors: true, depth: 10 })
      }\n` +
      `  actual value: ${
        Deno.inspect(actualValue, { colors: true, depth: 10 })
      }` +
      `${await matchDebug(m)}`,
  );
  const done = assertion.done ?? true;
  assert(
    equal(await m.scope.stream.done(), done),
    `Pattern was ${done ? "" : "not "}expected to be done${await matchDebug(
      m,
    )}`,
  );
}

/**
 * Steps asserting that each Uffda module, with `‸` marking a source offset,
 * is first diagnosed at that offset, leading with an explanation that includes
 * the given text.
 */
export function explainedMistakesTest(mistakes: [string, string][]) {
  return async (t: Deno.TestContext) => {
    for (const [marked, explanation] of mistakes) {
      await t.step(JSON.stringify(marked), async () => {
        const source = marked.replace("‸", "");
        const match = await uffdaGrammar(source);
        const [diagnostic] = await diagnoseRecoveries(match);
        const analysis = diagnostic?.analysis ??
          (isSuccess(match) ? undefined : await analyzeMatchFailure(match));
        assert(analysis, "expected a diagnostic");
        assertEquals(analysis.sourceOffset, marked.indexOf("‸"));
        assert(
          analysis.explanation?.includes(explanation),
          `expected an explanation including ${
            JSON.stringify(explanation)
          }, got ${JSON.stringify(analysis.explanation)}`,
        );
      });
    }
  };
}
