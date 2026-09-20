import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { useEffect } from 'react';

import { $createChartNode, ChartNode } from '@/editor/nodes/ChartNode/ChartNode';

export const INSERT_CHART_COMMAND: LexicalCommand<void> = createCommand('INSERT_CHART_COMMAND');

export default function ChartPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ChartNode])) throw new Error('ChartPlugin: ChartNode not registered on editor');

    return editor.registerCommand(
      INSERT_CHART_COMMAND,
      () => {
        $insertNodes([$createChartNode()]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}