'use client';

import type { FaqBlock, FormDefinition } from '@tramites/form-contracts';
import { moveFaqBlock, removeFaqBlock, updateFaqBlock } from '../model/definition';
import type { FaqBlockEditorErrors } from '../model/editor-validation';

type FaqBlockEditorProps = {
  block: FaqBlock;
  index: number;
  count: number;
  definition: FormDefinition;
  blockErrors?: FaqBlockEditorErrors;
  setDefinition: (definition: FormDefinition) => void;
};

export function FaqBlockEditor({ block, index, count, definition, blockErrors, setDefinition }: FaqBlockEditorProps) {
  const change = (update: (current: FaqBlock) => FaqBlock) => setDefinition(updateFaqBlock(definition, block.id, update));

  return (
    <div className={`field-editor${blockErrors ? ' has-error' : ''}`}>
      <div className="field-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="field-badge-type">
            <span style={{ color: 'var(--ink-muted)', fontSize: 11, fontWeight: 800 }}>#{index + 1}</span>
            {block.question || 'Pregunta sin título'}
          </span>
          <span className="field-type-tag">FAQ</span>
          {block.initiallyOpen && <span className="badge badge-info">Abierto por defecto</span>}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="button sm ghost"
            onClick={() => setDefinition(moveFaqBlock(definition, block.id, -1))}
            disabled={index === 0}
            title="Mover arriba"
          >
            ↑
          </button>
          <button
            type="button"
            className="button sm ghost"
            onClick={() => setDefinition(moveFaqBlock(definition, block.id, 1))}
            disabled={index === count - 1}
            title="Mover abajo"
          >
            ↓
          </button>
          <button
            type="button"
            className="button sm danger"
            onClick={() => setDefinition(removeFaqBlock(definition, block.id))}
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group full">
          <label>Pregunta / título</label>
          <input
            value={block.question}
            className={blockErrors?.question ? 'invalid' : undefined}
            aria-invalid={Boolean(blockErrors?.question)}
            onChange={(event) => change((current) => ({ ...current, question: event.target.value }))}
            placeholder="Ej. ¿Qué documentación necesito?"
          />
          {blockErrors?.question && <span className="field-error">{blockErrors.question}</span>}
        </div>

        <div className="form-group full">
          <label>
            Respuesta / contenido
            <span className="hint">Texto plano. No admite Markdown ni HTML.</span>
          </label>
          <textarea
            value={block.answer}
            className={blockErrors?.answer ? 'invalid' : undefined}
            aria-invalid={Boolean(blockErrors?.answer)}
            onChange={(event) => change((current) => ({ ...current, answer: event.target.value }))}
            placeholder="Ej. Necesitás el DNI y el comprobante de domicilio."
          />
          {blockErrors?.answer && <span className="field-error">{blockErrors.answer}</span>}
        </div>
      </div>

      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={block.initiallyOpen}
            onChange={(event) => change((current) => ({ ...current, initiallyOpen: event.target.checked }))}
          />
          Mostrar abierto por defecto
        </label>
      </div>
    </div>
  );
}
