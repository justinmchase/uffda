import { assert, assertEquals } from "@std/assert";
import {
  BUILTIN_UFF_LANGUAGE,
  type LspLanguageConfigEntry,
} from "./lsp.config.ts";
import {
  languageMetadataForConfig,
  loadLanguageMetadata,
  toEditorLanguageConfiguration,
  toLanguageMetadata,
} from "./language_metadata.ts";

Deno.test("cli.language_metadata toLanguageMetadata", async (t) => {
  await t.step("returns undefined for a non-object value", () => {
    assertEquals(toLanguageMetadata(undefined), undefined);
    assertEquals(toLanguageMetadata("nope"), undefined);
    assertEquals(toLanguageMetadata(42), undefined);
  });

  await t.step("keeps only recognized, well-typed fields", () => {
    const metadata = toLanguageMetadata({
      ext: ".uff",
      name: "Uffda",
      description: 42, // wrong type, dropped
      comment: "#",
      brackets: [["{", "}"], ["not-a-pair"], ["[", "]"]],
      autoClosingPairs: [['"', '"']],
      surroundingPairs: "not-an-array",
      extraneous: "ignored",
    });
    assertEquals(metadata, {
      ext: ".uff",
      name: "Uffda",
      comment: "#",
      brackets: [["{", "}"], ["[", "]"]],
      autoClosingPairs: [['"', '"']],
    });
  });

  await t.step("returns undefined when every field is dropped", () => {
    const metadata = toLanguageMetadata({ brackets: ["nope", 1, null] });
    assertEquals(metadata, undefined);
  });
});

Deno.test("cli.language_metadata toEditorLanguageConfiguration", async (t) => {
  await t.step("projects comment/brackets/pairs into editor shape", () => {
    assertEquals(
      toEditorLanguageConfiguration({
        ext: ".uff",
        name: "Uffda",
        comment: "#",
        brackets: [["{", "}"]],
        autoClosingPairs: [['"', '"']],
        surroundingPairs: [["(", ")"]],
      }),
      {
        comments: { lineComment: "#" },
        brackets: [["{", "}"]],
        autoClosingPairs: [{ open: '"', close: '"' }],
        surroundingPairs: [["(", ")"]],
      },
    );
  });

  await t.step("returns undefined when only display fields are set", () => {
    assertEquals(
      toEditorLanguageConfiguration({ ext: ".uff", name: "Uffda" }),
      undefined,
    );
  });
});

Deno.test("cli.language_metadata loadLanguageMetadata", async (t) => {
  await t.step(
    "resolves the built-in .uff language's own [Language] metadata",
    async () => {
      const metadata = await loadLanguageMetadata(
        BUILTIN_UFF_LANGUAGE,
        Deno.cwd(),
      );
      assert(
        metadata,
        "expected Language metadata for the built-in .uff language",
      );
      assertEquals(metadata.ext, ".uff");
      assertEquals(metadata.name, "Uffda");
      assertEquals(metadata.comment, "#");
      assert(metadata.brackets && metadata.brackets.length > 0);
      assert(
        metadata.brackets!.some(([open, close]) =>
          open === "{" && close === "}"
        ),
      );
    },
  );

  await t.step(
    "returns undefined for a configured language with no modulePath",
    async () => {
      const language: LspLanguageConfigEntry = {
        id: "example",
        extensions: ["example"],
      };
      const metadata = await loadLanguageMetadata(language, Deno.cwd());
      assertEquals(metadata, undefined);
    },
  );

  await t.step(
    "returns undefined for a configured language whose module cannot resolve",
    async () => {
      const language: LspLanguageConfigEntry = {
        id: "example",
        extensions: ["example"],
        modulePath: "./does/not/exist.uff",
        entryRuleName: "Main",
      };
      const metadata = await loadLanguageMetadata(language, Deno.cwd());
      assertEquals(metadata, undefined);
    },
  );
});

Deno.test("cli.language_metadata languageMetadataForConfig", async (t) => {
  await t.step(
    "returns the built-in .uff language with an editor configuration projection",
    async () => {
      const result = await languageMetadataForConfig(
        { languages: [BUILTIN_UFF_LANGUAGE] },
        Deno.cwd(),
        { languageId: "uffda" },
      );
      assertEquals(result.languages.length, 1);
      assertEquals(result.languages[0].id, "uffda");
      assertEquals(result.languages[0].metadata.comment, "#");
      assertEquals(result.languages[0].configuration.comments, {
        lineComment: "#",
      });
      assert(result.languages[0].configuration.brackets);
    },
  );

  await t.step("returns an empty list for an unknown language id", async () => {
    const result = await languageMetadataForConfig(
      { languages: [BUILTIN_UFF_LANGUAGE] },
      Deno.cwd(),
      { languageId: "missing" },
    );
    assertEquals(result.languages, []);
  });
});
