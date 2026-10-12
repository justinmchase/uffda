import { assertEquals, assertStringIncludes } from "@std/assert";
import { toFileUrl } from "@std/path";
import { MatchErrorCode } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../patterns/pattern.ts";
import { Scope } from "../scope.ts";
import { JsonResolver } from "./json.resolver.ts";
import { ModuleDeclarationResultKind } from "./resolver.ts";

Deno.test("req:modules-runtime-002 - JSON resolver validates declarations and normalizes read/parse failures", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const url = toFileUrl(`${directory}/module.json`);
    const context = {
      scope: Scope.Default(),
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Run,
      } as const,
    };
    for (
      const value of [null, 42, {}, {
        imports: [],
        exports: [],
        rules: [],
        funcs: null,
      }]
    ) {
      await Deno.writeTextFile(url, JSON.stringify(value));
      const result = await new JsonResolver().resolveModule(url, context);
      assertEquals(result.kind, ModuleDeclarationResultKind.Error);
      if (result.kind !== ModuleDeclarationResultKind.Error) {
        throw new Error("expected error");
      }
      assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
      assertStringIncludes(
        result.error.message,
        "must export a ModuleDeclaration",
      );
    }
    await Deno.writeTextFile(
      url,
      JSON.stringify({ imports: [], exports: [], rules: [] }),
    );
    const valid = await new JsonResolver().resolveModule(url, context);
    assertEquals(valid.kind, ModuleDeclarationResultKind.ModuleDeclaration);
    await Deno.writeTextFile(url, "{ malformed");
    const invalid = await new JsonResolver().resolveModule(url, context);
    assertEquals(invalid.kind, ModuleDeclarationResultKind.Error);
    if (invalid.kind !== ModuleDeclarationResultKind.Error) {
      throw new Error("expected error");
    }
    assertStringIncludes(
      invalid.error.message,
      "Unable to import module declaration",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
