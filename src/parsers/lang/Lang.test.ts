import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";

tests(import.meta.url, () => [
  {
    id: "LANG00",
    pattern: () => TestLang,
    input: `
      A = B;
      xyz;
      C = D;
    `,
    matched: false, // Errors in a pipeline step will result in matched false
    errors: [
      {
        name: "InvalidPattern",
        message: "Not a valid Pattern",
        start: "4",
        end: "6",
      },
    ],
    value: [
      {
        kind: "PatternDeclaration",
        name: "A",
        pattern: { kind: "ReferencePattern", name: "B" },
      },
      undefined,
      {
        kind: "PatternDeclaration",
        name: "C",
        pattern: { kind: "ReferencePattern", name: "D" },
      },
    ],
  },
]);
