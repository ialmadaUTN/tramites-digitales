import { useState } from 'react';
import { isFieldReadOnly, type UploadReference } from '@tramites/form-contracts';
import type { FieldRenderer } from './types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function FileUploadControl({ field, controllerField, enabled, uploadFile }: Parameters<FieldRenderer>[0]) {
  const interactive = enabled && !isFieldReadOnly(field);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const files = Array.isArray(controllerField.value) ? controllerField.value as UploadReference[] : [];
  const maxFiles = field.maxFiles ?? 5;
  return (
    <div className="file-upload-control">
      <input
        id={field.id}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple={maxFiles > 1}
        disabled={!interactive || busy || !uploadFile}
        onChange={async (event) => {
          const selected = Array.from(event.target.files ?? []);
          setUploadError(null);
          if (!uploadFile) return;
          const accepted = selected.filter((file) => ALLOWED_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE).slice(0, Math.max(0, maxFiles - files.length));
          if (accepted.length !== selected.length) setUploadError('Algunos archivos fueron rechazados por tipo, tamaño o cantidad.');
          setBusy(true);
          try {
            const references = await Promise.all(accepted.map((file) => uploadFile(field.fieldName, file)));
            controllerField.onChange([...files, ...references].slice(0, maxFiles));
          } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'No se pudo cargar el archivo');
          } finally {
            setBusy(false);
            event.target.value = '';
          }
        }}
      />
      <small>{busy ? 'Cargando archivo...' : 'PDF, JPG o PNG. Hasta 10 MB por archivo.'}</small>
      {files.length > 0 && <span className="file-list">{files.map((file) => file.name).join(', ')}</span>}
      {uploadError && <span className="field-error">{uploadError}</span>}
    </div>
  );
}

export const renderFileUploadField: FieldRenderer = (props) => <FileUploadControl {...props} />;
