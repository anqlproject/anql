import { StateCreator } from 'zustand';

import { SearchResult } from '@/core/database/useSearchDatabase';

export interface SearchSlice {
  searchResult: SearchResult[];
  setSearchResult: (searchResult: SearchResult[]) => void;

  occurance: string;
  setOccurance: (occurance: string) => void;
  
  occurrence: string;
  setOccurrence: (occurrence: string) => void;
}

export const createSearchSlice: StateCreator<SearchSlice> = (set) => ({
  searchResult: [],
  setSearchResult: (searchResult) => set({ searchResult }),

  occurance: '',
  setOccurance: (occurance) => set({ occurance, occurrence: occurance }),

  occurrence: '',
  setOccurrence: (occurrence) => set({ occurance: occurrence, occurrence }),
});
