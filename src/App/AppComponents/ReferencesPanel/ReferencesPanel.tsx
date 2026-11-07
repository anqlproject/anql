import './ReferencesPanel.css';

import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Code2, Download, FileText, Image, Pencil, Plus, RefreshCw, Search, Sigma, Trash2, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createAsset, resolveAssetUrl } from '@/core/database/useAssetDatabase';
import {
  DEFAULT_REFERENCE_PATH,
  isReferenceInTrash,
  normalizeReferencePath,
  ReferenceJson,
} from '@/core/database/useReferenceDatabase';
import { logger } from '@/core/logger';
import {
  downloadOnlineReferenceResource,
  fetchOnlineReferenceLibrary,
  fetchOnlineReferenceRepositories,
  OnlineReferenceLibrary,
  OnlineReferenceRepository,
  OnlineReferenceResource,
} from '@/core/references/onlineReferenceCatalog';
import {
  REFERENCE_CODE_DRAG_TYPE,
  REFERENCE_DRAG_TYPE,
  REFERENCE_IMAGE_DRAG_TYPE,
  REFERENCE_LATEX_DRAG_TYPE,
  REFERENCE_PDF_DRAG_TYPE,
  REFERENCE_TEXT_DRAG_TYPE,
} from '@/core/references/referenceDragTypes';
import { useReferenceStore } from '@/core/references/useReferenceStore';

import ReferenceUsagesPanel, { loadReferenceUsages } from './ReferenceUsagesPanel';

type RefType = ReferenceJson['ref_type'];
const GROUP_PATH_PREFIX = 'groups/';
const ONLINE_REFERENCE_PATH_PREFIX = 'online/';

function getOnlineReferencePath(repositoryId: string, resourceId: string): string {
  return `${ONLINE_REFERENCE_PATH_PREFIX}${encodeURIComponent(repositoryId)}/${encodeURIComponent(resourceId)}`;
}

function getOnlineReferenceName(resource: OnlineReferenceResource, symbol?: string): string {
  if (symbol && /^[A-Za-z_][A-Za-z0-9_]*$/.test(symbol)) return symbol;
  const resourceName = resource.id.split('.').pop() ?? resource.id;
  return resourceName.replace(/[^A-Za-z0-9_]/g, '_').toLowerCase() || 'reference';
}

function getGroupName(path: string): string {
  const normalizedPath = normalizeReferencePath(path);
  if (!normalizedPath) return '';
  const groupPath = normalizedPath.startsWith(GROUP_PATH_PREFIX)
    ? normalizedPath.slice(GROUP_PATH_PREFIX.length)
    : normalizedPath;
  return groupPath.replace(/\/+$/, '');
}

function getGroupPath(groupName: string): string {
  const normalizedName = groupName.trim().replace(/[\\/]+/g, '_');
  return normalizedName ? `${GROUP_PATH_PREFIX}${normalizedName}/` : DEFAULT_REFERENCE_PATH;
}

const TYPE_ICONS: Record<RefType, React.ReactNode> = {
  text:   <Type size={12} />,
  image:  <Image size={12} />,
  code:   <Code2 size={12} />,
  pdf:    <FileText size={12} />,
  latex:  <Sigma size={12} />,
};

function ReferenceImageThumbnail({ src, name }: { src: string; name: string }) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;
    setResolvedSrc(null);
    setHasError(false);

    resolveAssetUrl(src)
      .then((url) => {
        if (url?.startsWith('blob:')) objectUrl = url;
        if (isMounted) {
          setResolvedSrc(url);
        } else if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch((error: unknown) => {
        logger.error('Failed to resolve reference image thumbnail', error as Error, { name });
        if (isMounted) setHasError(true);
      });

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, name]);

  if (!resolvedSrc || hasError) {
    return <Image size={14} />;
  }

  return (
    <img
      className="ref-item__thumbnail"
      src={resolvedSrc}
      alt={name}
      onError={() => setHasError(true)}
    />
  );
}

interface ReferencesPanelProps {
  panelRef: React.Ref<HTMLDivElement>;
  panelLeft: number;
  onClose: () => void;
  onRequestDelete: (reference: ReferenceJson) => void;
}

