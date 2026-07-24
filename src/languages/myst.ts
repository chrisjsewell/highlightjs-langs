/*
Language: MyST
Author: Chris Sewell
Description: MyST Markdown (Markedly Structured Text) — CommonMark plus Sphinx-compatible roles, directives and targets
Website: https://myst-parser.readthedocs.io
Category: markup
*/
import type { HLJSApi, Language, Mode } from "highlight.js";

/**
 * Grammar notes
 * -------------
 * The CommonMark layer is adapted from highlight.js' own markdown grammar
 * (BSD-3-Clause, Copyright (c) 2006 Ivan Sagalaev and highlight.js
 * contributors). The MyST layer follows the tokenisation choices of the
 * Pygments `MystLexer` shipped with MyST-Parser and of the vscode-myst-syntax
 * TextMate grammar.
 *
 * Known simplifications:
 * - YAML front matter cannot be anchored to the first line (highlight.js
 *   matches patterns at any position), so it is recognised heuristically: a
 *   `---` line whose next line looks like a YAML key. A mid-document thematic
 *   break directly followed by a `key: value`-looking paragraph will be
 *   misread as front matter.
 * - Fenced-code and `{code-*}` directive bodies are not sub-highlighted: the
 *   embedded language is only known dynamically from the fence info string.
 * - Fence pairing is positional (innermost-first); the MyST rule that an outer
 *   fence must be strictly longer than inner fences is not enforced, except
 *   that bare inner fences pair only at exactly three characters.
 * - Inline-markup word-adjacency rules are not enforced (`a**b**c` bolds, as
 *   in the core markdown grammar).
 */
