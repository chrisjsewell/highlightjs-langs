# AGENTS.md

Guidance for agents and human contributors working in this repository.

## Purpose

`highlightjs-langs` is an npm package providing third-party [highlight.js](https://highlightjs.org)
grammars for **reStructuredText** (aliases `rst`, `rest`), **MyST Markdown** (aliases `mystmd`,
`myst-markdown`) and **Cypher**, written in TypeScript. It ships ESM + CJS library builds,
TypeScript declarations, and self-registering browser bundles, all produced by tsup.

## Repository map

| Path                     | Contents                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| `src/languages/*.ts`     | The grammar definitions (`restructuredtext.ts`, `myst.ts`, `cypher.ts`)     |
| `src/browser/*.ts`       | Self-registering wrappers that call `hljs.registerLanguage` on the global  |
| `src/index.ts`           | Named exports (`restructuredtext`, `myst`, `registerLanguages`)            |
| `test/markup.test.ts`    | Markup harness: highlights `test/markup/<lang>/<name>.txt` vs `.expect.txt` |
| `test/markup/`           | Markup fixtures (input `.txt` + byte-exact `.expect.txt`)                   |
| `test/api.test.ts`       | Registration, auto-detection and pathological-input tests                  |
| `test/regex-safety.test.ts` | recheck ReDoS scan of every grammar regex (with justified allowlist)     |
| `test/fuzz.test.ts`      | Seeded corpus fuzzing with time budgets                                     |
| `test/detect/`           | Auto-detection samples (`<lang>/default.txt`)                              |
| `demo/`                  | Static demo page loading the built bundles                                  |
| `.github/workflows/`     | `ci.yml` (lint / typecheck / test) and `release.yml` (tag → npm)          |

## Commands

| Command                 | What it does                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm ci`                | Install exact dependencies from `package-lock.json`                       |
| `npm test`              | Run the vitest suite (markup fixtures + API/detection tests)             |
| `npm run test:update`   | Regenerate `test/markup/**/*.expect.txt` fixtures — then **review the diff** |
| `npm run typecheck`     | `tsc --noEmit`                                                            |
| `npm run lint`          | `biome check .`                                                          |
| `npm run build`         | Build `dist/` with tsup                                                   |

## Grammar authoring rules

- **Use only documented highlight.js scopes.** Stick to the names in the
  [CSS classes reference](https://highlightjs.readthedocs.io/en/latest/css-classes-reference.html);
  inventing scopes produces classes that no theme styles.
- **Never use regex lookbehind.** highlight.js targets Safari, which historically lacks lookbehind
  support, so it is banned by policy. Lookahead is fine.
- **Avoid catastrophic backtracking.** Prefer bounded quantifiers; do not nest unbounded groups
  (no `(a+)+` shapes). Pathological-input timing tests live in `test/api.test.ts` — keep them green.
- **Every regex is ReDoS-scanned.** `test/regex-safety.test.ts` runs recheck over all grammar
  regexes; a "vulnerable" verdict fails CI. Additions to its allowlist need a written
  justification plus a covering timing test. `test/fuzz.test.ts` fuzzes seeded random documents.
- **Mode order matters.** Inside a `contains` array, the order of modes breaks ties when several
  match at the same position: earlier modes win. Reorder deliberately, not by accident.
- **Keep `relevance` conventions.** Use `relevance: 0` for patterns common to many languages, and
  around `relevance: 5` for signature constructs that strongly identify the language.

## Fixture workflow

The `*.expect.txt` files are the behavioural specification of each grammar. `npm run test:update`
(which sets `UPDATE_EXPECT=1`) regenerates them from current output. **Always review the resulting
diff** — a change there is a change in grammar behaviour. Never regenerate blindly.

## Commit and PR titles

Start every commit-message summary and PR title with an emoji marking the change type — just
the emoji, no `NEW:`-style keyword text (adapted from the
[MyST-Parser convention](https://github.com/executablebooks/MyST-Parser/blob/master/AGENTS.md#commit-message-format)):

| Emoji | Change type                              |
| ----- | ---------------------------------------- |
| ✨    | New feature                              |
| 🐛    | Bug fix                                  |
| 👌    | Improvement (no breaking changes)        |
| ‼️    | Breaking change                          |
| 📚    | Documentation                            |
| 🔧    | Maintenance (tooling, config, typos)     |
| 🧪    | Tests or CI changes only                 |
| ♻️    | Refactoring                              |
| ⬆️    | Dependency upgrade (Dependabot uses this) |

Keep the summary at 72 characters or fewer, and add a body when the change needs context.

## Release process

Bump `version` in `package.json`, commit, then tag and push `vX.Y.Z`. Pushing the tag triggers
`.github/workflows/release.yml`, which checks the tag matches `package.json`, builds, and publishes
to npm (via OIDC trusted publishing, or an `NPM_TOKEN` secret for the first-ever publish).

---

CLAUDE.md is a symlink to this file — edit AGENTS.md only.
