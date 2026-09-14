import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { RuntimeSession, SessionLoadFailureCode } from "./mcp.session.ts";
import { compileSourcesToAstArtifacts } from "./compile.ts";

Deno.test("cli.mcp.session RuntimeSession", async (t) => {
  await t.step("loads a module and reports its exports", async () => {
    const session = new RuntimeSession("s1");
    const result = await session.load(
      "export Main; rule Main = any;",
    );
    assertEquals(result.ok, true);
    assert(result.ok);
    assertEquals(result.module.declarations, [
      { name: "Main", kind: "rule", exported: true },
    ]);
    assertEquals(session.listLoadedModules().length, 1);
  });

  await t.step("reports a func and a decorator export", async () => {
    const session = new RuntimeSession("s2");
    const result = await session.load(
      `export Greet Loud;
       decorator Loud = { shout: true };
       func Greet = _;`,
    );
    assertEquals(result.ok, true);
    assert(result.ok);
    const kinds = new Set(result.module.declarations.map((d) => d.kind));
    assert(kinds.has("func"));
    assert(kinds.has("decorator"));
  });

  await t.step("reports a parse failure without crashing", async () => {
    const session = new RuntimeSession("s3");
    const result = await session.load("rule Main = ");
    assertEquals(result.ok, false);
    assert(!result.ok);
    assertEquals(result.error.code, SessionLoadFailureCode.ParseFailure);
    assertEquals(result.error.phase, "parse");
    assertEquals(result.partiallyLoadedModules, []);
  });

  await t.step(
    "reports a resolution failure and prior successfully loaded modules",
    async () => {
      const session = new RuntimeSession("s4");
      const first = await session.load("export Main; rule Main = any;");
      assertEquals(first.ok, true);

      const second = await session.load("export Missing;");
      assertEquals(second.ok, false);
      assert(!second.ok);
      assertEquals(second.error.code, SessionLoadFailureCode.ResolutionFailure);
      assertEquals(second.error.phase, "resolve");
      assertEquals(second.partiallyLoadedModules.length, 1);
    },
  );

  await t.step(
    "re-loading the same path re-addresses the same module",
    async () => {
      const session = new RuntimeSession("s5");
      await session.load("export A; rule A = any;", "main.uff");
      await session.load("export B; rule B = any;", "main.uff");
      assertEquals(session.listLoadedModules().length, 1);
      assertEquals(
        session.listLoadedModules()[0].declarations,
        [{ name: "B", kind: "rule", exported: true }],
      );
    },
  );

  await t.step("close releases state and rejects further loads", async () => {
    const session = new RuntimeSession("s6");
    await session.load("export Main; rule Main = any;");
    session.close();
    assertEquals(session.isClosed, true);
    assertEquals(session.listLoadedModules(), []);
    let threw = false;
    try {
      await session.load("export Main; rule Main = any;");
    } catch {
      threw = true;
    }
    assert(threw);
  });

  await t.step(
    "resolves .uff imports against the default '.uffda' artifact root",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      try {
        const depUff = join(cwd, "dep.uff");
        await Deno.writeTextFile(depUff, "export Foo;\nrule Foo = any;");
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [depUff],
          outputDir: join(cwd, ".uffda", "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("s7", { cwd });
        const result = await session.load(
          'import "./dep.uff" Foo;\nexport Foo;',
          "main.uff",
        );
        assertEquals(result.ok, true);
        assert(result.ok);
        assertEquals(result.module.declarations, [
          { name: "Foo", kind: "rule", exported: true },
        ]);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "honors an explicit artifactRoot override",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      const artifactRoot = await Deno.makeTempDir({
        prefix: "uffda-mcp-session-artifacts-",
      });
      try {
        const depUff = join(cwd, "dep.uff");
        await Deno.writeTextFile(depUff, "export Foo;\nrule Foo = any;");
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [depUff],
          outputDir: join(artifactRoot, "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("s8", { cwd, artifactRoot });
        const result = await session.load(
          'import "./dep.uff" Foo;\nexport Foo;',
          "main.uff",
        );
        assertEquals(result.ok, true);
      } finally {
        await Deno.remove(cwd, { recursive: true });
        await Deno.remove(artifactRoot, { recursive: true });
      }
    },
  );

  await t.step(
    "tracks transitively imported modules in the session graph",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      try {
        const depUff = join(cwd, "dep.uff");
        await Deno.writeTextFile(depUff, "export Foo;\nrule Foo = any;");
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [depUff],
          outputDir: join(cwd, ".uffda", "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("s9", { cwd });
        const result = await session.load(
          'import "./dep.uff" Foo;\nexport Foo;',
          "main.uff",
        );
        assertEquals(result.ok, true);

        const loaded = session.listLoadedModules();
        assertEquals(loaded.length, 2);
        const depSummary = loaded.find((m) => m.moduleUrl.endsWith("dep.uff"));
        assert(depSummary);
        assertEquals(depSummary.declarations, [
          { name: "Foo", kind: "rule", exported: true },
        ]);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "reports modules resolved before a failure via resolvedDuringLoad",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      try {
        const depUff = join(cwd, "dep.uff");
        await Deno.writeTextFile(depUff, "export Foo;\nrule Foo = any;");
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [depUff],
          outputDir: join(cwd, ".uffda", "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("s10", { cwd });
        // "./dep.uff" resolves successfully; "./missing.uff" has no
        // compiled artifact, so the load fails while resolving imports —
        // but only after "./dep.uff" was already fully resolved.
        const result = await session.load(
          'import "./dep.uff" Foo;\nimport "./missing.uff" Bar;',
          "main.uff",
        );
        assertEquals(result.ok, false);
        assert(!result.ok);
        assertEquals(
          result.error.code,
          SessionLoadFailureCode.ResolutionFailure,
        );
        assertEquals(result.resolvedDuringLoad.length, 1);
        assert(result.resolvedDuringLoad[0].moduleUrl.endsWith("dep.uff"));
        assertEquals(result.resolvedDuringLoad[0].declarations, [
          { name: "Foo", kind: "rule", exported: true },
        ]);
        // Nothing is committed to the session's own graph on failure.
        assertEquals(session.listLoadedModules(), []);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "an anonymous load with a relative .uff import fails structurally, not by throwing",
    async () => {
      const session = new RuntimeSession("s11");
      const result = await session.load('import "./dep.uff" Foo;');
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionLoadFailureCode.ResolutionFailure);
      assertEquals(result.error.phase, "resolve");
      assertEquals(result.resolvedDuringLoad, []);
    },
  );

  await t.step(
    "does not re-list an already-committed module in resolvedDuringLoad",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      try {
        const depUff = join(cwd, "dep.uff");
        await Deno.writeTextFile(depUff, "export Foo;\nrule Foo = any;");
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [depUff],
          outputDir: join(cwd, ".uffda", "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("s12", { cwd });
        const first = await session.load(
          'import "./dep.uff" Foo;\nexport Foo;',
          "first.uff",
        );
        assertEquals(first.ok, true);
        assertEquals(session.listLoadedModules().length, 2);

        // A second, failing load that re-imports the already-committed
        // "./dep.uff" must not repeat it in resolvedDuringLoad — it's
        // already reported via partiallyLoadedModules.
        const second = await session.load(
          'import "./dep.uff" Foo;\nimport "./missing.uff" Bar;',
          "second.uff",
        );
        assertEquals(second.ok, false);
        assert(!second.ok);
        assertEquals(second.resolvedDuringLoad, []);
        assertEquals(second.partiallyLoadedModules.length, 2);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "a module whose own resolution fails is not cached as a success (Resolver rollback)",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      try {
        // "bad.uff" itself successfully resolves an artifact but then
        // fails its own resolution (an export referencing an undeclared
        // name) — this must not leave a broken "successful" entry in the
        // resolver's module graph that a later import of the same URL
        // could hit via memoization.
        const badUff = join(cwd, "bad.uff");
        await Deno.writeTextFile(badUff, "export Missing;");
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [badUff],
          outputDir: join(cwd, ".uffda", "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("s13", { cwd });
        const result = await session.load(
          'import "./bad.uff" Missing;',
          "main.uff",
        );
        assertEquals(result.ok, false);
        assert(!result.ok);
        assertEquals(
          result.error.code,
          SessionLoadFailureCode.ResolutionFailure,
        );
        // "bad.uff" itself failed, so it must not appear as a resolved
        // dependency alongside the failure.
        assertEquals(result.resolvedDuringLoad, []);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );
});
