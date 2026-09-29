import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { MatchKind, valueOf } from "../../match.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

const ref = (name: string) => ({ kind: "reference", name });
const member = (expression: unknown, name: string): unknown => ({
  kind: "member",
  expression,
  name,
});

async function parse(source: string): Promise<unknown> {
  const m = await expressionGrammar(source);
  assertEquals(m.kind, MatchKind.Ok, source);
  return m.kind === MatchKind.Ok ? valueOf(m) : undefined;
}

Deno.test(
  "req:cli-bootstrap-026 - member .uff uses left recursion through Primary",
  async (t) => {
    await t.step("member.uff folds over a Primary base", async () => {
      const source = await Deno.readTextFile(
        join(repoRoot, "src", "lang", "expression", "member.uff"),
      );
      assertEquals(source.includes("export Member"), true);
      assertEquals(source.includes("rule MemberName = Reference;"), true);
      assertEquals(
        source.includes('e:Token<Primary> "." n:Token<MemberName>'),
        true,
      );
      assertEquals(
        source.includes('{ kind: "member", expression: e, name: n.name }'),
        true,
      );
      assertEquals(source.includes("MemberTarget"), false);
      assertEquals(source.includes(".reduce"), false);
      assertEquals(source.includes("for ("), false);
    });

    await t.step("primary.uff tries Member first", async () => {
      const source = await Deno.readTextFile(
        join(repoRoot, "src", "lang", "expression", "primary.uff"),
      );
      assertEquals(source.includes('import "./member.uff" Member'), true);
      assertEquals(/rule Primary =\s*\|\s*Member\b/.test(source), true);
    });

    await t.step("member chains are left-associative", async () => {
      assertEquals(
        await parse("a.b.c"),
        member(member(ref("a"), "b"), "c"),
      );
    });

    await t.step("member access applies to every primary form", async () => {
      assertEquals(
        await parse("(f x).y"),
        member(
          { kind: "invocation", expression: ref("f"), args: [ref("x")] },
          "y",
        ),
      );
      assertEquals(
        await parse("[1].length"),
        member({
          kind: "array",
          expressions: [{
            kind: "arrayElement",
            expression: { kind: "number", value: 1 },
          }],
        }, "length"),
      );
      assertEquals(
        await parse("{ a: 1 }.a"),
        member({
          kind: "object",
          keys: [{
            kind: "objectKey",
            name: "a",
            expression: { kind: "number", value: 1 },
          }],
        }, "a"),
      );
      assertEquals(
        await parse('"abc".length'),
        member({ kind: "string", values: ["abc"] }, "length"),
      );
    });
  },
);
