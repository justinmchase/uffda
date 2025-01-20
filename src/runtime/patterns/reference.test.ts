import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { moduleDeclarationTest } from "../../test.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
} from "../declarations/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.reference", async (t) => {
  await t.step({
    name: "REFERENCE00",
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
                kind: PatternKind.Reference,
                name: "A",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "REFERENCE01",
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
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
            {
              name: "B",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["B"],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "REFERENCE02",
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
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
            {
              name: "B",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.InvalidArgument,
      message: "invalid argument count: expected 1, got 0",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "REFERENCE03",
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
                kind: PatternKind.Reference,
                name: "A",
                args: ["B"],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.InvalidArgument,
      message: "invalid argument count: expected 0, got 1",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "REFERENCE04",
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
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["B"],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.UnknownParameter,
      message: "unknown argument reference: B",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "REFERENCE04",
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
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["A"],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.InvalidArgument,
      message: "invalid self reference: A",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "REFERENCE05",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [
            {
              kind: ImportDeclarationKind.Module,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "B",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["B"],
              },
            },
          ],
        },
        ["file:///a.ts"]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "A", default: true },
          ],
          rules: [
            // Rule A is defined in a separate module
            // But it is still able to access rule B since it is passed as an argument for parameter T
            {
              name: "A",
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "REFERENCE06",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [
            {
              kind: ImportDeclarationKind.Module,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            // Rule B is passed as an argument for parameter T into rule A
            // Yet rule B is still able to access rule C since it is resolving references in its context
            {
              name: "B",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "C",
                args: [],
              },
            },
            {
              name: "C",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["B"],
              },
            },
          ],
        },
        ["file:///a.ts"]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "A",
            default: true,
          }],
          rules: [
            // Rule A is defined in a separate module
            // But it is still able to access rule B since it is passed as an argument for parameter T
            {
              name: "A",
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "REFERENCE07",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [
            {
              kind: ImportDeclarationKind.Module,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "B",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "C",
                args: [],
              },
            },
            {
              name: "C",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["B"],
              },
            },
          ],
        },
        ["file:///a.ts"]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "A",
            default: true,
          }],
          rules: [
            // Rule A is not able to access rule C since it is scoped to a different module
            {
              name: "A",
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "C",
                args: [],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.UnknownReference,
      message: "unknown reference: C",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "REFERENCE07",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [
            {
              kind: ImportDeclarationKind.Module,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "Main",
            default: true,
          }],
          rules: [
            {
              name: "B",
              parameters: [
                { name: "T" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T",
                args: [],
              },
            },
            {
              name: "C",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: ["B", "C"],
              },
            },
          ],
        },
        ["file:///a.ts"]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "A" }],
          rules: [
            // Rules can pass parameters in as arguments to other rules
            {
              name: "A",
              parameters: [
                { name: "T0" },
                { name: "T1" },
              ],
              pattern: {
                kind: PatternKind.Reference,
                name: "T0",
                args: ["T1"],
              },
            },
          ],
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "REFERENCE08",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          // Importing A from a.ts but its not exported results in an error
          imports: [{
            kind: ImportDeclarationKind.Module,
            moduleUrl: "file:///a.ts",
            names: ["A"],
          }],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "Main" }],
          rules: [
            {
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "A",
                args: [],
              },
            },
          ],
        },
        ["file:///a.ts"]: {
          imports: [],
          exports: [],
          rules: [
            {
              name: "A",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
          ],
        },
      },
      input: Input.From("a"),
      value: "a",
      throws: {
        name: "Error",
        message: "Unknown export A from module file:///a.ts",
      },
    }),
  });
});
