import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  BUILTIN_UFF_LANGUAGE,
  extensionOf,
  loadLspConfig,
  LspConfigLoadFailureCode,
  resolveLanguageForDocument,
} from "./lsp.config.ts";

Deno.test("cli.lsp.config extensionOf", async (t) => {
  await t.step("extracts a lowercased extension", () => {
    assertEquals(extensionOf("file:///a/b/Main.UFF"), "uff");
    assertEquals(extensionOf("/a/b/c.pattern"), "pattern");
  });

  await t.step("returns empty string for no extension", () => {
    assertEquals(extensionOf("/a/b/c"), "");
    assertEquals(extensionOf("/a/b.dir/c"), "");
  });
});

Deno.test("cli.lsp.config loadLspConfig", async (t) => {
  await t.step(
    "yields the built-in .uff entry when no config exists",
    async () => {
      const dir = await Deno.makeTempDir();
      try {
        const result = await loadLspConfig(dir);
        assertEquals(result.ok, true);
        assert(result.ok);
        assertEquals(result.config.languages, [BUILTIN_UFF_LANGUAGE]);
      } finally {
        await Deno.remove(dir, { recursive: true });
      }
    },
  );

  await t.step(
    "merges the built-in entry ahead of workspace-declared languages",
    async () => {
      const dir = await Deno.makeTempDir();
      try {
        await Deno.mkdir(join(dir, ".uffda"), { recursive: true });
        await Deno.writeTextFile(
          join(dir, ".uffda", "lsp.jsonc"),
          `{
            // a comment, since this is jsonc
            "languages": [
              { "id": "morse", "extensions": ["morse"], "modulePath": "./morse.uff", "entryRuleName": "Main" }
            ]
          }`,
        );
        const result = await loadLspConfig(dir);
        assertEquals(result.ok, true);
        assert(result.ok);
        assertEquals(result.config.languages[0], BUILTIN_UFF_LANGUAGE);
        assertEquals(result.config.languages[1].id, "morse");
      } finally {
        await Deno.remove(dir, { recursive: true });
      }
    },
  );

  await t.step("reports invalid JSONC as a structured failure", async () => {
    const dir = await Deno.makeTempDir();
    try {
      await Deno.mkdir(join(dir, ".uffda"), { recursive: true });
      await Deno.writeTextFile(
        join(dir, ".uffda", "lsp.jsonc"),
        "{ not valid json",
      );
      const result = await loadLspConfig(dir);
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, LspConfigLoadFailureCode.ParseFailure);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });

  await t.step("reports an invalid shape as a structured failure", async () => {
    const dir = await Deno.makeTempDir();
    try {
      await Deno.mkdir(join(dir, ".uffda"), { recursive: true });
      await Deno.writeTextFile(
        join(dir, ".uffda", "lsp.jsonc"),
        `{ "languages": [ { "id": "morse" } ] }`,
      );
      const result = await loadLspConfig(dir);
      assertEquals(result.ok, false);
      assert(!result.ok);
      assertEquals(result.error.code, LspConfigLoadFailureCode.InvalidShape);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });
});

Deno.test("cli.lsp.config resolveLanguageForDocument", async (t) => {
  const config = {
    languages: [
      BUILTIN_UFF_LANGUAGE,
      { id: "morse", extensions: ["morse"] },
    ],
  };

  await t.step("resolves by extension", () => {
    const language = resolveLanguageForDocument(config, "file:///a/main.uff");
    assertEquals(language?.id, "uffda");
  });

  await t.step("returns undefined for an unrecognized extension", () => {
    const language = resolveLanguageForDocument(config, "file:///a/main.xyz");
    assertEquals(language, undefined);
  });
});
