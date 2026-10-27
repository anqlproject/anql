import { newNode,NodeJson } from '@/core/database/useBlocDatabase';
import {
  DocumentsJson,
  getDocumentMetadata,
  newDocument,
} from '@/core/database/useDocumentDatabase';
import { addRecentDocument } from '@/core/database/useRecentDocumentsDatabase';

export async function duplicateDocument(
  document: DocumentsJson,
  nodes: NodeJson[],
  title: string,
): Promise<DocumentsJson> {
  const timestamp = Date.now();
  const metadata = await getDocumentMetadata(document.id);
  const duplicatedDocument: DocumentsJson = {
    ...document,
    id: crypto.randomUUID(),
    title,
    metadata,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await newDocument(duplicatedDocument);
  await addRecentDocument(duplicatedDocument.id, '');

  await Promise.all(nodes.map((node) => newNode({
    ...node,
    id: crypto.randomUUID(),
    document_id: duplicatedDocument.id,
    created_at: timestamp,
    updated_at: timestamp,
  })));

  return duplicatedDocument;
}
