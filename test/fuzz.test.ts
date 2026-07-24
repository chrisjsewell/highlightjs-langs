/**
 * Deterministic corpus fuzz: random documents are composed from adversarial
 * atoms plus fragments of the real markup fixtures, then highlighted with
 * every grammar under a per-case time budget and a well-formedness check.
 *
 * The generator is seeded, so failures reproduce exactly; the failure
 * message includes the case seed. Set FUZZ_CASES for deeper local runs
 * (default 100 per language).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js";
import { describe, expect, it } from "vitest";
import { registerLanguages } from "../src/index";

registerLanguages(hljs);

const ATOMS = [
  "`",
  "``",
  "```",
  "*",
  "**",
  "$",
  "$$",
  ":::",
  "----",
  "..",
  "::",
  ".. note::",
  ":key: value",
  "[^x]",
  "[x](y",
  "[x](y)",
  "|x|",
  "| ",
  "+++",
  "%",
  "---",
  ">>> ",
  "(a:B)-[:R]->(c)",
  "MATCH (n)",
  "$param",
  "{role}",
  "```{note}",
  "~~~",
  '"str"',
  "'s'",
  "//",
  "/*",
  "*/",
  "\\*",
  " ",
  "    ",
  "\t",
  "\n",
  "\n\n",
  "word",
  "a.b.c",
  "==== ====",
  "+--+--+",
];

// mulberry32 — tiny seeded PRNG, good enough for input shuffling.
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const markupRoot = fileURLToPath(new URL("./markup", import.meta.url));
const corpusLines: string[] = [];
for (const language of fs.readdirSync(markupRoot)) {
  const dir = path.join(markupRoot, language);
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".txt") && !file.endsWith(".expect.txt")) {
      corpusLines.push(
        ...fs.readFileSync(path.join(dir, file), "utf8").split("\n"),
      );
    }
  }
}

function generate(seed: number): string {
  const random = prng(seed);
  const parts: string[] = [];
  const pieces = 50 + Math.floor(random() * 400);
  for (let i = 0; i < pieces; i++) {
    if (random() < 0.4 && corpusLines.length > 0) {
      parts.push(corpusLines[Math.floor(random() * corpusLines.length)] ?? "");
      parts.push("\n");
    } else {
      const atom = ATOMS[Math.floor(random() * ATOMS.length)] ?? "";
      // occasionally repeat an atom hard, hunting quadratic behaviour
      parts.push(
        random() < 0.1 ? atom.repeat(1 + Math.floor(random() * 200)) : atom,
      );
    }
  }
  return parts.join("");
}

const CASES = Number(process.env.FUZZ_CASES ?? 100);
const BASE_SEED = 0xc0ffee;
const PER_CASE_BUDGET_MS = 1_000;

for (const language of ["restructuredtext", "myst", "cypher"]) {
  describe(`${language} fuzz`, () => {
    it(`survives ${CASES} seeded cases`, { timeout: 120_000 }, () => {
      for (let i = 0; i < CASES; i++) {
        const seed = BASE_SEED + i;
        const input = generate(seed);
        const start = performance.now();
        const value = hljs.highlight(input, { language }).value;
        const elapsed = performance.now() - start;
        expect(
          elapsed,
          `seed ${seed} (${input.length} chars) took ${Math.round(elapsed)}ms`,
        ).toBeLessThan(PER_CASE_BUDGET_MS);
        const opens = value.split("<span").length;
        const closes = value.split("</span>").length;
        expect(opens, `seed ${seed}: unbalanced spans`).toBe(closes);
      }
    });
  });
}