export default function ReferencesPanel({ panelRef, panelLeft, onClose, onRequestDelete }: ReferencesPanelProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const {
    references,
    isLoaded,
    loadReferences,
    addReference,
    editReference,
    restoreReference,
  } = useReferenceStore();
  const activeReferences = references.filter((reference) => !isReferenceInTrash(reference));

  const [referenceView, setReferenceView] = useState<'local' | 'online'>('local');
  const [onlineRepositories, setOnlineRepositories] = useState<OnlineReferenceRepository[] | null>(null);
  const [onlineRepositoriesFromCache, setOnlineRepositoriesFromCache] = useState(false);
  const [isLoadingOnlineRepositories, setIsLoadingOnlineRepositories] = useState(false);
  const [onlineRepositoriesError, setOnlineRepositoriesError] = useState(false);
  const [selectedOnlineRepository, setSelectedOnlineRepository] = useState<OnlineReferenceRepository | null>(null);
  const [onlineLibrary, setOnlineLibrary] = useState<OnlineReferenceLibrary | null>(null);
  const [onlineLibraryFromCache, setOnlineLibraryFromCache] = useState(false);
  const [isLoadingOnlineLibrary, setIsLoadingOnlineLibrary] = useState(false);
  const [onlineLibraryError, setOnlineLibraryError] = useState(false);
  const [downloadingResourceId, setDownloadingResourceId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [usageReference, setUsageReference] = useState<ReferenceJson | null>(null);
  const [hoveredReferenceKey, setHoveredReferenceKey] = useState<string | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // New-reference form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<RefType>('text');
  const [newValue, setNewValue] = useState('');
  const [newImageName, setNewImageName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [nameError, setNameError] = useState('');

  // Edit form state
  const [editValue, setEditValue] = useState('');
  const [editName, setEditName] = useState('');
  const [editImageName, setEditImageName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const onlineRepositoriesRequestId = useRef(0);
  const onlineLibraryRequestId = useRef(0);

  const loadOnlineRepositories = async () => {
    const requestId = ++onlineRepositoriesRequestId.current;
    setIsLoadingOnlineRepositories(true);
    setOnlineRepositoriesError(false);
    try {
      const result = await fetchOnlineReferenceRepositories();
      if (requestId !== onlineRepositoriesRequestId.current) return;
      setOnlineRepositories(result.value);
      setOnlineRepositoriesFromCache(result.fromCache);
    } catch (error) {
      if (requestId !== onlineRepositoriesRequestId.current) return;
      logger.error('Failed to load online reference repositories', error as Error);
      setOnlineRepositoriesError(true);
    } finally {
      if (requestId === onlineRepositoriesRequestId.current) {
        setIsLoadingOnlineRepositories(false);
      }
    }
  };

  const loadOnlineLibrary = async (repository: OnlineReferenceRepository) => {
    const requestId = ++onlineLibraryRequestId.current;
    setOnlineLibrary(null);
    setOnlineLibraryError(false);
    setIsLoadingOnlineLibrary(true);
    try {
      const result = await fetchOnlineReferenceLibrary(repository);
      if (requestId !== onlineLibraryRequestId.current) return;
      setOnlineLibrary(result.value);
      setOnlineLibraryFromCache(result.fromCache);
    } catch (error) {
      if (requestId !== onlineLibraryRequestId.current) return;
      logger.error('Failed to load online reference library', error as Error, {
        repositoryId: repository.id,
      });
      setOnlineLibraryError(true);
    } finally {
      if (requestId === onlineLibraryRequestId.current) {
        setIsLoadingOnlineLibrary(false);
      }
    }
  };

  const openOnlineView = () => {
    setReferenceView('online');
    setSearch('');
    if (!onlineRepositories && !isLoadingOnlineRepositories) {
      void loadOnlineRepositories();
    }
  };

  const selectOnlineRepository = (repository: OnlineReferenceRepository) => {
    setSelectedOnlineRepository(repository);
    setSearch('');
    setDownloadError(false);
    void loadOnlineLibrary(repository);
  };

  const returnToOnlineRepositories = () => {
    onlineLibraryRequestId.current += 1;
    setSelectedOnlineRepository(null);
    setOnlineLibrary(null);
    setOnlineLibraryError(false);
    setIsLoadingOnlineLibrary(false);
    setSearch('');
  };

  const installOnlineResource = async (
    repository: OnlineReferenceRepository,
    resource: OnlineReferenceResource,
  ) => {
    const path = getGroupPath(repository.name);
    const legacyOnlinePath = getOnlineReferencePath(repository.id, resource.id);
    const existingReference = references.find(
      (reference) =>
        (reference.source_repo_id === repository.id && reference.source_resource_id === resource.id) ||
        normalizeReferencePath(
          isReferenceInTrash(reference) ? reference.path.slice('trash/'.length) : reference.path,
        ) === legacyOnlinePath,
    );
    if (existingReference?.id && isReferenceInTrash(existingReference)) {
      try {
        await restoreReference(existingReference.id);
      } catch (error) {
        logger.error('Failed to restore online reference resource', error as Error, {
          referenceId: existingReference.id,
        });
        setDownloadError(true);
        return;
      }
    }
    if (existingReference && (existingReference.source_version ?? undefined) === resource.version) {
      if (existingReference.id && existingReference.path !== path) {
        await editReference(existingReference.id, { path });
      }
      return;
    }

    setDownloadingResourceId(resource.id);
    setDownloadError(false);
    try {
      const payload = await downloadOnlineReferenceResource(resource);
      const source = {
        source_repo_id: repository.id,
        source_resource_id: resource.id,
        source_version: resource.version ?? null,
        source_url: payload.source_url ?? null,
        license: payload.license ?? null,
      };
      const ref_type = resource.type === 'constant' ? 'text' : 'latex';
      const value = resource.type === 'constant' ? String(payload.value) : payload.latex ?? '';

      if (existingReference?.id) {
        await editReference(existingReference.id, { ref_type, value, path, ...source });
      } else {
        const baseName = getOnlineReferenceName(resource, payload.symbol);
        let referenceName = baseName;
        let suffix = 1;
        while (references.some((reference) => reference.name.toLowerCase() === referenceName.toLowerCase())) {
          referenceName = `${baseName}_${suffix++}`;
        }

        const reference = await addReference(referenceName, ref_type, value, path, source);
        if (reference.path !== path) {
          throw new Error('The downloaded resource name conflicts with an existing reference');
        }
      }
    } catch (error) {
      logger.error('Failed to install online reference resource', error as Error, {
        repositoryId: repository.id,
        resourceId: resource.id,
      });
      setDownloadError(true);
    } finally {
      setDownloadingResourceId(null);
    }
  };

  useEffect(() => {
    if (!isLoaded) loadReferences();
  }, [isLoaded, loadReferences]);

  useEffect(() => {
    if (isAdding) newNameRef.current?.focus();
    else searchRef.current?.focus();
  }, [isAdding]);

  const groups = [...new Set(
    activeReferences
      .map((reference) => normalizeReferencePath(reference.path))
      .filter((path) => Boolean(path) && !path.startsWith(ONLINE_REFERENCE_PATH_PREFIX)),
  )].sort((a, b) => getGroupName(a).localeCompare(getGroupName(b)));
  const referencesToShow = selectedGroup
    ? activeReferences.filter(
        (reference) => normalizeReferencePath(reference.path) === selectedGroup,
      )
    : activeReferences;
  const filtered = referencesToShow.filter((reference) =>
    reference.name.toLowerCase().includes(search.toLowerCase()) ||
    reference.value.toLowerCase().includes(search.toLowerCase())
  );
  const editingReference = editingId
    ? activeReferences.find((reference) => reference.id === editingId)
    : undefined;
  const hoveredReference = hoveredReferenceKey
    ? activeReferences.find((reference) => (reference.id ?? reference.name) === hoveredReferenceKey)
    : undefined;

  useEffect(() => {
    if (!hoveredReference || !hoveredReferenceKey) return;

    let isMounted = true;
    let refreshTimeout: number | undefined;
    let requestId = 0;

    const refreshUsageCount = () => {
      const currentRequestId = ++requestId;
      loadReferenceUsages(hoveredReference)
        .then((loadedUsages) => {
          if (!isMounted || currentRequestId !== requestId) return;
          setUsageCounts((counts) => ({
            ...counts,
            [hoveredReferenceKey]: loadedUsages.length,
          }));
        })
        .catch((error: unknown) => {
          if (!isMounted || currentRequestId !== requestId) return;
          logger.error('Failed to load reference usage count', error as Error, {
            referenceId: hoveredReference.id,
            referenceName: hoveredReference.name,
          });
        });
    };

    const handleDatabaseChange = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(refreshUsageCount, 150);
    };

    refreshUsageCount();
    window.addEventListener('node-database-changed', handleDatabaseChange);

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimeout);
      window.removeEventListener('node-database-changed', handleDatabaseChange);
    };
  }, [hoveredReference, hoveredReferenceKey]);

  useEffect(() => {
    if (selectedGroup && !groups.includes(selectedGroup)) {
      setSelectedGroup(null);
    }
  }, [groups, selectedGroup]);

  const handleAdd = async () => {
    if (
      !newName.trim() ||
      (['image', 'pdf'].includes(newType) && !newValue) ||
      (newType === 'latex' && !newValue.trim())
    ) return;
    const normalizedName = newName.trim().replace(/\s+/g, '_').toLowerCase();
    if (references.some((reference) => reference.name.toLowerCase() === normalizedName)) {
      setNameError(t('REFERENCE_PANEL.duplicateName') as string);
      return;
    }

    const newGroupPath = getGroupPath(newGroup);
    await addReference(newName, newType, newValue, newGroupPath);
    setSelectedGroup(newGroupPath || null);
    setNewName('');
    setNewValue('');
    setNewType('text');
    setNewImageName('');
    setNewGroup('');
    setNameError('');
    setIsAdding(false);
  };

  const startEdit = (ref: ReferenceJson) => {
    setIsAdding(false);
    setEditingId(ref.id ?? null);
    setEditValue(ref.value);
    setEditName(ref.name);
    setEditImageName(['image', 'pdf'].includes(ref.ref_type) && ref.value
      ? t(`REFERENCE_PANEL.selected${ref.ref_type === 'pdf' ? 'Pdf' : 'Image'}`) as string
      : '');
    setEditGroup(getGroupName(ref.path));
    setImageError('');
    setEditError('');
  };

  const startAdd = () => {
    setEditingId(null);
    setNewGroup(selectedGroup ? getGroupName(selectedGroup) : '');
    setNewName('');
    setNewValue('');
    setNewType('text');
    setNewImageName('');
    setNameError('');
    setImageError('');
    setIsAdding(true);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNameError('');
    setImageError('');
  };

  const saveEdit = async (id: string) => {
    setIsSavingEdit(true);
    setEditError('');
    try {
      await editReference(id, { name: editName, value: editValue, path: getGroupPath(editGroup) });
      setEditingId(null);
    } catch (error) {
      logger.error('Failed to edit reference', error as Error, { id });
      setEditError(t('REFERENCE_PANEL.editFailed') as string);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
    setImageError('');
  };

  const chooseReferenceFile = async (
    type: 'image' | 'pdf',
    onSelected: (assetRef: string, fileName: string) => void,
  ) => {
    setImageError('');
    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
        filters: [type === 'image'
          ? { name: t('REFERENCE_PANEL.types.image') as string, extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff'] }
          : { name: t('REFERENCE_PANEL.types.pdf') as string, extensions: ['pdf'] }],
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const fileName = selectedPath.split(/[/\\]/).pop() || (t(`REFERENCE_PANEL.selected${type === 'pdf' ? 'Pdf' : 'Image'}`) as string);
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeTypeByExtension: Record<string, string> = type === 'image' ? {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        tif: 'image/tiff',
        tiff: 'image/tiff',
      } : { pdf: 'application/pdf' };
      const mimeType = extension ? mimeTypeByExtension[extension] : undefined;
      if (!mimeType) {
        setImageError(t(type === 'pdf' ? 'REFERENCE_PANEL.invalidPdf' : 'REFERENCE_PANEL.invalidImage') as string);
        return;
      }

      setIsUploadingAsset(true);
      const bytes = await readFile(selectedPath);
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }

      const id = crypto.randomUUID();
      await createAsset(id, fileName, mimeType, btoa(binary));
      onSelected(`asset://${id}`, fileName);
    } catch (error) {
      logger.error(`Failed to select reference ${type}`, error as Error);
      setImageError(t(type === 'pdf' ? 'REFERENCE_PANEL.pdfUploadFailed' : 'REFERENCE_PANEL.imageUploadFailed') as string);
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); action(); }
    if (e.key === 'Escape') {
      if (isAdding) cancelAdd();
      else cancelEdit();
    }
  };

  const onlineRepositoriesFiltered = (onlineRepositories ?? []).filter((repository) =>
    repository.name.toLowerCase().includes(search.toLowerCase()) ||
    (repository.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const onlineResourcesFiltered = (onlineLibrary?.resources ?? []).filter((resource) =>
    resource.name.toLowerCase().includes(search.toLowerCase()) ||
    (resource.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (resource.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    resource.type.toLowerCase().includes(search.toLowerCase()),
  );
  const onlineListContent = !selectedOnlineRepository ? (
    <>
      {onlineRepositoriesFromCache && (
        <div className="ref-online__notice">{t('REFERENCE_PANEL.onlineCatalogCached')}</div>
      )}
      {isLoadingOnlineRepositories ? (
        <div className="ref-panel__empty" role="status">{t('REFERENCE_PANEL.onlineLoading')}</div>
      ) : onlineRepositoriesError ? (
        <div className="ref-online__error" role="alert">
          <span>{t('REFERENCE_PANEL.onlineCatalogError')}</span>
          <button type="button" className="ref-online__retry" onClick={() => void loadOnlineRepositories()}>
            <RefreshCw size={13} />
            {t('REFERENCE_PANEL.onlineRetry')}
          </button>
        </div>
      ) : onlineRepositoriesFiltered.length === 0 ? (
        <div className="ref-panel__empty">
          {search ? t('REFERENCE_PANEL.noResults') : t('REFERENCE_PANEL.onlineNoLibraries')}
        </div>
      ) : (
        <div className="ref-online__repositories">
          {onlineRepositoriesFiltered.map((repository) => (
            <button
              key={repository.id}
              type="button"
              className="ref-online__repository"
              onClick={() => selectOnlineRepository(repository)}
            >
              <span className="ref-online__title">{repository.name}</span>
              {repository.description && (
                <span className="ref-online__description">{repository.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  ) : (
    <>
      {onlineLibraryFromCache && (
        <div className="ref-online__notice">{t('REFERENCE_PANEL.onlineCatalogCached')}</div>
      )}
      {isLoadingOnlineLibrary ? (
        <div className="ref-panel__empty" role="status">{t('REFERENCE_PANEL.onlineLoading')}</div>
      ) : onlineLibraryError ? (
        <div className="ref-online__error" role="alert">
          <span>{t('REFERENCE_PANEL.onlineCatalogError')}</span>
          <button
            type="button"
            className="ref-online__retry"
            onClick={() => void loadOnlineLibrary(selectedOnlineRepository)}
          >
            <RefreshCw size={13} />
            {t('REFERENCE_PANEL.onlineRetry')}
          </button>
        </div>
      ) : onlineLibrary ? (
        <>
          <div className="ref-online__hint">{t('REFERENCE_PANEL.onlineUsageHint')}</div>
          {downloadError && (
            <div className="ref-online__error" role="alert">
              {t('REFERENCE_PANEL.onlineDownloadError')}
            </div>
          )}
          {onlineResourcesFiltered.length === 0 ? (
            <div className="ref-panel__empty">
              {search ? t('REFERENCE_PANEL.noResults') : t('REFERENCE_PANEL.onlineNoResources')}
            </div>
          ) : (
            <div className="ref-online__resources" role="list">
              {onlineResourcesFiltered.map((resource) => {
                const path = getOnlineReferencePath(selectedOnlineRepository.id, resource.id);
                const importedReference = activeReferences.find(
                  (reference) =>
                    (reference.source_repo_id === selectedOnlineRepository.id &&
                      reference.source_resource_id === resource.id) ||
                    reference.path === path,
                );
                const isInstalled = Boolean(
                  importedReference &&
                  (importedReference.source_version ?? undefined) === resource.version,
                );
                const hasUpdate = Boolean(importedReference && !isInstalled);
                const isDownloading = downloadingResourceId === resource.id;
                const isSupported = resource.type === 'constant' || resource.type === 'formula';
                return (
                  <div key={resource.id} className="ref-online__resource" role="listitem">
                    <div className="ref-online__resource-info">
                      <span className="ref-online__title">{resource.name}</span>
                      <span className="ref-online__meta">
                        {[resource.category, resource.type, resource.version]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {resource.description && (
                        <span className="ref-online__description">{resource.description}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`ref-online__install${isInstalled ? ' is-installed' : ''}${hasUpdate ? ' is-update' : ''}${!isSupported ? ' is-unsupported' : ''}`}
                      disabled={!isSupported || !isLoaded || isInstalled || downloadingResourceId !== null}
                      onClick={() => void installOnlineResource(selectedOnlineRepository, resource)}
                      aria-label={t(isInstalled
                        ? 'REFERENCE_PANEL.onlineInstalled'
                        : isDownloading
                          ? 'REFERENCE_PANEL.onlineDownloading'
                          : isSupported
                            ? hasUpdate
                              ? 'REFERENCE_PANEL.onlineUpdate'
                              : 'REFERENCE_PANEL.onlineInstall'
                            : 'REFERENCE_PANEL.onlineUnsupported', { name: resource.name }) as string}
                    >
                      {isInstalled ? <Check size={14} /> : <Download size={14} />}
                      <span>
                        {t(isInstalled
                          ? 'REFERENCE_PANEL.onlineInstalled'
                          : isDownloading
                            ? 'REFERENCE_PANEL.onlineDownloading'
                            : isSupported
                              ? hasUpdate
                                ? 'REFERENCE_PANEL.onlineUpdate'
                                : 'REFERENCE_PANEL.onlineInstall'
                              : 'REFERENCE_PANEL.onlineUnsupported')}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </>
  );

  const refreshOnlineCatalog = () => {
    if (selectedOnlineRepository) {
      void loadOnlineLibrary(selectedOnlineRepository);
    } else {
      void loadOnlineRepositories();
    }
  };

  return (
    <>
      <div
        ref={panelRef}
        className="ref-panel"
        style={{ left: panelLeft }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
      {/* ── Header ── */}
      <div className="ref-panel__header">
        {isAdding || editingReference ? (
          <div className="ref-panel__create-heading">
            {isAdding ? <Plus size={15} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
            <span>
              {isAdding
                ? t('REFERENCE_PANEL.newReference')
                : t('REFERENCE_PANEL.editing', { name: editingReference?.name })}
            </span>
          </div>
        ) : (
          <div className="ref-panel__navigation">
            <div className="ref-panel__mode-row">
              <div
                className="ref-panel__mode-tabs"
                role="tablist"
                aria-label={t('REFERENCE_PANEL.views') as string}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={referenceView === 'local'}
                  className={`ref-panel__mode-tab${referenceView === 'local' ? ' is-active' : ''}`}
                  onClick={() => {
                    setReferenceView('local');
                    setSearch('');
                  }}
                >
                  {t('REFERENCE_PANEL.localTab')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={referenceView === 'online'}
                  className={`ref-panel__mode-tab${referenceView === 'online' ? ' is-active' : ''}`}
                  onClick={openOnlineView}
                >
                  {t('REFERENCE_PANEL.onlineTab')}
                </button>
              </div>
              {referenceView === 'online' && (
                <button
                  type="button"
                  className="ref-panel__icon-action"
                  onClick={refreshOnlineCatalog}
                  aria-label={t('REFERENCE_PANEL.onlineRefresh') as string}
                  title={t('REFERENCE_PANEL.onlineRefresh') as string}
                  disabled={isLoadingOnlineRepositories || isLoadingOnlineLibrary}
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
            {referenceView === 'local' ? (
              <div
                className="ref-panel__view-tabs"
                role="tablist"
                aria-label={t('REFERENCE_PANEL.groups') as string}
              >
                {[null, ...groups].map((groupPath, index) => (
                  <button
                    key={groupPath ?? 'all'}
                    id={groupPath ? `reference-view-tab-${index}` : 'reference-view-tab-all'}
                    type="button"
                    role="tab"
                    aria-selected={selectedGroup === groupPath}
                    className={`ref-panel__view-tab${selectedGroup === groupPath ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedGroup(groupPath);
                      setSearch('');
                    }}
                  >
                    {selectedGroup === groupPath && (
                      <motion.span
                        aria-hidden="true"
                        className="ref-panel__tab-indicator"
                        layoutId="reference-group-tab-indicator"
                        transition={prefersReducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 36 }}
                      />
                    )}
                    <span className="ref-panel__view-tab-content">
                      {groupPath ? getGroupName(groupPath) : t('REFERENCE_PANEL.all')}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ref-panel__online-breadcrumb">
                {selectedOnlineRepository && (
                  <button
                    type="button"
                    className="ref-panel__back-btn"
                    onClick={returnToOnlineRepositories}
                    aria-label={t('REFERENCE_PANEL.onlineBack') as string}
                  >
                    <ArrowLeft size={14} />
                  </button>
                )}
                <span>{selectedOnlineRepository?.name ?? t('REFERENCE_PANEL.onlineLibraries')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isAdding && !editingReference && (
        <div className="ref-panel__search-wrap">
          <Search size={13} className="ref-panel__search-icon" />
          <input
            ref={searchRef}
            className="ref-panel__search"
            placeholder={t(referenceView === 'online'
              ? 'REFERENCE_PANEL.onlineSearchPlaceholder'
              : 'REFERENCE_PANEL.searchPlaceholder') as string}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ── List ── */}
      <div
        className="ref-panel__list"
        role={isAdding || editingReference ? undefined : 'tabpanel'}
        aria-labelledby={isAdding || editingReference
          ? undefined
          : referenceView === 'online'
            ? undefined
            : selectedGroup
              ? `reference-view-tab-${groups.indexOf(selectedGroup) + 1}`
              : 'reference-view-tab-all'}
      >
        {isAdding ? (
          <div className="ref-panel__create-content">
            <div className="ref-item__new-form">
              <div
                className="ref-item__type-tabs"
                role="tablist"
                aria-label={t('REFERENCE_PANEL.typeSelection') as string}
              >
                {(['text', 'image', 'code', 'pdf', 'latex'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={newType === type}
                    aria-controls="ref-item-new-value-panel"
                    className={`ref-item__type-tab${newType === type ? ' is-active' : ''}`}
                    onClick={() => {
                      setNewType(type);
                      setNewValue('');
                      setNewImageName('');
                      setImageError('');
                    }}
                  >
                    {newType === type && (
                      <motion.span
                        aria-hidden="true"
                        className="ref-panel__tab-indicator"
                        layoutId="reference-type-tab-indicator"
                        transition={prefersReducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 36 }}
                      />
                    )}
                    <span className="ref-item__type-tab-content">
                      {TYPE_ICONS[type]}
                      {t(`REFERENCE_PANEL.types.${type}`)}
                    </span>
                  </button>
                ))}
              </div>
              <input
                ref={newNameRef}
                className="ref-item__input ref-item__input--name"
                placeholder={t('REFERENCE_PANEL.newNamePlaceholder') as string}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNameError('');
                }}
                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
              />
              <label className="ref-item__group-field">
                <span>{t('REFERENCE_PANEL.group')}</span>
                <input
                  className="ref-item__input"
                  value={newGroup}
                  onChange={(event) => setNewGroup(event.target.value)}
                  placeholder={t('REFERENCE_PANEL.ungrouped') as string}
                  list="reference-group-options"
                />
              </label>
              {nameError && <span className="ref-item__error" role="alert">{nameError}</span>}
              <div
                id="ref-item-new-value-panel"
                role="tabpanel"
                className="ref-item__type-panel"
              >
                {newType === 'image' || newType === 'pdf' ? (
                  <button
                    type="button"
                    className="ref-item__image-picker"
                    onClick={() => chooseReferenceFile(newType, (assetRef, fileName) => {
                      setNewValue(assetRef);
                      setNewImageName(fileName);
                    })}
                    disabled={isUploadingAsset}
                  >
                    {newType === 'image' ? <Image size={14} /> : <FileText size={14} />}
                    {isUploadingAsset
                      ? t(`REFERENCE_PANEL.uploading${newType === 'pdf' ? 'Pdf' : 'Image'}`)
                      : newImageName || t(`REFERENCE_PANEL.choose${newType === 'pdf' ? 'Pdf' : 'Image'}`)}
                  </button>
                ) : newType === 'code' || newType === 'latex' ? (
                  <textarea
                    className={`ref-item__input ref-item__input--${newType}`}
                    placeholder={t(newType === 'latex'
                      ? 'REFERENCE_PANEL.latexPlaceholder'
                      : 'REFERENCE_PANEL.codePlaceholder') as string}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelAdd();
                      }
                    }}
                    spellCheck={false}
                  />
                ) : (
                  <input
                    className="ref-item__input"
                    placeholder={t('REFERENCE_PANEL.valuePlaceholder') as string}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleAdd)}
                  />
                )}
              </div>
              {imageError && <span className="ref-item__error" role="alert">{imageError}</span>}
            </div>
          </div>
        ) : referenceView === 'online' ? (
          onlineListContent
        ) : !editingReference && filtered.length === 0 ? (
          <div className="ref-panel__empty">
            {search ? t('REFERENCE_PANEL.noResults') : t('REFERENCE_PANEL.empty')}
          </div>
        ) : null}

        {referenceView === 'local' && !isAdding && (editingReference ? [editingReference] : filtered).map((ref) => (
          <div
            key={ref.id ?? ref.name}
            className={`ref-item${editingId === ref.id ? ' ref-item--editing' : ''}`}
            onMouseEnter={() => setHoveredReferenceKey(ref.id ?? ref.name)}
            onMouseLeave={() => setHoveredReferenceKey(null)}
            onFocusCapture={() => setHoveredReferenceKey(ref.id ?? ref.name)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setHoveredReferenceKey(null);
              }
            }}
          >
            {editingId === ref.id ? (
              /* ── Edit mode ── */
              <div className="ref-item__edit" role="group" aria-label={t('REFERENCE_PANEL.editing', { name: ref.name }) as string}>
                <input
                  className="ref-item__input ref-item__input--name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, () => saveEdit(ref.id!))}
                  placeholder={t('REFERENCE_PANEL.namePlaceholder') as string}
                  autoFocus
                />
                <label className="ref-item__group-field">
                  <span>{t('REFERENCE_PANEL.group')}</span>
                  <input
                    className="ref-item__input"
                    value={editGroup}
                    onChange={(event) => setEditGroup(event.target.value)}
                    placeholder={t('REFERENCE_PANEL.ungrouped') as string}
                    list="reference-group-options"
                  />
                </label>
                {ref.ref_type === 'image' || ref.ref_type === 'pdf' ? (
                  <button
                    type="button"
                    className="ref-item__image-picker"
                    onClick={() => chooseReferenceFile(ref.ref_type === 'pdf' ? 'pdf' : 'image', (assetRef, fileName) => {
                      setEditValue(assetRef);
                      setEditImageName(fileName);
                    })}
                    disabled={isUploadingAsset}
                  >
                    {ref.ref_type === 'image' && editValue
                      ? <ReferenceImageThumbnail src={editValue} name={editName || ref.name} />
                      : ref.ref_type === 'image' ? <Image size={14} /> : <FileText size={14} />}
                    {isUploadingAsset
                      ? t(`REFERENCE_PANEL.uploading${ref.ref_type === 'pdf' ? 'Pdf' : 'Image'}`)
                      : editImageName || t(`REFERENCE_PANEL.choose${ref.ref_type === 'pdf' ? 'Pdf' : 'Image'}`)}
                  </button>
                ) : ref.ref_type === 'code' || ref.ref_type === 'latex' ? (
                  <textarea
                    className={`ref-item__input ref-item__input--${ref.ref_type}`}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    placeholder={t(ref.ref_type === 'latex'
                      ? 'REFERENCE_PANEL.latexPlaceholder'
                      : 'REFERENCE_PANEL.codePlaceholder') as string}
                    spellCheck={false}
                  />
                ) : (
                  <input
                    className="ref-item__input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, () => saveEdit(ref.id!))}
                    placeholder={t('REFERENCE_PANEL.valuePlaceholder') as string}
                  />
                )}
                {imageError && <span className="ref-item__error" role="alert">{imageError}</span>}
                {editError && <span className="ref-item__error" role="alert">{editError}</span>}
              </div>
            ) : (
              /* ── Display mode ── */
              <div className="ref-item__row">
                <button
                  type="button"
                  className="ref-item__link"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData(
                      REFERENCE_DRAG_TYPE,
                      ref.id ?? `name:${ref.name}`,
                    );
                    event.dataTransfer.setData(
                      ref.ref_type === 'image'
                        ? REFERENCE_IMAGE_DRAG_TYPE
                        : ref.ref_type === 'pdf'
                          ? REFERENCE_PDF_DRAG_TYPE
                          : ref.ref_type === 'latex'
                            ? REFERENCE_LATEX_DRAG_TYPE
                        : ref.ref_type === 'code'
                          ? REFERENCE_CODE_DRAG_TYPE
                          : REFERENCE_TEXT_DRAG_TYPE,
                      '1',
                    );
                  }}
                  onClick={() => setUsageReference(ref)}
                  aria-label={t('REFERENCE_PANEL.viewUsages', { name: ref.name }) as string}
                >
                  <span
                    className="ref-item__type-icon"
                    title={t(`REFERENCE_PANEL.types.${ref.ref_type}`) as string}
                  >
                    {TYPE_ICONS[ref.ref_type as RefType]}
                  </span>
                  <span className="ref-item__name">@{ref.name}</span>
                  {ref.source_repo_id && (
                    <span
                      className="ref-item__source"
                      title={[
                        ref.source_url,
                        ref.license,
                        ref.source_version ? `v${ref.source_version}` : undefined,
                      ].filter(Boolean).join(' · ')}
                    >
                      {ref.source_repo_id}
                      {ref.source_version ? ` · v${ref.source_version}` : ''}
                    </span>
                  )}
                  {ref.ref_type === 'image' && (
                    <ReferenceImageThumbnail src={ref.value} name={ref.name} />
                  )}
                  <span className="ref-item__value">
                    {ref.ref_type === 'image'
                      ? <em>{t('REFERENCE_PANEL.imageValue')}</em>
                      : ref.ref_type === 'pdf'
                        ? <em>{t('REFERENCE_PANEL.pdfValue')}</em>
                      : ref.ref_type === 'latex'
                        ? <em>{t('REFERENCE_PANEL.latexValue')}</em>
                      : ref.value || <em>{t('REFERENCE_PANEL.emptyValue')}</em>}
                  </span>
                </button>
                <div className="ref-item__actions">
                  {hoveredReferenceKey === (ref.id ?? ref.name) &&
                    usageCounts[ref.id ?? ref.name] !== undefined && (
                      <span
                        className="ref-usage-count"
                        title={t('REFERENCE_PANEL.usagesTitle', { name: ref.name }) as string}
                        aria-label={t('REFERENCE_PANEL.usageCount', {
                          name: ref.name,
                          count: usageCounts[ref.id ?? ref.name],
                        }) as string}
                      >
                        {usageCounts[ref.id ?? ref.name]}
                      </span>
                    )}
                  <button
                    type="button"
                    className="ref-item__action-btn ref-item__action-btn--edit"
                    onClick={() => startEdit(ref)}
                    aria-label={t('REFERENCE_PANEL.edit', { name: ref.name }) as string}
                    title={t('REFERENCE_PANEL.edit', { name: ref.name }) as string}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="ref-item__action-btn ref-item__action-btn--delete"
                    onClick={() => onRequestDelete(ref)}
                    aria-label={t('REFERENCE_PANEL.delete', { name: ref.name }) as string}
                    title={t('REFERENCE_PANEL.delete', { name: ref.name }) as string}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

      </div>

      <datalist id="reference-group-options">
        {groups.map((groupPath) => (
          <option key={groupPath} value={getGroupName(groupPath)} />
        ))}
      </datalist>

      {/* ── Footer ── */}
      {referenceView === 'local' && (
        <div className="ref-panel__footer">
        {isAdding ? (
          <div className="ref-panel__create-actions">
            <button
              type="button"
              className="ref-item__btn ref-item__btn--cancel"
              onClick={cancelAdd}
              disabled={isUploadingAsset}
            >
              {t('REFERENCE_PANEL.cancel')}
            </button>
            <button
              type="button"
              className="ref-item__btn ref-item__btn--save"
              onClick={handleAdd}
              disabled={
                isUploadingAsset ||
                !newName.trim() ||
                (['image', 'pdf'].includes(newType) && !newValue) ||
                (newType === 'latex' && !newValue.trim())
              }
            >
              {t('REFERENCE_PANEL.create')}
            </button>
          </div>
        ) : editingReference ? (
          <div className="ref-panel__create-actions">
            <button
              type="button"
              className="ref-item__btn ref-item__btn--cancel"
              onClick={cancelEdit}
              disabled={isSavingEdit || isUploadingAsset}
            >
              {t('REFERENCE_PANEL.cancel')}
            </button>
            <button
              type="button"
              className="ref-item__btn ref-item__btn--save"
              onClick={() => saveEdit(editingReference.id!)}
              disabled={isSavingEdit || isUploadingAsset}
            >
              {isSavingEdit ? t('REFERENCE_PANEL.saving') : t('REFERENCE_PANEL.save')}
            </button>
          </div>
        ) : (
          <button className="ref-panel__add-btn" onClick={startAdd}>
            <Plus size={14} />
            {t('REFERENCE_PANEL.newReference')}
          </button>
        )}
        </div>
      )}
      </div>
      {usageReference && (
        <ReferenceUsagesPanel
          reference={usageReference}
          onClose={() => setUsageReference(null)}
          onUsageOpened={onClose}
        />
      )}
    </>
  );
}
