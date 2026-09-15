import { assert, assertEquals } from "@std/assert";
import {
  BUILTIN_UFF_LANGUAGE,
  type LspLanguageConfigEntry,
} from "./lsp.config.ts";
import {
  loadLanguageMetadata,
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

  await t.step("drops an empty/invalid bracket array entirely", () => {
    const metadata = toLanguageMetadata({ brackets: ["nope", 1, null] });
    assertEquals(metadata, {});
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
