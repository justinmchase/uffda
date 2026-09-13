import { assertEquals, assertRejects } from "@std/assert";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { DefaultModule } from "./modules/module.ts";
import type { DecoratorFunc } from "./modules/decorator.ts";
import type { Func } from "./modules/func.ts";
import type { Rule } from "./modules/rule.ts";
import type { AttributeDeclaration } from "./declarations/attribute.ts";
import type { Serializable } from "@justinmchase/serializable";
import { Scope } from "./scope.ts";
import { applyAttributes } from "./apply_attributes.ts";

function metadataDecorator(
  name: string,
  metadata: Serializable,
): DecoratorFunc {
  return {
    name,
    module: DefaultModule(),
    pattern: { kind: PatternKind.End },
    expression: { kind: ExpressionKind.Value, value: metadata },
  };
}

function targetRule(name = "Target"): Rule {
  return {
    name,
    module: DefaultModule(),
    pattern: { kind: PatternKind.Any },
    parameters: [],
  };
}

Deno.test("runtime/apply_attributes", async (t) => {
  await t.step(
    "APPLY_ATTRIBUTES00 - no declarations leaves attributes/metadata unset",
    async () => {
      const module = DefaultModule();
      const scope = Scope.Default();
      const rule = targetRule();
      await applyAttributes(rule, undefined, module, scope);
      assertEquals(rule.attributes, undefined);
      assertEquals(rule.metadata, undefined);

      await applyAttributes(rule, [], module, scope);
      assertEquals(rule.attributes, undefined);
      assertEquals(rule.metadata, undefined);
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES01 - presence is recorded even without an object return",
    async () => {
      const module = DefaultModule();
      const decorator = metadataDecorator("Inlined", "not-an-object");
      module.decorators.set("Inlined", decorator);
      const scope = Scope.Default();
      const rule = targetRule();
      const attributes: AttributeDeclaration[] = [{
        name: "Inlined",
        args: [],
      }];

      await applyAttributes(rule, attributes, module, scope);
      assertEquals(rule.attributes?.length, 1);
      assertEquals(rule.attributes?.[0].decorator, decorator);
      assertEquals(rule.metadata, { Inlined: "not-an-object" });
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES02 - results are keyed by decorator name, never merged",
    async () => {
      const module = DefaultModule();
      const first = metadataDecorator("First", { kind: "first", a: 1 });
      const second = metadataDecorator("Second", { kind: "second", a: 1 });
      module.decorators.set("First", first);
      module.decorators.set("Second", second);
      const scope = Scope.Default();
      const rule = targetRule();
      const attributes: AttributeDeclaration[] = [
        { name: "First", args: [] },
        { name: "Second", args: [] },
      ];

      await applyAttributes(rule, attributes, module, scope);
      assertEquals(rule.metadata, {
        First: { kind: "first", a: 1 },
        Second: { kind: "second", a: 1 },
      });
      assertEquals(rule.attributes?.map((a) => a.decorator.name), [
        "First",
        "Second",
      ]);
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES03 - `this` inside the decorator body resolves to the target",
    async () => {
      const module = DefaultModule();
      const decorator: DecoratorFunc = {
        name: "NameOf",
        module,
        pattern: { kind: PatternKind.End },
        expression: {
          kind: ExpressionKind.Object,
          keys: [{
            kind: ExpressionKind.ObjectKey,
            name: "decoratedName",
            expression: {
              kind: ExpressionKind.Member,
              expression: { kind: ExpressionKind.Reference, name: "this" },
              name: "name",
            },
          }],
        },
      };
      module.decorators.set("NameOf", decorator);
      const scope = Scope.Default();
      const rule = targetRule("Decorated");

      await applyAttributes(
        rule,
        [{ name: "NameOf", args: [] }],
        module,
        scope,
      );
      assertEquals(rule.metadata, { NameOf: { decoratedName: "Decorated" } });
      assertEquals(rule.attributes?.[0].decorator.name, "NameOf");
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES04 - applying the same decorator twice throws",
    async () => {
      const module = DefaultModule();
      const decorator = metadataDecorator("Once", { kind: "once" });
      module.decorators.set("Once", decorator);
      const scope = Scope.Default();
      const rule = targetRule();
      const attributes: AttributeDeclaration[] = [
        { name: "Once", args: [] },
        { name: "Once", args: [] },
      ];

      await assertRejects(
        () => applyAttributes(rule, attributes, module, scope),
        Error,
        "applied more than once",
      );
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES05 - an unresolved decorator name throws a ReferenceError",
    async () => {
      const module = DefaultModule();
      const scope = Scope.Default();
      const rule = targetRule();
      const attributes: AttributeDeclaration[] = [{
        name: "Missing",
        args: [],
      }];

      await assertRejects(
        () => applyAttributes(rule, attributes, module, scope),
        ReferenceError,
        "unknown decorator reference: Missing",
      );
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES06 - an attribute name resolving only to an ordinary func (not a decorator) is unresolved",
    async () => {
      const module = DefaultModule();
      const fn: Func = {
        name: "NotADecorator",
        module,
        pattern: { kind: PatternKind.End },
        expression: { kind: ExpressionKind.Value, value: { kind: "nope" } },
      };
      module.funcs.set("NotADecorator", fn);
      const scope = Scope.Default();
      const rule = targetRule();
      const attributes: AttributeDeclaration[] = [{
        name: "NotADecorator",
        args: [],
      }];

      await assertRejects(
        () => applyAttributes(rule, attributes, module, scope),
        ReferenceError,
        "unknown decorator reference: NotADecorator",
      );
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES07 - a decorator can resolve via module decorator imports",
    async () => {
      const module = DefaultModule();
      const decorator = metadataDecorator("Imported", { kind: "imported" });
      module.decoratorImports.set("Imported", decorator);
      const scope = Scope.Default();
      const rule = targetRule();

      await applyAttributes(
        rule,
        [{ name: "Imported", args: [] }],
        module,
        scope,
      );
      assertEquals(rule.metadata, { Imported: { kind: "imported" } });
    },
  );

  await t.step(
    "APPLY_ATTRIBUTES08 - a decorator whose name matches the decorated declaration is safe (no special guard needed)",
    async () => {
      const module = DefaultModule();
      const decorator = metadataDecorator("Example", { kind: "example" });
      module.decorators.set("Example", decorator);
      const scope = Scope.Default();
      const func: Func = {
        name: "Example",
        module,
        pattern: { kind: PatternKind.End },
        expression: { kind: ExpressionKind.Value, value: { kind: "func" } },
      };

      await applyAttributes(
        func,
        [{ name: "Example", args: [] }],
        module,
        scope,
      );
      assertEquals(func.metadata, { Example: { kind: "example" } });
    },
  );
});
