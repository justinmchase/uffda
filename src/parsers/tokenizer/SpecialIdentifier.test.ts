import { integration } from "../../integration.ts";
import { tests } from "../../test.ts";
import { SpecialIdentifier } from "./SpecialIdentifier.ts";

Deno.test(integration({
  future: "Requires support for string interpolation first",
  moduleUrl: "./SpecialIdentifier.uff",
  input: "$0",
  expected: "$0",
}));

tests(() => [
  {
    id: "SPECIALIDENTIFIER00",
    description: "can match a digit special identifier",
    module: () => SpecialIdentifier,
    input: "$0",
    value: "$0",
  },
  {
    id: "SPECIALIDENTIFIER01",
    description: "can match a letter special identifier",
    module: () => SpecialIdentifier,
    input: "$x",
    value: "$x",
  },
  {
    id: "SPECIALIDENTIFIER02",
    description: "must start with $",
    module: () => SpecialIdentifier,
    input: "x",
    matched: false,
    done: false,
  },
]);
