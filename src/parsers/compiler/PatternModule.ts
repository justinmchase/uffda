// import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
// import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
// import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

// export const PatternModule: IRulePattern = {
//   kind: PatternKind.Rule,
//   pattern: {
//     kind: PatternKind.Projection,
//     pattern: {
//       kind: PatternKind.Object,
//       keys: {
//         kind: { kind: PatternKind.Equal, value: "PatternModule" },
        
//         // imports // todo: implement imports...
//         // imports: {
//         //   kind: PatternKind.Variable,
//         //   name: "imports",
//         //   pattern: {
//         //     kind: PatternKind.Array,
//         //     pattern: {
//         //       kind: PatternKind.Slice,
//         //       pattern: {
//         //         kind: PatternKind.Reference,
//         //         name: "ImportDeclaration",
//         //       }
//         //     }
//         //   }
//         // },
        
//         patterns: {
//           kind: PatternKind.Variable,
//           name: "patterns",
//           pattern: {
//             kind: PatternKind.Array,
//             pattern: {
//               kind: PatternKind.Slice,
//               pattern: {
//                 kind: PatternKind.Reference,
//                 name: "PatternDeclaration",
//               },
//             },
//           },
//         },
//       },
//     },
//     expression: {
//       kind: ExpressionKind.Native,
//       fn: ({ imports = [], patterns = [] }) => ({
//         kind: DeclarationKind.Module,
//         imports,
//         patterns,
//       }),
//     },
//   },
// };
