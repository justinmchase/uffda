import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "OK00",
    description: "ok",
    pattern: () => PatternLang,
    input: "ok",
    value: {
      kind: LangPatternKind.OkPattern,
    },
  },
]);
