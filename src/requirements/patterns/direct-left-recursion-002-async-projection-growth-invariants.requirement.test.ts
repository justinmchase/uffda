import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

Deno.test("req:direct-left-recursion-002 - Left-recursive growth invariants hold under awaited rule projections", async (t) => {
  await t.step(
    "direct left recursion still stabilizes when the recursive rule projection is asynchronous",
    moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "a",
            default: true,
          }],
          rules: [
            {
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "a",
                        args: [],
                      },
                      { kind: PatternKind.Equal, value: "a" },
                    ],
                  },
                  { kind: PatternKind.Equal, value: "a" },
                ],
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => Promise.resolve(_),
              },
            },
          ],
        },
      },
      input: Input.Iterable("aaa"),
      kind: MatchKind.Ok,
      value: [["a", "a"], "a"],
    }),
  );

  await t.step(
    "indirect left recursion remains rejected even when a cycle participant has an async projection",
    moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "a" },
            { kind: ExportDeclarationKind.Rule, name: "b", default: true },
          ],
          rules: [
            {
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "b",
                args: [],
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => Promise.resolve(_),
              },
            },
            {
              name: "b",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "a",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.Iterable("ab"),
      kind: MatchKind.Fail,
    }),
  );
});
