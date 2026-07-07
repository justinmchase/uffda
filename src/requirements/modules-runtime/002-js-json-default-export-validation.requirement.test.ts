import { assert, assertEquals } from "@std/assert";
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

Deno.test("req:modules-runtime-002 - JavaScript and JSON declaration modules require default declaration exports", async (t) => {
  await t.step(
    "js module missing default declaration export fails",
    async () => {
      const resolver = new Resolver();
      const result = await resolver.import(
        new URL("../../runtime/resolvers/test.bad.module.js", import.meta.url),
        context(),
      );

      assertEquals(result.kind, ModuleImportResultKind.Error);
      if (result.kind !== ModuleImportResultKind.Error) return;
      assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        result.error.message,
        `Imported module ${new URL(
          "../../runtime/resolvers/test.bad.module.js",
          import.meta.url,
        )} must export a ModuleDeclaration as a default export`,
      );
    },
  );

  await t.step(
    "json import parse failure surfaces module-resolution error",
    async () => {
      const resolver = new Resolver();
      const result = await resolver.import(
        new URL(
          "../../runtime/resolvers/test.bad.module.json",
          import.meta.url,
        ),
        context(),
      );

      assertEquals(result.kind, ModuleImportResultKind.Error);
      if (result.kind !== ModuleImportResultKind.Error) return;
      assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        result.error.message,
        `Unable to import module declaration from ${new URL(
          "../../runtime/resolvers/test.bad.module.json",
          import.meta.url,
        )}`,
      );
      assert(result.error.cause instanceof Error);
    },
  );
});
