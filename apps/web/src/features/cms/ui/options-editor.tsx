'use client';

import { useMemo, useState } from 'react';
import type { FormOption } from '@tramites/form-contracts';
import { duplicateOptionValues } from '@tramites/form-contracts/field-rules';
import {
  addOption,
  moveOption,
  parseOptions,
  removeOption,
  serializeOptions,
  slugifyOptionValue,
  updateOption,
} from '../model/definition';

type OptionsEditorProps = {
  options: FormOption[] | undefined;
  error?: string;
  onChange: (options: FormOption[]) => void;
};

/** Marca por fila lo que el editor rechaza al guardar: etiqueta/valor vacío o repetido. */
function optionRowIssues(options: FormOption[]): { label?: string; value?: string }[] {
  const duplicates = new Set(duplicateOptionValues(options));
  return options.map((option) => ({
    label: option.label.trim() ? undefined : 'Falta la etiqueta',
    value: !String(option.value).trim()
      ? 'Falta el valor'
      : duplicates.has(String(option.value).trim())
        ? 'Valor repetido'
        : undefined,
  }));
}

const PRESETS: Record<string, { label: string; options: FormOption[] }> = {
  yesNo: {
    label: 'Sí / No',
    options: [
      { label: 'Sí', value: 'si' },
      { label: 'No', value: 'no' },
    ],
  },
  priority: {
    label: 'Prioridad (Baja / Media / Alta)',
    options: [
      { label: 'Baja', value: 'baja' },
      { label: 'Media', value: 'media' },
      { label: 'Alta', value: 'alta' },
    ],
  },
  gender: {
    label: 'Género',
    options: [
      { label: 'Femenino', value: 'femenino' },
      { label: 'Masculino', value: 'masculino' },
      { label: 'Otro / Prefiero no decir', value: 'otro' },
    ],
  },
};

export function OptionsEditor({ options = [], error, onChange }: OptionsEditorProps) {
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  const [rawText, setRawText] = useState(() => serializeOptions(options));
  const issues = useMemo(() => optionRowIssues(options), [options]);

  const handleModeChange = (newMode: 'visual' | 'text') => {
    if (newMode === 'text') {
      setRawText(serializeOptions(options));
    } else {
      const parsed = parseOptions(rawText);
      onChange(parsed);
    }
    setMode(newMode);
  };

  const handleTextChange = (text: string) => {
    setRawText(text);
    onChange(parseOptions(text));
  };

  const handleAddOption = () => {
    const next = addOption(options);
    onChange(next);
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const currentOpt = options[index];
    if (!currentOpt) return;

    const oldSlug = slugifyOptionValue(currentOpt.label);
    const currentValueStr = String(currentOpt.value);

    // Auto-update value if current value was empty, matched the previous slug, or was default
    const shouldAutoUpdateValue =
      !currentValueStr ||
      currentValueStr === oldSlug ||
      currentValueStr === `opcion_${index + 1}` ||
      currentValueStr === 'option';

    const nextValue = shouldAutoUpdateValue ? slugifyOptionValue(newLabel) || `opcion_${index + 1}` : currentOpt.value;

    onChange(updateOption(options, index, { label: newLabel, value: nextValue }));
  };

  const handleValueChange = (index: number, newValue: string) => {
    onChange(updateOption(options, index, { value: newValue }));
  };

  const handleRemoveOption = (index: number) => {
    onChange(removeOption(options, index));
  };

  const handleMoveOption = (index: number, offset: -1 | 1) => {
    onChange(moveOption(options, index, offset));
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      onChange(preset.options);
      setRawText(serializeOptions(preset.options));
    }
  };

  return (
    <div className="options-editor-container">
      <div className="options-editor-header">
        <div className="options-editor-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span>Opciones configuradas</span>
          <span className="badge badge-info">{options.length} {options.length === 1 ? 'opción' : 'opciones'}</span>
          {error && <span className="badge badge-warning">Revisar</span>}
        </div>

        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${mode === 'visual' ? 'active' : ''}`}
            onClick={() => handleModeChange('visual')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Visual
          </button>
          <button
            type="button"
            className={`segmented-btn ${mode === 'text' ? 'active' : ''}`}
            onClick={() => handleModeChange('text')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            Texto masivo
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div className="options-visual-content">
          {options.length === 0 ? (
            <div className="options-empty-state">
              <div className="options-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p>No hay opciones configuradas para este campo.</p>
              <button type="button" className="button sm primary" onClick={handleAddOption}>
                + Agregar primera opción
              </button>
            </div>
          ) : (
            <div className="options-table">
              <div className="options-table-header">
                <span className="col-idx">#</span>
                <span className="col-label">Etiqueta visible (lo que ve el usuario)</span>
                <span className="col-value">Valor interno (JSON value)</span>
                <span className="col-actions">Acciones</span>
              </div>

              <div className="options-rows">
                {options.map((opt, index) => (
                  <div key={index} className="option-row-item">
                    <span className="option-row-idx">#{index + 1}</span>

                    <div className="option-field-wrap">
                      <input
                        type="text"
                        className={`option-input${issues[index]?.label ? ' invalid' : ''}`}
                        aria-invalid={Boolean(issues[index]?.label)}
                        value={opt.label}
                        onChange={(e) => handleLabelChange(index, e.target.value)}
                        placeholder={`Ej. Opción ${index + 1}`}
                      />
                      {issues[index]?.label && <span className="field-error">{issues[index]?.label}</span>}
                    </div>

                    <div className="option-field-wrap">
                      <div className="option-value-input-container">
                        <input
                          type="text"
                          className={`option-input option-input-code${issues[index]?.value ? ' invalid' : ''}`}
                          aria-invalid={Boolean(issues[index]?.value)}
                          value={opt.value}
                          onChange={(e) => handleValueChange(index, e.target.value)}
                          placeholder={`opcion_${index + 1}`}
                        />
                      </div>
                      {issues[index]?.value && <span className="field-error">{issues[index]?.value}</span>}
                    </div>

                    <div className="option-row-actions">
                      <button
                        type="button"
                        className="button sm ghost option-btn-move"
                        disabled={index === 0}
                        onClick={() => handleMoveOption(index, -1)}
                        title="Mover arriba"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button sm ghost option-btn-move"
                        disabled={index === options.length - 1}
                        onClick={() => handleMoveOption(index, 1)}
                        title="Mover abajo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="button sm danger option-btn-delete"
                        onClick={() => handleRemoveOption(index)}
                        title="Eliminar opción"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="options-footer">
            <button type="button" className="button sm secondary" onClick={handleAddOption}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Agregar opción
            </button>

            <div className="options-presets">
              <span className="options-presets-label">Plantillas:</span>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  className="preset-chip-btn"
                  onClick={() => handleApplyPreset(key)}
                  title={`Cargar ${preset.label}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="options-text-content">
          <textarea
            className="options-textarea"
            rows={5}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={'theft|Robo\naccident|Accidente\nother|Otro'}
          />
          <div className="options-text-help">
            <span className="hint">
              Formato: <code>valor|Etiqueta visible</code> (una por línea).
            </span>
            <span className="hint">
              Internamente se guarda como pares clave/valor compatibles con el esquema de opciones.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
