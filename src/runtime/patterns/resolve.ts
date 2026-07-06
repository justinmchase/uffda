import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { rule } from "../rule.ts";
import { PatternKind } from "./pattern.kind.ts";
import { SpecialKind } from "../modules/special.ts";
import type { Rule } from "../modules/rule.ts";
import type { Scope } from "../scope.ts";
import type {
  ResolvePattern,
  ResolveReferencePattern,
  ResolveRunPattern,
  ResolveSpecialPattern,
} from "./pattern.ts";
import { ResolveTargetKind } from "./pattern.ts";

function resolveReference(
  pattern: ResolveReferencePattern,
  scope: Scope,
): Match {
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
    const argName = pattern.args[i];
    const paramName = ref.parameters[i].name;
    const r = scope.getRule(argName);
    if (!r) {
      return error(
        scope,
        pattern,
        MatchErrorCode.UnknownParameter,
        `unknown argument reference: ${argName}`,
      );
    }
    if (r === ref) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `invalid self reference: ${argName}`,
      );
    }
    args.set(paramName, r);
  }

  const m = rule(ref, args, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Ok:
      return ok(scope, m.scope, pattern, m.value, [m]);
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
  }
}

function resolveRun(pattern: ResolveRunPattern, scope: Scope): Match {
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

  return rule(main, new Map(), scope);
}

function resolveSpecial(pattern: ResolveSpecialPattern, scope: Scope): Match {
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

  const m = (() => {
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
  })();

  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, m.scope.pop(scope), pattern, m.value, [m]);
  }
}

export function resolve(pattern: ResolvePattern, scope: Scope): Match {
  switch (pattern.targetKind) {
    case ResolveTargetKind.Reference:
      return resolveReference(pattern, scope);
    case ResolveTargetKind.Run:
      return resolveRun(pattern, scope);
    case ResolveTargetKind.Special:
      return resolveSpecial(pattern, scope);
  }
}
