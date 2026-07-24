/**
 * Markup tests, mirroring highlight.js core's own test layout:
 * each `test/markup/<language>/<name>.txt` is highlighted with <language> and
 * compared byte-for-byte against `<name>.expect.txt`.
 *
 * Regenerate the expected files with `npm run test:update`, then review the
 * diff — the expected output is the specification of the grammar's behaviour.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js";
import { describe, expect, it } from "vitest";
import { registerLanguages } from "../src/index";

registerLanguages(hljs);

const markupRoot = fileURLToPath(new URL("./markup", import.meta.url));
const update = process.env.UPDATE_EXPECT === "1";

for (const language of fs.readdirSync(markupRoot).sort()) {
  describe(`${language} markup`, () => {
    const languageDir = path.join(markupRoot, language);
    const cases = fs
      .readdirSync(languageDir)
      .filter((f) => f.endsWith(".txt") && !f.endsWith(".expect.txt"))
      .sort();
    expect(cases.length).toBeGreaterThan(0);

    for (const file of cases) {
      it(file.replace(/\.txt$/, ""), () => {
        const code = fs.readFileSync(path.join(languageDir, file), "utf8");
        const actual = hljs.highlight(code, { language }).value;
        const expectFile = path.join(
          languageDir,
          file.replace(/\.txt$/, ".expect.txt"),
        );

        if (update || !fs.existsSync(expectFile)) {
          fs.writeFileSync(expectFile, actual);
          return;
        }
        const expected = fs.readFileSync(expectFile, "utf8");
        expect(actual).toBe(expected);
      });
    }
  });
}
