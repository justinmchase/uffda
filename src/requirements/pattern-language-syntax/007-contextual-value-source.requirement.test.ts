import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  ResolveTargetKind,
  ValueSourceKind,
} from "../../runtime/patterns/pattern.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "req:pattern-language-syntax-007 - Contextual $name value sources",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step(
      "equal $name projects a variable value source",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("$x"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Variable, name: "x" },
        },
      }),
    );

    await t.step(
      "between accepts $name bounds",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("$a..$b"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: { kind: ValueSourceKind.Variable, name: "a" },
          right: { kind: ValueSourceKind.Variable, name: "b" },
        },
      }),
    );

    await t.step(
      "includes accepts $name elements",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("in[$a y]"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Includes,
          values: [
            { kind: ValueSourceKind.Variable, name: "a" },
            { kind: ValueSourceKind.Literal, value: "y" },
          ],
        },
      }),
    );

    await t.step(
      "bare identifier remains resolve, not a value source",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("Word"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "Word",
          args: [],
        },
      }),
    );
  },
});
