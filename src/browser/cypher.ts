import type { HLJSApi } from "highlight.js";
import cypher from "../languages/cypher";

const hljs = (globalThis as { hljs?: HLJSApi }).hljs;
if (hljs?.registerLanguage) {
  hljs.registerLanguage("cypher", cypher);
} else {
  // biome-ignore lint/suspicious/noConsole: the only way to signal a setup error in a plain <script> include
  console.error(
    "highlightjs-langs: global 'hljs' not found; load highlight.js before cypher.min.js",
  );
}
