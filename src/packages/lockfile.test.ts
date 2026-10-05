import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { Lockfile } from "./lockfile.ts";

async function withDir(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "uffda-lockfile-" });
  try {
    await body(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("lockfile.Lockfile", async (t) => {
  await t.step("a missing lockfile is empty", async () => {
    await withDir(async (dir) => {
      const loaded = await Lockfile.load(join(dir, "uffda.lock"));
      assert(loaded.ok);
      assertEquals(loaded.lockfile.version("jsr:@a/b@^1"), undefined);
    });
  });

  await t.step("writes what it records, keys sorted", async () => {
    await withDir(async (dir) => {
      const path = join(dir, "uffda.lock");
      const loaded = await Lockfile.load(path);
      assert(loaded.ok);
      await loaded.lockfile.setVersion("jsr:@b/c@^2", "2.0.0");
      await loaded.lockfile.setVersion("jsr:@a/b@^1", "1.2.3");
      await loaded.lockfile.setIntegrity("@a/b@1.2.3", "abc");
      assertEquals(
        JSON.parse(await Deno.readTextFile(path)),
        {
          specifiers: { "jsr:@a/b@^1": "1.2.3", "jsr:@b/c@^2": "2.0.0" },
          jsr: { "@a/b@1.2.3": { integrity: "abc" } },
        },
      );
      assertEquals(
        Object.keys(JSON.parse(await Deno.readTextFile(path)).specifiers),
        ["jsr:@a/b@^1", "jsr:@b/c@^2"],
      );

      const reloaded = await Lockfile.load(path);
      assert(reloaded.ok);
      assertEquals(reloaded.lockfile.version("jsr:@a/b@^1"), "1.2.3");
      assertEquals(reloaded.lockfile.integrity("@a/b@1.2.3"), "abc");
    });
  });

  await t.step("without a path, lives only in memory", async () => {
    const lockfile = new Lockfile();
    await lockfile.setVersion("jsr:@a/b", "1.0.0");
    assertEquals(lockfile.version("jsr:@a/b"), "1.0.0");
  });

  await t.step("reports a lockfile of the wrong shape", async () => {
    await withDir(async (dir) => {
      const path = join(dir, "uffda.lock");
      for (
        const text of [
          "[",
          "[]",
          '{ "version": "1" }',
          '{ "specifiers": { "jsr:@a/b": 1 } }',
          '{ "jsr": { "@a/b@1.0.0": "abc" } }',
        ]
      ) {
        await Deno.writeTextFile(path, text);
        const loaded = await Lockfile.load(path);
        assert(!loaded.ok, text);
        assert(loaded.message.startsWith(path), loaded.message);
      }
    });
  });
});
