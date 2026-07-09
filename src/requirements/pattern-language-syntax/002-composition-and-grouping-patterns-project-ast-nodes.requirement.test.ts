import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
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
      "req:pattern-language-syntax-002 - Composition and grouping project AST nodes",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step(
      "not projects a unary not node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("not any"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "symbolic or respects alternative order",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any | fail"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    );

    await t.step(
      "symbolic and binds tighter than symbolic or",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any & fail | ok"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.And,
              patterns: [
                { kind: PatternKind.Any },
                { kind: PatternKind.Fail },
              ],
            },
            { kind: PatternKind.Ok },
          ],
        },
      }),
    );

    await t.step(
      "leading pipe supports vertically aligned alternatives",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("| any | fail | ok"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
            { kind: PatternKind.Ok },
          ],
        },
      }),
    );

    await t.step(
      "keyword and is rejected when input must be fully consumed",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any and fail"),
        kind: MatchKind.Fail,
      }),
    );

    await t.step(
      "keyword or is rejected when input must be fully consumed",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any or fail"),
        kind: MatchKind.Fail,
      }),
    );

    await t.step(
      "grouping preserves the nested pattern value",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("(any | fail)"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    );

    await t.step(
      "bracketed child projects an into node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("[end]"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Into,
          pattern: { kind: PatternKind.End },
        },
      }),
    );

    await t.step(
      "canonical grouping can wrap pipeline and lower-precedence children",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any |> (end | fail)"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Any },
            {
              kind: PatternKind.Or,
              patterns: [
                { kind: PatternKind.End },
                { kind: PatternKind.Fail },
              ],
            },
          ],
        },
      }),
    );
  },
);
