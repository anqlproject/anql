import { create } from 'zustand';

import {
  deleteReference,
  getAllReferences,
  newReference,
  ReferenceJson,
  updateReference,
} from '@/core/database/useReferenceDatabase';

function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

interface ReferenceStore {
  references: ReferenceJson[];
  isLoaded: boolean;

  // Actions
  loadReferences: () => Promise<void>;
  addReference: (name: string, ref_type: ReferenceJson['ref_type'], value: string) => Promise<ReferenceJson>;
  editReference: (id: string, updates: Partial<Pick<ReferenceJson, 'name' | 'ref_type' | 'value'>>) => Promise<void>;
  removeReference: (id: string) => Promise<void>;

  // Lookup
  getByName: (name: string) => ReferenceJson | undefined;
}

export const useReferenceStore = create<ReferenceStore>((set, get) => ({
  references: [],
  isLoaded: false,

  loadReferences: async () => {
    const refs = await getAllReferences();
    set({ references: refs, isLoaded: true });
  },

  addReference: async (name, ref_type, value) => {
    const normalizedName = name.trim().replace(/\s+/g, '_');
    const existing = get().references.find(
      (reference) => reference.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (existing) return existing;

    const ts = now();
    const ref: ReferenceJson = {
      id: generateId(),
      name: normalizedName,
      ref_type,
      value,
      created_at: ts,
      updated_at: ts,
    };

    try {
      await newReference(ref);
    } catch (error) {
      const references = await getAllReferences();
      set({ references, isLoaded: true });

      const duplicate = references.find(
        (reference) => reference.name.toLowerCase() === normalizedName.toLowerCase(),
      );
      if (duplicate) return duplicate;
      throw error;
    }

    // Optimistic update
    set((state) => ({
      references: [...state.references.filter(
        (reference) => reference.name.toLowerCase() !== normalizedName.toLowerCase(),
      ), ref].sort((a, b) => a.name.localeCompare(b.name)),
      isLoaded: true,
    }));
    return ref;
  },

  editReference: async (id, updates) => {
    const existing = get().references.find((r) => r.id === id);
    if (!existing) return;

    const updated: ReferenceJson = {
      ...existing,
      ...updates,
      name: updates.name ? updates.name.trim().replace(/\s+/g, '_') : existing.name,
      updated_at: now(),
    };
    await updateReference(updated);
    set((state) => ({
      references: state.references
        .map((r) => (r.id === id ? updated : r))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  removeReference: async (id) => {
    await deleteReference(id);
    set((state) => ({ references: state.references.filter((r) => r.id !== id) }));
  },

  getByName: (name) => {
    return get().references.find((r) => r.name === name);
  },
}));
