import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { uffdaCacheDir } from "./cache_dir.ts";

Deno.test("cache_dir.uffdaCacheDir", async (t) => {
  const envOf = (vars: Record<string, string>) => (name: string) => vars[name];

  await t.step("prefers XDG_CACHE_HOME", () => {
    assertEquals(
      uffdaCacheDir(envOf({ XDG_CACHE_HOME: "/x", LOCALAPPDATA: "/l" })),
      join("/x", "uffda"),
    );
  });

  await t.step("then LOCALAPPDATA", () => {
    assertEquals(
      uffdaCacheDir(envOf({ LOCALAPPDATA: "/l", HOME: "/h" })),
      join("/l", "uffda"),
    );
  });

  await t.step("then $HOME/.cache", () => {
    assertEquals(
      uffdaCacheDir(envOf({ HOME: "/h" })),
      join("/h", ".cache", "uffda"),
    );
  });
});
