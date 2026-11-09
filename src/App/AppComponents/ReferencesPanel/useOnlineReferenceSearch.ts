import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { logger } from '@/core/logger';
import {
  fetchOnlineReferenceLibrary,
  OnlineReferenceLibrary,
  OnlineReferenceRepository,
  OnlineReferenceResource,
} from '@/core/references/onlineReferenceCatalog';

export interface OnlineReferenceSearchResult {
  repository: OnlineReferenceRepository;
  resource: OnlineReferenceResource;
}

interface LoadedOnlineLibrary {
  repository: OnlineReferenceRepository;
  library: OnlineReferenceLibrary;
}

interface UseOnlineReferenceSearchOptions {
  enabled: boolean;
  query: string;
  repositories: OnlineReferenceRepository[] | null;
  isLoadingRepositories: boolean;
}

interface UseOnlineReferenceSearchResult {
  results: OnlineReferenceSearchResult[];
  isLoading: boolean;
  hasError: boolean;
  retry: () => void;
}

export default function useOnlineReferenceSearch({
  enabled,
  query,
  repositories,
  isLoadingRepositories,
}: UseOnlineReferenceSearchOptions): UseOnlineReferenceSearchResult {
  const [libraries, setLibraries] = useState<LoadedOnlineLibrary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);
  const isRequestInFlight = useRef(false);

  useEffect(() => {
    if (
      !enabled ||
      isLoadingRepositories ||
      !repositories ||
      libraries !== null ||
      isRequestInFlight.current
    ) {
      return;
    }

    const currentRequestId = ++requestId.current;
    isRequestInFlight.current = true;
    setIsLoading(true);
    setHasError(false);
    void Promise.allSettled(repositories.map(async (repository) => {
      try {
        const result = await fetchOnlineReferenceLibrary(repository);
        return { repository, library: result.value };
      } catch (error) {
        logger.error('Failed to load online library for global search', error as Error, {
          repositoryId: repository.id,
        });
        throw error;
      }
    })).then((results) => {
      if (currentRequestId !== requestId.current) return;
      setLibraries(results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      ));
      setHasError(results.some((result) => result.status === 'rejected'));
    }).finally(() => {
      if (currentRequestId === requestId.current) {
        isRequestInFlight.current = false;
        setIsLoading(false);
      }
    });
  }, [enabled, isLoadingRepositories, libraries, reloadKey, repositories]);

  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return (libraries ?? []).flatMap(({ repository, library }) =>
      library.resources
        .filter((resource) =>
          resource.name.toLowerCase().includes(normalizedQuery) ||
          (resource.description ?? '').toLowerCase().includes(normalizedQuery) ||
          (resource.category ?? '').toLowerCase().includes(normalizedQuery) ||
          resource.type.toLowerCase().includes(normalizedQuery) ||
          resource.id.toLowerCase().includes(normalizedQuery) ||
          resource.fileUrl.toLowerCase().includes(normalizedQuery) ||
          repository.name.toLowerCase().includes(normalizedQuery),
        )
        .map((resource) => ({ repository, resource })),
    );
  }, [libraries, normalizedQuery]);

  const retry = useCallback(() => {
    requestId.current += 1;
    isRequestInFlight.current = false;
    setLibraries(null);
    setHasError(false);
    setIsLoading(false);
    setReloadKey((key) => key + 1);
  }, []);

  return {
    results,
    isLoading: enabled && isLoading,
    hasError,
    retry,
  };
}
