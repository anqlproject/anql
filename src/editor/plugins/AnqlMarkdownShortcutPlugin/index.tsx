/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from 'react';

import { anqlMarkdownTransformersGetTransformers } from '@/editor/plugins/AnqlMarkdownTransformers';

import { anqlMarkdownShortcutPlugin as LexicalMarkdownShortcutPlugin } from './LexicalMarkdownShortcutpPugin';

interface AnqlMarkdownShortcutPluginProps {
  useBrackets?: boolean;
}

export default function AnqlMarkdownShortcutPlugin({ useBrackets = false }: AnqlMarkdownShortcutPluginProps): JSX.Element {
  const transformers = anqlMarkdownTransformersGetTransformers(useBrackets);
  return <LexicalMarkdownShortcutPlugin transformers={transformers} />;
}
