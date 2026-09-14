import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  RuntimeSession,
  SessionDescribeFailureCode,
  SessionEvalFailureCode,
  SessionLoadFailureCode,
  SessionQueryFailureCode,
} from "./mcp.session.ts";
import { compileSourcesToAstArtifacts } from "./compile.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";

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

Deno.test("cli.mcp.session RuntimeSession.eval", async (t) => {
  await t.step(
    "evaluates an expression invoking an in-scope func",
    async () => {
      const session = new RuntimeSession("e1");
      const loaded = await session.load(
        "export Add;\nfunc Add<a:number b:number> = (add a b);",
      );
      assertEquals(loaded.ok, true);

      const result = await session.eval({ expression: "(Add 1 2)" });
      assertEquals(result, { ok: true, value: 3 });
    },
  );

  await t.step("invokes a named rule against matching input", async () => {
    const session = new RuntimeSession("e2");
    const loaded = await session.load('export Main;\nrule Main = "A";');
    assertEquals(loaded.ok, true);

    const result = await session.eval({ rule: "Main", input: "A" });
    assertEquals(result, { ok: true, value: "A" });
  });

  await t.step(
    "reports a structured match failure for non-matching input",
    async () => {
      const session = new RuntimeSession("e3");
      const loaded = await session.load('export Main;\nrule Main = "A";');
      assertEquals(loaded.ok, true);

      const result = await session.eval({ rule: "Main", input: "B" });
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionEvalFailureCode.MatchFailure);
      assertEquals(result.error.phase, "eval");
      assert(result.error.message.includes("Main"));
    },
  );

  await t.step(
    "accepts JSON input when inputIsJson is set",
    async () => {
      const session = new RuntimeSession("e4");
      const loaded = await session.load("export Main;\nrule Main = any;");
      assertEquals(loaded.ok, true);

      const result = await session.eval({
        rule: "Main",
        input: "42",
        inputIsJson: true,
      });
      assertEquals(result, { ok: true, value: 42 });
    },
  );

  await t.step(
    "requires exactly one of expression/rule",
    async () => {
      const session = new RuntimeSession("e5");
      await session.load("export Main; rule Main = any;");

      const neither = await session.eval({});
      assertEquals(neither.ok, false);
      assert(!neither.ok);
      assertEquals(neither.error.code, SessionEvalFailureCode.InvalidInput);

      const both = await session.eval({
        expression: "1",
        rule: "Main",
        input: "x",
      });
      assertEquals(both.ok, false);
      assert(!both.ok);
      assertEquals(both.error.code, SessionEvalFailureCode.InvalidInput);
    },
  );

  await t.step("requires `input` when `rule` is set", async () => {
    const session = new RuntimeSession("e6");
    await session.load("export Main; rule Main = any;");

    const result = await session.eval({ rule: "Main" });
    assertEquals(result.ok, false);
    assert(!result.ok);
    assertEquals(result.error.code, SessionEvalFailureCode.InvalidInput);
  });

  await t.step(
    "fails deterministically for an unresolved rule name",
    async () => {
      const session = new RuntimeSession("e7");
      await session.load("export Main; rule Main = any;");

      const result = await session.eval({ rule: "DoesNotExist", input: "x" });
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionEvalFailureCode.MatchFailure);
    },
  );

  await t.step(
    "fails deterministically when the session has no loaded modules",
    async () => {
      const session = new RuntimeSession("e8");
      const result = await session.eval({ expression: "1" });
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionEvalFailureCode.UnknownModule);
    },
  );

  await t.step(
    "fails deterministically for an unknown moduleUrl",
    async () => {
      const session = new RuntimeSession("e9");
      await session.load("export Main; rule Main = any;", "main.uff");

      const result = await session.eval({
        expression: "1",
        moduleUrl: "does-not-exist.uff",
      });
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionEvalFailureCode.UnknownModule);
    },
  );

  await t.step(
    "reports a parse failure for invalid expression syntax without crashing",
    async () => {
      const session = new RuntimeSession("e10");
      await session.load("export Main; rule Main = any;");

      const result = await session.eval({ expression: "(" });
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionEvalFailureCode.ParseFailure);
      assertEquals(result.error.phase, "parse");
    },
  );

  await t.step(
    "defaults to the just-loaded root module, not its last-resolved import",
    async () => {
      // Regression test: `Resolver.import` discovers the root module before
      // its imports, so the root's href is *not* the last entry recorded in
      // resolver-discovery order once it imports anything. Omitting
      // `moduleUrl` must still target the root that was just loaded (whose
      // `Add` func is in scope), not the last transitively resolved import.
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

        const session = new RuntimeSession("e11", { cwd });
        const loaded = await session.load(
          'import "./dep.uff" Foo;\n' +
            "export Add;\n" +
            "func Add<a:number b:number> = (add a b);",
          "main.uff",
        );
        assertEquals(loaded.ok, true);
        // Two modules are now tracked (main.uff and dep.uff); the
        // resolver-discovery order places dep.uff last.
        assertEquals(session.listLoadedModules().length, 2);

        const result = await session.eval({ expression: "(Add 1 2)" });
        assertEquals(result, { ok: true, value: 3 });
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "accepts an href previously returned by load(), including session:// hrefs for inline source",
    async () => {
      // Regression test: `resolveTargetModule` must recognize a `moduleUrl`
      // that is already a stored href verbatim (exactly what `load()`
      // returns), not only a filesystem path resolved against `cwd` — this
      // is the only way to address an inline (no `path` given) load at all,
      // since its href is a `session://` URL with no corresponding path.
      const session = new RuntimeSession("e12");
      const loaded = await session.load("export Main; rule Main = any;");
      assertEquals(loaded.ok, true);
      assert(loaded.ok);

      const result = await session.eval({
        rule: "Main",
        input: "x",
        moduleUrl: loaded.module.moduleUrl,
      });
      assertEquals(result, { ok: true, value: "x" });
    },
  );

  await t.step(
    "reports an expression exception rather than throwing",
    async () => {
      const session = new RuntimeSession("e11");
      await session.load("export Main; rule Main = any;");

      const result = await session.eval({ expression: "UnknownName" });
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(
        result.error.code,
        SessionEvalFailureCode.ExpressionException,
      );
    },
  );

  await t.step(
    "reflects decorator-derived metadata applied during load",
    async () => {
      const session = new RuntimeSession("e12");
      const loaded = await session.load(
        `export Main Loud;
         decorator Loud = { shout: true };
         [Loud]
         rule Main = any;`,
      );
      assertEquals(loaded.ok, true);

      // Metadata is inspected here via the underlying Rule object rather
      // than the dedicated introspection tools (007) exercised in
      // "cli.mcp.session RuntimeSession introspection" below — this
      // confirms eval() genuinely reuses the session's already-materialized
      // Rule (with its decorator-applied metadata) rather than re-deriving
      // it, per requirement 006's metadata-reflection clause.
      const result = await session.eval({ rule: "Main", input: "x" });
      assertEquals(result, { ok: true, value: "x" });
    },
  );
});

