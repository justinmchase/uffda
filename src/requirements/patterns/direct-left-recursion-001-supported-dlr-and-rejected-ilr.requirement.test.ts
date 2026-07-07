import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

Deno.test("req:direct-left-recursion-001 - Direct left recursion is supported with a base case and indirect left recursion is rejected on the active rule-evaluation path", async (t) => {
  await t.step(
    "direct left recursion with a base case stabilizes to a successful match",
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
    "indirect left recursion is rejected on the current rule-evaluation path",
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
