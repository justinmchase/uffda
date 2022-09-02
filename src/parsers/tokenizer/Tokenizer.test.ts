import { tests } from "../../test.ts";
import { Tokenizer } from "./mod.ts";

tests(() => [
  {
    id: "TOKENIZER00",
    description: "succeeds on empty input",
    pattern: () => Tokenizer,
    input: "",
    value: [],
    matched: true,
    done: true,
  },
  {
    id: "TOKENIZER01",
    description: "succeeds on whitespace",
    pattern: () => Tokenizer,
    input: " ",
    value: [
      { type: "Whitespace", value: " " },
    ],
    matched: true,
    done: true,
  },
  {
    id: "TOKENIZER02",
    description: "succeeds on multiple lines",
    pattern: () => Tokenizer,
    input: "   \n   \n   ",
    value: [
      { type: "Whitespace", value: "   " },
      { type: "NewLine", value: "\n" },
      { type: "Whitespace", value: "   " },
      { type: "NewLine", value: "\n" },
      { type: "Whitespace", value: "   " },
    ],
  },
  {
    id: "TOKENIZER03",
    description: "successfully parses expressions",
    pattern: () => Tokenizer,
    input: "x + y - 1 -> $0",
    value: [
      { type: "Identifier", value: "x" },
      { type: "Whitespace", value: " " },
      { type: "Token", value: "+" },
      { type: "Whitespace", value: " " },
      { type: "Identifier", value: "y" },
      { type: "Whitespace", value: " " },
      { type: "Token", value: "-" },
      { type: "Whitespace", value: " " },
      { type: "Integer", value: 1 },
      { type: "Whitespace", value: " " },
      { type: "Token", value: "-" },
      { type: "Token", value: ">" },
      { type: "Whitespace", value: " " },
      { type: "SpecialIdentifier", value: "$0" },
    ],
  },
  {
    id: "TOKENIZER04",
    pattern: () => Tokenizer,
    input: ["a", "b", 7],
    value: [
      { type: "Identifier", value: "ab" },
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
]);
