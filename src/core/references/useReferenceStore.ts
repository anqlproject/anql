import { create } from 'zustand';

import {
  DEFAULT_REFERENCE_PATH,
  deleteReference,
  getAllReferences,
  getReferenceOriginalPath,
  isReferenceInTrash,
  newReference,
  REFERENCE_TRASH_PATH,
  ReferenceJson,
  updateReference,
} from '@/core/database/useReferenceDatabase';

function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

let referencesLoadPromise: Promise<void> | null = null;
const pendingReferenceCreations = new Map<string, Promise<ReferenceJson>>();

interface ReferenceStore {
  references: ReferenceJson[];
  isLoaded: boolean;

  // Actions
  loadReferences: () => Promise<void>;
  addReference: (name: string, ref_type: ReferenceJson['ref_type'], value: string, path?: string) => Promise<ReferenceJson>;
  editReference: (id: string, updates: Partial<Pick<ReferenceJson, 'name' | 'ref_type' | 'path' | 'value'>>) => Promise<void>;
  moveReferenceToTrash: (id: string) => Promise<void>;
  restoreReference: (id: string) => Promise<void>;
  removeReference: (id: string) => Promise<void>;

  // Lookup
  getByName: (name: string) => ReferenceJson | undefined;
}

export const useReferenceStore = create<ReferenceStore>((set, get) => ({
  references: [],
  isLoaded: false,

  loadReferences: async () => {
    if (get().isLoaded) return;
    if (!referencesLoadPromise) {
      referencesLoadPromise = getAllReferences()
        .then((references) => {
          set({ references, isLoaded: true });
        })
        .finally(() => {
          referencesLoadPromise = null;
        });
    }
    await referencesLoadPromise;
  },

  addReference: async (name, ref_type, value, path = DEFAULT_REFERENCE_PATH) => {
    const normalizedName = name.trim().replace(/\s+/g, '_');
    const key = normalizedName.toLowerCase();
    const pending = pendingReferenceCreations.get(key);
    if (pending) return pending;

    const creation = (async () => {
      if (!get().isLoaded) await get().loadReferences();

      const existing = get().references.find(
        (reference) => reference.name.toLowerCase() === key,
      );
      if (existing) return existing;

      const ts = now();
      const ref: ReferenceJson = {
        id: generateId(),
        name: normalizedName,
        ref_type,
        path,
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
          (reference) => reference.name.toLowerCase() === key,
        );
        if (duplicate) return duplicate;
        throw error;
      }

      set((state) => ({
        references: [...state.references.filter(
          (reference) => reference.name.toLowerCase() !== key,
        ), ref].sort((a, b) => a.name.localeCompare(b.name)),
        isLoaded: true,
      }));
      return ref;
    })();

    pendingReferenceCreations.set(key, creation);
    try {
      return await creation;
    } finally {
      pendingReferenceCreations.delete(key);
    }
  },

  editReference: async (id, updates) => {
    const existing = get().references.find((r) => r.id === id);
    if (!existing) return;

    const updated: ReferenceJson = {
      ...existing,
      ...updates,
      name: updates.name ? updates.name.trim().replace(/\s+/g, '_') : existing.name,
      updated_at: Math.max(now(), existing.updated_at + 1),
    };
    await updateReference(updated);
    set((state) => ({
      references: state.references
        .map((r) => (r.id === id ? updated : r))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  moveReferenceToTrash: async (id) => {
    const existing = get().references.find((reference) => reference.id === id);
    if (!existing || isReferenceInTrash(existing)) return;

    const trashed: ReferenceJson = {
      ...existing,
      path: `${REFERENCE_TRASH_PATH}${existing.path || 'home/'}`,
      updated_at: Math.max(now(), existing.updated_at + 1),
    };
    const updated = await updateReference(trashed);
    if (!updated) throw new Error(`Reference not found: ${id}`);

    set((state) => ({
      references: state.references.map((reference) => reference.id === id ? trashed : reference),
    }));
  },

  restoreReference: async (id) => {
    const existing = get().references.find((reference) => reference.id === id);
    if (!existing || !isReferenceInTrash(existing)) return;

    const restored: ReferenceJson = {
      ...existing,
      path: getReferenceOriginalPath(existing),
      updated_at: Math.max(now(), existing.updated_at + 1),
    };
    const updated = await updateReference(restored);
    if (!updated) throw new Error(`Reference not found: ${id}`);

    set((state) => ({
      references: state.references.map((reference) => reference.id === id ? restored : reference),
    }));
  },

  removeReference: async (id) => {
    const deleted = await deleteReference(id);
    if (!deleted) throw new Error(`Reference not found: ${id}`);
    set((state) => ({ references: state.references.filter((r) => r.id !== id) }));
  },

  getByName: (name) => {
    return get().references.find(
      (reference) => reference.name === name && !isReferenceInTrash(reference),
    );
  },
}));
