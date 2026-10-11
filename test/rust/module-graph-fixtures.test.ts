import { assert, assertEquals } from "@std/assert";
import fixtures from "./module-graph-fixtures.json" with { type: "json" };
import { isModuleDeclaration } from "../../src/runtime/declarations/is_module_declaration.ts";
import type { ModuleDeclaration } from "../../src/runtime/declarations/module.ts";
import { Resolver } from "../../src/runtime/resolve.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { PatternKind } from "../../src/runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../src/runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../src/runtime/resolvers/resolver.ts";

Deno.test("req:modules-runtime-001 req:modules-runtime-003 req:modules-runtime-004 req:modules-runtime-005 - shared Rust/TypeScript module graph corpus", async (t) => {
  const root = new URL("file:///uffda-shared-module-graph/");
  for (const fixture of fixtures) {
    await t.step(fixture.name, async () => {
      const declarations: Record<string, ModuleDeclaration> = {};
      for (const [name, declaration] of Object.entries(fixture.modules)) {
        assert(isModuleDeclaration(declaration));
        declarations[new URL(name, root).href] = declaration;
      }
      const result = await new Resolver({ declarations }).import(
        new URL(fixture.entry, root),
        {
          scope: Scope.Default(),
          pattern: {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Run,
          },
        },
      );
      assertEquals(result.kind === ModuleImportResultKind.Error, fixture.error);
      if (result.kind === ModuleImportResultKind.Error) return;
      assertEquals<unknown>(
        Object.fromEntries(
          [...result.module.exports].map((
            [name, value],
          ) => [name, value.module.moduleUrl.href.slice(root.href.length)]),
        ),
        fixture.exports,
      );
      assertEquals(
        result.module.default?.module.moduleUrl.href.slice(root.href.length) ??
          null,
        fixture.default,
      );
    });
  }
});
