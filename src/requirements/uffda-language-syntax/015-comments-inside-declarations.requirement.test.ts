import { assert, assertEquals } from "@std/assert";
import { diagnoseRecoveries } from "../../cli/diagnostics.ts";
import { compileUffdaSyntaxModule } from "../../lang/uffda/execute.ts";
import { formatUffdaSource } from "../../lang/uffda/format.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { FormatResultKind } from "../../lang/format.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

const commented = [
  "rule A =",
  "  # first",
  "  | x:B",
  "  # | C",
  "  | y:D",
  "    # between",
  "    E",
  "  -> {",
  "    # key",
  "    a: [",
  "      x",
  "      # element",
  "      y",
  "    ],",
  "    b: (f",
  "      # argument",
  "      x)",
  "    # last",
  "  }",
  ";",
  "rule F =",
  "  | G",
  "  # | H",
  ";",
].join("\n");

const uncommented = [
  "rule A = x:B | y:D E -> { a: [x y], b: (f x) };",
  "rule F = G;",
].join("\n");

const comment = (text: string) => ({
  kind: "comment",
  blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text }] }],
});

Deno.test(
  "req:uffda-language-syntax-015 - comments on their own lines stay in their lists",
  async () => {
    const match = await uffdaGrammar(commented);
    assert(isClean(match));
    assert(isSuccess(match));
    const [a, f] = unwrap(valueOf(match).declarations) as {
      pattern: { patterns: unknown[] };
      projection?: { keys: unknown[] };
    }[];
    assertEquals(a.pattern.patterns.length, 4);
    assertEquals(a.pattern.patterns[0], comment("first"));
    assertEquals(a.pattern.patterns[2], comment("| C"));
    assertEquals(a.projection?.keys[0], comment("key"));
    assertEquals(a.projection?.keys.at(-1), comment("last"));
    assertEquals(f.pattern.patterns.length, 2);
    assertEquals(f.pattern.patterns[1], comment("| H"));
  },
);

Deno.test(
  "req:uffda-language-syntax-015 - a comment after code inside a declaration is an error",
  async () => {
    const source = 'rule Main = "a" # inside\n "b";';
    const match = await uffdaGrammar(source);
    assertEquals(isClean(match), false);
    assert(isSuccess(match));
    const declarations = valueOf(match).declarations;
    assertEquals(declarations.map((d) => d.kind), ["rule"]);
  },
);

Deno.test(
  "req:uffda-language-syntax-015 - compiling drops comments inside declarations",
  async () => {
    const withComments = await uffdaGrammar(commented);
    const withoutComments = await uffdaGrammar(uncommented);
    assert(isSuccess(withComments));
    assert(isSuccess(withoutComments));
    assertEquals(
      unwrap(await compileUffdaSyntaxModule(valueOf(withComments))),
      unwrap(await compileUffdaSyntaxModule(valueOf(withoutComments))),
    );
  },
);

Deno.test(
  "req:uffda-language-syntax-015 - formatting keeps comments on their own lines",
  async () => {
    const first = await formatUffdaSource(commented);
    assert(first.kind === FormatResultKind.Formatted);
    const lines = first.text.split("\n").map((line) => line.trim());
    for (const text of ["# first", "# | C", "# between", "# key", "# last"]) {
      assert(lines.includes(text), text);
    }
    const second = await formatUffdaSource(first.text);
    assert(second.kind === FormatResultKind.Formatted);
    assertEquals(second.text, first.text);
  },
);

Deno.test(
  "req:uffda-language-syntax-015 - a comment after code is explained",
  async () => {
    for (
      const source of [
        "rule A =\n  |> B # c\n  |> C\n;",
        "rule A =\n  | a # c\n  | b\n;",
        "rule A = x:any -> [x # c\n x];",
        "rule A = x:any -> (f x # c\n x);",
        "rule A = x:any -> { a: x # c\n };",
      ]
    ) {
      const diagnostics = await diagnoseRecoveries(await uffdaGrammar(source));
      assertEquals(diagnostics.length, 1, source);
      assert(
        diagnostics[0].message.startsWith("Comments are part of the syntax"),
        source,
      );
    }
  },
);
