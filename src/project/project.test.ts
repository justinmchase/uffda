import { assert, assertEquals } from "@std/assert";
import {
  parseProject,
  type ProjectParseResult,
  ProjectProblemCode,
} from "./project.ts";

const PATH = "/work/app/uffda.jsonc";

function problemsOf(result: ProjectParseResult): string[] {
  assert(!result.ok, "expected problems");
  return result.problems.map(({ message }) => message);
}

Deno.test("project.parseProject reads a valid project file", async (t) => {
  await t.step("every field", async () => {
    const result = await parseProject(
      `{
        // Aliases, exports and languages.
        "imports": { "@acme/kv": "jsr:@acme/kv@^1.2.0" },
        "exports": { ".": "./src/mod.uff", "./lang": "./src/kv.uff" },
        "languages": ["./src/foo.uff", "@acme/kv/lang", "jsr:@acme/json@^1/lang"],
        "outDir": "./build/out",
      }`,
      PATH,
    );
    assert(result.ok);
    assertEquals(result.project, {
      root: "/work/app",
      path: PATH,
      imports: new Map([["@acme/kv", "jsr:@acme/kv@^1.2.0"]]),
      exports: new Map([
        [".", "./src/mod.uff"],
        ["./lang", "./src/kv.uff"],
      ]),
      languages: [
        "./src/foo.uff",
        "@acme/kv/lang",
        "jsr:@acme/json@^1/lang",
      ],
      outDir: "/work/app/build/out",
    });
  });

  await t.step("an empty object", async () => {
    const result = await parseProject("{}", PATH);
    assert(result.ok);
    assertEquals(result.project.imports.size, 0);
    assertEquals(result.project.exports.size, 0);
    assertEquals(result.project.languages, []);
    assertEquals(result.project.outDir, "/work/app/bin");
  });
});

Deno.test("project.parseProject reports every problem", async (t) => {
  await t.step("text that is not JSONC", async () => {
    const result = await parseProject("{ languages: ", PATH);
    assert(!result.ok);
    assertEquals(result.problems[0].code, ProjectProblemCode.ParseFailure);
  });

  await t.step("a value that is not an object", async () => {
    assertEquals(problemsOf(await parseProject("[]", PATH)), [
      "uffda.jsonc must hold an object.",
    ]);
  });

  await t.step("unknown fields and fields of the wrong type", async () => {
    const problems = problemsOf(
      await parseProject(
        `{ "language": [], "imports": [], "exports": 1, "languages": {} }`,
        PATH,
      ),
    );
    assertEquals(problems.length, 4);
    assert(problems[0].startsWith("Unknown field `language`"));
  });

  await t.step(
    "an outDir that is not a directory inside the project",
    async () => {
      for (const outDir of ['"../bin"', '"bin"', '"/bin"', "1"]) {
        assertEquals(
          problemsOf(await parseProject(`{ "outDir": ${outDir} }`, PATH)),
          [
            '`outDir` must be a directory inside the project starting with "./", as in "./bin".',
          ],
        );
      }
    },
  );

  await t.step("imports that are not module names or jsr:", async () => {
    const problems = problemsOf(
      await parseProject(
        `{ "imports": {
          "acme": "jsr:@acme/kv",
          "@acme/kv": "https://jsr.io/@acme/kv",
          "@acme/x": "./x.uff",
          "@acme/y": 1
        } }`,
        PATH,
      ),
    );
    assertEquals(problems.length, 4);
    assert(problems[0].includes('key "acme" must be a module name'));
    assert(problems[1].includes('`imports["@acme/kv"]` must be a `jsr:`'));
  });

  await t.step("overlapping module names", async () => {
    assertEquals(
      problemsOf(
        await parseProject(
          `{ "imports": {
            "@acme": "jsr:@acme/core",
            "@acme/kv": "jsr:@acme/kv",
            "@acmex": "jsr:@acme/x"
          } }`,
          PATH,
        ),
      ),
      [
        '`imports` "@acme" overlaps "@acme/kv": a module name may not be the start of another.',
      ],
    );
  });

  await t.step("exports outside the project or misnamed", async () => {
    const problems = problemsOf(
      await parseProject(
        `{ "exports": {
          "tokens": "./tokens.uff",
          ".": "../outside.uff",
          "./a": "@acme/kv",
          "./b": "./b.uff"
        } }`,
        PATH,
      ),
    );
    assertEquals(problems.length, 3);
  });

  await t.step("languages that are not specifiers", async () => {
    const problems = problemsOf(
      await parseProject(
        `{ "languages": ["foo.uff", 1, "./a b.uff"] }`,
        PATH,
      ),
    );
    assertEquals(problems.length, 3);
    assert(problems[0].startsWith("`languages[0]` must be a relative path"));
  });

  await t.step("languages naming undeclared aliases", async () => {
    assertEquals(
      problemsOf(
        await parseProject(
          `{
            "imports": { "@acme/kv": "jsr:@acme/kv@^1" },
            "languages": ["@acme/kv/lang", "@other/lang", "@acme/kvx"]
          }`,
          PATH,
        ),
      ),
      [
        '`languages[1]` names "@other/lang", which `imports` does not declare.',
        '`languages[2]` names "@acme/kvx", which `imports` does not declare.',
      ],
    );
  });

  await t.step("a repeated language", async () => {
    assertEquals(
      problemsOf(
        await parseProject(`{ "languages": ["./a.uff", "./a.uff"] }`, PATH),
      ),
      ['`languages[1]` repeats "./a.uff".'],
    );
  });
});
