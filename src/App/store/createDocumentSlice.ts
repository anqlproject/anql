import { StateCreator } from 'zustand';

import { DocumentsJson } from '@/core/database/useDocumentDatabase';

export interface BlocChangesType {
  type: string;
  key: string;
  id: string;
}

export interface DocumentSlice {
  currentDocument: DocumentsJson;
  setCurrentDocument: (page: DocumentsJson) => void;

  modified: BlocChangesType;
  setModified: (state: BlocChangesType) => void;
  documentIsModified: () => boolean;

  documents: DocumentsJson[];
  setDocument: (documents: DocumentsJson[]) => void;
}

const emptyChanges: BlocChangesType = { key: '', type: '', id: '' };

export const createDocumentSlice: StateCreator<DocumentSlice> = (set, get) => ({
  currentDocument: { id: '', title: '', path: '', workspace_id: '', created_at: 0, updated_at: 0 },
  setCurrentDocument: (page) => set({ currentDocument: page }),

  modified: emptyChanges,
  setModified: (state) => set({ modified: state }),
  documentIsModified: () => {
    const { modified } = get();
    return !(modified.key.length === 0 && modified.type.length === 0);
  },

  documents: [],
  setDocument: (documents) => set({ documents }),
});
