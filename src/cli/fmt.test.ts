// Traces to `.agents/requirements/cli-fmt/001-format-files-and-standard-input.requirement.md`.

import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  CliFormatFailureCode,
  CliFormatStatus,
  formatFiles,
  formatStdin,
  LanguageFormatting,
} from "./fmt.ts";

const UNFORMATTED = `rule   A =   "a"  ;\n`;
const FORMATTED = `rule A = "a";\n`;
/** A grammar declaring the language `id` for `extension`, with no formatter. */
function grammar(id: string, extension: string): string {
  return `export Tok;

decorator Language<c:any> = c;

[Language { id: "${id}", extensions: ["${extension}"] }]
rule Tok = any*;
`;
}

const TOKENS_PROJECT = {
  "uffda.jsonc": JSON.stringify({ languages: ["./grammar/tok.uff"] }),
  "grammar/tok.uff": grammar("tokens", ".tok"),
};

async function workspace(files: Record<string, string>): Promise<string> {
  const cwd = await Deno.makeTempDir();
  for (const [path, text] of Object.entries(files)) {
    await Deno.mkdir(join(cwd, path, ".."), { recursive: true });
    await Deno.writeTextFile(join(cwd, path), text);
  }
  return cwd;
}

async function load(cwd: string): Promise<LanguageFormatting> {
  const formatting = await LanguageFormatting.load(cwd);
  if ("error" in formatting) throw new Error(formatting.error);
  return formatting;
}