export default function myst(hljs: HLJSApi): Language {
  const DIRECTIVE_NAME = /[\w:+.-]+/;

  // ---------------------------------------------------------------------
  // CommonMark layer (adapted from highlight.js markdown)
  // ---------------------------------------------------------------------
  const INLINE_HTML: Mode = {
    begin: /<\/?[A-Za-z_]/,
    end: ">",
    subLanguage: "xml",
    relevance: 0,
  };
  const HORIZONTAL_RULE: Mode = {
    begin: "^[-\\*]{3,}",
    end: "$",
    relevance: 0,
  };
  const CODE: Mode = {
    scope: "code",
    variants: [
      // fenced blocks with a matching-length closing fence
      { begin: "(`{3,})[^`](.|\\n)*?\\1`*[ ]*" },
      { begin: "(~{3,})[^~](.|\\n)*?\\1~*[ ]*" },
      // unclosed fences (needed when markdown is itself a sublanguage)
      { begin: "```", end: "```+[ ]*$" },
      { begin: "~~~", end: "~~~+[ ]*$" },
      // inline code span
      { begin: "`.+?`" },
      // indented code block
      {
        begin: "(?=^( {4}|\\t))",
        contains: [{ begin: "^( {4}|\\t)", end: "(\\n)$" }],
        relevance: 0,
      },
    ],
    relevance: 0,
  };
  const LIST: Mode = {
    scope: "bullet",
    begin: "^[ \t]*([*+-]|(\\d+\\.))(?=\\s+)",
    end: "\\s+",
    excludeEnd: true,
    relevance: 0,
  };
  const LINK_REFERENCE: Mode = {
    begin: /^\[[^\n]{1,400}\]:/,
    returnBegin: true,
    contains: [
      {
        scope: "symbol",
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
      },
      {
        scope: "link",
        begin: /:\s*/,
        end: /$/,
        excludeBegin: true,
      },
    ],
    relevance: 0,
  };
  const URL_SCHEME = /[A-Za-z][A-Za-z0-9+.-]*/;
  // Deviation from core markdown: labels and destinations use bounded,
  // bracket-free character classes instead of `.+?`/`.*?`. The generic core
  // variants backtrack catastrophically on unclosed-link floods such as
  // "[a](b" repeated (cubic — seconds of work from a 10 KB input).
  const LINK_LABEL = /\[[^[\]\n]{0,399}\]/;
  const LINK: Mode = {
    variants: [
      {
        begin: hljs.regex.concat(LINK_LABEL, /\[[^[\]\n]{0,399}\]/),
        relevance: 0,
      },
      {
        begin: hljs.regex.concat(
          LINK_LABEL,
          /\(((data|javascript|mailto):|(?:http|ftp)s?:\/\/)[^()\n]{0,399}\)/,
        ),
        relevance: 2,
      },
      {
        begin: hljs.regex.concat(
          LINK_LABEL,
          /\(/,
          URL_SCHEME,
          /:\/\/[^()\n]{0,399}\)/,
        ),
        relevance: 2,
      },
      {
        begin: hljs.regex.concat(LINK_LABEL, /\([./?&#][^()\n]{0,399}\)/),
        relevance: 1,
      },
      {
        begin: hljs.regex.concat(LINK_LABEL, /\([^()\n]{0,399}\)/),
        relevance: 0,
      },
    ],
    returnBegin: true,
    contains: [
      { match: /\[(?=\])/ },
      {
        scope: "string",
        relevance: 0,
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        returnEnd: true,
      },
      {
        scope: "link",
        relevance: 0,
        begin: /\]\(/,
        end: /\)/,
        excludeBegin: true,
        excludeEnd: true,
      },
      {
        scope: "symbol",
        relevance: 0,
        begin: /\]\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
      },
    ],
  };
  const BOLD: Mode = {
    scope: "strong",
    contains: [], // populated below
    variants: [
      { begin: /_{2}(?!\s)/, end: /_{2}/ },
      { begin: /\*{2}(?!\s)/, end: /\*{2}/ },
    ],
  };
  const ITALIC: Mode = {
    scope: "emphasis",
    contains: [], // populated below
    variants: [
      { begin: /\*(?![*\s])/, end: /\*/ },
      { begin: /_(?![_\s])/, end: /_/, relevance: 0 },
    ],
  };
  const BOLD_WITHOUT_ITALIC = hljs.inherit(BOLD, { contains: [] });
  const ITALIC_WITHOUT_BOLD = hljs.inherit(ITALIC, { contains: [] });
  BOLD.contains?.push(ITALIC_WITHOUT_BOLD);
  ITALIC.contains?.push(BOLD_WITHOUT_ITALIC);
  const ENTITY: Mode = {
    scope: "literal",
    match: /&([a-zA-Z0-9]+|#[0-9]{1,7}|#[Xx][0-9a-fA-F]{1,6});/,
    relevance: 0,
  };

  // ---------------------------------------------------------------------
  // MyST layer
  // ---------------------------------------------------------------------

  // Backslash-escaped ASCII punctuation (CommonMark), e.g. \*
  const ESCAPE: Mode = {
    scope: "char.escape",
    match: /\\[!-/:-@[-`{|}~]/,
    relevance: 0,
  };

  // `{role-name}` immediately before a backtick span, e.g. {py:func}`open`
  const ROLE: Mode = {
    begin: [/\{/, DIRECTIVE_NAME, /\}/, /(?=`)/],
    beginScope: { 1: "punctuation", 2: "keyword", 3: "punctuation" },
    relevance: 2,
  };

  // $inline math$ — closed at end of line if unbalanced.
  const MATH_INLINE: Mode = {
    scope: "formula",
    begin: /\$(?![\s$])/,
    end: /\$|(?=\n)/,
    relevance: 0,
  };

  // [^label] footnote reference / definition. Labels are word characters and
  // hyphens, length-bounded so that failed matches on "[^" floods stay cheap.
  const FOOTNOTE_REF: Mode = {
    scope: "symbol",
    match: /\[\^[\w-]{1,60}\]/,
    relevance: 0,
  };
  const FOOTNOTE_DEF: Mode = {
    scope: "symbol",
    match: /^\[\^[\w-]{1,60}\]:/,
  };

  const CONTAINABLE: Mode[] = [
    ESCAPE,
    INLINE_HTML,
    LINK,
    ROLE,
    MATH_INLINE,
    FOOTNOTE_REF,
  ];
  for (const m of [BOLD, ITALIC, BOLD_WITHOUT_ITALIC, ITALIC_WITHOUT_BOLD]) {
    m.contains = (m.contains ?? []).concat(CONTAINABLE);
  }
  const INLINE_MODES: Mode[] = CONTAINABLE.concat(BOLD, ITALIC);

  const HEADER: Mode = {
    scope: "section",
    variants: [
      { begin: "^#{1,6}", end: "$", contains: INLINE_MODES },
      {
        begin: "(?=^.+?\\n[=-]{2,}$)",
        contains: [
          { begin: "^[=-]*$" },
          { begin: "^", end: "\\n", contains: INLINE_MODES },
        ],
      },
    ],
  };

  const BLOCKQUOTE: Mode = {
    scope: "quote",
    begin: "^>\\s+",
    contains: INLINE_MODES,
    end: "$",
  };

  // YAML front matter. highlight.js cannot anchor to the document start, so
  // require the following line to look like a YAML mapping key.
  const FRONT_MATTER: Mode = {
    begin: [/^---[ \t]*/, /\n/, /(?=[\w"'-][^\n]*:)/],
    beginScope: { 1: "meta" },
    end: /^(?:---|\.\.\.)[ \t]*$/,
    endScope: "meta",
    subLanguage: "yaml",
    relevance: 3,
  };

  // `% comment` lines.
  const COMMENT: Mode = {
    scope: "comment",
    match: /^[ ]{0,3}%[^\n]*/,
    relevance: 2,
  };

  // `+++` block break, with optional metadata.
  const BLOCK_BREAK: Mode = {
    scope: "meta",
    match: /^\+{3,}[^\n]*$/,
    relevance: 2,
  };

  // `(target-name)=` label lines.
  const TARGET: Mode = {
    begin: [/^\(/, /[^()\n]+/, /\)=/, /(?=[ \t]*$)/],
    beginScope: { 1: "punctuation", 2: "symbol", 3: "punctuation" },
    relevance: 3,
  };

  // `:key: value` directive options (only valid inside directives). The key
  // charset must exclude `:` so that a `:::` fence is never read as a key.
  const DIRECTIVE_OPTION: Mode = {
    begin: [/^[ \t]*/, /:[\w+.-]+:/, /[ \t]*/, /[^\n]*/],
    beginScope: { 2: "attr", 4: "string" },
    relevance: 0,
  };

  // `--- yaml ---` option block at the top of a directive body. The next line
  // must look like a YAML key so a mid-body thematic break stays a thematic
  // break, and endsWithParent guarantees the region can never outlive the
  // directive (it would otherwise swallow the closing fence and beyond).
  const DIRECTIVE_YAML_OPTIONS: Mode = {
    begin: [/^[ \t]*---[ \t]*/, /\n/, /(?=[ \t]*[\w"'-][^\n]*:)/],
    beginScope: { 1: "meta" },
    end: /^[ \t]*---[ \t]*$/,
    endScope: "meta",
    subLanguage: "yaml",
    endsWithParent: true,
  };

  // Helper producing the three fence flavours (```, ~~~, :::) of a directive.
  const directiveVariants = (name: RegExp, withArgument: boolean): Mode[] => {
    const argument = withArgument ? [/[^\n]*/] : [];
    const scopes: Record<number, string> = {
      2: "punctuation",
      3: "punctuation",
      4: "keyword",
      5: "punctuation",
    };
    if (withArgument) {
      scopes[6] = "string";
    }
    return [
      {
        begin: [/^[ \t]*/, /`{3,}/, /\{/, name, /\}/, ...argument],
        beginScope: scopes,
        end: /^[ \t]*`{3,}[ \t]*$/,
        endScope: "punctuation",
      },
      {
        begin: [/^[ \t]*/, /~{3,}/, /\{/, name, /\}/, ...argument],
        beginScope: scopes,
        end: /^[ \t]*~{3,}[ \t]*$/,
        endScope: "punctuation",
      },
      {
        begin: [/^[ \t]*/, /:{3,}/, /\{/, name, /\}/, ...argument],
        beginScope: scopes,
        end: /^[ \t]*:{3,}[ \t]*$/,
        endScope: "punctuation",
      },
    ];
  };

  // `{eval-rst}` bodies are reStructuredText.
  const EVAL_RST_DIRECTIVE: Mode = {
    variants: directiveVariants(/eval-rst/, false),
    subLanguage: "restructuredtext",
    relevance: 5,
  };

  // `{math}` bodies are LaTeX.
  const MATH_DIRECTIVE: Mode = {
    variants: directiveVariants(/math/, false),
    subLanguage: "latex",
    relevance: 5,
  };

  // Code-like directives: body is a code listing in a dynamically chosen
  // language, so leave it unhighlighted (options still highlight).
  const CODE_DIRECTIVE: Mode = {
    variants: directiveVariants(
      /(?:code-block|code-cell|code|sourcecode|ipython3|ipython|literalinclude|include|raw|mermaid)/,
      true,
    ),
    contains: [DIRECTIVE_YAML_OPTIONS, DIRECTIVE_OPTION],
    relevance: 5,
  };

  // Generic directives, one mode per fence flavour so that each flavour can
  // nest any other flavour (a `variants`-based mode cannot: `self` inside a
  // variant refers to that variant only).
  const [DIRECTIVE_TICK, DIRECTIVE_TILDE, DIRECTIVE_COLON] = directiveVariants(
    DIRECTIVE_NAME,
    true,
  ) as [Mode, Mode, Mode];
  for (const d of [DIRECTIVE_TICK, DIRECTIVE_TILDE, DIRECTIVE_COLON]) {
    d.relevance = 5;
  }

  // Display math and amsmath environments.
  const MATH_DISPLAY: Mode = {
    scope: "formula",
    begin: /\$\$/,
    end: /\$\$|(?=\n[ \t]*\n)/,
    relevance: 2,
    starts: {
      end: /$/,
      contains: [{ scope: "symbol", match: /\([^()\n]+\)/ }],
    },
  };
  const AMSMATH: Mode = {
    scope: "formula",
    begin:
      /^[ \t]*\\begin\{(?:equation|align|alignat|gather|multline|flalign|eqnarray)\*?\}/,
    end: /\\end\{(?:equation|align|alignat|gather|multline|flalign|eqnarray)\*?\}/,
    relevance: 2,
  };

  // Fenced code inside a directive body. highlight.js resolves a tie between
  // a child `begin` and the parent's `end` in favour of the child, so the
  // parent directive's own bare closing fence must never look like a code
  // opener: require a non-newline character (info string) after the fence.
  const CODE_IN_DIRECTIVE: Mode = {
    scope: "code",
    variants: [
      { begin: "(`{3,})[^`\\n](.|\\n)*?\\1`*[ ]*" },
      { begin: "(~{3,})[^~\\n](.|\\n)*?\\1~*[ ]*" },
      // A bare exactly-3 fence pair (no info string). A longer parent closer
      // can never match this: its fourth fence character fails the (?!`).
      { begin: "`{3}(?!`)[ \\t]*\\n(.|\\n)*?\\n`{3}(?!`)[ \\t]*(?=\\n|$)" },
      { begin: "~{3}(?!~)[ \\t]*\\n(.|\\n)*?\\n~{3}(?!~)[ \\t]*(?=\\n|$)" },
      // inline spans must not match a bare ``` fence line (`.` matches `!)
      { begin: "``[^`\\n]+``|`[^`\\n]+`" },
      // indented code, one line at a time so it can never run across the
      // parent directive's closing fence
      { begin: "^( {4}|\\t)", end: "$", relevance: 0 },
    ],
    relevance: 0,
  };

  // Directives and code fences are listed before HEADER so that a fence line
  // directly followed by a `---` options block is not misread as a setext
  // heading (mode order breaks ties at the same match position).
  const DIRECTIVE_BODY: (Mode | "self")[] = [
    DIRECTIVE_YAML_OPTIONS,
    DIRECTIVE_OPTION,
    COMMENT,
    TARGET,
    EVAL_RST_DIRECTIVE,
    MATH_DIRECTIVE,
    CODE_DIRECTIVE,
    DIRECTIVE_TICK,
    DIRECTIVE_TILDE,
    DIRECTIVE_COLON,
    CODE_IN_DIRECTIVE,
    HEADER,
    INLINE_HTML,
    FOOTNOTE_DEF,
    LIST,
    BOLD,
    ITALIC,
    BLOCKQUOTE,
    HORIZONTAL_RULE,
    ESCAPE,
    ROLE,
    AMSMATH,
    MATH_DISPLAY,
    MATH_INLINE,
    LINK,
    LINK_REFERENCE,
    FOOTNOTE_REF,
    ENTITY,
  ];
  DIRECTIVE_TICK.contains = DIRECTIVE_BODY;
  DIRECTIVE_TILDE.contains = DIRECTIVE_BODY;
  DIRECTIVE_COLON.contains = DIRECTIVE_BODY;

  return {
    name: "MyST",
    aliases: ["mystmd", "myst-markdown"],
    contains: [
      FRONT_MATTER,
      COMMENT,
      BLOCK_BREAK,
      TARGET,
      EVAL_RST_DIRECTIVE,
      MATH_DIRECTIVE,
      CODE_DIRECTIVE,
      DIRECTIVE_TICK,
      DIRECTIVE_TILDE,
      DIRECTIVE_COLON,
      CODE,
      HEADER,
      INLINE_HTML,
      FOOTNOTE_DEF,
      LIST,
      BOLD,
      ITALIC,
      BLOCKQUOTE,
      HORIZONTAL_RULE,
      ESCAPE,
      ROLE,
      AMSMATH,
      MATH_DISPLAY,
      MATH_INLINE,
      LINK,
      LINK_REFERENCE,
      FOOTNOTE_REF,
      ENTITY,
    ],
  };
}
