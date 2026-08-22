import { isElementEnabled, isElementIncluded, isElementVisible, type DynamicFormProps, type FormItem } from '@tramites/form-contracts';
import { useEffect, useMemo } from 'react';
import { useRuntimeForm } from '../hooks/use-runtime-form';
import { DynamicField } from './fields/dynamic-field';
import { FormState } from './form-state';
import { DynamicRepeater } from './repeater/dynamic-repeater';
import '../../../styles.css';
import { valuesByFieldId } from '../model/field-state';
import { evaluatePreviewState } from '../model/preview-state';

export function DynamicForm(props: DynamicFormProps) {
  const runtime = useRuntimeForm(props);
  const previewState = useMemo(
    () => runtime.definition
      ? evaluatePreviewState(runtime.definition, runtime.values, runtime.externalVariables)
      : undefined,
    [runtime.definition, runtime.values, runtime.externalVariables],
  );

  useEffect(() => {
    if (previewState) props.onPreviewStateChange?.(previewState);
  }, [previewState, props.onPreviewStateChange]);

  if (runtime.loadError) {
    return (
      <FormState title="No se pudo cargar" variant="error">
        <span>{runtime.loadError}</span>
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

  const conditionValues = valuesByFieldId(runtime.fieldMap, runtime.values);
  if (!previewState?.visible) {
    return <FormState>Este formulario no está disponible para el contexto actual.</FormState>;
  }
  const formEnabled = previewState.enabled;

  const formIncluded = previewState.included;
  const renderItem = (item: FormItem, ancestorEnabled = true, ancestorIncluded = true) => item.kind === 'field' ? (
    <DynamicField
      key={item.field.id}
      field={item.field}
      control={runtime.control}
      values={runtime.values}
      errors={runtime.errors}
      fieldMap={runtime.fieldMap}
      externalVariables={runtime.externalVariables}
      ancestorEnabled={ancestorEnabled}
      ancestorIncluded={ancestorIncluded}
      uploadFile={runtime.uploadFile}
    />
  ) : (!item.conditions?.visible || isElementVisible(item.conditions, conditionValues, runtime.externalVariables)) ? (
    <aside className="form-info-block" key={item.id}>
      {item.title && <h3>{item.title}</h3>}
      <p>{item.text}</p>
    </aside>
  ) : null;

  return (
    <form className="dynamic-form" onSubmit={runtime.handleSubmit(runtime.submit)} noValidate>
      <fieldset disabled={!formEnabled} style={{ border: 0, padding: 0, margin: 0 }}>
      <header className="form-header">
        <span className="eyebrow">Formulario dinámico · v{runtime.version ?? 'borrador'}</span>
        <h1>{runtime.definition.title}</h1>
        {runtime.definition.description && <p>{runtime.definition.description}</p>}
      </header>
      {runtime.definition.containers.map((container) => {
        const containerEnabled = isElementEnabled(container.conditions, conditionValues, runtime.externalVariables);
        const containerIncluded = formIncluded && isElementIncluded(container.conditions, conditionValues, runtime.externalVariables);
        if (!isElementVisible(container.conditions, conditionValues, runtime.externalVariables)) return null;
        return (
          <section className="form-container" key={container.id}>
            <h2>{container.title}</h2>
            {container.kind === 'repeater' ? (
              <DynamicRepeater container={container} control={runtime.control} enabled={containerEnabled} />
            ) : (
              <fieldset disabled={!containerEnabled} style={{ border: 0, padding: 0, margin: 0 }}>
                <div className={container.columns === 2 ? 'field-grid two-columns' : 'field-grid'}>
                  {(container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }))).map((item) => renderItem(item, containerEnabled, containerIncluded))}
                </div>
              </fieldset>
            )}
          </section>
        );
      })}
      {runtime.remoteError && <div className="inline-error">{runtime.remoteError.message}</div>}
      <button className="primary-button" disabled={runtime.submitting} type="submit">
        {runtime.submitting ? 'Enviando…' : runtime.definition.submitLabel}
      </button>
      </fieldset>
    </form>
  );
}
