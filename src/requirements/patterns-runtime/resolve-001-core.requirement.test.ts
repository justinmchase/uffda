import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import {
  type Module,
  type Rule,
  SpecialKind,
} from "../../runtime/modules/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest, patternTest } from "../../test.ts";

const mod0: Module = {
  moduleUrl: new URL("file:///resolve-special-req.ts"),
  imports: new Map(),
  exports: new Map(),
  rules: new Map(),
  default: undefined,
};
const rule0: Rule = {
  name: "A",
  module: mod0,
  parameters: [],
  pattern: { kind: PatternKind.Any },
};
mod0.rules.set("A", rule0);
mod0.exports.set("A", rule0);
mod0.default = rule0;

Deno.test("req:resolve-001 - Resolve handles reference, run, and special targets and delegates matching to selected behavior", async (t) => {
  await t.step(
    "resolve reference delegates to resolved rule",
    moduleDeclarationTest({
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
  );

  await t.step(
    "resolve reference errors on unknown rule",
    moduleDeclarationTest({
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
  );

  await t.step(
    "resolve run uses module default when name is omitted",
    moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [{
            name: "Main",
            parameters: [],
            pattern: { kind: PatternKind.Equal, value: "a" },
          }],
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "resolve run errors when selected rule is missing",
    moduleDeclarationTest({
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
  );

  await t.step(
    "resolve special delegates via module semantics",
    patternTest({
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Special,
        value: { kind: SpecialKind.Module, module: mod0 },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "resolve special delegates via rule semantics",
    patternTest({
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Special,
        value: { kind: SpecialKind.Rule, rule: rule0 },
      },
      input: Input.Iterable([7]),
      kind: MatchKind.Ok,
      value: 7,
    }),
  );
});
