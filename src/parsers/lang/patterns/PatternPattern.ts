import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";

export const PatternPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Reference,
    name: LangPatternKind.PipelinePattern,
  },
};
