/*
Language: reStructuredText
Author: Chris Sewell
Description: reStructuredText (RST) markup, as used by Docutils and Sphinx
Website: https://docutils.sourceforge.io/rst.html
Category: markup
*/
import type { HLJSApi, Language, Mode } from "highlight.js";

/**
 * Grammar notes
 * -------------
 * reStructuredText is context-sensitive (e.g. a section title is defined by the
 * adornment line *below* it), which a lexer-style highlighter cannot fully
 * capture. This grammar takes the same pragmatic approach as the Pygments RST
 * lexer: recognise constructs from local patterns, favouring lookahead (never
 * lookbehind, per highlight.js browser-support policy).
 *
 * Known simplifications:
 * - Directive bodies are not parsed as nested RST, and `.. code::` bodies are
 *   not sub-highlighted (the target language is only known dynamically).
 * - Postfix roles (`text`:role:) are not recognised.
 * - A section adornment may be any run of the same punctuation character; we
 *   accept mixed punctuation runs to avoid backreferences.
 */
export default function restructuredtext(hljs: HLJSApi): Language {
  // Any ASCII punctuation, the character set allowed for section adornments.
  const ADORNMENT_CHAR = /[!-/:-@[-`{-~]/;

  // `.. |name| replace:: value`
  const SUBSTITUTION_DEF: Mode = {
    begin: [/^[ \t]*\.\.[ \t]+/, /\|[^|\n]+\|/, /[ \t]+/, /[\w.+-]+(?::[\w.+-]+)*/, /::/],
    beginScope: { 1: "punctuation", 2: "template-variable", 4: "keyword", 5: "punctuation" },
    starts: {
      end: /$/,
      contains: [{ scope: "string", match: /[^\n]+/ }],
    },
    relevance: 5,
  };

  // `.. [1]`, `.. [#label]`, `.. [*]`, `.. [citation]`
  const FOOTNOTE_DEF: Mode = {
    begin: [/^[ \t]*\.\.[ \t]+/, /\[(?:\d+|#[\w.+-]*|\*|[^\]\s]+)\]/],
    beginScope: { 1: "punctuation", 2: "symbol" },
    relevance: 2,
  };

  // `.. _name: url`, `.. _\`phrase name\`: url`, `.. __: url`
  const TARGET_DEF: Mode = {
    begin: [/^[ \t]*\.\.[ \t]+/, /_/, /`[^`\n]+`|[^:\n]*/, /:/],
    beginScope: { 1: "punctuation", 2: "symbol", 3: "symbol", 4: "punctuation" },
    starts: {
      end: /$/,
      contains: [{ scope: "link", match: /[^\n]+/ }],
    },
    relevance: 2,
  };

  // `.. directive-name:: arguments`
  const DIRECTIVE: Mode = {
    begin: [/^[ \t]*\.\.[ \t]+/, /[\w.+-]+(?::[\w.+-]+)*/, /::/],
    beginScope: { 1: "punctuation", 2: "keyword", 3: "punctuation" },
    starts: {
      end: /$/,
      contains: [{ scope: "string", match: /[^\n]+/ }],
    },
    relevance: 5,
  };

  // `.. anything else` — a comment, including its indented continuation block.
  const COMMENT: Mode = {
    scope: "comment",
    begin: /^[ \t]*\.\.(?=[ \t]+\S)/,
    starts: {
      scope: "comment",
      end: /^(?=\S)/,
    },
    relevance: 0,
  };

  // An "empty comment" (`..` alone) does not consume the following block.
  const EMPTY_COMMENT: Mode = {
    scope: "comment",
    match: /^[ \t]*\.\.[ \t]*$/,
    relevance: 0,
  };

  // `__ url` — anonymous hyperlink target shorthand.
  const ANONYMOUS_TARGET: Mode = {
    begin: [/^__/, /[ \t]+/],
    beginScope: { 1: "symbol" },
    starts: {
      end: /$/,
      contains: [{ scope: "link", match: /[^\n]+/ }],
    },
    relevance: 0,
  };

  // `:field name: value` — field lists (docinfo, directive options).
  const FIELD: Mode = {
    scope: "attr",
    match: /^[ \t]*:(?!:)[^:\n]+:(?=[ \t]|$)/,
    relevance: 0,
  };

  // `>>> code` / `... code` doctest lines, highlighted as Python.
  const DOCTEST: Mode = {
    scope: "meta.prompt",
    starts: {
      end: /$/,
      subLanguage: "python",
    },
    variants: [{ begin: /^>{3}(?=[ \t])/ }, { begin: /^\.{3}(?=[ \t])/ }],
    relevance: 2,
  };

  // Grid table border: `+-----+-----+` or `+=====+=====+`
  const GRID_TABLE_LINE: Mode = {
    scope: "punctuation",
    match: /^[ \t]*\+(?:[-=]+\+)+[ \t]*$/,
    relevance: 2,
  };

  // Simple table border: `======  =====` (two or more column runs)
  const SIMPLE_TABLE_LINE: Mode = {
    scope: "punctuation",
    match: /^[ \t]*[=-]+(?:[ \t]+[=-]+)+[ \t]*$/,
    relevance: 2,
  };

  // A paragraph line directly followed by an adornment line is a section
  // title. Lines starting with `|` or `+` are excluded so grid-table rows are
  // not mistaken for titles.
  const SECTION_TITLE: Mode = {
    scope: "section",
    begin: hljs.regex.concat(
      /^[ \t]*[^\s|+.].*/,
      "(?=\\n",
      ADORNMENT_CHAR,
      "{2,}[ \\t]*$)",
    ),
    relevance: 0,
  };

  // Adornment (section over/underline) or transition line.
  const ADORNMENT: Mode = {
    scope: "section",
    match: hljs.regex.concat("^", ADORNMENT_CHAR, "{2,}[ \\t]*$"),
    relevance: 0,
  };

  // A paragraph ending in `::` (or `::` alone) introduces an indented literal
  // block, which extends until the next non-indented line.
  const LITERAL_BLOCK: Mode = {
    scope: "punctuation",
    begin: /::[ \t]*$/,
    starts: {
      scope: "code",
      end: /^(?=\S)/,
    },
    relevance: 0,
  };

  // Line blocks (`| line`) and grid-table cell separators.
  const PIPE: Mode = {
    scope: "punctuation",
    match: /\|(?=[ \t]|$)/,
    relevance: 0,
  };

  const BULLET: Mode = {
    scope: "bullet",
    match: /^[ \t]*[-+*•‣⁃](?=[ \t])/,
    relevance: 0,
  };

  const ENUMERATOR: Mode = {
    scope: "bullet",
    match:
      /^[ \t]*(?:(?:\d+|#|[A-Za-z]|[ivxlcdm]+|[IVXLCDM]+)[.)]|\((?:\d+|#|[A-Za-z]|[ivxlcdm]+|[IVXLCDM]+)\))(?=[ \t])/,
    relevance: 0,
  };

  // Backslash-escaped punctuation, e.g. \* — prevents markup recognition.
  const ESCAPE: Mode = {
    scope: "char.escape",
    match: /\\[!-/:-@[-`{|}~]/,
    relevance: 0,
  };

  // ``inline literal``
  const INLINE_LITERAL: Mode = {
    scope: "code",
    begin: /``/,
    end: /``|(?=\n[ \t]*\n)/,
    relevance: 0,
  };

  // `:role:` or `:domain:role:` immediately before interpreted text.
  const ROLE: Mode = {
    scope: "keyword",
    match: /:[\w+.-]+(?::[\w+.-]+)*:(?=`)/,
    relevance: 2,
  };

  // Inline internal target: _`target name`
  const INTERNAL_TARGET: Mode = {
    scope: "symbol",
    begin: /_`(?!`)/,
    end: /`/,
    relevance: 2,
  };

  // Interpreted text and phrase references: `text`, `text`_, `text <url>`_
  const INTERPRETED: Mode = {
    scope: "string",
    begin: /`(?!`)/,
    end: /`_{0,2}|(?=\n[ \t]*\n)/,
    contains: [{ scope: "link", match: /<[^<>\n]+>(?=`)/ }],
    relevance: 0,
  };

  // |substitution| and |substitution|_ references.
  const SUBSTITUTION_REF: Mode = {
    scope: "template-variable",
    match: /\|[^|\s]+\|_{0,2}/,
    relevance: 0,
  };

  // [1]_, [#]_, [*]_, [citation]_ references.
  const FOOTNOTE_REF: Mode = {
    scope: "symbol",
    match: /\[(?:\d+|#[\w.+-]*|\*|[^\]\s]+)\]_/,
    relevance: 1,
  };

  // Standalone references: name_, name__
  const STANDALONE_REF: Mode = {
    scope: "symbol",
    match: /\b[A-Za-z0-9][\w.+-]*__?(?=[\s.,;:!?)\]"']|$)/,
    relevance: 0,
  };

  const STRONG: Mode = {
    scope: "strong",
    begin: /\*\*(?=\S)/,
    end: /\*\*|(?=\n[ \t]*\n)/,
    relevance: 0,
  };

  const EMPHASIS: Mode = {
    scope: "emphasis",
    begin: /\*(?![\s*])/,
    end: /\*|(?=\n[ \t]*\n)/,
    relevance: 0,
  };

  const URL: Mode = {
    scope: "link",
    match: /\bhttps?:\/\/[^\s<>`]+/,
    relevance: 0,
  };

  return {
    name: "reStructuredText",
    aliases: ["rst", "rest"],
    contains: [
      SUBSTITUTION_DEF,
      FOOTNOTE_DEF,
      TARGET_DEF,
      DIRECTIVE,
      COMMENT,
      EMPTY_COMMENT,
      ANONYMOUS_TARGET,
      FIELD,
      DOCTEST,
      GRID_TABLE_LINE,
      SIMPLE_TABLE_LINE,
      LITERAL_BLOCK,
      SECTION_TITLE,
      ADORNMENT,
      PIPE,
      BULLET,
      ENUMERATOR,
      ESCAPE,
      INLINE_LITERAL,
      ROLE,
      INTERNAL_TARGET,
      INTERPRETED,
      SUBSTITUTION_REF,
      FOOTNOTE_REF,
      STANDALONE_REF,
      STRONG,
      EMPHASIS,
      URL,
    ],
  };
}
