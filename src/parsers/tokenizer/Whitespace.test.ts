import { tests } from "../../test.ts";
import { Whitespace } from "./Whitespace.ts";

tests(() => [
  {
    id: "WHITESPACE00",
    description: "can match space",
    module: () => Whitespace,
    input: " ",
    value: " ",
  },
  {
    id: "WHITESPACE01",
    description: "can match tab",
    module: () => Whitespace,
    input: "\t",
    value: "\t",
  },
  {
    id: "WHITESPACE02",
    description: "does not match newline",
    module: () => Whitespace,
    input: "\n",
    matched: false,
    done: false,
  },
  {
    id: "WHITESPACE03",
    description: "matches multiple whitespace characters in a row",
    module: () => Whitespace,
    input: "     ",
    value: "     ",
  },
]);
