import { assertEquals } from "@std/assert";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { Scope } from "../../runtime/scope.ts";

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

Deno.test("req:modules-runtime-003 - Native import declarations provide module declarations for normal import binding", async () => {
  const resolver = new Resolver();
  const result = await resolver.import(
    new URL("../../runtime/resolvers/test2.module.ts", import.meta.url),
    context(),
  );

  assertEquals(result.kind, ModuleImportResultKind.Module);
  if (result.kind !== ModuleImportResultKind.Module) return;

  assertEquals([...result.module.rules.keys()], []);
  assertEquals([...result.module.imports.keys()], ["A"]);
  assertEquals(
    [...result.module.imports.get("A")!.module.rules.keys()],
    ["A", "B"],
  );
});
