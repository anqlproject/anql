/**
 * StandardMarkdownPastePlugin
 *
 * Intercepts paste events containing raw Markdown text (e.g. text copied from
 * a source that does not render Markdown: a code block, a plain-text editor,
 * or an AI chat showing ### literally) and converts it to Lexical nodes.
 *
 * STRATEGY
 *   1. If text/html already has rendered semantic elements (<h1-6>, <blockquote>,
 *      <strong>) let Lexical's native paste handler run — nothing to do.
 *   2. If text/plain has raw Markdown block syntax, intercept and convert using
 *      $convertFromMarkdownString with ALL standard transformers, minus the
 *      app-specific ones (MATH, MATH_BLOCK, EQUATION, DATETIME, LINK).
 *   3. The converted nodes are inserted at the cursor position, preserving the
 *      document content that exists before and after the cursor.
 */

import { $convertFromMarkdownString, $generateNodesFromMarkdownString } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

import {
  ANQL_MARKDOWN_TRANSFORMERS,
  DATETIME,
  EQUATION,
  LINK,
  MATH,
  MATH_BLOCK,
} from '@/editor/plugins/AnqlMarkdownTransformers';

// ---------------------------------------------------------------------------
// Transformers
// All standard Lexical transformers EXCEPT the app-specific syntax nodes:
//   - MATH / MATH_BLOCK  →  @math(...) and $$ blocks
//   - EQUATION           →  $inline$ LaTeX
//   - DATETIME           →  @date(...)
//   - LINK               →  custom @node: / @document: link syntax
// Standard coverage kept: headings, hr, image, quote, check/ordered/unordered
// lists, tables, code blocks (fenced), bold, italic, underline, code,
// strikethrough, highlight, subscript, superscript.
// ---------------------------------------------------------------------------
const EXCLUDED = new Set([MATH, MATH_BLOCK, EQUATION, DATETIME, LINK]);

const PASTE_TRANSFORMERS = ANQL_MARKDOWN_TRANSFORMERS.filter((t) => !EXCLUDED.has(t as any)) as any;

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** Markdown block-level patterns that indicate *raw* (un-rendered) content. */
const RAW_MD_PATTERNS = [
  /^#{1,6}s/m,   // headings
  /^>s/m,        // blockquotes
  /^|.+|/m,    // tables
  /^```/m,        // fenced code blocks
];

function standardMarkdownPastePluginHasRawMarkdown(plain: string): boolean {
  return RAW_MD_PATTERNS.some((p) => p.test(plain));
}

/**
 * If the HTML clipboard already contains semantic elements produced by a
 * browser rendering Markdown (e.g. ChatGPT, GitHub), let Lexical's built-in
 * HTML paste handler do the work — it will already produce the right nodes.
 */
function standardMarkdownPastePluginHtmlAlreadyRendered(html: string): boolean {
  return (
    /<h[1-6][s>]/i.test(html) ||
    /<blockquote[s>]/i.test(html) ||
    /<strong[s>]/i.test(html)
  );
}

// ---------------------------------------------------------------------------
// Cursor-aware insertion
// ---------------------------------------------------------------------------

/**
 * Converts  to Lexical nodes using $convertFromMarkdownString and
 * inserts the result at the current cursor position.
 *
 * $convertFromMarkdownString replaces the entire root, so we:
 *   1. Record nodes before and after the cursor.
 *   2. Run the conversion (root is now only markdown nodes).
 *   3. Rebuild root = before + markdown + after.
 *
 * Nodes that are removed from the root within a single update() call but
 * then re-appended remain valid in Lexical's nodeMap — this is safe.
 */
function standardMarkdownPastePluginInsertMarkdownAtCursor(markdown: string): void {
  const sel = $getSelection();

  // No active selection — just replace the whole document.
  if (!$isRangeSelection(sel)) {
    $convertFromMarkdownString(markdown, PASTE_TRANSFORMERS);
    return;
  }

  // Generate nodes from markdown string without clearing the root
  const nodes = $generateNodesFromMarkdownString(markdown, PASTE_TRANSFORMERS);

  // Insert the generated nodes at the current selection
  sel.insertNodes(nodes);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default function StandardMarkdownPastePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboard =
          event.clipboardData ||
          (window as unknown as { clipboardData: DataTransfer }).clipboardData;
        if (!clipboard) return false;

        const html = clipboard.getData('text/html') || '';
        const plain = clipboard.getData('text/plain') || '';

        if (!plain) return false;

        // Let native Lexical handle already-rendered HTML.
        if (standardMarkdownPastePluginHtmlAlreadyRendered(html)) return false;

        // Only intercept when raw Markdown block syntax is detected.
        if (!standardMarkdownPastePluginHasRawMarkdown(plain)) return false;

        event.preventDefault();
        editor.update(() => standardMarkdownPastePluginInsertMarkdownAtCursor(plain));
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
}