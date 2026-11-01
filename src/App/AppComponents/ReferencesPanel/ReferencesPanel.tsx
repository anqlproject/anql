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
}

export default function ReferencesPanel({ panelRef, onClose }: ReferencesPanelProps) {
  const { t } = useTranslation();
  const { references, isLoaded, loadReferences, addReference, editReference, removeReference } = useReferenceStore();

  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    setEditingId(ref.id ?? null);
    setEditValue(ref.value);
    setEditName(ref.name);
    setEditImageName(ref.ref_type === 'image' && ref.value ? t('REFERENCE_PANEL.selectedImage') as string : '');
    setImageError('');
    setEditError('');
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
          <div key={ref.id} className="ref-item">
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
                    <Image size={14} />
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
              <div className="ref-item__row" onDoubleClick={() => startEdit(ref)}>
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
                <button
                  className="ref-item__btn ref-item__btn--edit"
                  onClick={() => startEdit(ref)}
                  aria-label={t('REFERENCE_PANEL.edit', { name: ref.name }) as string}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="ref-item__btn ref-item__btn--delete"
                  onClick={() => removeReference(ref.id!)}
                  aria-label={t('REFERENCE_PANEL.delete', { name: ref.name }) as string}
                >
                  <Trash2 size={12} />
                </button>
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
              <select
                className="ref-item__select"
                value={newType}
                onChange={(e) => {
                  setNewType(e.target.value as RefType);
                  setNewValue('');
                  setNewImageName('');
                  setImageError('');
                }}
              >
                <option value="text">{t('REFERENCE_PANEL.types.text')}</option>
                <option value="image">{t('REFERENCE_PANEL.types.image')}</option>
              </select>
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
        <button className="ref-panel__add-btn" onClick={() => setIsAdding(true)}>
          <Plus size={14} />
          {t('REFERENCE_PANEL.newReference')}
        </button>
      </div>
    </div>
  );
}
