/**
 * Static ReDoS analysis: every regex in every grammar (begin/end/match/
 * illegal, keyword $patterns, and the concatenation highlight.js builds from
 * multi-part begin arrays) is checked with recheck, the automaton+fuzz
 * hybrid analyser also used by highlight.js core.
 *
 * A "vulnerable" verdict fails the suite. "unknown" (backreferences, or
 * analyser timeout) is tolerated — those patterns are covered by the
 * pathological-input timing tests in api.test.ts instead.
 */
import type { HLJSApi, Language, Mode } from "highlight.js";
import hljs from "highlight.js";
import { check } from "recheck";
import { describe, expect, it } from "vitest";
import cypher, { KEYWORDS as CYPHER_KEYWORDS } from "../src/languages/cypher";
import myst from "../src/languages/myst";
import restructuredtext from "../src/languages/restructuredtext";

type RegexLike = RegExp | string;

const regexSource = (re: RegexLike): string =>
  typeof re === "string" ? re : re.source;

/** Recursively collect every regex source in a language definition. */
function collectRegexes(language: Language): Map<string, string> {
  const found = new Map<string, string>();
  const visited = new Set<object>();

  const add = (re: RegexLike | undefined | null, path: string): void => {
    if (re === undefined || re === null) return;
    const src = regexSource(re);
    if (src && !found.has(src)) {
      found.set(src, path);
    }
  };

  const visit = (mode: Mode | "self", path: string): void => {
    if (typeof mode !== "object" || mode === null || visited.has(mode)) {
      return;
    }
    visited.add(mode);

    for (const key of ["begin", "end", "match"] as const) {
      const value = mode[key];
      if (Array.isArray(value)) {
        // highlight.js concatenates array parts into one capture-grouped
        // regex; only that joined form exists at runtime, so only it is
        // analysed (a part alone can look vulnerable while the joined
        // anchored form is not, and vice versa).
        add(
          value.map((part) => `(${regexSource(part)})`).join(""),
          `${path}.${key} (joined)`,
        );
      } else {
        add(value, `${path}.${key}`);
      }
    }
    const illegal = mode.illegal;
    if (Array.isArray(illegal)) {
      for (const [i, part] of illegal.entries()) {
        add(part, `${path}.illegal[${i}]`);
      }
    } else {
      add(illegal, `${path}.illegal`);
    }
    const keywords = mode.keywords;
    if (keywords && typeof keywords === "object" && "$pattern" in keywords) {
      add(keywords.$pattern as RegexLike, `${path}.$pattern`);
    }

    for (const [i, child] of (mode.contains ?? []).entries()) {
      visit(child, `${path}>${i}`);
    }
    for (const [i, variant] of (mode.variants ?? []).entries()) {
      visit(variant, `${path}~${i}`);
    }
    if (mode.starts) {
      visit(mode.starts, `${path}.starts`);
    }
  };

  visit(language as Mode, language.name ?? "root");
  return found;
}

const GRAMMARS: Array<{ name: string; fn: (h: HLJSApi) => Language }> = [
  { name: "restructuredtext", fn: restructuredtext },
  { name: "myst", fn: myst },
  { name: "cypher", fn: cypher },
];

// Patterns recheck flags that are accepted deliberately. Every entry needs a
// justification here and a covering timing test in api.test.ts.
const FENCE_JUSTIFICATION =
  "fenced-code pattern kept in parity with highlight.js core markdown; " +
  "backreference/lazy-scan shape that recheck can only fuzz; worst case " +
  "needs an unclosed-fence flood, covered by the api.test.ts timing suite";
const ALLOWLIST = new Map<string, string>([
  ["(`{3,})[^`](.|\\n)*?\\1`*[ ]*", FENCE_JUSTIFICATION],
  ["(~{3,})[^~](.|\\n)*?\\1~*[ ]*", FENCE_JUSTIFICATION],
  ["(`{3,})[^`\\n](.|\\n)*?\\1`*[ ]*", FENCE_JUSTIFICATION],
  ["(~{3,})[^~\\n](.|\\n)*?\\1~*[ ]*", FENCE_JUSTIFICATION],
  [
    "`{3}(?!`)[ \\t]*\\n(.|\\n)*?\\n`{3}(?!`)[ \\t]*(?=\\n|$)",
    FENCE_JUSTIFICATION,
  ],
  [
    "~{3}(?!~)[ \\t]*\\n(.|\\n)*?\\n~{3}(?!~)[ \\t]*(?=\\n|$)",
    FENCE_JUSTIFICATION,
  ],
  ["```+[ ]*$", FENCE_JUSTIFICATION],
  ["~~~+[ ]*$", FENCE_JUSTIFICATION],
  // Anchored (^ with m-flag) and fully length-bounded: recheck analyses the
  // pattern unanchored, but at runtime ^ restricts candidate positions to
  // line starts, and the quantifier bounds cap per-line work. Measured
  // linear: 200 KB pump inputs highlight in <20 ms (see the "target def
  // spaces" / "bracket line flood" timing cases in api.test.ts).
  [
    "(^[ \\t]*\\.\\.[ \\t]+)(_)(`[^`\\n]{1,200}`|[^:\\n]{0,200})(:)",
    "anchored per line and bounded; measured linear — see api.test.ts",
  ],
  [
    "^\\[[^\\n]{1,400}\\]:",
    "anchored per line and bounded; measured linear — see api.test.ts",
  ],
  [
    "\\b[A-Za-z0-9]\\w{0,60}(?:[.+-]\\w{1,60}){0,15}__?(?=[\\s.,;:!?)\\]\"']|$)",
    "segment- and length-bounded (≤16 backtrack points per position); " +
      "measured linear, 200 KB kebab pumps in <30 ms — see the 'kebab " +
      "segment flood' timing case in api.test.ts",
  ],
  [
    `(\\b(?!(?:${CYPHER_KEYWORDS.join("|")})\\()[A-Za-z_]\\w{0,60}(?:\\.\\w{1,60}){0,6})(\\()`,
    "zero-width keyword lookahead over a fixed alternation plus bounded " +
      "segments — constant work per position; measured linear to 800 KB " +
      "(cost is span emission) — see the 'keyword paren flood' timing case " +
      "in api.test.ts",
  ],
]);

for (const { name, fn } of GRAMMARS) {
  describe(`${name} regexes are ReDoS-safe`, () => {
    const language = fn(hljs);
    const flags = `m${language.case_insensitive ? "i" : ""}`;
    const regexes = collectRegexes(language);

    it("collected a plausible number of regexes", () => {
      expect(regexes.size).toBeGreaterThan(5);
    });

    for (const [source, path] of regexes) {
      const label = `${path}: /${source.length > 70 ? `${source.slice(0, 70)}…` : source}/`;
      it(label, { timeout: 20_000 }, async () => {
        if (ALLOWLIST.has(source)) {
          return;
        }
        const diagnostics = await check(source, flags, { timeout: 10_000 });
        if (diagnostics.status === "vulnerable") {
          const summary = diagnostics.complexity?.summary ?? "vulnerable";
          const attack =
            "attack" in diagnostics
              ? JSON.stringify(diagnostics.attack).slice(0, 200)
              : "";
          expect.fail(`${path} /${source}/ is ${summary} ${attack}`);
        }
        expect(["safe", "unknown"]).toContain(diagnostics.status);
      });
    }
  });
}
