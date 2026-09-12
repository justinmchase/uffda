import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import {
  CharacterClass,
  ValueSourceKind,
} from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternGrammar } from "./pattern.lang.ts";
import { executeUffdaSource } from "../uffda/execute.ts";

const moduleUrl = new URL("./switch.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.switch",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "SWITCH_LANG_00 parses a single literal-key case with a default",
      fn: async () => {
        const m = await patternGrammar(`switch { "#": any, default: fail }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [
              {
                key: {
                  kind: "values",
                  values: [{
                    kind: ValueSourceKind.Literal,
                    value: "#",
                  }],
                },
                pattern: { kind: PatternKind.Any },
              },
            ],
            default: { kind: PatternKind.Fail },
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_01 parses a character-class key case",
      fn: async () => {
        const m = await patternGrammar(`switch { \\cL: any, default: fail }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [
              {
                key: {
                  kind: "characterClass",
                  characterClass: CharacterClass.Letter,
                },
                pattern: { kind: PatternKind.Any },
              },
            ],
            default: { kind: PatternKind.Fail },
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_02 parses multiple literal keys sharing one case",
      fn: async () => {
        const m = await patternGrammar(`switch { "a", "b": any }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [
              {
                key: {
                  kind: "values",
                  values: [
                    { kind: ValueSourceKind.Literal, value: "a" },
                    { kind: ValueSourceKind.Literal, value: "b" },
                  ],
                },
                pattern: { kind: PatternKind.Any },
              },
            ],
            default: undefined,
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_03 parses multiple cases with no default",
      fn: async () => {
        const m = await patternGrammar(`switch { "#": any, "%": end }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [
              {
                key: {
                  kind: "values",
                  values: [{ kind: ValueSourceKind.Literal, value: "#" }],
                },
                pattern: { kind: PatternKind.Any },
              },
              {
                key: {
                  kind: "values",
                  values: [{ kind: ValueSourceKind.Literal, value: "%" }],
                },
                pattern: { kind: PatternKind.End },
              },
            ],
            default: undefined,
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_04 parses a default-only body",
      fn: async () => {
        const m = await patternGrammar(`switch { default: fail }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [],
            default: { kind: PatternKind.Fail },
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_05 parses an empty body",
      fn: async () => {
        const m = await patternGrammar(`switch { }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [],
            default: undefined,
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_06 allows a trailing comma after the last case",
      fn: async () => {
        const m = await patternGrammar(`switch { "#": any, }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [
              {
                key: {
                  kind: "values",
                  values: [{ kind: ValueSourceKind.Literal, value: "#" }],
                },
                pattern: { kind: PatternKind.Any },
              },
            ],
            default: undefined,
          });
        }
      },
    });

    await t.step({
      name: "SWITCH_LANG_07 allows a trailing comma after a trailing default",
      fn: async () => {
        const m = await patternGrammar(`switch { "#": any, default: fail, }`);
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, {
            kind: PatternKind.Switch,
            cases: [
              {
                key: {
                  kind: "values",
                  values: [{ kind: ValueSourceKind.Literal, value: "#" }],
                },
                pattern: { kind: PatternKind.Any },
              },
            ],
            default: { kind: PatternKind.Fail },
          });
        }
      },
    });

    await t.step({
      name:
        "SWITCH_LANG_08 rejects a bare `default` identifier used as a rule reference (reserved keyword)",
      fn: async () => {
        const m = await patternGrammar(`default`);
        assertEquals(m.kind !== MatchKind.Ok, true);
      },
    });

    await t.step({
      name:
        "SWITCH_LANG_09 rejects a bare `switch` identifier used as a rule reference (reserved keyword)",
      fn: async () => {
        const m = await patternGrammar(`switch`);
        assertEquals(m.kind !== MatchKind.Ok, true);
      },
    });

    await t.step({
      name:
        "SWITCH_LANG_E2E a full .uff rule using switch syntax dispatches, falls to default, and commits to the chosen case (no fallthrough)",
      fn: async () => {
        const source = `
          export Main;
          rule Main = switch {
            "a": ok,
            "b": fail,
            default: ok
          };
        `;

        const okOnA = await executeUffdaSource(source, {
          entryRuleName: "Main",
          input: "a",
        });
        assertEquals(okOnA.kind, MatchKind.Ok);

        // Committed choice: "b"'s key matches, so its own (failing) body
        // runs — the overall rule fails rather than falling through to
        // `default`.
        const failsOnB = await executeUffdaSource(source, {
          entryRuleName: "Main",
          input: "b",
        });
        assertEquals(failsOnB.kind, MatchKind.Fail);

        const okOnDefault = await executeUffdaSource(source, {
          entryRuleName: "Main",
          input: "c",
        });
        assertEquals(okOnDefault.kind, MatchKind.Ok);
      },
    });
  },
});
