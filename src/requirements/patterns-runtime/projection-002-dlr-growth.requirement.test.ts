import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

Deno.test("req:projection-002 - DLR growth observes transforming Projection on the recursive Or arm", async (t) => {
  await t.step(
    "member-shaped DLR with variable binders projects nested AST during growth",
    moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Member",
            default: true,
          }],
          rules: [
            {
              name: "Member",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Then,
                      patterns: [
                        {
                          kind: PatternKind.Variable,
                          name: "e",
                          pattern: {
                            kind: PatternKind.Resolve,
                            targetKind: ResolveTargetKind.Reference,
                            name: "Member",
                            args: [],
                          },
                        },
                        { kind: PatternKind.Equal, value: "." },
                        {
                          kind: PatternKind.Variable,
                          name: "n",
                          pattern: { kind: PatternKind.Any },
                        },
                      ],
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ e, n }: { e: unknown; n: unknown }) => ({
                        kind: "member",
                        expression: e,
                        name: n,
                      }),
                    },
                  },
                  { kind: PatternKind.Any },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable(["a", ".", "b", ".", "c"]),
      kind: MatchKind.Ok,
      value: {
        kind: "member",
        expression: {
          kind: "member",
          expression: "a",
          name: "b",
        },
        name: "c",
      },
    }),
  );
});
