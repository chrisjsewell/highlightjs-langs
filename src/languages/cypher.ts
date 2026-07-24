/*
Language: Cypher
Author: Chris Sewell
Description: Cypher graph query language (Neo4j, openCypher)
Website: https://opencypher.org
Category: database
*/
import type { HLJSApi, Language, Mode } from "highlight.js";

/**
 * Grammar notes
 * -------------
 * Derived from `highlightjs-cypher` (CC0-1.0, by Johannes Wienke and
 * contributors), rewritten for this package:
 *
 * - The original's function-call prefix `(\s+|,)name(` backtracked
 *   quadratically (a degenerate 80 KB whitespace line took ~14 s). The call
 *   operator must directly follow the name, so the prefix is simply dropped.
 * - The keyword `$pattern` used lookbehind, which highlight.js bans for
 *   Safari compatibility; dots in the token pattern achieve the same
 *   "don't highlight `x.create` as a keyword" effect without it.
 * - `functionCall` (a scope no theme styles) is replaced with the documented
 *   `title.function.invoke`, applied to every called function rather than
 *   only a hard-coded built-in list.
 */
export default function cypher(hljs: HLJSApi): Language {
  // `name(` — called functions, including namespaced ones like db.labels(.
  // Segment-locked shape: a flat [\w.]* tail followed by the required paren
  // backtracks quadratically on "a.a.a…" floods, whereas dot-separated
  // segments leave at most a handful of backtrack points per position.
  const FUNCTION_CALL: Mode = {
    begin: [/\b[A-Za-z_]\w{0,60}(?:\.\w{1,60}){0,6}/, /\(/],
    beginScope: { 1: "title.function.invoke", 2: "punctuation" },
    relevance: 0,
  };

  // $param, $`weird param`
  const PARAMETER: Mode = {
    scope: "variable",
    match: /\$(?:[A-Za-z_]\w*|`[^`\n]+`)/,
    relevance: 0,
  };

  // Node labels and relationship types: (n:Person), -[r:KNOWS], :`odd one`
  const LABEL: Mode = {
    begin: [/:/, /[A-Za-z_]\w*|`[^`\n]+`/],
    beginScope: { 1: "punctuation", 2: "type" },
    relevance: 0,
  };

  // `escaped identifiers` — closed at end of line if unterminated.
  const BACKTICK_NAME: Mode = {
    scope: "symbol",
    begin: /`/,
    end: /`|(?=\n)/,
    relevance: 0,
  };

  // Relationship-pattern arrows, the visual signature of Cypher.
  const REL_ARROW: Mode = {
    scope: "operator",
    variants: [
      { match: /<-\[|\]->/, relevance: 3 },
      { match: /-\[|\]-|-->|<--/, relevance: 0 },
    ],
  };

  return {
    name: "Cypher",
    case_insensitive: true,
    keywords: {
      // Dots inside tokens keep property accesses like `a.create` from
      // matching the bare keyword `create`.
      $pattern: "[\\w.]+",
      keyword: [
        "as",
        "asc",
        "ascending",
        "and",
        "assert",
        "by",
        "call",
        "case",
        "commit",
        "constraint",
        "create",
        "csv",
        "cypher",
        "delete",
        "desc",
        "descending",
        "detach",
        "distinct",
        "drop",
        "else",
        "end",
        "ends",
        "explain",
        "fieldterminator",
        "for",
        "foreach",
        "from",
        "headers",
        "in",
        "index",
        "is",
        "join",
        "limit",
        "load",
        "match",
        "merge",
        "nodetach",
        "not",
        "on",
        "optional",
        "or",
        "order",
        "periodic",
        "profile",
        "remove",
        "return",
        "scan",
        "set",
        "skip",
        "start",
        "starts",
        "then",
        "union",
        "unique",
        "unwind",
        "use",
        "using",
        "when",
        "where",
        "with",
        "xor",
        "yield",
      ],
      literal: ["true", "false", "null"],
    },
    contains: [
      // Plain comment modes rather than hljs.C_LINE/BLOCK_COMMENT_MODE: the
      // stock COMMENT factory embeds English-prose and TODO-doctag submodes
      // whose regexes backtrack polynomially on whitespace floods.
      { scope: "comment", begin: /\/\//, end: /$/, relevance: 0 },
      { scope: "comment", begin: /\/\*/, end: /\*\//, relevance: 0 },
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      BACKTICK_NAME,
      hljs.C_NUMBER_MODE,
      PARAMETER,
      REL_ARROW,
      LABEL,
      FUNCTION_CALL,
    ],
  };
}
