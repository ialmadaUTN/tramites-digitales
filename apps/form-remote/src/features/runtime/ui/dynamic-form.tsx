import type { DynamicFormProps } from '@tramites/form-contracts';
import { useRuntimeForm } from '../hooks/use-runtime-form';
import { DynamicField } from './fields/dynamic-field';
import { FormState } from './form-state';
import { DynamicRepeater } from './repeater/dynamic-repeater';
import '../../../styles.css';

export function DynamicForm(props: DynamicFormProps) {
  const runtime = useRuntimeForm(props);

  if (runtime.loadError) {
    // Un formulario pausado no es una falla: se muestra el mensaje del BFF sin el encabezado de error.
    const paused = runtime.loadError.code === 'FORM_PAUSED';
    return (
      <FormState title={paused ? 'Formulario no disponible' : 'No se pudo cargar'} variant="error">
        <span>{runtime.loadError.message}</span>
      </FormState>
    );
  }
  if (!runtime.definition) return <FormState>Cargando formulario…</FormState>;
  if (runtime.receipt) {
    return (
      <FormState title="Gestión recibida" variant="success">
        <span>Número de submission: {runtime.receipt.submissionId}</span>
        <span>Estado del mock: {runtime.receipt.deliveryStatus}</span>
      </FormState>
    );
  }

  return (
    <form className="dynamic-form" onSubmit={runtime.handleSubmit(runtime.submit)} noValidate>
      <header className="form-header">
        <span className="eyebrow">Formulario dinámico · v{runtime.version ?? 'borrador'}</span>
        <h1>{runtime.definition.title}</h1>
        {runtime.definition.description && <p>{runtime.definition.description}</p>}
      </header>
      {runtime.definition.containers.map((container) => (
        <section className="form-container" key={container.id}>
          <h2>{container.title}</h2>
          {container.kind === 'repeater' ? (
            <DynamicRepeater container={container} control={runtime.control} />
          ) : (
            <div className={container.columns === 2 ? 'field-grid two-columns' : 'field-grid'}>
              {container.fields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  control={runtime.control}
                  values={runtime.values}
                  errors={runtime.errors}
                  fieldMap={runtime.fieldMap}
                  uploadFile={runtime.uploadFile}
                />
              ))}
            </div>
          )}
        </section>
      ))}
      {runtime.remoteError && <div className="inline-error">{runtime.remoteError.message}</div>}
      <button className="primary-button" disabled={runtime.submitting} type="submit">
        {runtime.submitting ? 'Enviando…' : runtime.definition.submitLabel}
      </button>
    </form>
  );
}