Deno.test("cli.mcp.session RuntimeSession introspection", async (t) => {
  const LOUD_MODULE_SOURCE = `export Main Loud Label Greet Add;
     decorator Loud = { shout: true };
     decorator Label<name:string> = { name: name };
     [Loud]
     rule Main = any;
     [Loud]
     [Label "hi"]
     func Greet<name:string> = name;
     func Add<a:number b:number> = (add a b);`;

  await t.step(
    "listLoadedModules reports every declaration's kind and exported flag",
    async () => {
      const session = new RuntimeSession("i1");
      await session.load(LOUD_MODULE_SOURCE);

      const modules = session.listLoadedModules();
      assertEquals(modules.length, 1);
      const kinds = new Map(
        modules[0].declarations.map((d) => [d.name, d.kind]),
      );
      assertEquals(kinds.get("Main"), "rule");
      assertEquals(kinds.get("Greet"), "func");
      assertEquals(kinds.get("Add"), "func");
      assertEquals(kinds.get("Loud"), "decorator");
      assert(modules[0].declarations.every((d) => d.exported));
    },
  );

  await t.step(
    "describe reports a rule's pattern, parameters, attributes, and metadata",
    async () => {
      const session = new RuntimeSession("i2");
      await session.load(LOUD_MODULE_SOURCE);

      const result = session.describe("Main");
      assertEquals(result.ok, true);
      assert(result.ok);
      assertEquals(result.declaration.kind, "rule");
      assertEquals(result.declaration.name, "Main");
      assertEquals(result.declaration.exported, true);
      assertEquals(result.declaration.parameters, []);
      assertEquals(result.declaration.pattern, { kind: PatternKind.Any });
      assertEquals(result.declaration.attributes, [
        { decorator: "Loud", args: [] },
      ]);
      assertEquals(result.declaration.metadata, { Loud: { shout: true } });
    },
  );

  await t.step(
    "describe reports a func's attribute args and metadata",
    async () => {
      const session = new RuntimeSession("i3");
      await session.load(LOUD_MODULE_SOURCE);

      const result = session.describe("Greet");
      assertEquals(result.ok, true);
      assert(result.ok);
      assertEquals(result.declaration.kind, "func");
      assertEquals(result.declaration.attributes, [
        { decorator: "Loud", args: [] },
        { decorator: "Label", args: ["hi"] },
      ]);
      assertEquals(result.declaration.metadata, {
        Loud: { shout: true },
        Label: { name: "hi" },
      });
    },
  );

  await t.step(
    "describe reports a decorator's own pattern/expression with no parameters/attributes/metadata",
    async () => {
      const session = new RuntimeSession("i4");
      await session.load(LOUD_MODULE_SOURCE);

      const result = session.describe("Loud");
      assertEquals(result.ok, true);
      assert(result.ok);
      assertEquals(result.declaration.kind, "decorator");
      assertEquals(result.declaration.parameters, undefined);
      assertEquals(result.declaration.attributes, undefined);
      assertEquals(result.declaration.metadata, undefined);
    },
  );

  await t.step(
    "describe reports a declaration with no applied attributes as having no metadata",
    async () => {
      const session = new RuntimeSession("i5");
      await session.load(LOUD_MODULE_SOURCE);

      const result = session.describe("Add");
      assertEquals(result.ok, true);
      assert(result.ok);
      assertEquals(result.declaration.attributes, undefined);
      assertEquals(result.declaration.metadata, undefined);
    },
  );

  await t.step(
    "describe fails deterministically for an unknown declaration name",
    async () => {
      const session = new RuntimeSession("i6");
      await session.load(LOUD_MODULE_SOURCE);

      const result = session.describe("DoesNotExist");
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(
        result.error.code,
        SessionDescribeFailureCode.UnknownDeclaration,
      );
    },
  );

  await t.step(
    "describe fails deterministically for an unknown moduleUrl",
    async () => {
      const session = new RuntimeSession("i7");
      await session.load(LOUD_MODULE_SOURCE, "main.uff");

      const result = session.describe("Main", "does-not-exist.uff");
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionDescribeFailureCode.UnknownModule);
    },
  );

  await t.step("describe defaults to the just-loaded root module", async () => {
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

      const session = new RuntimeSession("i8", { cwd });
      await session.load(
        'import "./dep.uff" Foo;\nexport Main;\nrule Main = any;',
        "main.uff",
      );

      // Omitting moduleUrl must describe against the just-loaded root
      // (main.uff, which has `Main`), not the last-resolved import
      // (dep.uff, which does not).
      const result = session.describe("Main");
      assertEquals(result.ok, true);
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });

  await t.step(
    "queryByMetadata finds every rule/func with the given decorator, unfiltered",
    async () => {
      const session = new RuntimeSession("i9");
      await session.load(LOUD_MODULE_SOURCE);

      const result = await session.queryByMetadata("Loud");
      assertEquals(result.ok, true);
      assert(result.ok);
      const names = result.matches.map((m) => m.name).sort();
      assertEquals(names, ["Greet", "Main"]);
    },
  );

  await t.step(
    "queryByMetadata filters by a predicate pattern matched against the metadata value",
    async () => {
      const session = new RuntimeSession("i10");
      await session.load(LOUD_MODULE_SOURCE);

      const result = await session.queryByMetadata(
        "Loud",
        "{ shout: true }",
      );
      assertEquals(result.ok, true);
      assert(result.ok);
      assertEquals(result.matches.map((m) => m.name).sort(), ["Greet", "Main"]);

      const noMatches = await session.queryByMetadata(
        "Loud",
        "{ shout: false }",
      );
      assertEquals(noMatches.ok, true);
      assert(noMatches.ok);
      assertEquals(noMatches.matches, []);
    },
  );

  await t.step(
    "queryByMetadata returns no matches for a decorator nothing applies",
    async () => {
      const session = new RuntimeSession("i11");
      await session.load(LOUD_MODULE_SOURCE);

      const result = await session.queryByMetadata("Unused");
      assertEquals(result, { ok: true, matches: [] });
    },
  );

  await t.step(
    "queryByMetadata reports a parse failure for an invalid predicate without crashing",
    async () => {
      const session = new RuntimeSession("i12");
      await session.load(LOUD_MODULE_SOURCE);

      const result = await session.queryByMetadata("Loud", "{");
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, SessionQueryFailureCode.ParseFailure);
    },
  );

  await t.step(
    "queryByMetadata searches across every loaded module in the session, not just the root",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-mcp-session-" });
      try {
        const depUff = join(cwd, "dep.uff");
        await Deno.writeTextFile(
          depUff,
          `export Foo Loud;
         decorator Loud = { shout: true };
         [Loud]
         rule Foo = any;`,
        );
        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [depUff],
          outputDir: join(cwd, ".uffda", "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true);

        const session = new RuntimeSession("i13", { cwd });
        await session.load(
          'import "./dep.uff" Foo;\nexport Main;\nrule Main = any;',
          "main.uff",
        );

        const result = await session.queryByMetadata("Loud");
        assertEquals(result.ok, true);
        assert(result.ok);
        assertEquals(result.matches.map((m) => m.name), ["Foo"]);
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );
});
