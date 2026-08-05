import { useCallback } from "react";

import { useSearch } from '@/App/AppComponents/LocalSearch/useSearch';

declare global {
  interface Window {
    CSS: {
      highlights: Map<string, Highlight>;
    };
  }
}

export const globalSearch = () => {
  const {
    setQuery,
    goToResult,
    closeSearch
  } = useSearch();

  // Gestionnaire de recherche
  const handleSearch = useCallback((text : string) => {
    setQuery(text);
  }, [setQuery]);
  
  const handleNavigate = useCallback((position : number) => {
    // position is an index
    goToResult(position);
  }, [goToResult]);

  return {
    handleSearch,
    handleNavigate,
    clearHighlights: closeSearch
  }
}