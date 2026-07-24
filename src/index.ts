import type { HLJSApi } from "highlight.js";
import cypher from "./languages/cypher";
import myst from "./languages/myst";
import restructuredtext from "./languages/restructuredtext";

export { cypher, myst, restructuredtext };

/**
 * Register every grammar in this package on the given highlight.js instance,
 * under its canonical name (aliases are picked up from the grammars):
 *
 * - `restructuredtext` (aliases: `rst`, `rest`)
 * - `myst` (aliases: `mystmd`, `myst-markdown`)
 * - `cypher`
 */
export function registerLanguages(hljs: HLJSApi): void {
  hljs.registerLanguage("restructuredtext", restructuredtext);
  hljs.registerLanguage("myst", myst);
  hljs.registerLanguage("cypher", cypher);
}
