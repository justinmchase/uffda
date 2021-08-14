import { tests } from "../../test.ts";
import { Whitespace } from "./Whitespace.ts";

tests("parsers.tokenizer.whitespace", () => [
  {
    id: "WHITESPACE00",
    description: "can match space",
    pattern: () => Whitespace,
    input: " ",
    value: " ",
  },
  {
    id: "WHITESPACE01",
    description: "can match tab",
    pattern: () => Whitespace,
    input: "\t",
    value: "\t",
  },
  {
    id: "WHITESPACE02",
    description: "does not match newline",
    pattern: () => Whitespace,
    input: "\n",
    matched: false,
    done: false,
  },
  {
    id: "WHITESPACE03",
    description: "matches multiple whitespace characters in a row",
    pattern: () => Whitespace,
    input: "     ",
    value: "     ",
  },
]);
