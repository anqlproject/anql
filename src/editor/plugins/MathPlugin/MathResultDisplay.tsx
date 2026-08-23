import './MathResultDisplay.css';

import { autoUpdate, offset, useFloating } from '@floating-ui/react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import { Check, CornerDownRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/custom/Dialog/Dialog';
import { MathEvaluationResult, useMathVariables } from '@/editor/context/MathVariablesContext';

import { $getAllMathNodes } from './traversal';

/**
 * Renders the result as a React overlay positioned over the DOM node.
 * This avoids Lexical DOM reconciliation conflicts while allowing rich React UI.
 */
function MathResultOverlay({
  dom,
  result,
  onShowDetails,
}: {
  dom: HTMLElement;
  result: MathEvaluationResult;
  onShowDetails: (text: string) => void;
}) {
  const { t } = useTranslation();

  const { refs, x, y } = useFloating({
    placement: 'bottom-start',
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [
      // Move up by 24px (into the node's padding-bottom) and right by 8px
      offset({ mainAxis: -24, crossAxis: 8 }),
    ],
  });

  useEffect(() => {
    // Pass the actual DOM element so autoUpdate can observe it
    refs.setReference(dom);
  }, [dom, refs]);

  const isError = !!result.error;
  const text = isError ? result.error! : result.result;
  const limit = isError ? 30 : 50;
  const isTruncated = text.length > limit;
  const displayText = isTruncated ? text.substring(0, limit) + '...' : text;

  const [copied, setCopied] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (copied) return;

    // Remove leading '=' and spaces for a clean copy
    const textToCopy = text.replace(/^=\s*/, '');
    navigator.clipboard.writeText(textToCopy);

    setCopied(true);

    // Keep it visible for 1s, then fade out for 300ms
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setCopied(false);
        setIsFadingOut(false);
      }, 300);
    }, 1000);
  };

  if (copied) {
    return (
      <div
        ref={refs.setFloating}
        style={{
          position: 'absolute',
          top: y ?? 0,
          left: x ?? 0,
        }}
        className="math-react-overlay"
      >
        <span className={`math-react-overlay__badge ${isFadingOut ? 'fade-out' : ''}`}>
          <Check size={12} strokeWidth={2.5} />
          {t('MATH_PANEL.copied') as string}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={refs.setFloating}
      style={{
        position: 'absolute',
        top: y ?? 0,
        left: x ?? 0,
      }}
      className="math-react-overlay"
    >
      <span
        className={`math-react-overlay__text ${isError ? 'math-react-overlay__text--error' : 'math-react-overlay__text--success'}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={t('MATH_PANEL.doubleClickToCopy') as string}
      >
        <CornerDownRight size={12} strokeWidth={2} />
        {displayText}
      </span>

      {isTruncated && (
        <button
          className="math-react-overlay__button"
          onMouseDown={(e) => {
            // Prevent editor from losing focus
            e.preventDefault();
            e.stopPropagation();
            onShowDetails(text);
          }}
        >
          {t('MATH_PANEL.plus') as string}
        </button>
      )}
    </div>
  );
}

export function MathResultDisplay() {
  const [editor] = useLexicalComposerContext();
  const { results } = useMathVariables();
  const { t } = useTranslation();
  const [detailDialog, setDetailDialog] = useState<string | null>(null);
  const [nodes, setNodes] = useState<{ key: string; dom: HTMLElement }[]>([]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (detailDialog) {
      // Remove leading '=' and spaces for a clean copy
      const textToCopy = detailDialog.replace(/^=\s*/, '');
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 1. Track DOM elements of MathExpNodes
  useEffect(() => {
    const updateNodes = () => {
      editor.getEditorState().read(() => {
        const mathNodes = $getAllMathNodes($getRoot());
        const newNodes = [];
        for (const node of mathNodes) {
          const dom = editor.getElementByKey(node.__key);
          if (dom) {
            newNodes.push({ key: node.__key, dom });
          }
        }
        setNodes(newNodes);
      });
    };

    updateNodes();
    return editor.registerUpdateListener(() => updateNodes());
  }, [editor]);

  // 2. Handle simple "is-empty" class for the placeholder (Lexical safe)
  useEffect(() => {
    for (const node of nodes) {
      const result = results[node.key];
      const isEmpty = !result || (!result.result && !result.error);
      if (isEmpty) {
        node.dom.classList.add('is-empty');
      } else {
        node.dom.classList.remove('is-empty');
      }
    }
  }, [results, nodes]);

  return (
    <>
      {/* 3. Render a React Portal overlay for each node with a result */}
      {nodes.map((node) => {
        const result = results[node.key];
        if (!result || (!result.result && !result.error)) return null;

        return (
          <MathResultOverlay
            key={node.key}
            dom={node.dom}
            result={result}
            onShowDetails={setDetailDialog}
          />
        );
      })}

      {/* Detail Dialog */}
      <Dialog
        isOpen={!!detailDialog}
        onClose={() => setDetailDialog(null)}
        title={t('MATH_PANEL.details') as string}
        mode="info"
        size="md"
        okButton={{
          text: copied ? (t('MATH_PANEL.copied') as string) : (t('MATH_PANEL.copy') as string),
          onClick: handleCopy,
        }}
        description={
          <div style={{ maxHeight: '60vh', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)' }}>
            {detailDialog}
          </div>
        }
      />
    </>
  );
}
