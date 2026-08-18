'use client';

import { useState } from 'react';
import type { FormSummary } from '../api/forms-api';

type FormListProps = {
  forms: FormSummary[];
  selectedId: string | null;
  saving: boolean;
  onCreate: () => void;
  onSelect: (formId: string) => void;
};

export function FormList({ forms, selectedId, saving, onCreate, onSelect }: FormListProps) {
  const [search, setSearch] = useState('');

  const filteredForms = forms.filter(
    (form) =>
      form.name.toLowerCase().includes(search.toLowerCase()) ||
      form.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="panel">
      <div className="panel-header">
        <h2>Formularios</h2>
        <span className="badge badge-info">{forms.length} {forms.length === 1 ? 'ítem' : 'ítems'}</span>
      </div>

      <button className="button primary" style={{ width: '100%', marginBottom: 14 }} onClick={onCreate} disabled={saving}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nuevo formulario
      </button>

      {forms.length > 3 && (
        <div className="search-wrapper">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="form-list">
        {filteredForms.map((form) => {
          const isSelected = selectedId === form.id;
          return (
            <button
              key={form.id}
              className={`form-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelect(form.id)}
            >
              <span className="form-item-title">{form.name}</span>
              <span className="form-item-meta">
                <span className={`badge ${form.published ? 'badge-success' : 'badge-warning'}`}>
                  <span className="badge-dot" />
                  {form.published ? 'Publicado' : 'Borrador'}
                </span>
                <span className="form-item-id">#{form.id.slice(0, 8)}</span>
              </span>
            </button>
          );
        })}

        {filteredForms.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {search ? 'No se encontraron formularios' : 'No hay formularios aún.'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
