import { invoke } from '@tauri-apps/api/core';

export interface SearchResult {
    node_id: string;
    document_id: string;
}

// Function to verify and recreate indexes before search
const ensureIndexes = async (): Promise<void> => {
    try {
        await invoke('verify_and_recreate_indexes');
    } catch (error) {
        console.warn('Failed to verify indexes:', error);
    }
};

export const searchNodes = async (query: string): Promise<SearchResult[]> => {
    try {
        await ensureIndexes();
        const results = await invoke('search_nodes_fts', { query }) as SearchResult[];
        return results;
    } catch (error) {
        console.error('Failed to search nodes:', error);
        throw error;
    }
};

export const searchNodesWithSnippets = async (query: string): Promise<[SearchResult, string][]> => {
    try {
        await ensureIndexes();
        const results = await invoke('search_nodes_fts_with_snippets', { query }) as [SearchResult, string][];
        return results;
    } catch (error) {
        console.error('Failed to search nodes:', error);
        throw error;
    }
};

export const fuzzySearchNodes = async (query: string): Promise<[SearchResult, number][]> => {
    try {
        await ensureIndexes();
        const results = await invoke('fuzzy_search_nodes', { query }) as [SearchResult, number][];
        return results;
    } catch (error) {
        console.error('Failed to fuzzy search nodes:', error);
        throw error;
    }
};

export const fuzzySearchNodesWithSnippets = async (query: string): Promise<[SearchResult, string, number][]> => {
    try {
        await ensureIndexes();
        const results = await invoke('fuzzy_search_nodes_with_snippets', { query }) as [SearchResult, string, number][];
        return results;
    } catch (error) {
        console.error('Failed to fuzzy search nodes with snippets:', error);
        throw error;
    }
};

export const similaritySearchNodes = async (query: string, threshold: number = 0.6): Promise<[SearchResult, number][]> => {
    try {
        await ensureIndexes();
        const results = await invoke('similarity_search_nodes', { query, threshold }) as [SearchResult, number][];
        return results;
    } catch (error) {
        console.error('Failed to similarity search nodes:', error);
        throw error;
    }
};

