import { assert, assertEquals } from "@std/assert";
import { exists } from "@std/fs/exists";
import { join } from "@std/path";
import { ImportDeclarationKind } from "../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { astArtifactPathForUffUrl } from "../runtime/resolvers/artifact_path.ts";
import { ensureCompiledImportArtifacts } from "./ensure_import_artifacts.ts";

function declWithImport(moduleUrl: string): ModuleDeclaration {
  return {
    imports: [{
      kind: ImportDeclarationKind.Module,
      moduleUrl,
      names: ["Foo"],
    }],
    exports: [],
    rules: [],
  };
}

Deno.test("cli.ensure_import_artifacts", async (t) => {
  await t.step(
    "compiles a missing file:// .uff import into the artifact root",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-ensure-imports-" });
      try {
        const depPath = join(cwd, "dep.uff");
        await Deno.writeTextFile(depPath, "export Foo;\nrule Foo = any;");
        const mainUrl = new URL(`file://${join(cwd, "main.uff")}`);
        const depUrl = new URL(`file://${depPath}`);

        const result = await ensureCompiledImportArtifacts({
          cwd,
          artifactRoot: ".uffda",
          moduleUrl: mainUrl,
          declaration: declWithImport("./dep.uff"),
          knownDeclarations: new Map(),
        });
        assertEquals(result.ok, true);

        const artifactPath = astArtifactPathForUffUrl(cwd, ".uffda", depUrl);
        assertEquals(await exists(artifactPath), true);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "skips imports already present in knownDeclarations",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-ensure-imports-" });
      try {
        const depPath = join(cwd, "dep.uff");
        // No source file written — knownDeclarations must short-circuit.
        const mainUrl = new URL(`file://${join(cwd, "main.uff")}`);
        const depUrl = new URL(`file://${depPath}`);
        const known: ModuleDeclaration = {
          imports: [],
          exports: [],
          rules: [],
        };

        const result = await ensureCompiledImportArtifacts({
          cwd,
          artifactRoot: ".uffda",
          moduleUrl: mainUrl,
          declaration: declWithImport("./dep.uff"),
          knownDeclarations: new Map([[depUrl.href, known]]),
        });
        assertEquals(result.ok, true);
        assertEquals(
          await exists(astArtifactPathForUffUrl(cwd, ".uffda", depUrl)),
          false,
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "compiles transitive imports discovered from a freshly written artifact",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-ensure-imports-" });
      try {
        const leafPath = join(cwd, "leaf.uff");
        const midPath = join(cwd, "mid.uff");
        await Deno.writeTextFile(leafPath, "export Z;\nrule Z = any;");
        await Deno.writeTextFile(
          midPath,
          'import "./leaf.uff" Z;\nexport Mid;\nrule Mid = Z;',
        );
        const mainUrl = new URL(`file://${join(cwd, "main.uff")}`);
        const leafUrl = new URL(`file://${leafPath}`);

        const result = await ensureCompiledImportArtifacts({
          cwd,
          artifactRoot: ".uffda",
          moduleUrl: mainUrl,
          declaration: declWithImport("./mid.uff"),
          knownDeclarations: new Map(),
        });
        assertEquals(result.ok, true);
        assert(result.ok);
        assertEquals(
          await exists(astArtifactPathForUffUrl(cwd, ".uffda", leafUrl)),
          true,
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "leaves missing import sources for the resolver (does not fail ensure)",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-ensure-imports-" });
      try {
        const mainUrl = new URL(`file://${join(cwd, "main.uff")}`);
        const result = await ensureCompiledImportArtifacts({
          cwd,
          artifactRoot: ".uffda",
          moduleUrl: mainUrl,
          declaration: declWithImport("./missing.uff"),
          knownDeclarations: new Map(),
        });
        assert(result.ok);
        assertEquals(
          [...result.missingSources],
          [new URL(`file://${join(cwd, "missing.uff")}`).href],
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "reports a structured failure when an import source fails to compile",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-ensure-imports-" });
      try {
        const badPath = join(cwd, "bad.uff");
        await Deno.writeTextFile(badPath, "this is not valid uffda !!!");
        const mainUrl = new URL(`file://${join(cwd, "main.uff")}`);
        const result = await ensureCompiledImportArtifacts({
          cwd,
          artifactRoot: ".uffda",
          moduleUrl: mainUrl,
          declaration: declWithImport("./bad.uff"),
          knownDeclarations: new Map(),
        });
        assertEquals(result.ok, false);
        assert(!result.ok);
        assert(result.message.length > 0);
        const badUrl = new URL(`file://${badPath}`).href;
        assertEquals(result.dependency.moduleUrl, badUrl);
        assertEquals(result.dependency.location?.line, 0);
        assertEquals(result.importChain, [{
          importerUrl: mainUrl.href,
          importIndex: 0,
          moduleUrl: "./bad.uff",
          resolvedUrl: badUrl,
        }]);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "reports the full import chain for a transitive compile failure",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-ensure-imports-" });
      try {
        const midPath = join(cwd, "mid.uff");
        const badPath = join(cwd, "bad.uff");
        await Deno.writeTextFile(
          midPath,
          'import "./bad.uff" B;\nexport Mid;\nrule Mid = B;',
        );
        await Deno.writeTextFile(badPath, "export B;\n\nrule B = ( any ;");
        const mainUrl = new URL(`file://${join(cwd, "main.uff")}`);
        const midUrl = new URL(`file://${midPath}`).href;
        const badUrl = new URL(`file://${badPath}`).href;
        const result = await ensureCompiledImportArtifacts({
          cwd,
          artifactRoot: ".uffda",
          moduleUrl: mainUrl,
          declaration: declWithImport("./mid.uff"),
          knownDeclarations: new Map(),
        });
        assert(!result.ok);
        assertEquals(result.dependency.moduleUrl, badUrl);
        assertEquals(result.dependency.location?.line, 2);
        assertEquals(result.importChain, [
          {
            importerUrl: mainUrl.href,
            importIndex: 0,
            moduleUrl: "./mid.uff",
            resolvedUrl: midUrl,
          },
          {
            importerUrl: midUrl,
            importIndex: 0,
            moduleUrl: "./bad.uff",
            resolvedUrl: badUrl,
          },
        ]);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );
});
