import { defineConfig } from "tsup";

const banner = `/*! highlightjs-langs | reStructuredText & MyST grammars for highlight.js | MIT | https://github.com/chrisjsewell/highlightjs-langs */`;

export default defineConfig([
  // Library builds (ESM + CJS + type declarations).
  {
    entry: {
      index: "src/index.ts",
      restructuredtext: "src/languages/restructuredtext.ts",
      myst: "src/languages/myst.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    target: "es2019",
    clean: true,
  },
  // Self-registering browser bundles (load after highlight.js itself).
  {
    entry: {
      restructuredtext: "src/browser/restructuredtext.ts",
      myst: "src/browser/myst.ts",
    },
    format: ["iife"],
    minify: true,
    target: "es2017",
    outExtension: () => ({ js: ".min.js" }),
    banner: { js: banner },
  },
]);
