import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js";
import { describe, expect, it } from "vitest";
import { myst, registerLanguages, restructuredtext } from "../src/index";

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

  it("exposes the raw grammar functions", () => {
    expect(restructuredtext(hljs).name).toBe("reStructuredText");
    expect(myst(hljs).name).toBe("MyST");
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
  };

  for (const [name, input] of Object.entries(inputs)) {
    for (const language of ["restructuredtext", "myst"]) {
      it(`${language}: ${name}`, () => {
        const start = performance.now();
        const result = hljs.highlight(input, { language });
        expect(result.value).toBeTypeOf("string");
        expect(performance.now() - start).toBeLessThan(2_000);
      });
    }
  }
});
