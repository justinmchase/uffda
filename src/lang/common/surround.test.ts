import { Input } from "../../input.ts";
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
        input: new Input("(x)"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "SURROUND01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("(x"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "SURROUND02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("x)"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });

    await t.step({
      name: "SURROUND03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("x"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });

    await t.step({
      name: "SURROUND04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("()"),
        kind: MatchKind.Fail,
        failures: [
          {
            pattern: { kind: PatternKind.Equal, value: "(" },
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
      moduleUrl: new URL("./surround.ts", import.meta.url).href,
      names: ["Surround"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "SurroundTest",
    },
  ],
  rules: [
    {
      name: "A",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "(",
      },
    },
    {
      name: "B",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "x",
      },
    },
    {
      name: "C",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: ")",
      },
    },
    {
      // A = "(";
      // B = "x";
      // C = ")";
      // Surround = Surround<A B C>;
      name: "SurroundTest",
      parameters: [],
      pattern: {
        kind: PatternKind.Reference,
        name: "Surround",
        args: ["A", "B", "C"],
      },
    },
  ],
};

export default SurroundTest;
