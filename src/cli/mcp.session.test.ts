import { assert, assertEquals } from "@std/assert";
import { RuntimeSession, SessionLoadFailureCode } from "./mcp.session.ts";

Deno.test("cli.mcp.session RuntimeSession", async (t) => {
  await t.step("loads a module and reports its exports", async () => {
    const session = new RuntimeSession("s1");
    const result = await session.load(
      "export Main; rule Main = any;",
    );
    assertEquals(result.ok, true);
    assert(result.ok);
    assertEquals(result.module.declarations, [{ name: "Main", kind: "rule" }]);
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
        [{ name: "B", kind: "rule" }],
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
});
