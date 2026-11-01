import './ReferencesPanel.css';

import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { Image, Pencil, Plus, Search, Trash2, Type, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createAsset, resolveAssetUrl } from '@/core/database/useAssetDatabase';
import { ReferenceJson } from '@/core/database/useReferenceDatabase';
import { logger } from '@/core/logger';
import { useReferenceStore } from '@/core/references/useReferenceStore';

import ReferenceUsagesPanel, { loadReferenceUsages } from './ReferenceUsagesPanel';

type RefType = ReferenceJson['ref_type'];

const TYPE_ICONS: Record<RefType, React.ReactNode> = {
  text:   <Type size={12} />,
  image:  <Image size={12} />,
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
  onClose: () => void;
  onRequestDelete: (reference: ReferenceJson) => void;
}

export default function ReferencesPanel({ panelRef, onClose, onRequestDelete }: ReferencesPanelProps) {
  const { t } = useTranslation();
  const { references, isLoaded, loadReferences, addReference, editReference } = useReferenceStore();

  const [search, setSearch] = useState('');
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
  const [nameError, setNameError] = useState('');

  // Edit form state
  const [editValue, setEditValue] = useState('');
  const [editName, setEditName] = useState('');
  const [editImageName, setEditImageName] = useState('');
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
    const reference = references.find(
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
  }, [hoveredReferenceKey, references, usageCounts]);

  useEffect(() => {
    if (isAdding) newNameRef.current?.focus();
    else searchRef.current?.focus();
  }, [isAdding]);

  const filtered = references.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.value.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newName.trim() || (newType === 'image' && !newValue)) return;
    const normalizedName = newName.trim().replace(/\s+/g, '_').toLowerCase();
    if (references.some((reference) => reference.name.toLowerCase() === normalizedName)) {
      setNameError(t('REFERENCE_PANEL.duplicateName') as string);
      return;
    }

    await addReference(newName, newType, newValue);
    setNewName('');
    setNewValue('');
    setNewType('text');
    setNewImageName('');
    setNameError('');
    setIsAdding(false);
  };

  const startEdit = (ref: ReferenceJson) => {
    setIsAdding(false);
    setEditingId(ref.id ?? null);
    setEditValue(ref.value);
    setEditName(ref.name);
    setEditImageName(ref.ref_type === 'image' && ref.value ? t('REFERENCE_PANEL.selectedImage') as string : '');
    setImageError('');
    setEditError('');
  };

  const startAdd = () => {
    setEditingId(null);
    setIsAdding(true);
  };

  const saveEdit = async (id: string) => {
    setIsSavingEdit(true);
    setEditError('');
    try {
      await editReference(id, { name: editName, value: editValue });
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
    if (e.key === 'Escape') { setIsAdding(false); cancelEdit(); }
  };

  return (
    <>
      <div
        ref={panelRef}
        className="ref-panel"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
      {/* ── Header ── */}
      <div className="ref-panel__header">
        <span className="ref-panel__title">{t('REFERENCE_PANEL.title')}</span>
        <button className="ref-panel__close" onClick={onClose} aria-label={t('REFERENCE_PANEL.close') as string}>
          <X size={14} />
        </button>
      </div>

      {/* ── Search ── */}
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

      {/* ── List ── */}
      <div className="ref-panel__list">
        {filtered.length === 0 && !isAdding && (
          <div className="ref-panel__empty">
            {search ? t('REFERENCE_PANEL.noResults') : t('REFERENCE_PANEL.empty')}
          </div>
        )}

        {filtered.map((ref) => (
          <div
            key={ref.id ?? ref.name}
            className="ref-item"
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
                <div className="ref-item__edit-status">
                  <Pencil size={13} />
                  <span>{t('REFERENCE_PANEL.editing', { name: ref.name })}</span>
                </div>
                <input
                  className="ref-item__input ref-item__input--name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, () => saveEdit(ref.id!))}
                  placeholder={t('REFERENCE_PANEL.namePlaceholder') as string}
                  autoFocus
                />
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
                <div className="ref-item__new-actions">
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
                    onClick={() => saveEdit(ref.id!)}
                    disabled={isSavingEdit || isUploadingImage}
                  >
                    {isSavingEdit ? t('REFERENCE_PANEL.saving') : t('REFERENCE_PANEL.save')}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Display mode ── */
              <div className="ref-item__row">
                <button
                  type="button"
                  className="ref-item__link"
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

        {/* ── Add form ── */}
        {isAdding && (
          <div className="ref-item ref-item--new">
            <div className="ref-item__new-form">
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
              {nameError && <span className="ref-item__error" role="alert">{nameError}</span>}
              <div
                className="ref-item__type-tabs"
                role="tablist"
                aria-label={t('REFERENCE_PANEL.typeSelection') as string}
              >
                {(['text', 'image'] as const).map((type) => (
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
              <div className="ref-item__new-actions">
                <button className="ref-item__btn ref-item__btn--cancel" onClick={() => setIsAdding(false)}>
                  {t('REFERENCE_PANEL.cancel')}
                </button>
                <button
                  className="ref-item__btn ref-item__btn--save"
                  onClick={handleAdd}
                  disabled={isUploadingImage || (newType === 'image' && !newValue)}
                >
                  {t('REFERENCE_PANEL.create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="ref-panel__footer">
        <button className="ref-panel__add-btn" onClick={startAdd}>
          <Plus size={14} />
          {t('REFERENCE_PANEL.newReference')}
        </button>
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
