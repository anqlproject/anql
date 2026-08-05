/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */


import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { MarkNode } from '@lexical/mark';
import { OverflowNode } from '@lexical/overflow';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import type { Klass, LexicalNode } from 'lexical';

import { DateTimeNode } from './DateTimeNode/DateTimeNode';
import { EquationNode } from './EquationNode/EquationNode';
import { ImageNode } from './ImageNode/ImageNode';
import { LinkNode } from './LinkNode/LinkNode';
import { ListNode } from './ListNode/ListNode';
import { MathExpNode } from './MathNode/MathExpNode';
import { PdfNode } from './PdfNode/PdfNode';
import { TableNode } from './TableNode/TableNode';

const anqlNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  OverflowNode,
  ImageNode,
  EquationNode,
  HorizontalRuleNode,
  MarkNode,
  MathExpNode,
  DateTimeNode,
  ListNode,
  LinkNode,
  TableNode,
  PdfNode
];

export default anqlNodes;
