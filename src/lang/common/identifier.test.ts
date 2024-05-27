import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./identifier.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.identifier",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "IDENTIFIER00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("abc"),
        kind: MatchKind.Ok,
        value: "abc",
      }),
    });

    await t.step({
      name: "IDENTIFIER01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("_Abc"),
        kind: MatchKind.Ok,
        value: "_Abc",
      }),
    });

    await t.step({
      name: "IDENTIFIER02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("A_b_c_"),
        kind: MatchKind.Ok,
        value: "A_b_c_",
      }),
    });

    await t.step({
      name: "IDENTIFIER03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
        ),
        kind: MatchKind.Ok,
        value:
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
      }),
    });

    await t.step({
      name: "IDENTIFIER04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("1abc"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "IDENTIFIER05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("ab̃c"), // \cMn
        kind: MatchKind.Ok,
        value: "ab̃c",
      }),
    });

    await t.step({
      name: "IDENTIFIER06",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("abःc"), // \cMc
        kind: MatchKind.Ok,
        value: "abःc",
      }),
    });

    await t.step({
      name: "IDENTIFIER07",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("ab⁀c"), // \cPc
        kind: MatchKind.Ok,
        value: "ab⁀c",
      }),
    });

    await t.step({
      name: "IDENTIFIER08",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("abc⁠xyz"), // \cCf
        kind: MatchKind.Ok,
        value: "abc⁠xyz",
      }),
    });
  },
);
