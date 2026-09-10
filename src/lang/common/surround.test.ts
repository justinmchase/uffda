import { Input } from "../../input.ts";
import { lit, ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { MatchKind } from "../../mod.ts";
import { Path } from "../../path.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./surround.test.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.surround",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "SURROUND00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("(x)"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "SURROUND01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("(x"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "SURROUND02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("x)"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });

    await t.step({
      name: "SURROUND03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("x"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });

    await t.step({
      name: "SURROUND04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("()"),
        kind: MatchKind.Fail,
        failures: [
          {
            pattern: { kind: PatternKind.Equal, value: lit("(") },
            start: Path.From(1),
            end: Path.From(1),
          },
        ],
      }),
    });
  },
);

export const SurroundTest: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: new URL("./surround.uff", import.meta.url).href,
      names: ["Surround"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "SurroundTest",
      default: true,
    },
  ],
  rules: [
    {
      name: "A",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("(") },
    },
    {
      name: "B",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("x") },
    },
    {
      name: "C",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit(")") },
    },
    {
      // A = "(";
      // B = "x";
      // C = ")";
      // Surround = Surround<A B C>;
      name: "SurroundTest",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Surround",
        args: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "A",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "B",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "C",
            args: [],
          },
        ],
      },
    },
  ],
};

export default SurroundTest;
