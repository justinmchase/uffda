import { assert, assertEquals } from "@std/assert";
import {
  BUILTIN_UFF_LANGUAGE,
  type LspLanguageConfigEntry,
} from "./lsp.config.ts";
import {
  enrichLspConfigWithLanguageMetadata,
  grammarTargetFor,
  languageMetadataForConfig,
  loadLanguageMetadata,
  loadWorkspaceLanguages,
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

Deno.test("cli.language_metadata enrichLspConfigWithLanguageMetadata", async (t) => {
  await t.step(
    "fills extensions from the built-in .uff [Language].ext when empty",
    async () => {
      const enriched = await enrichLspConfigWithLanguageMetadata(
        {
          languages: [{
            id: "uffda",
            extensions: [],
          }],
        },
        Deno.cwd(),
      );
      assertEquals(enriched.languages[0].extensions, ["uff"]);
    },
  );

  await t.step(
    "leaves JSON-declared extensions alone",
    async () => {
      const enriched = await enrichLspConfigWithLanguageMetadata(
        {
          languages: [{
            id: "uffda",
            extensions: ["custom"],
          }],
        },
        Deno.cwd(),
      );
      assertEquals(enriched.languages[0].extensions, ["custom"]);
    },
  );
});

Deno.test("cli.language_metadata grammarTargetFor", async (t) => {
  await t.step("the built-in language targets the bundled grammar", () => {
    const target = grammarTargetFor(BUILTIN_UFF_LANGUAGE, "/workspace");
    assertEquals(target?.entryRuleName, "UffdaLang");
    assert(target?.moduleUrl.href.endsWith("/src/lang/uffda/uffda.lang.uff"));
  });

  await t.step("a configured language resolves against the workspace", () => {
    assertEquals(
      grammarTargetFor({
        id: "morse",
        extensions: ["morse"],
        modulePath: "./morse.uff",
        entryRuleName: "Main",
      }, "/workspace"),
      {
        moduleUrl: new URL("file:///workspace/morse.uff"),
        entryRuleName: "Main",
      },
    );
  });

  await t.step(
    "a .uff entry naming its own grammar uses that grammar",
    () => {
      assertEquals(
        grammarTargetFor({
          id: "uffda",
          extensions: ["uff"],
          modulePath: "./custom.uff",
          entryRuleName: "Custom",
        }, "/workspace"),
        {
          moduleUrl: new URL("file:///workspace/custom.uff"),
          entryRuleName: "Custom",
        },
      );
    },
  );

  await t.step("a language without a grammar has no target", () => {
    assertEquals(
      grammarTargetFor({ id: "text", extensions: ["txt"] }, "/workspace"),
      undefined,
    );
  });
});

Deno.test("cli.language_metadata loadWorkspaceLanguages", async (t) => {
  const workspace = async (config?: unknown) => {
    const root = await Deno.makeTempDir();
    if (config !== undefined) {
      await Deno.mkdir(`${root}/.uffda`);
      await Deno.writeTextFile(
        `${root}/.uffda/lsp.jsonc`,
        JSON.stringify(config),
      );
    }
    return root;
  };

  await t.step(
    "serves the built-in language without a config file",
    async () => {
      const root = await workspace();
      try {
        assertEquals(await loadWorkspaceLanguages(root), {
          ok: true,
          config: { languages: [BUILTIN_UFF_LANGUAGE] },
          conflicts: [],
        });
      } finally {
        await Deno.remove(root, { recursive: true });
      }
    },
  );

  await t.step("reports extensions several languages claim", async () => {
    const root = await workspace({
      languages: [
        { id: "a", extensions: ["foo"] },
        { id: "b", extensions: ["foo"] },
      ],
    });
    try {
      const loaded = await loadWorkspaceLanguages(root);
      assert(loaded.ok);
      assertEquals(loaded.conflicts, [{
        extension: "foo",
        languages: ["a", "b"],
      }]);
      assertEquals(
        loaded.config.languages.map(({ extensions }) => extensions),
        [["uff"], [], []],
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });

  await t.step("reports an invalid config file", async () => {
    const root = await workspace({ languages: 1 });
    try {
      assertEquals((await loadWorkspaceLanguages(root)).ok, false);
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
});
