import { invoke } from '@tauri-apps/api/core';

export const REFERENCE_TRASH_PATH = 'trash/';
export const DEFAULT_REFERENCE_PATH = '';

export interface ReferenceJson {
  id?: string | null;
  name: string;
  ref_type: 'text' | 'image' | 'code';
  path: string;
  value: string;
  created_at: number;
  updated_at: number;
}

export const getAllReferences = async (): Promise<ReferenceJson[]> => {
  return invoke('get_all_references');
};

export const newReference = async (ref: ReferenceJson): Promise<string> => {
  return invoke('new_reference', { reference: ref });
};

export const updateReference = async (ref: ReferenceJson): Promise<boolean> => {
  return invoke('update_reference', { reference: ref });
};

export const deleteReference = async (id: string): Promise<boolean> => {
  return invoke('delete_reference', { id });
};

export function isReferenceInTrash(reference: ReferenceJson): boolean {
  return reference.path.startsWith(REFERENCE_TRASH_PATH);
}

export function normalizeReferencePath(path: string): string {
  return path === 'home/' || path === 'home' ? DEFAULT_REFERENCE_PATH : path;
}

export function getReferenceOriginalPath(reference: ReferenceJson): string {
  if (!isReferenceInTrash(reference)) return reference.path;
  return normalizeReferencePath(reference.path.slice(REFERENCE_TRASH_PATH.length));
}

export const getReferenceByName = async (name: string): Promise<ReferenceJson | null> => {
  return invoke('get_reference_by_name', { name });
};
