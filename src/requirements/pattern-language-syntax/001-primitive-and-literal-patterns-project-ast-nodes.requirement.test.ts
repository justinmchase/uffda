import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { CharacterClass } from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Type } from "@justinmchase/type";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name:
      "req:pattern-language-syntax-001 - Primitive and literal pattern forms project AST nodes",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step(
      "any projects an any node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any"),
        kind: MatchKind.Ok,
        value: { kind: PatternKind.Any },
      }),
    );

    await t.step(
      "equal projects a literal value node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar('"hello"'),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: "hello",
        },
      }),
    );

    await t.step(
      "type projects a typed node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("string"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Type,
          type: Type.String,
        },
      }),
    );

    await t.step(
      "character projects a character-class node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("\\cL"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        },
      }),
    );
  },
);
