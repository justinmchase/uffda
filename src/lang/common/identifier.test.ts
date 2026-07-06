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
        input: Input.Iterable("abc"),
        kind: MatchKind.Ok,
        value: "abc",
      }),
    });

    await t.step({
      name: "IDENTIFIER01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("_Abc"),
        kind: MatchKind.Ok,
        value: "_Abc",
      }),
    });

    await t.step({
      name: "IDENTIFIER02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("A_b_c_"),
        kind: MatchKind.Ok,
        value: "A_b_c_",
      }),
    });

    await t.step({
      name: "IDENTIFIER03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(
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
        input: Input.Iterable("1abc"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "IDENTIFIER05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("ab̃c"), // \cMn
        kind: MatchKind.Ok,
        value: "ab̃c",
      }),
    });

    await t.step({
      name: "IDENTIFIER06",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("abःc"), // \cMc
        kind: MatchKind.Ok,
        value: "abःc",
      }),
    });

    await t.step({
      name: "IDENTIFIER07",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("ab⁀c"), // \cPc
        kind: MatchKind.Ok,
        value: "ab⁀c",
      }),
    });

    await t.step({
      name: "IDENTIFIER08",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("abc⁠xyz"), // \cCf
        kind: MatchKind.Ok,
        value: "abc⁠xyz",
      }),
    });

    await t.step({
      name: "IDENTIFIER09",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("1abc"),
        kind: MatchKind.Fail,
      }),
    });
  },
);
