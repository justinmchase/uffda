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
          let insideString = false;
          let braceDepth = 0;

          while (i < tokens.length) {
            const token = tokens[i];

            // Track when we enter/exit strings
            if (token === '"') {
              insideString = !insideString;
              braceDepth = 0; // Reset brace depth when entering/exiting string
              result.push(token);
              i++;
              continue;
            }

            // Track brace depth for interpolated expressions
            if (insideString) {
              if (token === "{") {
                braceDepth++;
                result.push(token);
                i++;
                continue;
              } else if (token === "}") {
                braceDepth--;
                result.push(token);
                i++;
                continue;
              }
            }

            // Determine if we should filter whitespace
            const shouldFilterWhitespace = !insideString || braceDepth > 0;

            if (typeof token === "string" && token.trim() === "") {
              // This is a whitespace or newline token
              if (shouldFilterWhitespace) {
                // Skip whitespace outside strings or inside interpolated expressions
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
