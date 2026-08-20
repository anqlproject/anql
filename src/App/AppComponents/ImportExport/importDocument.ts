import { $convertFromMarkdownString } from '@lexical/markdown';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { LexicalEditor } from 'lexical';

import { newNode } from '@/core/database/useBlocDatabase';
import { DocumentsJson, newDocument } from '@/core/database/useDocumentDatabase';
import { addRecentDocument } from '@/core/database/useRecentDocumentsDatabase';
import { DATABASE_PATH } from '@/core/global/defaultSettings';
import { ANQL_MARKDOWN_TRANSFORMERS } from '@/editor/plugins/AnqlMarkdownTransformers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportDocumentOptions {
  /** Lexical editor instance (needed to convert Markdown) */
  editor: LexicalEditor;
  /** Called with a toast-style message when import cannot proceed */
  onError: (message: string) => void;
  /** Called with the newly created document after all DB writes are done */
  openDocument: (doc: DocumentsJson) => Promise<void>;
  /** Function to create a new file/document */
  handleNewFile: (title?: string) => Promise<void>;
}

interface ImportResult {
  content: string;
  extension: string;
  title: string;
}


/** Recursively extract plain text from a Lexical node JSON (used as full_text index). */
function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) ?? '';
  if (Array.isArray(node.children))
    return (node.children as Record<string, unknown>[]).map(extractText).join('');
  return '';
}

/** Extract file extension from a file path. */
function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/** Extract title from file path (without extension). */
function getTitleFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  return nameWithoutExt || 'Imported Document';
}

/** Save an array of Lexical node JSONs as nodes under a given document. */
async function saveNodesFromNodes(
  nodes: Record<string, unknown>[],
  documentId: string,
): Promise<void> {
  let prevPos = 'aa';
  for (const nodeJson of nodes) {
    const id = crypto.randomUUID();
    
    if (!nodeJson.$) nodeJson.$ = {};
    const meta = nodeJson.$ as Record<string, unknown>;
    
    const position = (meta.position as string) || (prevPos + 'n');
    prevPos = position;

    meta.id = id;
    meta.position = position;
    meta.node_type = nodeJson.type;

    await newNode({
      id,
      position,
      content: JSON.stringify(nodeJson),
      full_text: extractText(nodeJson),
      document_id: documentId,
      node_type: nodeJson.type as string,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }
}

/** Extract root-level Lexical node JSONs from the current editor state (after a Markdown update). */
function extractNodesFromEditorState(editor: LexicalEditor): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  editor.getEditorState().read(() => {
    const state = editor.getEditorState();
    const rootNode = state._nodeMap.get('root');
    const children: string[] =
      (rootNode as unknown as { __children?: string[] }).__children ?? [];
    children.forEach((key) => {
      const node = state._nodeMap.get(key);
      if (node) nodes.push(node.exportJSON() as Record<string, unknown>);
    });
  });
  return nodes;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run the full import flow:
 * open file -> extract zip via Rust -> persist DB -> open document.
 */
export async function importDocument({
  editor,
  onError,
  openDocument,
  handleNewFile,
}: ImportDocumentOptions): Promise<void> {
  try {
    // Step 1 — File picker (accept ANQL, md)
    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: [
        { name: 'Anql Archive', extensions: ['anql'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] }
      ]
    });
    if (!selectedPath || typeof selectedPath !== 'string') return;

    // Step 2 — Determine file type and handle accordingly
    const fileExtension = getFileExtension(selectedPath);

    if (fileExtension === 'anql') {
      // ZIP: use Rust backend to extract and remap assets (full DB flow)
      const importResult = await invoke<ImportResult>('import_from_zip', { zipPath: selectedPath });
      const { content: processedContent, extension: fileExt, title } = importResult;

      // Step 3 — Create the document record in DB (nodes added next)
      const newDocumentItem: DocumentsJson = {
        id: crypto.randomUUID(),
        title,
        path: DATABASE_PATH.HOME_PATH,
        workspace_id: 'default',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      await newDocument(newDocumentItem);
      try {
        await addRecentDocument(newDocumentItem.id, '');
      } catch {
        /* non-critical */
      }

      // Step 4 — Extract Lexical nodes and save nodes
      if (fileExt === 'json') {
        const jsonData = JSON.parse(processedContent);
        if (jsonData.assets) delete jsonData.assets;
        const stateToLoad = jsonData.editorState ?? jsonData;
        if (stateToLoad.root?.children) {
          await saveNodesFromNodes(stateToLoad.root.children, newDocumentItem.id);
        }
      } else {
        // Markdown: convert via editor, then read resulting node JSONs
        await new Promise<void>((resolve) => {
          editor.update(
            () => {
              $convertFromMarkdownString(processedContent, ANQL_MARKDOWN_TRANSFORMERS);
            },
            { onUpdate: resolve },
          );
        });
        const nodes = extractNodesFromEditorState(editor);
        await saveNodesFromNodes(nodes, newDocumentItem.id);
      }

      // Step 5 — Open via standard reconstruction flow (DB -> editor)
      await openDocument(newDocumentItem);
    } else if (fileExtension === 'md' || fileExtension === 'markdown') {
      // Direct file: use same technique as DocumentMenu (simple editor update)
      const content = await readTextFile(selectedPath);
      const title = getTitleFromPath(selectedPath);

      // Create new file/document with title from filename
      await handleNewFile(title);

      // Markdown: convert via editor (same as DocumentMenu)
      editor.update(() => {
        $convertFromMarkdownString(content, ANQL_MARKDOWN_TRANSFORMERS);
      });
    } else {
      onError('Unsupported file format. Please select a .anql or .md file.');
      return;
    }
  } catch (e) {
    console.error('[importDocument] Import failed:', e);
    onError(typeof e === 'string' ? e : (e as Error).message);
  }
}
