import { assertEquals, assertRejects } from "@std/assert";
import { MatchKind } from "../match.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";
import { Resolver } from "./resolve.ts";
import { Scope } from "./scope.ts";
import { compileUffdaSource } from "../lang/uffda/execute.ts";

/**
 * End-to-end coverage for rule/func decorators (#159, reworked design): parse
 * `.uff` source through the real grammar and compiler, then materialize it
 * via `Resolver` (which is where `applyAttributes` runs) and inspect the
 * resulting `Rule`/`Func` metadata. See
 * `.agents/specifications/runtime/rule-metadata.spec.md`.
 *
 * Declaration order follows `ModuleBody` in `uffda.lang.uff`
 * (imports*, exports*, then rule/func/decorator declarations*) — `export`
 * statements must precede the rule/func/decorator declarations they
 * reference.
 */
async function importCompiled(source: string) {
  const compiled = await compileUffdaSource(source);
  if (compiled.kind !== MatchKind.Ok) {
    throw new Error(`compileUffdaSource failed: ${compiled.kind}`);
  }
  const moduleUrl = new URL("file:///uffda/decorators.test.module.ts");
  const resolver = new Resolver({
    declarations: { [moduleUrl.href]: compiled.value },
  });
  const scope = Scope.Default();
  const imported = await resolver.import(moduleUrl, {
    scope,
    pattern: { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
  });
  if (imported.kind !== ModuleImportResultKind.Module) {
    throw new Error(`resolver.import failed: ${imported.kind}`);
  }
  return imported.module;
}

Deno.test("runtime/resolve decorators (#159)", async (t) => {
  await t.step(
    "RESOLVE_DECORATORS00 - a rule attribute's metadata is recorded on the Rule, keyed by decorator name",
    async () => {
      const module = await importCompiled(
        `export Main;
         decorator Deprecated<message:string> = { kind: "deprecated", message: message };
         [Deprecated "superseded"]
         rule Main = any;`,
      );
      const main = module.rules.get("Main");
      assertEquals(main?.metadata, {
        Deprecated: { kind: "deprecated", message: "superseded" },
      });
      assertEquals(main?.attributes?.length, 1);
      assertEquals(main?.attributes?.[0].decorator.name, "Deprecated");
    },
  );

  await t.step(
    "RESOLVE_DECORATORS01 - stacked attributes are each keyed by their own decorator name",
    async () => {
      const module = await importCompiled(
        `export Main;
         decorator First = { kind: "first", a: 1 };
         decorator Second = { kind: "second", a: 1 };
         [First][Second]
         rule Main = any;`,
      );
      const main = module.rules.get("Main");
      assertEquals(main?.metadata, {
        First: { kind: "first", a: 1 },
        Second: { kind: "second", a: 1 },
      });
      assertEquals(
        main?.attributes?.map((a) => a.decorator.name),
        ["First", "Second"],
      );
    },
  );

  await t.step(
    "RESOLVE_DECORATORS02 - a func can also carry attributes",
    async () => {
      const module = await importCompiled(
        `export Main;
         decorator Example = { kind: "example" };
         [Example]
         func Decorated = _;
         rule Main = any -> (Decorated);`,
      );
      const decorated = module.funcs.get("Decorated");
      assertEquals(decorated?.metadata, { Example: { kind: "example" } });
    },
  );

  await t.step(
    "RESOLVE_DECORATORS03 - attribute presence is recorded even without an object return",
    async () => {
      const module = await importCompiled(
        `export Main;
         decorator Inlined = "not-an-object";
         [Inlined]
         rule Main = any;`,
      );
      const main = module.rules.get("Main");
      assertEquals(main?.metadata, { Inlined: "not-an-object" });
      assertEquals(main?.attributes?.[0].decorator.name, "Inlined");
    },
  );

  await t.step(
    "RESOLVE_DECORATORS04 - applying the same decorator twice throws",
    async () => {
      await assertRejects(
        () =>
          importCompiled(
            `export Main;
             decorator Once = { kind: "once" };
             [Once][Once]
             rule Main = any;`,
          ),
        Error,
        "applied more than once",
      );
    },
  );

  await t.step(
    "RESOLVE_DECORATORS05 - an unresolved attribute name fails module resolution",
    async () => {
      await assertRejects(
        () =>
          importCompiled(
            `export Main;
             [Missing]
             rule Main = any;`,
          ),
        ReferenceError,
        "unknown decorator reference: Missing",
      );
    },
  );

  await t.step(
    "RESOLVE_DECORATORS06 - a decorator applied to an unrelated func is unaffected by that func's own name/shape",
    async () => {
      const module = await importCompiled(
        `export Main;
         decorator ExampleDecorator = { kind: "example" };
         [ExampleDecorator]
         func Example = { kind: "example-func" };
         rule Main = any;`,
      );
      const example = module.funcs.get("Example");
      assertEquals(example?.metadata, {
        ExampleDecorator: { kind: "example" },
      });
    },
  );

  await t.step(
    "RESOLVE_DECORATORS07 - an attribute naming a rule/func (not a decorator) fails resolution",
    async () => {
      await assertRejects(
        () =>
          importCompiled(
            `export Main;
             func NotADecorator = { kind: "nope" };
             [NotADecorator]
             rule Main = any;`,
          ),
        ReferenceError,
        "unknown decorator reference: NotADecorator",
      );
    },
  );

  await t.step(
    "RESOLVE_DECORATORS08 - a decorator declaration name colliding with a func name fails resolution",
    async () => {
      await assertRejects(
        () =>
          importCompiled(
            `export Main;
             func Shared = { kind: "func" };
             decorator Shared = { kind: "decorator" };
             rule Main = any;`,
          ),
      );
    },
  );
});
