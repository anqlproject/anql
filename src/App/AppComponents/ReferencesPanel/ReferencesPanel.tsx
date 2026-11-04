import './ReferencesPanel.css';

import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { Code2, Image, Pencil, Plus, Search, Trash2, Type } from 'lucide-react';
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
  REFERENCE_CODE_DRAG_TYPE,
  REFERENCE_DRAG_TYPE,
  REFERENCE_IMAGE_DRAG_TYPE,
  REFERENCE_TEXT_DRAG_TYPE,
} from '@/core/references/referenceDragTypes';
import { useReferenceStore } from '@/core/references/useReferenceStore';

import ReferenceUsagesPanel, { loadReferenceUsages } from './ReferenceUsagesPanel';

type RefType = ReferenceJson['ref_type'];
const GROUP_PATH_PREFIX = 'groups/';

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
  const { references, isLoaded, loadReferences, addReference, editReference } = useReferenceStore();
  const activeReferences = references.filter((reference) => !isReferenceInTrash(reference));

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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isLoaded) loadReferences();
  }, [isLoaded, loadReferences]);

  useEffect(() => {
    if (!hoveredReferenceKey || usageCounts[hoveredReferenceKey] !== undefined) return;
    const reference = activeReferences.find(
      (item) => (item.id ?? item.name) === hoveredReferenceKey,
    );
    if (!reference) return;

    let isMounted = true;
    loadReferenceUsages(reference)
      .then((loadedUsages) => {
        if (!isMounted) return;
        setUsageCounts((counts) => ({
          ...counts,
          [hoveredReferenceKey]: loadedUsages.length,
        }));
      })
      .catch((error: unknown) => {
        logger.error('Failed to load reference usage count', error as Error, {
          referenceId: reference.id,
          referenceName: reference.name,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [activeReferences, hoveredReferenceKey, usageCounts]);

  useEffect(() => {
    if (isAdding) newNameRef.current?.focus();
    else searchRef.current?.focus();
  }, [isAdding]);

  const groups = [...new Set(
    activeReferences
      .map((reference) => normalizeReferencePath(reference.path))
      .filter(Boolean),
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

  useEffect(() => {
    if (selectedGroup && !groups.includes(selectedGroup)) {
      setSelectedGroup(null);
    }
  }, [groups, selectedGroup]);

  const handleAdd = async () => {
    if (!newName.trim() || (newType === 'image' && !newValue)) return;
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
    setEditImageName(ref.ref_type === 'image' && ref.value ? t('REFERENCE_PANEL.selectedImage') as string : '');
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

  const chooseImage = async (onSelected: (assetRef: string, fileName: string) => void) => {
    setImageError('');
    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
        filters: [{ name: t('REFERENCE_PANEL.types.image') as string, extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff'] }],
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const fileName = selectedPath.split(/[/\\]/).pop() || (t('REFERENCE_PANEL.selectedImage') as string);
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeTypeByExtension: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        tif: 'image/tiff',
        tiff: 'image/tiff',
      };
      const mimeType = extension ? mimeTypeByExtension[extension] : undefined;
      if (!mimeType) {
        setImageError(t('REFERENCE_PANEL.invalidImage') as string);
        return;
      }

      setIsUploadingImage(true);
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
      logger.error('Failed to select reference image', error as Error);
      setImageError(t('REFERENCE_PANEL.imageUploadFailed') as string);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); action(); }
    if (e.key === 'Escape') {
      if (isAdding) cancelAdd();
      else cancelEdit();
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
          <div
            className="ref-panel__view-tabs"
            role="tablist"
            aria-label={t('REFERENCE_PANEL.views') as string}
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
                {groupPath ? getGroupName(groupPath) : t('REFERENCE_PANEL.all')}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isAdding && !editingReference && (
        <div className="ref-panel__search-wrap">
          <Search size={13} className="ref-panel__search-icon" />
          <input
            ref={searchRef}
            className="ref-panel__search"
            placeholder={t('REFERENCE_PANEL.searchPlaceholder') as string}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ── List ── */}
      <div
        className="ref-panel__list"
        role={isAdding || editingReference ? undefined : 'tabpanel'}
        aria-labelledby={isAdding || editingReference ? undefined : selectedGroup
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
                {(['text', 'image', 'code'] as const).map((type) => (
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
                    {TYPE_ICONS[type]}
                    {t(`REFERENCE_PANEL.types.${type}`)}
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
                {newType === 'image' ? (
                  <button
                    type="button"
                    className="ref-item__image-picker"
                    onClick={() => chooseImage((assetRef, fileName) => {
                      setNewValue(assetRef);
                      setNewImageName(fileName);
                    })}
                    disabled={isUploadingImage}
                  >
                    <Image size={14} />
                    {isUploadingImage ? t('REFERENCE_PANEL.uploadingImage') : newImageName || t('REFERENCE_PANEL.chooseImage')}
                  </button>
                ) : newType === 'code' ? (
                  <textarea
                    className="ref-item__input ref-item__input--code"
                    placeholder={t('REFERENCE_PANEL.codePlaceholder') as string}
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
        ) : !editingReference && filtered.length === 0 ? (
          <div className="ref-panel__empty">
            {search ? t('REFERENCE_PANEL.noResults') : t('REFERENCE_PANEL.empty')}
          </div>
        ) : null}

        {!isAdding && (editingReference ? [editingReference] : filtered).map((ref) => (
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
                {ref.ref_type === 'image' ? (
                  <button
                    type="button"
                    className="ref-item__image-picker"
                    onClick={() => chooseImage((assetRef, fileName) => {
                      setEditValue(assetRef);
                      setEditImageName(fileName);
                    })}
                    disabled={isUploadingImage}
                  >
                    {editValue
                      ? <ReferenceImageThumbnail src={editValue} name={editName || ref.name} />
                      : <Image size={14} />}
                    {isUploadingImage ? t('REFERENCE_PANEL.uploadingImage') : editImageName || t('REFERENCE_PANEL.chooseImage')}
                  </button>
                ) : ref.ref_type === 'code' ? (
                  <textarea
                    className="ref-item__input ref-item__input--code"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    placeholder={t('REFERENCE_PANEL.codePlaceholder') as string}
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
                  {ref.ref_type === 'image' && (
                    <ReferenceImageThumbnail src={ref.value} name={ref.name} />
                  )}
                  <span className="ref-item__value">
                    {ref.ref_type === 'image'
                      ? <em>{t('REFERENCE_PANEL.imageValue')}</em>
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
      <div className="ref-panel__footer">
        {isAdding ? (
          <div className="ref-panel__create-actions">
            <button
              type="button"
              className="ref-item__btn ref-item__btn--cancel"
              onClick={cancelAdd}
              disabled={isUploadingImage}
            >
              {t('REFERENCE_PANEL.cancel')}
            </button>
            <button
              type="button"
              className="ref-item__btn ref-item__btn--save"
              onClick={handleAdd}
              disabled={isUploadingImage || !newName.trim() || (newType === 'image' && !newValue)}
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
              disabled={isSavingEdit || isUploadingImage}
            >
              {t('REFERENCE_PANEL.cancel')}
            </button>
            <button
              type="button"
              className="ref-item__btn ref-item__btn--save"
              onClick={() => saveEdit(editingReference.id!)}
              disabled={isSavingEdit || isUploadingImage}
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
