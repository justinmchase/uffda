import { tests } from "../../test.ts";
import { SpecialIdentifier } from "./SpecialIdentifier.ts";

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
