import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { rule } from "../rule.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import { PatternKind } from "./pattern.kind.ts";
import { SpecialKind } from "../modules/special.ts";
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

function argumentRule(pattern: Pattern, module: Module, index: number): Rule {
  return {
    name: `$arg${index}`,
    module,
    parameters: [],
    pattern,
  };
}

async function resolveReference(
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
    const r = {
      ...argumentRule(argPattern, scope.module, i),
      closureArgs: new Map(scope.args),
    };
    if (r.pattern === ref.pattern) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `invalid self reference in argument ${i}`,
      );
    }
    args.set(paramName, r);
  }

  const m = await rule(ref, args, scope);
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

async function resolveRun(
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

  return await rule(main, new Map(), scope);
}

async function resolveSpecial(
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

  const m = await (async () => {
    switch (value.kind) {
      case SpecialKind.Module:
        return await resolve(
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Run,
          },
          scope.pushModule(value.module),
        );
      case SpecialKind.Rule:
        return await rule(value.rule, new Map(), scope);
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

export async function resolve(
  pattern: ResolvePattern,
  scope: Scope,
): AwaitableMatch {
  switch (pattern.targetKind) {
    case ResolveTargetKind.Reference:
      return await resolveReference(pattern, scope);
    case ResolveTargetKind.Run:
      return await resolveRun(pattern, scope);
    case ResolveTargetKind.Special:
      return await resolveSpecial(pattern, scope);
  }
}
