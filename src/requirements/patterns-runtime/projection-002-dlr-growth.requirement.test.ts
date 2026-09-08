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

  await t.step(
    "DLR grow does not leak inner binders into the caller scope",
    moduleDeclarationTest({
      moduleUrl: import.meta.url + "#no-leak",
      declarations: {
        [import.meta.url + "#no-leak"]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Outer",
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
            {
              name: "Outer",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "Member",
                    args: [],
                  },
                  // Reuse the same binder names Member used internally. This
                  // must succeed: grow must not leave e/n on the caller scope.
                  {
                    kind: PatternKind.Variable,
                    name: "e",
                    pattern: { kind: PatternKind.Equal, value: "tail" },
                  },
                  {
                    kind: PatternKind.Variable,
                    name: "n",
                    pattern: { kind: PatternKind.Equal, value: "end" },
                  },
                ],
              },
            },
          ],
        },
      },
      input: Input.Iterable(["a", ".", "b", "tail", "end"]),
      kind: MatchKind.Ok,
      value: [
        {
          kind: "member",
          expression: "a",
          name: "b",
        },
        "tail",
        "end",
      ],
    }),
  );

  await t.step(
    "DLR grow preserves caller bindings across the recursive rule",
    moduleDeclarationTest({
      moduleUrl: import.meta.url + "#preserve",
      declarations: {
        [import.meta.url + "#preserve"]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Outer",
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
            {
              name: "Outer",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Variable,
                    name: "x",
                    pattern: { kind: PatternKind.Equal, value: "prep" },
                  },
                  {
                    kind: PatternKind.Variable,
                    name: "m",
                    pattern: {
                      kind: PatternKind.Resolve,
                      targetKind: ResolveTargetKind.Reference,
                      name: "Member",
                      args: [],
                    },
                  },
                ],
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ x, m }: { x: unknown; m: unknown }) => ({ x, m }),
              },
            },
          ],
        },
      },
      input: Input.Iterable(["prep", "a", ".", "b"]),
      kind: MatchKind.Ok,
      value: {
        x: "prep",
        m: {
          kind: "member",
          expression: "a",
          name: "b",
        },
      },
    }),
  );
});
