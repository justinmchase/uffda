import { assert, assertEquals } from "@std/assert";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { FormatResultKind } from "../format.ts";
import { formatUffdaSource, formatUffdaSyntaxModule } from "./format.ts";
import { uffdaGrammar } from "./uffda.lang.ts";

const formats = async (source: string, expected: string) => {
  const result = await formatUffdaSource(source);
  assert(
    result.kind === FormatResultKind.Formatted,
    `expected ${JSON.stringify(source)} to format`,
  );
  assertEquals(result.text, expected);
};

Deno.test("lang.uffda.format", async (t) => {
  await t.step(
    "FORMAT00 - a rule that fits is written on one line",
    () =>
      formats(
        "export Main;\nrule   Main =\n  a\n  b\n  -> x;",
        "export rule Main = a b -> x;\n",
      ),
  );

  await t.step(
    "FORMAT01 - imports and exports are grouped, other declarations spaced",
    () =>
      formats(
        `import "./a.uff" A; import "./b.uff" B; export X; export Y; rule Z = A; rule X = B;`,
        [
          `import "./a.uff" A;`,
          `import "./b.uff" B;`,
          ``,
          `export X;`,
          `export Y;`,
          ``,
          `rule Z = A;`,
          ``,
          `rule X = B;`,
          ``,
        ].join("\n"),
      ),
  );

  await t.step(
    "FORMAT02 - a comment sits directly above the next declaration",
    () =>
      formats(
        "# Hello   world\n# again\nrule A = ok;\n# trailing",
        "# Hello world again\nrule A = ok;\n\n# trailing\n",
      ),
  );

  await t.step(
    "FORMAT03 - a broken declaration ends with `;` on its own line",
    () =>
      formats(
        `rule Alternatives = "aaaaaaaaaaaaaaaaaaaa" | "bbbbbbbbbbbbbbbbbbbbbbbbb" | "cccccccccccccccccccccccc" | "dddd";`,
        [
          `rule Alternatives =`,
          `  | "aaaaaaaaaaaaaaaaaaaa"`,
          `  | "bbbbbbbbbbbbbbbbbbbbbbbbb"`,
          `  | "cccccccccccccccccccccccc"`,
          `  | "dddd"`,
          `;`,
          ``,
        ].join("\n"),
      ),
  );

  await t.step(
    "FORMAT04 - a broken rule puts the projection on its own line",
    () =>
      formats(
        `rule O = x:X -> { kind: "something", first: x, second: (add x 1), third: [x x x], fourth: "text" };`,
        [
          `rule O =`,
          `  x:X`,
          `  -> {`,
          `    kind: "something",`,
          `    first: x,`,
          `    second: (add x 1),`,
          `    third: [x x x],`,
          `    fourth: "text"`,
          `  }`,
          `;`,
          ``,
        ].join("\n"),
      ),
  );

  await t.step(
    "FORMAT05 - a broken sequence or `&` chain puts each operand on its own line",
    async () => {
      await formats(
        `rule T = alpha:Alpha beta:Beta gamma:Gamma delta:Delta epsilon:Epsilon zeta:Zeta eta:Eta;`,
        [
          `rule T =`,
          `  alpha:Alpha`,
          `  beta:Beta`,
          `  gamma:Gamma`,
          `  delta:Delta`,
          `  epsilon:Epsilon`,
          `  zeta:Zeta`,
          `  eta:Eta`,
          `;`,
          ``,
        ].join("\n"),
      );
      await formats(
        `rule A = (object & { kind: "aaaaaaaaaaaaaaaaaaaa" }) & (object & { name: "bbbbbbbbbbbbbbbbbbbbbbbbbbbb" });`,
        [
          `rule A =`,
          `  (object & { kind: "aaaaaaaaaaaaaaaaaaaa" })`,
          `  & (object & { name: "bbbbbbbbbbbbbbbbbbbbbbbbbbbb" })`,
          `;`,
          ``,
        ].join("\n"),
      );
    },
  );

  await t.step(
    "FORMAT06 - parentheses appear only where precedence needs them",
    async () => {
      await formats(
        "rule P = ((a | b) c) & (d (x -> 1) [e*] (f g)+ (not (h?)) x:(i | j));",
        "rule P = (a | b) c & d (x -> 1) [e*] (f g)+ not h? x:(i | j);\n",
      );
      await formats(
        "rule Q = (a (b -> 2)) -> 3;",
        "rule Q = a (b -> 2) -> 3;\n",
      );
    },
  );

  await t.step(
    "FORMAT07 - a func head breaks its parameters only when it does not fit",
    () =>
      formats(
        `func F<a:string b:number> = (join [a b] "");\nfunc G<> = 1;\nfunc Long<firstParameter:{ index: number, value: string } secondParameter:array> = (add 1 2);`,
        [
          `func F<a:string b:number> = (join [a b] "");`,
          ``,
          `func G = 1;`,
          ``,
          `func Long<`,
          `  firstParameter:{ index: number, value: string }`,
          `  secondParameter:array`,
          `> =`,
          `  (add 1 2)`,
          `;`,
          ``,
        ].join("\n"),
      ),
  );

  await t.step(
    "FORMAT08 - a lambda body follows its parameter list",
    async () => {
      await formats(
        "func H<xs:array> = (map xs <x:number> -> (add x 1));",
        "func H<xs:array> = (map xs <x:number> -> (add x 1));\n",
      );
      await formats(
        "func H<items:array> = (reduce items 0 <accumulator:number item:{ value: number, weight: number }> -> (add accumulator item.value));",
        [
          `func H<items:array> =`,
          `  (reduce`,
          `    items`,
          `    0`,
          `    <accumulator:number item:{ value: number, weight: number }> -> (add`,
          `      accumulator`,
          `      item.value`,
          `    )`,
          `  )`,
          `;`,
          ``,
        ].join("\n"),
      );
    },
  );

  await t.step(
    "FORMAT09 - strings are escaped and spellings are canonical",
    async () => {
      await formats(
        String.raw`rule S = "a\"b\\c\n" -> "x\{y} {(add 1 2)}";`,
        String.raw`rule S = "a\"b\\c\n" -> "x\{y} {(add 1 2)}";` + "\n",
      );
      await formats(
        "rule R = a*0.. b*1.. c*2 d*0..3 e*1..4 f? (skip g) h*;",
        "rule R = a*0 b+ c*2 d*..3 e*1..4 f? skip g h*;\n",
      );
      await formats(
        `rule U = ope X sneak by until ";";`,
        `rule U = ope X sneak by until ";";\n`,
      );
    },
  );

  await t.step(
    "FORMAT10 - bracketed lists break with the closing bracket on its own line",
    async () => {
      await formats(
        `rule I = in["aaaaaaaaaaaa" "bbbbbbbbbbbbbbbb" "cccccccccccccccc" "dddddddddddddddd" "eeeeeeeeeeeee"];`,
        [
          `rule I =`,
          `  in[`,
          `    "aaaaaaaaaaaa"`,
          `    "bbbbbbbbbbbbbbbb"`,
          `    "cccccccccccccccc"`,
          `    "dddddddddddddddd"`,
          `    "eeeeeeeeeeeee"`,
          `  ]`,
          `;`,
          ``,
        ].join("\n"),
      );
      await formats(
        `[Doc { description: "A long description that will not fit on the same line as the attribute name." }]\nrule D = ok;`,
        [
          `[Doc {`,
          `  description: "A long description that will not fit on the same line as the attribute name."`,
          `}]`,
          `rule D = ok;`,
          ``,
        ].join("\n"),
      );
    },
  );

  await t.step(
    "FORMAT11 - an unclean parse is not formatted",
    async () => {
      const result = await formatUffdaSource("rule = ;");
      assert(result.kind === FormatResultKind.ParseFailed);
      assertEquals(isClean(result.match), false);
    },
  );

  await t.step(
    "FORMAT13 - a rule body alternation puts each alternative on its own line",
    () =>
      formats(
        "rule CommentBlockFormat<W, F> = ParagraphFormat<W> | ListFormat<W> | FenceFormat<F>;",
        [
          "rule CommentBlockFormat<W, F> =",
          "  | ParagraphFormat<W>",
          "  | ListFormat<W>",
          "  | FenceFormat<F>",
          ";",
          "",
        ].join("\n"),
      ),
  );

  await t.step(
    "FORMAT14 - a rule whose body is an alternation always breaks",
    () =>
      formats(
        "rule A = a | b; rule B = (a | b) c;",
        ["rule A =", "  | a", "  | b", ";", "", "rule B = (a | b) c;", ""].join(
          "\n",
        ),
      ),
  );

  await t.step("FORMAT12 - an empty module formats to empty text", async () => {
    const parsed = await uffdaGrammar("");
    assert(isClean(parsed) && isSuccess(parsed));
    const result = await formatUffdaSyntaxModule(valueOf(parsed));
    assertEquals(result, { kind: FormatResultKind.Formatted, text: "" });
  });
});
