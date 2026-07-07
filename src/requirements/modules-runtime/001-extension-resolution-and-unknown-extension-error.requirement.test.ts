import { assertEquals } from "@std/assert";
import { MatchErrorCode } from "../../match.ts";
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

Deno.test("req:modules-runtime-001 - Module resolution supports configured extensions and rejects unknown extensions", async (t) => {
  await t.step(
    "ts/js/json declaration modules resolve successfully",
    async () => {
      const resolver = new Resolver();

      const tsResult = await resolver.import(
        new URL("../../runtime/resolvers/test0.module.ts", import.meta.url),
        context(),
      );
      assertEquals(tsResult.kind, ModuleImportResultKind.Module);

      const jsResult = await resolver.import(
        new URL("../../runtime/resolvers/test.module.js", import.meta.url),
        context(),
      );
      assertEquals(jsResult.kind, ModuleImportResultKind.Module);

      const jsonResult = await resolver.import(
        new URL("../../runtime/resolvers/test.module.json", import.meta.url),
        context(),
      );
      assertEquals(jsonResult.kind, ModuleImportResultKind.Module);
    },
  );

  await t.step("unknown extension yields module-resolution error", async () => {
    const resolver = new Resolver();
    const result = await resolver.import(
      new URL("../../runtime/resolvers/test.bad.module.txt", import.meta.url),
      context(),
    );

    assertEquals(result.kind, ModuleImportResultKind.Error);
    if (result.kind !== ModuleImportResultKind.Error) return;
    assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
    assertEquals(
      result.error.message,
      "Unable to resolve file of unknown extension .txt",
    );
  });
});
