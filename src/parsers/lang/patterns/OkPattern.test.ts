import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { OkPattern } from "./OkPattern.ts";

tests(() => [
  {
    id: "OK00",
    module: () => OkPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "ok" },
    ],
    value: {
      kind: LangPatternKind.OkPattern,
    },
  },
]);
