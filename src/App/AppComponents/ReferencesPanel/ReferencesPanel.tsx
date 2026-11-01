import './ReferencesPanel.css';

import { Image, Pencil, Plus, Search, Trash2, Type, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReferenceJson } from '@/core/database/useReferenceDatabase';
import { useReferenceStore } from '@/core/references/useReferenceStore';

type RefType = ReferenceJson['ref_type'];

const TYPE_ICONS: Record<RefType, React.ReactNode> = {
  text:   <Type size={12} />,
  number: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>#</span>,
  image:  <Image size={12} />,
};

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

  // Edit form state
  const [editValue, setEditValue] = useState('');
  const [editName, setEditName] = useState('');

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
    if (!newName.trim()) return;
    await addReference(newName, newType, newValue);
    setNewName('');
    setNewValue('');
    setNewType('text');
    setIsAdding(false);
  };

  const startEdit = (ref: ReferenceJson) => {
    setEditingId(ref.id ?? null);
    setEditValue(ref.value);
    setEditName(ref.name);
  };

  const saveEdit = async (id: string) => {
    await editReference(id, { name: editName, value: editValue });
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); action(); }
    if (e.key === 'Escape') { setIsAdding(false); setEditingId(null); }
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
        <button className="ref-panel__close" onClick={onClose} aria-label={t('REFERENCE_PANEL.close')}>
          <X size={14} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="ref-panel__search-wrap">
        <Search size={13} className="ref-panel__search-icon" />
        <input
          ref={searchRef}
          className="ref-panel__search"
          placeholder={t('REFERENCE_PANEL.searchPlaceholder')}
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
              <div className="ref-item__edit">
                <input
                  className="ref-item__input ref-item__input--name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, () => saveEdit(ref.id!))}
                  placeholder={t('REFERENCE_PANEL.namePlaceholder')}
                  autoFocus
                />
                <input
                  className="ref-item__input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, () => saveEdit(ref.id!))}
                  placeholder={t('REFERENCE_PANEL.valuePlaceholder')}
                />
                <button className="ref-item__btn ref-item__btn--save" onClick={() => saveEdit(ref.id!)}>
                  {t('REFERENCE_PANEL.save')}
                </button>
              </div>
            ) : (
              /* ── Display mode ── */
              <div className="ref-item__row" onDoubleClick={() => startEdit(ref)}>
                <span className="ref-item__type-icon" title={t(`REFERENCE_PANEL.types.${ref.ref_type}`)}>
                  {TYPE_ICONS[ref.ref_type as RefType]}
                </span>
                <span className="ref-item__name">@{ref.name}</span>
                <span className="ref-item__value">{ref.value || <em>{t('REFERENCE_PANEL.emptyValue')}</em>}</span>
                <button
                  className="ref-item__btn ref-item__btn--edit"
                  onClick={() => startEdit(ref)}
                  aria-label={t('REFERENCE_PANEL.edit', { name: ref.name })}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="ref-item__btn ref-item__btn--delete"
                  onClick={() => removeReference(ref.id!)}
                  aria-label={t('REFERENCE_PANEL.delete', { name: ref.name })}
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
                placeholder={t('REFERENCE_PANEL.newNamePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
              />
              <select
                className="ref-item__select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as RefType)}
              >
                <option value="text">{t('REFERENCE_PANEL.types.text')}</option>
                <option value="number">{t('REFERENCE_PANEL.types.number')}</option>
                <option value="image">{t('REFERENCE_PANEL.types.image')}</option>
              </select>
              <input
                className="ref-item__input"
                placeholder={t('REFERENCE_PANEL.valuePlaceholder')}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
              />
              <div className="ref-item__new-actions">
                <button className="ref-item__btn ref-item__btn--cancel" onClick={() => setIsAdding(false)}>
                  {t('REFERENCE_PANEL.cancel')}
                </button>
                <button className="ref-item__btn ref-item__btn--save" onClick={handleAdd}>
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