Deno.test("cli.fmt formatFiles", async (t) => {
  await t.step("rewrites files that change and lists them", async () => {
    const cwd = await workspace({ "a.uff": UNFORMATTED, "b.uff": FORMATTED });
    try {
      const result = await formatFiles({
        formatting: await load(cwd),
        cwd,
        sourcePaths: ["*.uff"],
        check: false,
      });
      assertEquals(result, {
        ok: true,
        check: false,
        files: [
          {
            sourcePath: "a.uff",
            status: CliFormatStatus.Changed,
            language: "uffda",
          },
          {
            sourcePath: "b.uff",
            status: CliFormatStatus.Unchanged,
            language: "uffda",
          },
        ],
      });
      assertEquals(await Deno.readTextFile(join(cwd, "a.uff")), FORMATTED);
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });

  await t.step("--check writes nothing and fails on a change", async () => {
    const cwd = await workspace({ "a.uff": UNFORMATTED });
    try {
      const result = await formatFiles({
        formatting: await load(cwd),
        cwd,
        sourcePaths: ["a.uff"],
        check: true,
      });
      assertEquals(result.ok, false);
      assertEquals(result.files[0].status, CliFormatStatus.Changed);
      assertEquals(await Deno.readTextFile(join(cwd, "a.uff")), UNFORMATTED);
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });

  await t.step(
    "a file that does not parse cleanly is reported, not rewritten",
    async () => {
      const cwd = await workspace({ "bad.uff": "rule = ;\n" });
      try {
        const result = await formatFiles({
          formatting: await load(cwd),
          cwd,
          sourcePaths: ["bad.uff"],
          check: false,
        });
        assertEquals(result.ok, false);
        const [file] = result.files;
        assertEquals(file.status, CliFormatStatus.Failed);
        assertEquals(
          file.diagnostics?.[0].code,
          CliFormatFailureCode.Recovered,
        );
        assertEquals(file.diagnostics?.[0].location?.line, 0);
        assertEquals(
          await Deno.readTextFile(join(cwd, "bad.uff")),
          "rule = ;\n",
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "files named without a language or formatter, and missing paths, fail",
    async () => {
      const cwd = await workspace({
        ...TOKENS_PROJECT,
        "a.txt": "x",
        "a.tok": "x",
      });
      try {
        const result = await formatFiles({
          formatting: await load(cwd),
          cwd,
          sourcePaths: ["a.txt", "a.tok", "missing.uff"],
          check: false,
        });
        assertEquals(result.ok, false);
        assertEquals(
          result.files.map(({ sourcePath, status, diagnostics }) => [
            sourcePath,
            status,
            diagnostics?.map(({ code }) => code),
          ]),
          [
            ["missing.uff", CliFormatStatus.Failed, [
              CliFormatFailureCode.SourceNotFound,
            ]],
            ["a.tok", CliFormatStatus.Failed, [
              CliFormatFailureCode.NoFormatter,
            ]],
            ["a.txt", CliFormatStatus.Failed, [
              CliFormatFailureCode.NoLanguage,
            ]],
          ],
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );
});

Deno.test("cli.fmt formatFiles without paths or through globs", async (t) => {
  const files = {
    ...TOKENS_PROJECT,
    "a.uff": UNFORMATTED,
    "sub/b.uff": FORMATTED,
    "notes.txt": "x",
    "a.tok": "x",
    "node_modules/pkg/c.uff": UNFORMATTED,
    ".git/d.uff": UNFORMATTED,
  };

  await t.step(
    "formats every file under cwd, skipping what has no formatter",
    async () => {
      const cwd = await workspace(files);
      try {
        const result = await formatFiles({
          formatting: await load(cwd),
          cwd,
          sourcePaths: [],
          check: false,
        });
        assertEquals(result, {
          ok: true,
          check: false,
          files: [
            {
              sourcePath: "a.uff",
              status: CliFormatStatus.Changed,
              language: "uffda",
            },
            {
              sourcePath: "grammar/tok.uff",
              status: CliFormatStatus.Unchanged,
              language: "uffda",
            },
            {
              sourcePath: "sub/b.uff",
              status: CliFormatStatus.Unchanged,
              language: "uffda",
            },
          ],
        });
        assertEquals(
          await Deno.readTextFile(join(cwd, "node_modules/pkg/c.uff")),
          UNFORMATTED,
        );
        assertEquals(
          await Deno.readTextFile(join(cwd, ".git/d.uff")),
          UNFORMATTED,
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step("a workspace with nothing to format succeeds", async () => {
    const cwd = await workspace({});
    try {
      assertEquals(
        await formatFiles({
          formatting: await load(cwd),
          cwd,
          sourcePaths: [],
          check: true,
        }),
        { ok: true, check: true, files: [] },
      );
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });

  await t.step("files a glob matches are skipped the same way", async () => {
    const cwd = await workspace(files);
    try {
      const result = await formatFiles({
        formatting: await load(cwd),
        cwd,
        sourcePaths: ["a.*", "notes.*"],
        check: true,
      });
      assertEquals(result.files.map(({ sourcePath }) => sourcePath), [
        "a.uff",
      ]);
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });
});

Deno.test("cli.fmt formatStdin", async (t) => {
  const cwd = await workspace({});
  try {
    const formatting = await load(cwd);

    await t.step("formats standard input as .uff", async () => {
      const result = await formatStdin({
        formatting,
        source: UNFORMATTED,
        check: false,
      });
      assertEquals(result.ok, true);
      assertEquals(result.text, FORMATTED);
    });

    await t.step("--check reports without text", async () => {
      const result = await formatStdin({
        formatting,
        source: UNFORMATTED,
        check: true,
      });
      assertEquals(result.ok, false);
      assertEquals(result.text, undefined);
      assertEquals(result.files[0].status, CliFormatStatus.Changed);
    });

    await t.step("an unclean parse produces no text", async () => {
      const result = await formatStdin({
        formatting,
        source: "rule = ;",
        check: false,
      });
      assertEquals(result.ok, false);
      assertEquals(result.text, undefined);
      assert(result.files[0].diagnostics?.length);
    });
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});

Deno.test("cli.fmt LanguageFormatting.load reports invalid configuration", async () => {
  const cwd = await workspace({ "uffda.jsonc": "{ languages: 1 }" });
  try {
    const formatting = await LanguageFormatting.load(cwd);
    assert("error" in formatting);
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});

Deno.test("cli.fmt LanguageFormatting.load reads the project file a config path names", async () => {
  const cwd = await workspace({
    "conf/project.jsonc": JSON.stringify({ languages: ["../grammar/tok.uff"] }),
    "grammar/tok.uff": grammar("tokens", ".tok"),
  });
  try {
    const formatting = await LanguageFormatting.load(
      cwd,
      join(cwd, "conf", "project.jsonc"),
    );
    assert(!("error" in formatting), JSON.stringify(formatting));
    assertEquals(formatting.languageFor("a.tok")?.id, "tokens");
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});

Deno.test("cli.fmt language ownership", async (t) => {
  await t.step(
    "an extension several languages claim fails the configuration",
    async () => {
      const cwd = await workspace({
        "uffda.jsonc": JSON.stringify({ languages: ["./a.uff", "./b.uff"] }),
        "a.uff": grammar("a", ".tok"),
        "b.uff": grammar("b", ".tok"),
      });
      try {
        const formatting = await LanguageFormatting.load(cwd);
        assert("error" in formatting);
        assert(formatting.error.includes("'.tok'"));
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step("a workspace language claiming .uff takes it over", async () => {
    const cwd = await workspace({
      "uffda.jsonc": JSON.stringify({ languages: ["./grammar/tok.uff"] }),
      "grammar/tok.uff": grammar("tokens", ".uff"),
      "a.uff": UNFORMATTED,
    });
    try {
      const formatting = await load(cwd);
      const named = await formatFiles({
        formatting,
        cwd,
        sourcePaths: ["a.uff"],
        check: true,
      });
      assertEquals(named.files[0].language, "tokens");
      assertEquals(
        named.files[0].diagnostics?.[0].code,
        CliFormatFailureCode.NoFormatter,
      );
      assertEquals(
        await formatFiles({ formatting, cwd, sourcePaths: [], check: true }),
        { ok: true, check: true, files: [] },
      );
    } finally {
      await Deno.remove(cwd, { recursive: true });
    }
  });
});
