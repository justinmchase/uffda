import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { rule } from "../rule.ts";
import { andThen, type AwaitableMatch } from "../awaitable.ts";
import { PatternKind } from "./pattern.kind.ts";
import { SpecialKind } from "../modules/special.ts";
import { isRule } from "../modules/rule.ts";
import type { Rule } from "../modules/rule.ts";
import type { Module } from "../modules/module.ts";
import type { Scope } from "../scope.ts";
import type {
  Pattern,
  ResolvePattern,
  ResolveReferencePattern,
  ResolveRunPattern,
  ResolveSpecialPattern,
} from "./pattern.ts";
import { ResolveTargetKind } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

function argumentRule(pattern: Pattern, module: Module, index: number): Rule {
  return {
    name: `$arg${index}`,
    module,
    parameters: [],
    pattern,
  };
}

function resolveReference(
  pattern: ResolveReferencePattern,
  scope: Scope,
): AwaitableMatch {
  const ref = scope.getRule(pattern.name);
  if (!ref) {
    return error(
      scope,
      pattern,
      MatchErrorCode.UnknownReference,
      `unknown reference: ${pattern.name}`,
    );
  }

  if (pattern.args.length !== ref.parameters.length) {
    return error(
      scope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `invalid argument count: expected ${ref.parameters.length}, got ${pattern.args.length}`,
    );
  }

  const args = new Map<string, Rule>();
  for (let i = 0; i < pattern.args.length; i++) {
    const argPattern = pattern.args[i];
    const paramName = ref.parameters[i].name;
    let argument: Rule;
    if (
      argPattern.kind === PatternKind.Resolve &&
      argPattern.targetKind === ResolveTargetKind.Reference &&
      argPattern.args.length === 0
    ) {
      const namedArgument = scope.getRule(argPattern.name);
      if (!namedArgument) {
        return error(
          scope,
          pattern,
          MatchErrorCode.UnknownParameter,
          `unknown argument reference: ${argPattern.name}`,
        );
      }
      argument = namedArgument;
    } else {
      argument = {
        ...argumentRule(argPattern, scope.module, i),
        closureArgs: new Map(scope.args),
      };
    }

    if (argument === ref || argument.pattern === ref.pattern) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `invalid self reference: ${ref.name}`,
      );
    }
    args.set(paramName, argument);
  }

  return andThen(rule(ref, args, scope), (m) => {
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Ok:
        return ok(scope, m.scope, pattern, m.value, [m]);
      case MatchKind.Fail:
        return fail(scope, pattern, [m]);
    }
  });
}

function resolveRun(
  pattern: ResolveRunPattern,
  scope: Scope,
): AwaitableMatch {
  const { module } = scope;
  const main = pattern.name ? module.exports.get(pattern.name) : module.default;

  if (!main) {
    return error(
      scope,
      pattern,
      MatchErrorCode.PatternExpected,
      pattern.name
        ? `Rule ${pattern.name} not found`
        : "Module does not have a default export, please specify which Rule you want to import",
    );
  }

  if (!isRule(main)) {
    return error(
      scope,
      pattern,
      MatchErrorCode.PatternExpected,
      pattern.name
        ? `Export ${pattern.name} is a func, not a rule`
        : "Default export is a func, not a rule",
    );
  }

  return rule(main, new Map(), scope);
}

function resolveSpecial(
  pattern: ResolveSpecialPattern,
  scope: Scope,
): AwaitableMatch {
  const { value } = pattern;
  if (value == null) {
    return error(
      scope,
      pattern,
      MatchErrorCode.NullValue,
      "Special patterns require a value",
    );
  }

  if (typeof value === "function") {
    return error(
      scope,
      pattern,
      MatchErrorCode.Type,
      "Function patterns are not supported yet",
    );
  }

  const special = (): AwaitableMatch => {
    switch (value.kind) {
      case SpecialKind.Module:
        return resolve(
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Run,
          },
          scope.pushModule(value.module),
        );
      case SpecialKind.Rule:
        return rule(value.rule, new Map(), scope);
    }
  };

  return andThen(special(), (m) => {
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, pattern, [m]);
      case MatchKind.Ok:
        return ok(scope, m.scope.pop(scope), pattern, m.value, [m]);
    }
  });
}

export function resolve(
  pattern: ResolvePattern,
  scope: Scope,
): AwaitableMatch {
  switch (pattern.targetKind) {
    case ResolveTargetKind.Reference:
      return resolveReference(pattern, scope);
    case ResolveTargetKind.Run:
      return resolveRun(pattern, scope);
    case ResolveTargetKind.Special:
      return resolveSpecial(pattern, scope);
  }
}

/**
 * Compiles a `Resolve` pattern into a reusable closure. Unlike composite
 * kinds such as `Then`/`And`/`Or`, a `Resolve` pattern has no static child
 * pattern to precompile ahead of time: which `Rule` it actually invokes is
 * looked up from the invocation `Scope` itself (`scope.getRule`, the
 * current `scope.module`, or a pattern-embedded but already-resolved
 * `Special` value), so there is nothing further to flatten beyond skipping
 * the generic dispatcher's per-call `switch (pattern.kind)`.
 *
 * `resolve` itself stays a plain two-argument entry point (rather than
 * collapsing into this factory the way every other pattern kind does)
 * because callers outside the compiled-pattern pipeline — language
 * bootstrapping code that resolves a synthetic `ResolvePattern` once,
 * outside of any cached rule body — invoke it directly and need the
 * `Match` result, not a reusable closure.
 */
export function buildResolve(pattern: ResolvePattern): CompiledPattern {
  return (scope: Scope) => resolve(pattern, scope);
}
