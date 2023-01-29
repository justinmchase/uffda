import { integration } from "../../integration.ts";

Deno.test({
  name: "SPECIALIDENTIFIER00",
  ...integration({
    moduleUrl: "./SpecialIdentifier.uff",
    input: "$0",
    expected: "$0",
  }),
});
Deno.test({
  name: "SPECIALIDENTIFIER01",
  ...integration({
    moduleUrl: "./SpecialIdentifier.uff",
    input: "$x",
    expected: "$x",
  }),
});
Deno.test({
  name: "SPECIALIDENTIFIER02",
  ...integration({
    moduleUrl: "./SpecialIdentifier.uff",
    input: "x",
    matched: false,
    done: false,
  }),
});
