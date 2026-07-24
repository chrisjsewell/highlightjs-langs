import type { HLJSApi } from "highlight.js";
import restructuredtext from "../languages/restructuredtext";

const hljs = (globalThis as { hljs?: HLJSApi }).hljs;
if (hljs?.registerLanguage) {
  hljs.registerLanguage("restructuredtext", restructuredtext);
} else {
  // biome-ignore lint/suspicious/noConsole: the only way to signal a setup error in a plain <script> include
  console.error(
    "highlightjs-langs: global 'hljs' not found; load highlight.js before restructuredtext.min.js",
  );
}
