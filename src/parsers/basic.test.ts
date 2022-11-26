import { tests } from "../test.ts";
import { Basic } from "./basic.ts";

tests(() => [
  {
    id: "BASIC00",
    description: "succeeds on empty input",
    module: () => Basic,
    value: []
  },
  {
    id: "BASIC01",
    description: "succeeds on empty input",
    module: () => Basic,
    input: "x + y\n",
    value: [
      { kind: "Identifier", value: "x" },
      { kind: "Token", value: "+" },
      { kind: "Identifier", value: "y" }
    ],
  },
]);
