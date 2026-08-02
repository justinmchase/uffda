import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "./execute.ts";
import { MorseLang } from "./morse.lang.ts";

const MORSE_REPERTOIRE = [
  [".-", "A"],
  ["-...", "B"],
  ["-.-.", "C"],
  ["-..", "D"],
  [".", "E"],
  ["..-.", "F"],
  ["--.", "G"],
  ["....", "H"],
  ["..", "I"],
  [".---", "J"],
  ["-.-", "K"],
  [".-..", "L"],
  ["--", "M"],
  ["-.", "N"],
  ["---", "O"],
  [".--.", "P"],
  ["--.-", "Q"],
  [".-.", "R"],
  ["...", "S"],
  ["-", "T"],
  ["..-", "U"],
  ["...-", "V"],
  [".--", "W"],
  ["-..-", "X"],
  ["-.--", "Y"],
  ["--..", "Z"],
  ["-----", "0"],
  [".----", "1"],
  ["..---", "2"],
  ["...--", "3"],
  ["....-", "4"],
  [".....", "5"],
  ["-....", "6"],
  ["--...", "7"],
  ["---..", "8"],
  ["----.", "9"],
  [".-.-.-", "."],
  ["--..--", ","],
  ["..--..", "?"],
  [".----.", "'"],
  ["-.-.--", "!"],
  ["-..-.", "/"],
  ["-.--.", "("],
  ["-.--.-", ")"],
  [".-...", "&"],
  ["---...", ":"],
  ["-.-.-.", ";"],
  ["-...-", "="],
  [".-.-.", "+"],
  ["-....-", "-"],
  ["..--.-", "_"],
  [".-..-.", '"'],
  ["...-..-", "$"],
  [".--.-.", "@"],
] as const;

const MOBY_DICK_EXCERPT = `I quickly followed suit, and descending into the
bar-room accosted the grinning landlord very pleasantly. I cherished no malice
towards him, though he had been skylarking with me not a little in the matter of
my bedfellow.

However, a good laugh is a mighty good thing, and rather too scarce a good
thing; the more's the pity. So, if any one man, in his own proper person, afford
stuff for a good joke to anybody, let him not be backward, but let him
cheerfully allow himself to spend and be spent in that way. And the man that has
anything bountifully laughable about him, be sure there is more in that man than
you perhaps think for.`;

const MOBY_DICK_MORSE =
  `../ --.-/..-/../-.-./-.-/.-../-.--/ ..-./---/.-../.-../---/.--/./-../
.../..-/../-/--..--/ .-/-./-../ -.././.../-.-././-./-../../-./--./
../-./-/---/ -/...././ -.../.-/.-./-....-/.-./---/---/--/
.-/-.-./-.-./---/.../-/./-../ -/...././ --./.-./../-./-./../-./--./
.-../.-/-./-../.-../---/.-./-../ ...-/./.-./-.--/
.--./.-.././.-/.../.-/-./-/.-../-.--/.-.-.-/ ../
-.-./...././.-./../.../...././-../ -./---/ --/.-/.-../../-.-././
-/---/.--/.-/.-./-../.../ ..../../--/--..--/ -/..../---/..-/--./..../ ...././
..../.-/-../ -.../././-./ .../-.-/-.--/.-../.-/.-./-.-/../-./--./
.--/../-/..../ --/./ -./---/-/ .-/ .-../../-/-/.-.././ ../-./ -/...././
--/.-/-/-/./.-./ ---/..-./ --/-.--/
-..././-../..-././.-../.-../---/.--/.-.-.-/

..../---/.--/./...-/./.-./--..--/ .-/ --./---/---/-../ .-../.-/..-/--./..../
../.../ .-/ --/../--./..../-/-.--/ --./---/---/-../ -/..../../-./--./--..--/
.-/-./-../ .-./.-/-/...././.-./ -/---/---/ .../-.-./.-/.-./-.-././ .-/
--./---/---/-../ -/..../../-./--./-.-.-./ -/...././ --/---/.-././.----./.../
-/...././ .--./../-/-.--/.-.-.-/ .../---/--..--/ ../..-./ .-/-./-.--/
---/-././ --/.-/-./--..--/ ../-./ ..../../.../ ---/.--/-./
.--./.-./---/.--././.-./ .--././.-./.../---/-./--..--/
.-/..-./..-./---/.-./-../ .../-/..-/..-./..-./ ..-./---/.-./ .-/
--./---/---/-../ .---/---/-.-/./ -/---/ .-/-./-.--/-.../---/-../-.--/--..--/
.-.././-/ ..../../--/ -./---/-/ -..././
-.../.-/-.-./-.-/.--/.-/.-./-../--..--/ -.../..-/-/ .-.././-/ ..../../--/
-.-./..../././.-./..-./..-/.-../.-../-.--/ .-/.-../.-../---/.--/
..../../--/..././.-../..-./ -/---/ .../.--././-./-../ .-/-./-../ -..././
.../.--././-./-/ ../-./ -/..../.-/-/ .--/.-/-.--/.-.-.-/ .-/-./-../ -/...././
--/.-/-./ -/..../.-/-/ ..../.-/.../ .-/-./-.--/-/..../../-./--./
-.../---/..-/-./-/../..-./..-/.-../.-../-.--/
.-../.-/..-/--./..../.-/-.../.-.././ .-/-.../---/..-/-/ ..../../--/--..--/
-..././ .../..-/.-././ -/...././.-././ ../.../ --/---/.-././ ../-./
-/..../.-/-/ --/.-/-./ -/..../.-/-./ -.--/---/..-/
.--././.-./..../.-/.--./.../ -/..../../-./-.-/ ..-./---/.-./.-.-.-/`;

function normalizeWrappedText(text: string): string {
  return text
    .split("\n\n")
    .map((paragraph) => paragraph.replaceAll("\n", " "))
    .join("\n\n");
}

function normalizeMorseText(text: string): string {
  return normalizeWrappedText(text).toUpperCase();
}

Deno.test("lang.uffda.morse-lang compiles and translates Morse input", async (t) => {
  await t.step("decodes the complete supported repertoire", async () => {
    const input = MORSE_REPERTOIRE.map(([code]) => `${code}/`).join("");
    const expected = MORSE_REPERTOIRE.map(([, symbol]) => symbol).join("");
    const match = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(input),
    });

    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, expected);
    }
  });

  await t.step("decodes SOS", async () => {
    const match = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(".../---/.../"),
    });
    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, "SOS");
    }
  });

  await t.step("round trips public-domain prose through Morse", async () => {
    const input = normalizeMorseText(MOBY_DICK_EXCERPT);
    const expected = normalizeWrappedText(MOBY_DICK_MORSE);
    const encoded = await executeUffdaSource(MorseLang, {
      entryRuleName: "Text",
      input: Input.Iterable(input),
    });
    assertEquals(encoded.kind, MatchKind.Ok);
    if (encoded.kind !== MatchKind.Ok) return;
    assertEquals(typeof encoded.value, "string");
    if (typeof encoded.value !== "string") return;
    assertEquals(encoded.value, expected);

    const decoded = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(encoded.value),
    });
    assertEquals(decoded.kind, MatchKind.Ok);
    if (decoded.kind === MatchKind.Ok) {
      assertEquals(decoded.value, input);
    }
  });

  await t.step("unsupported Morse input fails", async () => {
    const match = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(".-"),
    });
    assertEquals(match.kind, MatchKind.Fail);
  });
});
