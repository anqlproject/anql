import './ReferencesPanel.css';

import { Image, Plus, Search, Trash2, Type, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ReferenceJson } from '@/core/database/useReferenceDatabase';
import { useReferenceStore } from '@/core/references/useReferenceStore';

type RefType = ReferenceJson['ref_type'];

const TYPE_ICONS: Record<RefType, React.ReactNode> = {
  text:   <Type size={12} />,
  number: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>#</span>,
  image:  <Image size={12} />,
};

const TYPE_LABELS: Record<RefType, string> = {
  text: 'Texte',
  number: 'Nombre',
  image: 'Image',
};

interface ReferencesPanelProps {
  panelRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
}

export default function ReferencesPanel({ panelRef, onClose }: ReferencesPanelProps) {
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
        <span className="ref-panel__title">Références</span>
        <button className="ref-panel__close" onClick={onClose} aria-label="Fermer">
          <X size={14} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="ref-panel__search-wrap">
        <Search size={13} className="ref-panel__search-icon" />
        <input
          ref={searchRef}
          className="ref-panel__search"
          placeholder="Rechercher une référence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── List ── */}
      <div className="ref-panel__list">
        {filtered.length === 0 && !isAdding && (
          <div className="ref-panel__empty">
            {search ? 'Aucun résultat' : 'Aucune référence — cliquez + pour créer'}
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
                  placeholder="nom"
                  autoFocus
                />
                <input
                  className="ref-item__input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, () => saveEdit(ref.id!))}
                  placeholder="valeur"
                />
                <button className="ref-item__btn ref-item__btn--save" onClick={() => saveEdit(ref.id!)}>
                  Enregistrer
                </button>
              </div>
            ) : (
              /* ── Display mode ── */
              <div className="ref-item__row" onDoubleClick={() => startEdit(ref)}>
                <span className="ref-item__type-icon" title={TYPE_LABELS[ref.ref_type as RefType]}>
                  {TYPE_ICONS[ref.ref_type as RefType]}
                </span>
                <span className="ref-item__name">@{ref.name}</span>
                <span className="ref-item__value">{ref.value || <em>vide</em>}</span>
                <button
                  className="ref-item__btn ref-item__btn--delete"
                  onClick={() => removeReference(ref.id!)}
                  aria-label={`Supprimer @${ref.name}`}
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
                placeholder="nom_référence"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
              />
              <select
                className="ref-item__select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as RefType)}
              >
                <option value="text">Texte</option>
                <option value="number">Nombre</option>
                <option value="image">Image</option>
              </select>
              <input
                className="ref-item__input"
                placeholder="valeur"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
              />
              <div className="ref-item__new-actions">
                <button className="ref-item__btn ref-item__btn--cancel" onClick={() => setIsAdding(false)}>
                  Annuler
                </button>
                <button className="ref-item__btn ref-item__btn--save" onClick={handleAdd}>
                  Créer
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
          Nouvelle référence
        </button>
      </div>
    </div>
  );
}
