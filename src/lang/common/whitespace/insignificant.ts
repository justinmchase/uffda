import { Type } from "@justinmchase/type";
import {
  ExportDeclarationKind,
  type ModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";

export const Insignificant: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Insignificant",
      default: true,
    },
  ],
  rules: [
    {
      name: "Insignificant",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.Unknown,
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => {
          const tokens = _ as unknown[];
          const result: unknown[] = [];
          let i = 0;

          // Stack to track context: 'string' or 'interpolation'
          const contextStack: string[] = [];

          while (i < tokens.length) {
            const token = tokens[i];
            const currentContext = contextStack[contextStack.length - 1];

            // Handle quote - toggles string context
            if (token === '"') {
              if (currentContext === "string") {
                // Exiting a string
                contextStack.pop();
              } else {
                // Entering a string (from top-level or from interpolation)
                contextStack.push("string");
              }
              result.push(token);
              i++;
              continue;
            }

            // Handle braces - manage interpolation context within strings
            if (token === "{" && currentContext === "string") {
              contextStack.push("interpolation");
              result.push(token);
              i++;
              continue;
            }

            if (token === "}" && currentContext === "interpolation") {
              contextStack.pop();
              result.push(token);
              i++;
              continue;
            }

            // Determine if we should filter whitespace:
            // - Top level (empty stack): filter
            // - Inside interpolation: filter
            // - Inside string (not interpolation): keep
            const shouldFilterWhitespace = currentContext !== "string";

            if (typeof token === "string" && token.trim() === "") {
              // This is a whitespace or newline token
              if (shouldFilterWhitespace) {
                // Skip whitespace at top level or inside interpolated expressions
                i++;
                continue;
              } else {
                // Keep whitespace inside string content
                result.push(token);
                i++;
                continue;
              }
            }

            // Keep all non-whitespace tokens
            result.push(token);
            i++;
          }

          return result;
        },
      },
    },
  ],
};

export default Insignificant;
