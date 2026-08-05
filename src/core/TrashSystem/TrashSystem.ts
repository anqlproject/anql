import { deleteDocument, DocumentsJson, getDocumentsByPath, updateDocument } from "@/core/database/useDocumentDatabase";
import { DATABASE_PATH } from "@/core/global/defaultSettings";

const MAX_TRASH_ITEMS = 100;

async function getTrashItemCount(): Promise<number> {
    try {
        const trashItems = await getDocumentsByPath(DATABASE_PATH.TRASH_PATH);
        return trashItems.length;
    } catch (error) {
        console.error('Error counting trash items:', error);
        return 0;
    }
}

async function cleanupOldTrashItems(): Promise<void> {
    try {
        const trashItems = await getDocumentsByPath(DATABASE_PATH.TRASH_PATH);

        if (trashItems.length >= MAX_TRASH_ITEMS) {
            const sortedItems = trashItems.sort((a, b) => a.updated_at - b.updated_at);
            const itemToDelete = sortedItems.slice(0, 1)[0];

            await deleteDocument(itemToDelete.id);
            console.log(`Deleted old trash item: ${itemToDelete.id}`);
        }
    } catch (error) {
        console.error('Error cleaning up trash items:', error);
    }
}

export async function MoveToTrash(document: DocumentsJson): Promise<boolean> {
    try {
        const currentCount = await getTrashItemCount();
        if (currentCount >= MAX_TRASH_ITEMS) {
            await cleanupOldTrashItems();
        }

        const TrashItem: DocumentsJson = {
            id: document.id,
            path: DATABASE_PATH.TRASH_PATH,
            workspace_id: document.workspace_id,
            title: document.title,
            created_at: document.created_at,
            updated_at: Date.now()
        };

        const success = await updateDocument(TrashItem);

        if (success) {
            console.log(`Document moved to trash: ${document.title}`);
        }

        return success;
    } catch (error) {
        console.error('Error moving document to trash:', error);
        return false;
    }
}

export async function EmptyTrash(): Promise<boolean> {
    try {
        const trashItems = await getDocumentsByPath(DATABASE_PATH.TRASH_PATH);

        for (const item of trashItems) {
            await deleteDocument(item.id);
        }

        console.log(`Trash emptied: deleted ${trashItems.length} items`);
        return true;
    } catch (error) {
        console.error('Error emptying trash:', error);
        return false;
    }
}

export async function RestoreFromTrash(documentId: string, originalPath: string): Promise<boolean> {
    try {
        const document = await getDocumentsByPath(DATABASE_PATH.TRASH_PATH + documentId);

        if (document.length > 0) {
            const restoredDocument: DocumentsJson = {
                ...document[0],
                path: originalPath,
                updated_at: Date.now(),
            };

            return await updateDocument(restoredDocument);
        }

        return false;
    } catch (error) {
        console.error('Error restoring from trash:', error);
        return false;
    }
}
