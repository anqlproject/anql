import {
  isReferenceInTrash,
  normalizeReferencePath,
  ReferenceJson,
} from '@/core/database/useReferenceDatabase';
import {
  OnlineReferenceRepository,
  OnlineReferenceResource,
} from '@/core/references/onlineReferenceCatalog';
import { downloadOnlineReferenceResource } from '@/core/references/onlineReferenceCatalog';
import { useReferenceStore } from '@/core/references/useReferenceStore';

const GROUP_PATH_PREFIX = 'groups/';
const ONLINE_REFERENCE_PATH_PREFIX = 'online/';

function getGroupPath(groupName: string): string {
  const normalizedName = groupName.trim().replace(/[\\/]+/g, '_');
  return normalizedName ? `${GROUP_PATH_PREFIX}${normalizedName}/` : '';
}

function getOnlineReferencePath(repositoryId: string, resourceId: string): string {
  return `${ONLINE_REFERENCE_PATH_PREFIX}${encodeURIComponent(repositoryId)}/${encodeURIComponent(resourceId)}`;
}

function getOnlineReferenceName(resource: OnlineReferenceResource, symbol?: string): string {
  if (resource.type === 'code') return resource.name;
  if (symbol && /^[A-Za-z_][A-Za-z0-9_]*$/.test(symbol)) return symbol;
  const resourceName = resource.id.split('.').pop() ?? resource.id;
  return resourceName.replace(/[^A-Za-z0-9_]/g, '_').toLowerCase() || 'reference';
}

export async function installOnlineReferenceResource(
  repository: OnlineReferenceRepository,
  resource: OnlineReferenceResource,
): Promise<ReferenceJson> {
  const store = useReferenceStore.getState();
  if (!store.isLoaded) await store.loadReferences();

  const path = getGroupPath(repository.name);
  const legacyOnlinePath = getOnlineReferencePath(repository.id, resource.id);
  const existingReference = useReferenceStore.getState().references.find(
    (reference) =>
      (reference.source_repo_id === repository.id && reference.source_resource_id === resource.id) ||
      normalizeReferencePath(
        isReferenceInTrash(reference) ? reference.path.slice('trash/'.length) : reference.path,
      ) === legacyOnlinePath,
  );

  if (existingReference?.id && isReferenceInTrash(existingReference)) {
    await useReferenceStore.getState().restoreReference(existingReference.id);
  }

  if (existingReference && (existingReference.source_version ?? undefined) === resource.version) {
    if (existingReference.id && existingReference.path !== path) {
      await useReferenceStore.getState().editReference(existingReference.id, { path });
      return useReferenceStore.getState().references.find((reference) => reference.id === existingReference.id)
        ?? { ...existingReference, path };
    }
    return existingReference;
  }

  const payload = await downloadOnlineReferenceResource(resource);
  const source = {
    source_repo_id: repository.id,
    source_resource_id: resource.id,
    source_version: resource.version ?? null,
    source_url: payload.source_url ?? null,
    license: payload.license ?? null,
  };
  const ref_type: ReferenceJson['ref_type'] = resource.type === 'constant'
    ? 'text'
    : resource.type === 'formula'
      ? 'latex'
      : 'code';
  const value = resource.type === 'constant'
    ? String(payload.value)
    : resource.type === 'formula'
      ? payload.latex ?? ''
      : payload.code ?? '';

  if (existingReference?.id) {
    await useReferenceStore.getState().editReference(existingReference.id, {
      ref_type,
      value,
      path,
      ...source,
    });
    return useReferenceStore.getState().references.find((reference) => reference.id === existingReference.id)
      ?? { ...existingReference, ref_type, value, path, ...source };
  }

  const references = useReferenceStore.getState().references;
  const baseName = getOnlineReferenceName(resource, payload.symbol);
  let referenceName = baseName;
  let suffix = 1;
  while (references.some((reference) => reference.name.toLowerCase() === referenceName.toLowerCase())) {
    referenceName = `${baseName}_${suffix++}`;
  }

  const reference = await useReferenceStore.getState().addReference(
    referenceName,
    ref_type,
    value,
    path,
    source,
  );
  if (reference.path !== path) {
    throw new Error('The downloaded resource name conflicts with an existing reference');
  }
  return reference;
}
