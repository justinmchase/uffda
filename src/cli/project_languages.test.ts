import { assert, assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import {
  builtinLanguages,
  extensionOf,
  isBuiltinLanguage,
  languageForDocument,
  loadProjectLanguages,
  type ProjectLanguage,
  settleOwnership,
} from "./project_languages.ts";

function grammar(
  languages: { rule: string; language: string }[],
): string {
  return [
    `export ${languages.map(({ rule }) => rule).join(" ")};`,
    "decorator Language<c:any> = c;",
    ...languages.map(({ rule, language }) =>
      `[Language ${language}]\nrule ${rule} = any*;`
    ),
  ].join("\n");
}

async function withProject(
  files: Record<string, string>,
  body: (root: string) => Promise<void>,
): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "uffda-project-languages-" });
  try {
    for (const [path, text] of Object.entries(files)) {
      const full = join(root, path);
      await Deno.mkdir(join(full, ".."), { recursive: true });
      await Deno.writeTextFile(full, text);
    }
    await body(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

const summary = (languages: ProjectLanguage[]) =>
  languages.map(({ id, extensions, specifier }) => ({
    id,
    extensions,
    specifier,
  }));

Deno.test("cli.project_languages builtinLanguages", async () => {
  const [uffda, ...rest] = await builtinLanguages();
  assertEquals(rest, []);
  assertEquals(uffda.id, "uffda");
  assertEquals(uffda.name, "Uffda");
  assertEquals(uffda.extensions, [".uff"]);
  assertEquals(uffda.grammar.entryRuleName, "UffdaLang");
  assert(isBuiltinLanguage(uffda));
});

Deno.test("cli.project_languages loadProjectLanguages", async (t) => {
  await t.step("serves the built-in language without a project", async () => {
    await withProject({}, async (root) => {
      const loaded = await loadProjectLanguages(root);
      assertEquals(loaded.project, undefined);
      assertEquals(loaded.problems, []);
      assertEquals(summary(loaded.languages), [
        { id: "uffda", extensions: [".uff"], specifier: undefined },
      ]);
    });
  });

  await t.step("reads the project file a config path names", async () => {
    await withProject({
      "uffda.jsonc": "{ languages: 1 }",
      "conf/other.jsonc": JSON.stringify({ imports: {} }),
    }, async (root) => {
      const loaded = await loadProjectLanguages(
        root,
        join(root, "conf", "other.jsonc"),
      );
      assertEquals(loaded.problems, []);
      assertEquals(loaded.project?.path, join(root, "conf", "other.jsonc"));
    });
  });

  await t.step(
    "serves the built-in language with an invalid project",
    async () => {
      await withProject({ "uffda.jsonc": "{ languages: 1 }" }, async (root) => {
        const loaded = await loadProjectLanguages(root);
        assertEquals(summary(loaded.languages).map(({ id }) => id), ["uffda"]);
        assertEquals(loaded.problems.length, 1);
        assert(loaded.problems[0].startsWith(join(root, "uffda.jsonc")));
      });
    },
  );

  await t.step(
    "reads each language from its grammar's [Language]",
    async () => {
      await withProject({
        "uffda.jsonc": '{ "languages": ["./lang/foo.uff"] }',
        "lang/foo.uff": grammar([
          {
            rule: "Foo",
            language: '{ id: "foo", name: "Foo", extensions: [".foo"] }',
          },
          {
            rule: "Bar",
            language: '{ id: "bar", extensions: [".bar" ".b"] }',
          },
        ]),
        "src/x": "",
      }, async (root) => {
        const loaded = await loadProjectLanguages(join(root, "src"));
        assertEquals(loaded.problems, []);
        assertEquals(loaded.project?.root, root);
        assertEquals(summary(loaded.languages), [
          { id: "uffda", extensions: [".uff"], specifier: undefined },
          { id: "foo", extensions: [".foo"], specifier: "./lang/foo.uff" },
          {
            id: "bar",
            extensions: [".bar", ".b"],
            specifier: "./lang/foo.uff",
          },
        ]);
        const foo = loaded.languages[1];
        assertEquals(foo.name, "Foo");
        assertEquals(
          foo.grammar.moduleUrl.href,
          toFileUrl(join(root, "lang", "foo.uff")).href,
        );
        assertEquals(foo.grammar.entryRuleName, "Foo");
        assert(foo.grammar.declarations?.[foo.grammar.moduleUrl.href]);
      });
    },
  );

  await t.step("reports languages that cannot be served", async () => {
    await withProject({
      "uffda.jsonc": JSON.stringify({
        imports: { "@acme/kv": "jsr:@acme/kv@^1" },
        languages: [
          "./missing.uff",
          "./broken.uff",
          "./plain.uff",
          "./bad.uff",
          "@acme/kv/lang",
          "./ok.uff",
        ],
      }),
      "broken.uff": "rule = ;",
      "plain.uff": "export A;\nrule A = any;",
      "bad.uff": grammar([{ rule: "Bad", language: '{ id: "bad" }' }]),
      "ok.uff": grammar([
        { rule: "Ok", language: '{ id: "ok", extensions: [".ok"] }' },
      ]),
    }, async (root) => {
      const loaded = await loadProjectLanguages(root);
      assertEquals(summary(loaded.languages).map(({ id }) => id), [
        "uffda",
        "ok",
      ]);
      assertEquals(loaded.problems.length, 5);
      assert(loaded.problems[2].includes("exports no rule with [Language]"));
      assert(loaded.problems[3].includes("`extensions`"));
      assert(loaded.problems[4].includes("not supported yet"));
    });
  });
});

Deno.test("cli.project_languages settleOwnership", async (t) => {
  const language = (
    id: string,
    extensions: string[],
    specifier?: string,
  ): ProjectLanguage => ({
    id,
    extensions,
    grammar: { moduleUrl: new URL(`file:///${id}.uff`), entryRuleName: id },
    ...(specifier !== undefined ? { specifier } : {}),
  });
  const uffda = language("uffda", [".uff"]);

  await t.step("keeps languages with distinct ids and extensions", () => {
    const a = language("a", [".a"], "./a.uff");
    assertEquals(settleOwnership([uffda], [a]), {
      languages: [uffda, a],
      problems: [],
    });
  });

  await t.step("a project language takes over a built-in extension", () => {
    const a = language("a", [".uff"], "./a.uff");
    assertEquals(settleOwnership([uffda], [a]), {
      languages: [{ ...uffda, extensions: [] }, a],
      problems: [],
    });
  });

  await t.step("a project language takes over a built-in id", () => {
    const a = language("uffda", [".u"], "./a.uff");
    assertEquals(settleOwnership([uffda], [a]), {
      languages: [a],
      problems: [],
    });
  });

  await t.step(
    "an extension two project languages claim is served by none",
    () => {
      const a = language("a", [".x", ".a"], "./a.uff");
      const b = language("b", [".x"], "./b.uff");
      const settled = settleOwnership([uffda], [a, b]);
      assertEquals(settled.languages, [
        uffda,
        { ...a, extensions: [".a"] },
        { ...b, extensions: [] },
      ]);
      assertEquals(settled.problems, [
        "The '.x' extension is claimed by more than one language ('a', 'b') in uffda.jsonc; none of them serves it",
      ]);
    },
  );

  await t.step("an id two project languages declare is served by none", () => {
    const a = language("a", [".a"], "./a.uff");
    const b = language("a", [".b"], "./b.uff");
    const settled = settleOwnership([uffda], [a, b]);
    assertEquals(settled.languages, [uffda]);
    assertEquals(settled.problems.length, 1);
    assert(settled.problems[0].includes("'a'"));
  });
});

Deno.test("cli.project_languages documents", async (t) => {
  await t.step("extensionOf", () => {
    assertEquals(extensionOf("file:///a/b.UFF"), ".uff");
    assertEquals(extensionOf("/a/b.tar.gz"), ".gz");
    assertEquals(extensionOf("/a.dir/b"), "");
    assertEquals(extensionOf("file:///a/b.foo?x=1#y"), ".foo");
  });

  await t.step("languageForDocument", async () => {
    const languages = await builtinLanguages();
    assertEquals(languageForDocument(languages, "/x/a.uff")?.id, "uffda");
    assertEquals(languageForDocument(languages, "/x/a.txt"), undefined);
    assertEquals(languageForDocument(languages, "/x/Makefile"), undefined);
  });
});
