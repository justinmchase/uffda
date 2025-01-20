import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = import.meta.url;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.token",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "TOKEN_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("x"),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "TOKEN_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input(["   ", "x"]),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "TOKEN_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input(["x", "   "]),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
    await t.step({
      name: "TOKEN_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input(["   ", "x", "   "]),
        kind: MatchKind.Ok,
        value: "x",
      }),
    });
  },
);

export const TokenTest: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: new URL("./token.ts", import.meta.url).href,
      names: ["Token"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "TokenTest",
      default: true,
    },
  ],
  rules: [
    {
      name: "T",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "x",
      },
    },
    {
      // T = "x";
      // TokenTest = Token<T>;
      name: "TokenTest",
      parameters: [],
      pattern: {
        kind: PatternKind.Reference,
        name: "Token",
        args: ["T"],
      },
    },
  ],
};

export default TokenTest;
