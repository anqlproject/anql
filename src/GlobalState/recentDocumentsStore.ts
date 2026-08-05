import { create } from 'zustand';

export interface RecentDocumentJson {
  id: string;
  opened_at: number;
  last_focused_node_id: string;
}

interface RecentDocumentsStore {
  documents: RecentDocumentJson[];
  shouldRefresh: boolean;
  setRecentDocuments: (documents: RecentDocumentJson[]) => void;
  refreshRecentDocuments: () => void;
  clearRecentDocuments: () => void;
}

export const useRecentDocumentsStore = create<RecentDocumentsStore>((set) => ({
  documents: [],
  shouldRefresh: false,
  setRecentDocuments: (documents) => set({ documents }),
  refreshRecentDocuments: () => set((state) => ({ shouldRefresh: !state.shouldRefresh })),
  clearRecentDocuments: () => set({ documents: [] }),
}));
