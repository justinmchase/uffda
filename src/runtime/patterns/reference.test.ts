import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.reference", async (t) => {
  await t.step({
    name: "REFERENCE00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "A",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
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
              kind: DeclarationKind.Rule,
              name: "B",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
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
              kind: DeclarationKind.Rule,
              name: "B",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "A",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
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
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            {
              kind: DeclarationKind.Rule,
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
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [
            {
              kind: DeclarationKind.ModuleImport,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "B",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            // Rule A is defined in a separate module
            // But it is still able to access rule B since it is passed as an argument for parameter T
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [
            {
              kind: DeclarationKind.ModuleImport,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          rules: [
            // Rule B is passed as an argument for parameter T into rule A
            // Yet rule B is still able to access rule C since it is resolving references in its context
            {
              kind: DeclarationKind.Rule,
              name: "B",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "C",
                args: [],
              },
            },
            {
              kind: DeclarationKind.Rule,
              name: "C",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            // Rule A is defined in a separate module
            // But it is still able to access rule B since it is passed as an argument for parameter T
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [
            {
              kind: DeclarationKind.ModuleImport,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          rules: [
            {
              kind: DeclarationKind.Rule,
              name: "B",
              parameters: [],
              pattern: {
                kind: PatternKind.Reference,
                name: "C",
                args: [],
              },
            },
            {
              kind: DeclarationKind.Rule,
              name: "C",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            // Rule A is not able to access rule C since it is scoped to a different module
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [
            {
              kind: DeclarationKind.ModuleImport,
              moduleUrl: "file:///a.ts",
              names: ["A"],
            },
          ],
          rules: [
            {
              kind: DeclarationKind.Rule,
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
              kind: DeclarationKind.Rule,
              name: "C",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: "a" },
            },
            {
              kind: DeclarationKind.Rule,
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
          kind: DeclarationKind.Module,
          imports: [],
          rules: [
            // Rules can pass parameters in as arguments to other rules
            {
              kind: DeclarationKind.Rule,
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
});
