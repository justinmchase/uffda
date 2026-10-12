import { assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { JsonResolver } from "../../src/runtime/resolvers/json.resolver.ts";
import { ModuleDeclarationResultKind } from "../../src/runtime/resolvers/resolver.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { PatternKind } from "../../src/runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../src/runtime/patterns/pattern.ts";

type Fixture = { name: string; text: string; valid: boolean };

Deno.test("req:modules-runtime-002 - shared Rust/TypeScript JSON declaration validation corpus", async (t) => {
  const fixtures: Fixture[] = JSON.parse(
    await Deno.readTextFile(
      new URL("./module-fixtures.json", import.meta.url),
    ),
  );
  const directory = await Deno.makeTempDir();
  try {
    const url = toFileUrl(join(directory, "module.json"));
    const context = {
      scope: Scope.Default(),
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Run,
      } as const,
    };
    for (const fixture of fixtures) {
      await t.step(fixture.name, async () => {
        await Deno.writeTextFile(url, fixture.text);
        const result = await new JsonResolver().resolveModule(url, context);
        assertEquals(
          result.kind === ModuleDeclarationResultKind.ModuleDeclaration,
          fixture.valid,
        );
      });
    }
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
