'use client';

import { useState } from 'react';
import { formDefinitionSchema, type FormDefinition } from '@tramites/form-contracts';
import type { DefinitionEditorErrors } from '../model/editor-validation';

type JsonPreviewPanelProps = {
  definition: FormDefinition;
  editorErrors: DefinitionEditorErrors;
};

/**
 * Junta los mismos mensajes que ya ve el autor junto a cada campo en
 * "Estructura", en vez de inventar un texto nuevo para este panel.
 */
function pushRecordMessages(messages: string[], record: Record<string, Record<string, string | undefined>>) {
  for (const errors of Object.values(record)) {
    for (const message of Object.values(errors)) if (message) messages.push(message);
  }
}

function collectMessages(editorErrors: DefinitionEditorErrors): string[] {
  const messages: string[] = [];
  for (const message of [editorErrors.name, editorErrors.title, editorErrors.submitLabel, editorErrors.tipificationKey, editorErrors.conditions]) {
    if (message) messages.push(message);
  }
  pushRecordMessages(messages, editorErrors.containers);
  pushRecordMessages(messages, editorErrors.fields);
  pushRecordMessages(messages, editorErrors.faqBlocks);
  pushRecordMessages(messages, editorErrors.textBlocks);
  return messages;
}

/**
 * Vista de solo lectura del JSON que efectivamente viajaría al BFF: se
 * normaliza con el mismo `formDefinitionSchema` que valida ahí (aplica los
 * valores por defecto y descarta cualquier clave que no sea parte del
 * contrato — nunca puede filtrar algo que el contrato no declara). No hay
 * forma de editar el JSON acá a propósito: es un espejo, no un editor
 * alternativo.
 */
export function JsonPreviewPanel({ definition, editorErrors }: JsonPreviewPanelProps) {
  const [copied, setCopied] = useState(false);
  const parsed = formDefinitionSchema.safeParse(definition);

  const messages = collectMessages(editorErrors);
  // El fallback de Zod solo aporta cuando el editor no marcó nada: si ya
  // hay mensajes propios, agregar los issues crudos de Zod solo repite la
  // misma falla con un texto menos claro (p. ej. "title: Invalid input"
  // junto a "El título es obligatorio").
  if (!parsed.success && messages.length === 0) {
    for (const issue of parsed.error.issues) {
      messages.push(issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message);
    }
  }

  // Si el schema no pudo normalizar (caso raro: el editor ya debería haber
  // marcado el problema), se muestra igual la definición tal cual está en
  // pantalla, para no dejar el panel en blanco justo cuando más hace falta.
  const json = JSON.stringify(parsed.success ? parsed.data : definition, null, 2);

  const handleCopy = () => {
    void navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>JSON de la definición</h2>
          <span className="hint">
            Es la definición normalizada tal como se validaría y guardaría en el BFF. Vista de solo lectura: no se puede editar el JSON acá.
          </span>
        </div>
        <div className="toolbar-actions">
          {copied && <span className="badge badge-success">¡Copiado!</span>}
          <button type="button" className="button sm secondary" onClick={handleCopy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copiar JSON
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="json-preview-errors" role="alert">
          <strong>{messages.length === 1 ? 'Hay un problema en la definición:' : `Hay ${messages.length} problemas en la definición:`}</strong>
          <ul>
            {messages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}

      <pre className="json-preview-code" aria-label="JSON de la definición del formulario">{json}</pre>
    </div>
  );
}
