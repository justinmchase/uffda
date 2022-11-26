import { tests } from "../../test.ts";
import { ExcludeWhitespace } from "./ExcludeWhitespace.ts";

tests(() => [
  {
    id: "EXCLUDE00",
    description: "can exclude whitespace and newlines",
    module: () => ExcludeWhitespace,
    input: [
      { kind: "Identifier", value: "x" },
      { kind: "Whitespace", value: " " },
      { kind: "Token", value: "+" },
      { kind: "Whitespace", value: " " },
      { kind: "Identifier", value: "y" },
      { kind: "NewLine", value: "\n" },
    ],
    value: [
      { kind: "Identifier", value: "x" },
      { kind: "Token", value: "+" },
      { kind: "Identifier", value: "y" },
    ],
  },
]);
