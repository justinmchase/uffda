import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { StringPattern } from "./StringPattern.ts";

tests(() => [
  {
    id: "STRINGPATTERN00",
    module: () => StringPattern,
    input: [
      { kind: TokenizerKind.String, value: "abc" },
    ],
    value: {
      kind: LangPatternKind.EqualPattern,
      value: "abc",
    },
  },
  {
    id: "STRINGPATTERN01",
    module: () => StringPattern,
    input: [
      { kind: TokenizerKind.String, value: "" },
    ],
    value: {
      kind: LangPatternKind.EqualPattern,
      value: "",
    },
  },
]);
