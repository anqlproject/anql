/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from 'react';

import { getTransformers } from '@/editor/plugins/MarkdownTransformers';

import { MarkdownShortcutPlugin } from './LexicalMarkdownShortcutpPugin';

interface MarkdownPluginProps {
  useBrackets?: boolean;
}

export default function MarkdownPlugin({ useBrackets = false }: MarkdownPluginProps): JSX.Element {
  const transformers = getTransformers(useBrackets);
  return <MarkdownShortcutPlugin transformers={transformers} />;
}
