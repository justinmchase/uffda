import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { Path } from "../../path.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./group.test.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.group",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "GROUP00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("(a)"),
        kind: MatchKind.Ok,
        value: "a",
      }),
    });
    await t.step({
      name: "GROUP01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("()"),
        kind: MatchKind.Ok,
        value: undefined,
      }),
    });

    await t.step({
      name: "GROUP01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("(b)"),
        kind: MatchKind.Fail,
        failures: [
          {
            pattern: { kind: PatternKind.Equal, value: "a" },
            start: Path.From(1),
            end: Path.From(1),
          },
        ],
      }),
    });

    await t.step({
      name: "GROUP02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: new Input("(a"),
        kind: MatchKind.Fail,
        failures: [
          {
            pattern: { kind: PatternKind.Equal, value: ")" },
            start: Path.From(2),
            end: Path.From(2),
          },
        ],
      }),
    });
  },
);

export const GroupTest: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: new URL("./group.ts", import.meta.url).href,
      names: ["Group"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "GroupTest",
    },
  ],
  rules: [
    {
      name: "A",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "a",
      },
    },
    {
      // A = "a";
      // GroupTest = Group<A>;
      name: "GroupTest",
      parameters: [],
      pattern: {
        kind: PatternKind.Reference,
        name: "Group",
        args: ["A"],
      },
    },
  ],
};

export default GroupTest;
