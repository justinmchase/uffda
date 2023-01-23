import { tests } from "../../test.ts";
import { Letter } from "./Letter.ts";

tests(() => [
  {
    id: "LETTER00",
    description: "matches a letter",
    module: () => Letter,
    input: "a",
    value: "a",
  },
  {
    id: "LETTER01",
    description: "does not match a non-letter",
    module: () => Letter,
    input: "*",
    matched: false,
    done: false,
  },
  {
    id: "LETTER02",
    description: "does not match a digit",
    module: () => Letter,
    input: "1",
    matched: false,
    done: false,
  },
]);
