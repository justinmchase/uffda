import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

Deno.test(
  "req:rules-001 - Rule memoization stores post-expression success values",
  moduleDeclarationTest({
    moduleUrl: import.meta.url,
    declarations: {
      [import.meta.url]: {
        imports: [],
        exports: [
          { kind: ExportDeclarationKind.Rule, name: "R" },
          {
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          },
        ],
        rules: [
          {
            name: "R",
            parameters: [],
            pattern: { kind: PatternKind.Equal, value: "a" },
            expression: {
              kind: ExpressionKind.Native,
              fn: () => "projected",
            },
          },
          {
            name: "Main",
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
                      name: "R",
                      args: [],
                    },
                    { kind: PatternKind.Equal, value: "x" },
                  ],
                },
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "R",
                  args: [],
                },
              ],
            },
          },
        ],
      },
    },
    kind: MatchKind.Ok,
    input: Input.Iterable("a"),
    value: "projected",
  }),
);
