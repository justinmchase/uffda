import { tests } from "../../test.ts";
import { Tokenizer } from "./mod.ts";

tests(() => [
  {
    id: "TOKENIZER00",
    description: "succeeds on empty input",
    module: () => Tokenizer,
    input: "",
    value: [],
    matched: true,
    done: true,
  },
  {
    id: "TOKENIZER01",
    description: "succeeds on whitespace",
    module: () => Tokenizer,
    input: " ",
    value: [
      { kind: "Whitespace", value: " " },
    ],
    matched: true,
    done: true,
  },
  {
    id: "TOKENIZER02",
    description: "succeeds on multiple lines",
    module: () => Tokenizer,
    input: "   \n   \n   ",
    value: [
      { kind: "Whitespace", value: "   " },
      { kind: "NewLine", value: "\n" },
      { kind: "Whitespace", value: "   " },
      { kind: "NewLine", value: "\n" },
      { kind: "Whitespace", value: "   " },
    ],
  },
  {
    id: "TOKENIZER03",
    description: "successfully parses expressions",
    module: () => Tokenizer,
    input: "x + y - 1 -> $0",
    value: [
      { kind: "Identifier", value: "x" },
      { kind: "Whitespace", value: " " },
      { kind: "Token", value: "+" },
      { kind: "Whitespace", value: " " },
      { kind: "Identifier", value: "y" },
      { kind: "Whitespace", value: " " },
      { kind: "Token", value: "-" },
      { kind: "Whitespace", value: " " },
      { kind: "Integer", value: 1 },
      { kind: "Whitespace", value: " " },
      { kind: "Token", value: "-" },
      { kind: "Token", value: ">" },
      { kind: "Whitespace", value: " " },
      { kind: "SpecialIdentifier", value: "$0" },
    ],
  },
  {
    id: "TOKENIZER04",
    module: () => Tokenizer,
    input: ["a", "b", 7],
    value: [
      { kind: "Identifier", value: "ab" },
      undefined,
    ],
    errors: [
      {
        name: "InvalidToken",
        message: "Tokens are expected to be strings",
        start: "2",
        end: "3",
      },
    ],
  },
  {
    id: "TOKENIZER05",
    module: () => Tokenizer,
    input: "'abc'",
    value: [
      { kind: "String", value: "abc" },
    ],
  },
  {
    id: "TOKENIZER06",
    module: () => Tokenizer,
    input: ";",
    value: [
      { kind: "Token", value: ";" },
    ],
  },
]);
