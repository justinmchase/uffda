import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  BUILTIN_UFF_LANGUAGE,
  describeExtensionConflict,
  extensionOf,
  loadLspConfig,
  LspConfigLoadFailureCode,
  normalizeExtension,
  resolveExtensionOwnership,
  resolveLanguageForDocument,
  withExtensionFromMetadata,
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

  await t.step(
    "allows omitting extensions when modulePath and entryRuleName are present",
    async () => {
      const dir = await Deno.makeTempDir();
      try {
        await Deno.mkdir(join(dir, ".uffda"), { recursive: true });
        await Deno.writeTextFile(
          join(dir, ".uffda", "lsp.jsonc"),
          `{
            "languages": [
              {
                "id": "morse",
                "modulePath": "./morse.uff",
                "entryRuleName": "Main"
              }
            ]
          }`,
        );
        const result = await loadLspConfig(dir);
        assertEquals(result.ok, true);
        assert(result.ok);
        assertEquals(result.config.languages[1], {
          id: "morse",
          extensions: [],
          modulePath: "./morse.uff",
          entryRuleName: "Main",
        });
      } finally {
        await Deno.remove(dir, { recursive: true });
      }
    },
  );
});

Deno.test("cli.lsp.config withExtensionFromMetadata", async (t) => {
  await t.step("normalizes leading dots", () => {
    assertEquals(normalizeExtension(".UFF"), "uff");
    assertEquals(normalizeExtension("morse"), "morse");
  });

  await t.step("fills empty extensions from metadata ext", () => {
    assertEquals(
      withExtensionFromMetadata(
        { id: "morse", extensions: [], modulePath: "./morse.uff" },
        ".morse",
      ).extensions,
      ["morse"],
    );
  });

  await t.step("does not override JSON-declared extensions", () => {
    assertEquals(
      withExtensionFromMetadata(
        { id: "morse", extensions: ["ms"] },
        ".morse",
      ).extensions,
      ["ms"],
    );
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

Deno.test("cli.lsp.config resolveExtensionOwnership", async (t) => {
  const morse = { id: "morse", extensions: ["morse"] };

  await t.step("leaves a configuration without overlaps unchanged", () => {
    const config = { languages: [BUILTIN_UFF_LANGUAGE, morse] };
    const resolved = resolveExtensionOwnership(config);
    assertEquals(resolved.conflicts, []);
    assertEquals(resolved.config.languages[0], BUILTIN_UFF_LANGUAGE);
    assertEquals(resolved.config.languages[1], morse);
  });

  await t.step("a workspace language takes over a built-in extension", () => {
    const custom = { id: "custom-uff", extensions: ["uff"] };
    const { config, conflicts } = resolveExtensionOwnership({
      languages: [BUILTIN_UFF_LANGUAGE, custom],
    });
    assertEquals(conflicts, []);
    assertEquals(resolveLanguageForDocument(config, "/a/main.uff"), custom);
  });

  await t.step(
    "an extension several workspace languages claim belongs to none",
    () => {
      const a = { id: "a", extensions: ["foo", "a"] };
      const b = { id: "b", extensions: ["foo", "b"] };
      const { config, conflicts } = resolveExtensionOwnership({
        languages: [BUILTIN_UFF_LANGUAGE, a, b],
      });
      assertEquals(conflicts, [{ extension: "foo", languages: ["a", "b"] }]);
      assertEquals(resolveLanguageForDocument(config, "/x.foo"), undefined);
      assertEquals(resolveLanguageForDocument(config, "/x.a")?.id, "a");
      assertEquals(resolveLanguageForDocument(config, "/x.b")?.id, "b");
    },
  );

  await t.step("a language listing an extension twice is no conflict", () => {
    const twice = { id: "twice", extensions: ["t", "t"] };
    assertEquals(
      resolveExtensionOwnership({ languages: [BUILTIN_UFF_LANGUAGE, twice] })
        .conflicts,
      [],
    );
  });

  await t.step(
    "describes a conflict naming the extension and languages",
    () => {
      assertEquals(
        describeExtensionConflict({ extension: "foo", languages: ["a", "b"] }),
        "The '.foo' extension is claimed by more than one language ('a', 'b') in .uffda/lsp.jsonc; none of them serves it",
      );
    },
  );
});
