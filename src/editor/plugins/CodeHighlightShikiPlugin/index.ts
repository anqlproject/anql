/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */


import { loadCodeLanguage, loadCodeTheme, registerCodeHighlighting, ShikiTokenizer } from '@lexical/code-shiki';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';

import { useGlobalStore } from '@/App/store/useGlobalStore';
import { useThemeStore } from '@/GlobalState/themeStore';

export const CODE_LANGUAGES = [
  '',
  'bash',
  'c',
  'clike',
  'cpp',
  'csharp',
  'css',
  'go',
  'html',
  'java',
  'js',
  'json',
  'kotlin',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'swift',
  'ts',
  'xml',
  'yaml',
];

export const CODE_THEMES = [
  'dark-plus',
  'light-plus',
  'one-light',
];

export default function CodeHighlightShikiPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const { resolvedTheme } = useThemeStore();
  const config = useGlobalStore((state) => state.config);

  // Ref to hold the current default theme — readable inside the tokenizer
  // without re-registering registerCodeHighlighting on every theme change.
  const defaultThemeRef = useRef(
    resolvedTheme === 'dark'
      ? config.editor.codeThemeDark
      : config.editor.codeThemeLight,
  );

  // Keep the ref up to date on every render (no effect needed).
  defaultThemeRef.current =
    resolvedTheme === 'dark'
      ? config.editor.codeThemeDark
      : config.editor.codeThemeLight;

  useEffect(() => {
    // Load all languages
    CODE_LANGUAGES.forEach(lang => {
      if (lang) loadCodeLanguage(lang, editor);
    });
    // Load all themes
    CODE_THEMES.forEach(theme => {
      loadCodeTheme(theme, editor);
    });

    // Custom tokenizer: defaultTheme is a getter so it always returns the
    // current user-configured theme from the ref. This means the library's
    // own $codeNodeTransform will use the right theme when creating a new
    // CodeNode, instead of the hardcoded 'one-light' fallback.
    const customTokenizer = {
      ...ShikiTokenizer,
      get defaultTheme() {
        return defaultThemeRef.current;
      },
    };

    return registerCodeHighlighting(editor, customTokenizer);
  }, [editor]);

  return null;
}
