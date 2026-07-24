# highlightjs-langs

[![CI](https://github.com/chrisjsewell/highlightjs-langs/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/chrisjsewell/highlightjs-langs/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/highlightjs-langs.svg)](https://www.npmjs.com/package/highlightjs-langs)

[highlight.js](https://highlightjs.org) grammars for **reStructuredText** and **MyST Markdown**,
distributed as a single npm package with per-language builds.

These are third-party grammars: highlight.js keeps everything except a core set of languages
outside the main library, and leaves them to be published separately. See the
[list of supported languages](https://highlightjs.readthedocs.io/en/latest/supported-languages.html)
for where third-party grammars live in the ecosystem.

## Languages

| Language          | class / aliases                     | import                                            | browser bundle                  |
| ----------------- | ----------------------------------- | ------------------------------------------------- | ------------------------------- |
| reStructuredText  | `restructuredtext`, `rst`, `rest`   | `highlightjs-langs/restructuredtext` (or `/rst`)  | `dist/restructuredtext.min.js`  |
| MyST Markdown     | `myst`, `mystmd`, `myst-markdown`   | `highlightjs-langs/myst`                           | `dist/myst.min.js`              |

## Usage — browser / CDN

Load highlight.js core first, then one or both self-registering language bundles, then highlight.
The `*.min.js` bundles register themselves on the global `hljs` — no extra wiring needed.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/highlight.min.js"></script>

<!-- Each bundle self-registers on the global `hljs`; load them AFTER highlight.js. -->
<script src="https://cdn.jsdelivr.net/npm/highlightjs-langs/dist/restructuredtext.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlightjs-langs/dist/myst.min.js"></script>

<script>
  hljs.highlightAll();
</script>
```

## Usage — Node / bundlers

ESM — register everything at once:

```js
import hljs from "highlight.js";
import { registerLanguages } from "highlightjs-langs";

registerLanguages(hljs);
```

ESM — register a single language:

```js
import hljs from "highlight.js";
import myst from "highlightjs-langs/myst";

hljs.registerLanguage("myst", myst);
```

CommonJS:

```js
const { restructuredtext, myst, registerLanguages } = require("highlightjs-langs");
// Note: deep-path requires need `.default`, e.g.
// const myst = require("highlightjs-langs/myst").default;
```

## What's highlighted

### reStructuredText

- Sections and their adornments, and transitions
- Directives: name, arguments and `:option:` fields
- Comments, including multi-line comments
- Hyperlink targets: named, anonymous and inline
- Footnotes and citations: both definitions and references
- Substitution definitions and references
- Roles, e.g. `:py:func:`
- Interpreted text and phrase references, including embedded URIs
- Inline markup: strong, emphasis, inline literals and backslash escapes
- Bullet and enumerated lists
- Field lists
- Literal blocks (introduced by `::`)
- Line blocks
- Doctest blocks (the Python is sub-highlighted)
- Grid and simple tables
- Bare URLs

### MyST Markdown

- The full CommonMark layer: headings, emphasis, code, links, block quotes, lists and inline HTML
- YAML front matter (sub-highlighted as YAML)
- `%` line comments
- `+++` block breaks
- `(target)=` labels
- ` ```{directive} ` / `~~~` / `:::` fences with options (`:key: value` and `---` YAML option blocks) and arbitrary nesting
- `{role}` syntax
- `{eval-rst}` bodies, highlighted as reStructuredText
- `{math}` bodies, highlighted as LaTeX
- Dollar math (`$` … `$` and `$$` … `$$`), including equation labels
- `amsmath` environments
- Footnotes

## Known limitations

Being upfront about what these grammars deliberately do *not* do:

- reStructuredText directive bodies and `.. code::` blocks are **not** sub-highlighted — the body
  language is only known dynamically at render time, which a static grammar cannot resolve.
- Postfix roles (`` `x`:role: ``) are not recognised; only the prefix form (`` :role:`x` ``) is.
- MyST front matter is detected heuristically. A mid-document `---` followed by a `key: value`
  line can be misread as front matter.
- Info-string languages on fenced code blocks are not sub-highlighted.
- MyST fence pairing is positional; the "the closing fence must be at least as long as the opening
  fence" rule is not enforced.

## Looking for other languages?

This package intentionally sticks to reStructuredText and MyST, and does not duplicate grammars
that already exist:

- **Cypher** — already available as [highlightjs-cypher](https://github.com/highlightjs/highlightjs-cypher).
- **Jinja** templates — covered by highlight.js core via the `django` grammar (alias `jinja`).
- **Twig** — covered by highlight.js core via the `twig` grammar.

## Demo

```bash
npm run build      # builds the dist/ bundles the demo loads
```

Then open [`demo/index.html`](demo/index.html) in a browser.

## Development

| Command                 | What it does                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm ci`                | Install exact dependencies from `package-lock.json`                       |
| `npm test`              | Run the vitest suite (markup fixtures + API/detection tests)             |
| `npm run test:update`   | Regenerate `test/markup/**/*.expect.txt` fixtures — then **review the diff** |
| `npm run typecheck`     | `tsc --noEmit`                                                            |
| `npm run lint`          | `biome check .`                                                          |
| `npm run build`         | Build `dist/` with tsup                                                   |

### Fixtures

Tests mirror highlight.js core's layout: `test/markup/<lang>/<name>.txt` is highlighted and compared
byte-for-byte against `<name>.expect.txt`. **The `*.expect.txt` files are the behavioural
specification of each grammar.** `npm run test:update` regenerates them — always review the diff
carefully, and never regenerate blindly.

### Git hooks

```bash
npx prek install
```

This installs the hooks configured in [`.pre-commit-config.yaml`](.pre-commit-config.yaml)
(formatting/lint via Biome, plus basic hygiene checks). [prek](https://github.com/j178/prek) is a
fast pre-commit reimplementation; plain `pre-commit` works too, and CI runs the same hooks.

## Releasing

1. Bump `version` in `package.json` and commit.
2. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

The [Release workflow](.github/workflows/release.yml) runs on the tag, verifies the tag matches
`package.json`, then builds and publishes to npm.

**First-ever publish** must use an `NPM_TOKEN` secret: npm cannot pre-configure trusted publishing
for a package that does not exist yet. Create a granular npm automation token, add it as the
repository secret `NPM_TOKEN`, and push the first tag. **After** that, configure the Trusted
Publisher on npmjs.com (package Settings → Trusted Publisher → GitHub Actions → user
`chrisjsewell`, repo `highlightjs-langs`, workflow `release.yml`) and delete the secret; subsequent
releases publish via OIDC with no long-lived credentials.

## License

[MIT](LICENSE).

The MyST CommonMark layer is adapted from highlight.js' own `markdown` grammar
(BSD-3-Clause, © Ivan Sagalaev and the highlight.js contributors).
