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
      "quantifier accepts $name bounds",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any*$min..$max"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Variable, name: "min" },
          max: { kind: ValueSourceKind.Variable, name: "max" },
        },
      }),
    );

    await t.step(
      "between accepts open upper bound",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("$a.."),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: { kind: ValueSourceKind.Variable, name: "a" },
          right: undefined,
        },
      }),
    );

    await t.step(
      "between accepts open lower bound",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("..$b"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: undefined,
          right: { kind: ValueSourceKind.Variable, name: "b" },
        },
      }),
    );

    await t.step(
      "bare open between is rejected",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar(".."),
        kind: MatchKind.Fail,
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
