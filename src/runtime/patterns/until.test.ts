// import { tests } from "../../test.ts";
// import { PatternKind } from "./pattern.kind.ts";

// tests(() => [
//   {
//     id: "ERROR00",
//     description: "~'a'",
//     pattern: () => ({
//       kind: PatternKind.Until,
//       name: "Test",
//       message: "testing",
//       pattern: {
//         kind: PatternKind.Equal,
//         value: "a",
//       },
//     }),
//     input: "",
//     matched: false,
//   },
//   {
//     id: "ERROR01",
//     description: "~'c'",
//     pattern: () => ({
//       kind: PatternKind.Until,
//       name: "Test",
//       message: "testing",
//       pattern: {
//         kind: PatternKind.Equal,
//         value: "c",
//       },
//     }),
//     input: "abc",
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "3" },
//     ],
//   },
//   {
//     id: "ERROR02",
//     description: "~'c'",
//     input: "ab",
//     pattern: () => ({
//       kind: PatternKind.Until,
//       name: "Test",
//       message: "testing",
//       pattern: {
//         kind: PatternKind.Equal,
//         value: "c",
//       },
//     }),
//     errors: [{ name: "Test", message: "testing", start: "0", end: "2" }],
//   },
//   {
//     id: "ERROR03",
//     description: "~',' ~','",
//     pattern: () => ({
//       kind: PatternKind.Then,
//       patterns: [
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ",",
//           },
//         },
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ",",
//           },
//         },
//       ],
//     }),
//     input: "a,b,",
//     value: [undefined, undefined],
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "2" },
//       { name: "Test", message: "testing", start: "2", end: "4" },
//     ],
//   },
//   {
//     id: "ERRO3.1",
//     description: "~',' ';'",
//     pattern: () => ({
//       kind: PatternKind.Then,
//       patterns: [
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ",",
//           },
//         },
//         {
//           kind: PatternKind.Equal,
//           value: ";",
//         },
//       ],
//     }),
//     input: "a,;",
//     value: [undefined, ";"],
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "2" },
//     ],
//   },
//   {
//     id: "ERROR04",
//     description: "~).|~);",
//     pattern: () => ({
//       kind: PatternKind.Or,
//       patterns: [
//         {
//           kind: PatternKind.Then,
//           patterns: [
//             {
//               kind: PatternKind.Until,
//               name: "Test",
//               message: "testing",
//               pattern: {
//                 kind: PatternKind.Equal,
//                 value: ")",
//               },
//             },
//             {
//               kind: PatternKind.Equal,
//               value: ".",
//             },
//           ],
//         },
//         {
//           kind: PatternKind.Then,
//           patterns: [
//             {
//               kind: PatternKind.Until,
//               name: "Test",
//               message: "testing",
//               pattern: {
//                 kind: PatternKind.Equal,
//                 value: ")",
//               },
//             },
//             {
//               kind: PatternKind.Equal,
//               value: ";",
//             },
//           ],
//         },
//       ],
//     }),
//     // This should match the second or clause
//     // While both clauses will generate errors, only one error should make it through
//     input: "(abc);",
//     value: [undefined, ";"],
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "5" },
//     ],
//   },
//   {
//     id: "ERROR05",
//     description: "~';' & ~';'",
//     pattern: () => ({
//       kind: PatternKind.And,
//       patterns: [
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ";",
//           },
//         },
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ";",
//           },
//         },
//       ],
//     }),
//     // Each clause should generate an error and all should be propagated
//     input: "a;",
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "2" },
//       { name: "Test", message: "testing", start: "0", end: "2" },
//     ],
//   },
//   {
//     id: "ERROR06",
//     description: "[~';']",
//     pattern: () => ({
//       kind: PatternKind.Array,
//       pattern: {
//         kind: PatternKind.Until,
//         name: "Test",
//         message: "testing",
//         pattern: {
//           kind: PatternKind.Equal,
//           value: ";",
//         },
//       },
//     }),
//     // Each clause should generate an error and all should be propagated
//     input: [["a", ";"]],
//     errors: [
//       { name: "Test", message: "testing", start: "1.0", end: "1.2" },
//     ],
//   },
//   {
//     id: "ERROR07",
//     description: "{ A = ~';'}",
//     pattern: () => ({
//       kind: PatternKind.Block,
//       rules: {
//         A: {
//           kind: PatternKind.Rule,
//           pattern: {
//             kind: PatternKind.Until,
//             name: "Test",
//             message: "testing",
//             pattern: {
//               kind: PatternKind.Equal,
//               value: ";",
//             },
//           },
//         },
//       },
//     }),
//     // Each clause should generate an error and all should be propagated
//     input: "a;",
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "2" },
//     ],
//   },
//   {
//     id: "ERROR08",
//     description: "^~';'",
//     pattern: () => ({
//       kind: PatternKind.Not,
//       pattern: {
//         kind: PatternKind.Until,
//         name: "Test",
//         message: "testing",
//         pattern: {
//           kind: PatternKind.Equal,
//           value: ";",
//         },
//       },
//     }),
//     input: "a;",
//     matched: false,
//     done: false,
//     errors: [],
//   },
//   {
//     id: "ERROR09",
//     description: "^~';'",
//     pattern: () => ({
//       kind: PatternKind.Not,
//       pattern: {
//         kind: PatternKind.Then,
//         patterns: [
//           {
//             kind: PatternKind.Until,
//             name: "Test",
//             message: "testing",
//             pattern: {
//               kind: PatternKind.Equal,
//               value: "c",
//             },
//           },
//           {
//             kind: PatternKind.Equal,
//             value: ";",
//           },
//         ],
//       },
//     }),
//     input: "abc",
//     done: false,
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "3" },
//     ],
//   },
//   {
//     id: "ERROR10",
//     description: "{ x = ~';' }",
//     pattern: () => ({
//       kind: PatternKind.Object,
//       keys: {
//         x: {
//           kind: PatternKind.Array,
//           pattern: {
//             kind: PatternKind.Until,
//             name: "Test",
//             message: "testing",
//             pattern: {
//               kind: PatternKind.Equal,
//               value: ";",
//             },
//           },
//         },
//       },
//     }),
//     input: [{ x: ["a", ";"] }],
//     value: { x: ["a", ";"] },
//     errors: [
//       { name: "Test", message: "testing", start: "1.x.0", end: "1.x.2" },
//     ],
//   },
//   {
//     id: "ERROR11",
//     description: "~';' > 'a' ';'",
//     pattern: () => ({
//       kind: PatternKind.Pipeline,
//       steps: [
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ";",
//           },
//         },
//         {
//           kind: PatternKind.Then,
//           patterns: [
//             { kind: PatternKind.Equal, value: "a" },
//             { kind: PatternKind.Equal, value: ";" },
//           ],
//         },
//       ],
//     }),
//     input: "a;",
//     matched: false,
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "2" },
//     ],
//   },
//   {
//     id: "ERROR12",
//     description: "'a' ';' > ~';'",
//     pattern: () => ({
//       kind: PatternKind.Pipeline,
//       steps: [
//         {
//           kind: PatternKind.Then,
//           patterns: [
//             { kind: PatternKind.Equal, value: "a" },
//             { kind: PatternKind.Equal, value: ";" },
//           ],
//         },
//         {
//           kind: PatternKind.Until,
//           name: "Test",
//           message: "testing",
//           pattern: {
//             kind: PatternKind.Equal,
//             value: ";",
//           },
//         },
//       ],
//     }),
//     input: "a;",
//     matched: false,
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "2" },
//     ],
//   },
//   {
//     id: "ERROR13",
//     description: "consumes all until end",
//     pattern: () => ({
//       kind: PatternKind.Until,
//       name: "Test",
//       message: "testing",
//       pattern: {
//         kind: PatternKind.End,
//       },
//     }),
//     input: "abc",
//     errors: [
//       { name: "Test", message: "testing", start: "0", end: "3" },
//     ],
//   },
// ]);
