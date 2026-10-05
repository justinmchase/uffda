import { assert, assertEquals } from "@std/assert";
import { MatchErrorCode, MatchKind } from "../match.ts";
import { Resolver } from "./resolve.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";
import { ExportDeclarationKind } from "./declarations/export.ts";
import { ImportDeclarationKind } from "./declarations/import.ts";
import { Scope } from "./scope.ts";

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

const readPermissions = await Deno.permissions.query({ name: "read" });
if (readPermissions.state === "granted") {
  Deno.test({
    name: "RESOLVE00",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test.module.json", import.meta.url),
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE01",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test.module.js", import.meta.url),
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE02",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test0.module.ts", import.meta.url),
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE03",
    fn: async () => {
      const resolver = new Resolver();
      const resolved = await resolver.import(
        new URL("./resolvers/test1.module.ts", import.meta.url),
        context(),
      );
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;
      assertEquals(
        [...resolved.module.rules.keys()],
        [],
      );
      assertEquals(
        [...resolved.module.imports.get("A")!.module.rules.keys()],
        ["A", "B"],
      );
    },
  });

  Deno.test({
    name: "RESOLVE04",
    fn: async () => {
      const resolver = new Resolver();
      const t1 = await resolver.import(
        new URL("./resolvers/test1.module.ts", import.meta.url),
        context(),
      );
      const t2 = await resolver.import(
        new URL("./resolvers/test2.module.ts", import.meta.url),
        context(),
      );
      assertEquals(t1.kind, ModuleImportResultKind.Module);
      assertEquals(t2.kind, ModuleImportResultKind.Module);
      if (
        t1.kind !== ModuleImportResultKind.Module ||
        t2.kind !== ModuleImportResultKind.Module
      ) return;
      assertEquals(
        t1.module.imports.get("A")?.module,
        t2.module.imports.get("A")?.module,
      );
    },
  });

  Deno.test({
    name: "RESOLVE05",
    fn: async () => {
      const resolver = new Resolver();
      const m = await resolver.import(
        new URL("./resolvers/test.bad.module.txt", import.meta.url),
        context(),
      );
      assertEquals(m.kind, ModuleImportResultKind.Error);
      if (m.kind !== ModuleImportResultKind.Error) return;
      assertEquals(m.error.kind, MatchKind.Error);
      assertEquals(m.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        m.error.message,
        "Unable to resolve file of unknown extension .txt",
      );
    },
  });

  Deno.test({
    name: "RESOLVE06",
    fn: async () => {
      const resolver = new Resolver();
      const m = await resolver.import(
        new URL("./resolvers/test.bad.module.js", import.meta.url),
        context(),
      );
      assertEquals(m.kind, ModuleImportResultKind.Error);
      if (m.kind !== ModuleImportResultKind.Error) return;
      assertEquals(m.error.kind, MatchKind.Error);
      assertEquals(m.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        m.error.message,
        `Imported module ${new URL(
          "./resolvers/test.bad.module.js",
          import.meta.url,
        )} must export a ModuleDeclaration as a default export`,
      );
    },
  });

  Deno.test({
    name: "RESOLVE07",
    fn: async () => {
      const resolver = new Resolver();
      const m = await resolver.import(
        new URL("./resolvers/test.bad.module.json", import.meta.url),
        context(),
      );
      assertEquals(m.kind, ModuleImportResultKind.Error);
      if (m.kind !== ModuleImportResultKind.Error) return;
      assertEquals(m.error.kind, MatchKind.Error);
      assertEquals(m.error.code, MatchErrorCode.ModuleResolution);
      assertEquals(
        m.error.message,
        `Unable to import module declaration from ${new URL(
          "./resolvers/test.bad.module.json",
          import.meta.url,
        )}`,
      );
      assert(m.error.cause instanceof Error);
    },
  });

  Deno.test({
    name:
      "RESOLVE08 - resolvedModules/moduleDeclarations expose every resolved module",
    fn: async () => {
      const resolver = new Resolver();
      const moduleUrl = new URL(
        "./resolvers/test.module.json",
        import.meta.url,
      );
      const resolved = await resolver.import(moduleUrl, context());
      assertEquals(resolved.kind, ModuleImportResultKind.Module);
      if (resolved.kind !== ModuleImportResultKind.Module) return;

      assert(resolver.resolvedModules.has(moduleUrl.href));
      assertEquals(
        resolver.resolvedModules.get(moduleUrl.href),
        resolved.module,
      );
      assert(resolver.moduleDeclarations.has(moduleUrl.href));
    },
  });

  Deno.test({
    name: "RESOLVE09 - a failed import is rolled back, not cached as a success",
    fn: async () => {
      const resolver = new Resolver();
      const moduleUrl = new URL(
        "./resolvers/test.bad.module.json",
        import.meta.url,
      );
      const first = await resolver.import(moduleUrl, context());
      assertEquals(first.kind, ModuleImportResultKind.Error);

      // The failed URL must not be memoized as if it had succeeded:
      // `resolvedModules` must not carry a half-built entry for it, and a
      // second `import()` of the same URL must fail again rather than
      // returning a cached "success" for the broken module.
      assert(!resolver.resolvedModules.has(moduleUrl.href));

      const second = await resolver.import(moduleUrl, context());
      assertEquals(second.kind, ModuleImportResultKind.Error);
    },
  });

  Deno.test({
    name: "RESOLVE10 - an import failure carries the chain of import edges",
    fn: async () => {
      const main = "file:///uffda-resolve10/main.uff";
      const mid = "file:///uffda-resolve10/mid.uff";
      const leaf = "file:///uffda-resolve10/leaf.uff";
      const rule = (name: string) => ({
        name,
        parameters: [],
        pattern: { kind: PatternKind.Any } as const,
      });
      const resolver = new Resolver({
        declarations: {
          [main]: {
            imports: [
              {
                kind: ImportDeclarationKind.Module,
                moduleUrl: "./leaf.uff",
                names: ["L"],
              },
              {
                kind: ImportDeclarationKind.Module,
                moduleUrl: "./mid.uff",
                names: ["M"],
              },
            ],
            exports: [],
            rules: [],
          },
          [mid]: {
            imports: [{
              kind: ImportDeclarationKind.Module,
              moduleUrl: "./leaf.uff",
              names: ["Nope"],
            }],
            exports: [{ kind: ExportDeclarationKind.Rule, name: "M" }],
            rules: [rule("M")],
          },
          [leaf]: {
            imports: [],
            exports: [{ kind: ExportDeclarationKind.Rule, name: "L" }],
            rules: [rule("L")],
          },
        },
      });
      const result = await resolver.import(new URL(main), context());
      assert(result.kind === ModuleImportResultKind.Error);
      assertEquals(result.importChain, [
        {
          importerUrl: main,
          importIndex: 1,
          moduleUrl: "./mid.uff",
          resolvedUrl: mid,
        },
        {
          importerUrl: mid,
          importIndex: 0,
          moduleUrl: "./leaf.uff",
          resolvedUrl: leaf,
          name: "Nope",
        },
      ]);
    },
  });

  Deno.test({
    name: "RESOLVE11 - module names resolve through the import map",
    fn: async (t) => {
      const main = "file:///uffda-resolve11/main.uff";
      const tokens = "jsr:@acme/kv@^1.2.0/tokens";
      const importing = (moduleUrl: string) => ({
        imports: [{
          kind: ImportDeclarationKind.Module as const,
          moduleUrl,
          names: ["T"],
        }],
        exports: [],
        rules: [],
      });
      const imports = new Map([["@acme/kv", "jsr:@acme/kv@^1.2.0"]]);

      await t.step("an alias imports the module it stands for", async () => {
        const resolver = new Resolver({
          imports,
          declarations: {
            [main]: importing("@acme/kv/tokens"),
            [tokens]: {
              imports: [],
              exports: [{ kind: ExportDeclarationKind.Rule, name: "T" }],
              rules: [{
                name: "T",
                parameters: [],
                pattern: { kind: PatternKind.Any },
              }],
            },
          },
        });
        const result = await resolver.import(new URL(main), context());
        assertEquals(result.kind, ModuleImportResultKind.Module);
        assert(resolver.resolvedModules.has(tokens));
      });

      await t.step("an undeclared module name is an import error", async () => {
        const resolver = new Resolver({
          imports,
          declarations: { [main]: importing("@acme/other") },
        });
        const result = await resolver.import(new URL(main), context());
        assert(result.kind === ModuleImportResultKind.Error);
        assertEquals(
          result.error.message,
          '"@acme/other" is not a module name the project file\'s `imports` declares',
        );
        assertEquals(result.importChain, [{
          importerUrl: main,
          importIndex: 0,
          moduleUrl: "@acme/other",
        }]);
      });

      await t.step("a jsr: module is not loaded yet", async () => {
        const resolver = new Resolver({
          imports,
          declarations: { [main]: importing("@acme/kv/tokens") },
        });
        const result = await resolver.import(new URL(main), context());
        assert(result.kind === ModuleImportResultKind.Error);
        assertEquals(
          result.error.message,
          `Unable to load ${tokens}: loading modules from packages is not supported yet`,
        );
        assertEquals(result.importChain?.[0].resolvedUrl, tokens);
      });
    },
  });

  Deno.test({
    name: "RESOLVE12 - .uff imports are read from the artifact layout",
    fn: async (t) => {
      const root = await Deno.makeTempDir({ prefix: "uffda-resolve12-" });
      try {
        const outDir = `${root}/out`;
        await Deno.mkdir(`${outDir}/ast/lib`, { recursive: true });
        await Deno.writeTextFile(
          `${outDir}/ast/lib/dep.uffda.ast.json`,
          JSON.stringify({
            imports: [],
            exports: [{ kind: ExportDeclarationKind.Rule, name: "T" }],
            rules: [{ name: "T", parameters: [], pattern: { kind: "any" } }],
          }),
        );
        const dep = new URL(`file://${root}/lib/dep.uff`);

        await t.step("from <outDir>/ast/<path from root>", async () => {
          const resolver = new Resolver({ artifacts: { root, outDir } });
          const result = await resolver.import(dep, context());
          assertEquals(result.kind, ModuleImportResultKind.Module);
        });

        await t.step("by default, from the cwd's ./bin", async () => {
          const result = await new Resolver().import(dep, context());
          assert(result.kind === ModuleImportResultKind.Error);
          assert(
            result.error.message.includes(`is outside ${Deno.cwd()}`),
            result.error.message,
          );
        });
      } finally {
        await Deno.remove(root, { recursive: true });
      }
    },
  });
} else {
  Deno.test({
    name: "resolve tests require read permissions",
    ignore: true,
    fn: () => {},
  });
}
