import { assert, assertEquals } from "@std/assert";
import { SessionManager, SessionManagerErrorCode } from "./mcp.sessions.ts";

Deno.test("cli.mcp.sessions SessionManager", async (t) => {
  await t.step("open returns distinct, stable ids", () => {
    const manager = new SessionManager();
    const a = manager.open();
    const b = manager.open();
    assert(a.id !== b.id);
    assertEquals(manager.get(a.id), { ok: true, session: a });
    assertEquals(manager.get(b.id), { ok: true, session: b });
  });

  await t.step("get fails deterministically for an unknown id", () => {
    const manager = new SessionManager();
    const lookup = manager.get("never-opened");
    assertEquals(lookup.ok, false);
    assert(!lookup.ok);
    assertEquals(lookup.error.code, SessionManagerErrorCode.UnknownSession);
    assertEquals(lookup.error.phase, "session-lookup");
  });

  await t.step(
    "close releases the session; further lookups fail deterministically",
    () => {
      const manager = new SessionManager();
      const session = manager.open();
      const closed = manager.close(session.id);
      assertEquals(closed.ok, true);
      assertEquals(session.isClosed, true);

      const lookup = manager.get(session.id);
      assertEquals(lookup.ok, false);
      assert(!lookup.ok);
      assertEquals(lookup.error.code, SessionManagerErrorCode.UnknownSession);
    },
  );

  await t.step("close on an unknown id fails deterministically", () => {
    const manager = new SessionManager();
    const result = manager.close("never-opened");
    assertEquals(result.ok, false);
  });

  await t.step("sessions loading the same source are isolated", async () => {
    const manager = new SessionManager();
    const a = manager.open();
    const b = manager.open();
    await a.load("export Main; rule Main = any;");
    assertEquals(a.listLoadedModules().length, 1);
    assertEquals(b.listLoadedModules().length, 0);
  });
});
