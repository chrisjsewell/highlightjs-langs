import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js";
import { describe, expect, it } from "vitest";
import {
  cypher,
  myst,
  registerLanguages,
  restructuredtext,
} from "../src/index";

registerLanguages(hljs);

describe("registration", () => {
  it("registers restructuredtext with its aliases", () => {
    expect(hljs.getLanguage("restructuredtext")?.name).toBe("reStructuredText");
    expect(hljs.getLanguage("rst")?.name).toBe("reStructuredText");
    expect(hljs.getLanguage("rest")?.name).toBe("reStructuredText");
  });

  it("registers myst with its aliases", () => {
    expect(hljs.getLanguage("myst")?.name).toBe("MyST");
    expect(hljs.getLanguage("mystmd")?.name).toBe("MyST");
    expect(hljs.getLanguage("myst-markdown")?.name).toBe("MyST");
  });

  it("registers cypher", () => {
    expect(hljs.getLanguage("cypher")?.name).toBe("Cypher");
  });

  it("exposes the raw grammar functions", () => {
    expect(restructuredtext(hljs).name).toBe("reStructuredText");
    expect(myst(hljs).name).toBe("MyST");
    expect(cypher(hljs).name).toBe("Cypher");
  });
});

describe("auto-detection", () => {
  const detectRoot = fileURLToPath(new URL("./detect", import.meta.url));
  for (const language of fs.readdirSync(detectRoot).sort()) {
    it(`detects ${language}`, () => {
      const sample = fs.readFileSync(
        path.join(detectRoot, language, "default.txt"),
        "utf8",
      );
      const result = hljs.highlightAuto(sample);
      expect(result.language).toBe(language);
    });
  }
});

describe("pathological inputs complete quickly", () => {
  const inputs: Record<string, string> = {
    "unbalanced backticks": "`".repeat(20_000),
    "unbalanced strong": "**a ".repeat(5_000),
    "dollar runs": "$".repeat(10_000),
    "bracket runs": "[".repeat(5_000) + "]".repeat(5_000),
    "pipe table": `${"| a ".repeat(200)}|\n`.repeat(100),
    "directive spam": "```{note}\n".repeat(500),
    "adornment spam": "===\n".repeat(2_000),
    "long single line": `text ${"=".repeat(50_000)} text`,
    "role colon flood": ":a".repeat(50_000),
    "citation bracket flood": "[a".repeat(50_000),
    "dotted name flood": "a.".repeat(50_000),
    "footnote caret flood": "[^a".repeat(33_000),
    "unclosed link flood": "[a](b".repeat(2_000),
    "space flood": " ".repeat(80_000),
    "comma space flood": " ,".repeat(40_000),
    "paren flood": "a(".repeat(20_000),
    "unclosed fence flood": "```x\n".repeat(3_000),
    "block comment spaces": `/* ${" ".repeat(80_000)}`,
    "target def spaces": `.. ${" ".repeat(80_000)}x`,
    "bracket line flood": `[${"a".repeat(200)}]x\n`.repeat(400),
    "kebab segment flood": "a-".repeat(40_000),
    "keyword paren flood": "match(".repeat(15_000),
    "dotted call flood": "a.a(".repeat(20_000),
  };

  for (const [name, input] of Object.entries(inputs)) {
    for (const language of ["restructuredtext", "myst", "cypher"]) {
      it(`${language}: ${name}`, () => {
        const start = performance.now();
        const result = hljs.highlight(input, { language });
        expect(result.value).toBeTypeOf("string");
        expect(performance.now() - start).toBeLessThan(2_000);
      });
    }
  }
});
