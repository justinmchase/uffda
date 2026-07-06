import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { ExportDeclarationKind } from "../declarations/mod.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ResolveTargetKind } from "./pattern.ts";

Deno.test("runtime.patterns.resolve", async (t) => {
  await t.step({
    name: "RESOLVE_PATTERN00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "A",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "A",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "RESOLVE_PATTERN01",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "Missing",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.UnknownReference,
      message: "unknown reference: Missing",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "RESOLVE_PATTERN02",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Run,
              },
            },
          ],
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "RESOLVE_PATTERN03",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Run,
                name: "Missing",
              },
            },
          ],
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.PatternExpected,
      message: "Rule Missing not found",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
});
