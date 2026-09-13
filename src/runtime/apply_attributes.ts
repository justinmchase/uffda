import { ok } from "../match.ts";
import type { MatchOk } from "../match.ts";
import type { AttributeDeclaration } from "./declarations/attribute.ts";
import { exec } from "./exec.ts";
import { funcCallable } from "./expressions/func_callable.ts";
import type { Attribute } from "./modules/attribute.ts";
import type { DecoratorFunc } from "./modules/decorator.ts";
import type { Func } from "./modules/func.ts";
import type { Module } from "./modules/module.ts";
import type { Rule } from "./modules/rule.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import type { Scope } from "./scope.ts";

function resolveDecorator(
  module: Module,
  name: string,
): DecoratorFunc | undefined {
  return module.decorators.get(name) ?? module.decoratorImports.get(name);
}

/**
 * Invokes each attribute's decorator, in written order, against `target` — a
 * freshly materialized `Rule`/`Func` that does not yet carry
 * `attributes`/`metadata`.
 *
 * `this` inside a decorator's body always resolves to `target` (see
 * `.agents/specifications/runtime/rule-metadata.spec.md`): decorator
 * declarations live in a namespace (`Module.decorators`/
 * `Module.decoratorImports`) entirely separate from ordinary funcs, so a
 * decorator's body is only ever reachable through this attribute-application
 * path — never through ordinary reference/invocation evaluation — which
 * makes `this`'s meaning here unambiguous by construction, not by a runtime
 * or static guard. This MUST also run before `target.metadata`/
 * `target.attributes` are populated: `target` only exposes its
 * pre-decoration structural fields at the point it is passed in here, which
 * keeps decorator invocation acyclic by construction (a decorator can never
 * observe its own or a sibling decorator's not-yet-final output, including a
 * decorator whose name matches the declaration it decorates).
 */
export async function applyAttributes(
  target: Rule | Func,
  declarations: AttributeDeclaration[] | undefined,
  module: Module,
  scope: Scope,
): Promise<void> {
  if (!declarations || declarations.length === 0) {
    return;
  }

  const baseMatch: MatchOk = ok(
    scope,
    scope,
    { kind: PatternKind.End },
    undefined,
  );

  const seen = new Set<DecoratorFunc>();
  const attributes: Attribute[] = [];
  const metadata: Record<string, unknown> = {};

  for (const { name, args } of declarations) {
    const decorator = resolveDecorator(module, name);
    if (!decorator) {
      throw new ReferenceError(`unknown decorator reference: ${name}`);
    }
    if (seen.has(decorator)) {
      throw new Error(
        `decorator ${name} is applied more than once to ${target.name}`,
      );
    }
    seen.add(decorator);

    const resolvedArgs: unknown[] = [];
    for (const arg of args) {
      resolvedArgs.push(await exec(arg, baseMatch));
    }

    const invoke = funcCallable(decorator, baseMatch, target);
    const result = await invoke(...resolvedArgs);
    metadata[name] = result;
    attributes.push({ decorator, args: resolvedArgs });
  }

  target.attributes = attributes;
  target.metadata = metadata;
}
