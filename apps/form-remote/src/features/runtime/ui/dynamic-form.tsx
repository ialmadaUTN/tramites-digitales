import { isElementEnabled, isElementIncluded, isElementVisible, resolveTextTemplate, type DynamicFormProps, type FormDefinition, type FormItem, type FormRuntimeError } from '@tramites/form-contracts';
import { useEffect, useMemo, useRef } from 'react';
import { useRuntimeForm } from '../hooks/use-runtime-form';
import { DynamicField } from './fields/dynamic-field';
import { FormState } from './form-state';
import { DynamicRepeater } from './repeater/dynamic-repeater';
import '../../../styles.css';
import { valuesByFieldId } from '../model/field-state';
import { evaluatePreviewState } from '../model/preview-state';

type RenderedTextBlock = { title?: string; text: string };
type TextTemplateState = { rendered: Map<string, RenderedTextBlock>; error?: FormRuntimeError };

function resolveVisibleTextBlocks(definition: FormDefinition, conditionValues: Record<string, unknown>, externalVariables: Record<string, unknown>): TextTemplateState {
  const rendered = new Map<string, RenderedTextBlock>();
  const missing = new Set<string>();
  const invalid = new Set<string>();

  for (const container of definition.containers) {
    if (!isElementVisible(container.conditions, conditionValues, externalVariables)) continue;
    for (const item of container.items ?? container.fields.map((field) => ({ kind: 'field' as const, field }))) {
      if (item.kind !== 'textBlock' || (item.conditions?.visible && !isElementVisible(item.conditions, conditionValues, externalVariables))) continue;
      const title = item.title === undefined ? { success: true as const, value: undefined } : resolveTextTemplate(item.title, externalVariables);
      const text = resolveTextTemplate(item.text, externalVariables);
      if (!title.success) {
        title.missing.forEach((name) => missing.add(name));
        if (title.missing.length === 0) invalid.add(title.message);
      }
      if (!text.success) {
        text.missing.forEach((name) => missing.add(name));
        if (text.missing.length === 0) invalid.add(text.message);
      }
      if (title.success && text.success) rendered.set(item.id, { title: title.value, text: text.value });
    }
  }

  if (missing.size > 0 || invalid.size > 0) {
    const message = missing.size > 0 ? `Faltan variables externas: ${[...missing].join(', ')}` : [...invalid].join('; ');
    return { rendered, error: { code: 'MISSING_EXTERNAL_VARIABLE', message } };
  }
  return { rendered };
}

export function DynamicForm(props: DynamicFormProps) {
  const runtime = useRuntimeForm(props);
  const previewState = useMemo(
    () => runtime.definition
      ? evaluatePreviewState(runtime.definition, runtime.values, runtime.externalVariables)
      : undefined,
    [runtime.definition, runtime.values, runtime.externalVariables],
  );
  const conditionValues = useMemo(
    () => runtime.definition ? valuesByFieldId(runtime.fieldMap, runtime.values) : {},
    [runtime.definition, runtime.fieldMap, runtime.values],
  );
  const textTemplateState = useMemo(
    () => runtime.definition && previewState?.visible
      ? resolveVisibleTextBlocks(runtime.definition, conditionValues, runtime.externalVariables)
      : { rendered: new Map<string, RenderedTextBlock>() },
    [runtime.definition, runtime.externalVariables, conditionValues, previewState?.visible],
  );
  const lastTemplateError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previewState) props.onPreviewStateChange?.(previewState);
  }, [previewState, props.onPreviewStateChange]);

  useEffect(() => {
    const error = textTemplateState.error;
    const signature = error ? `${error.code}:${error.message}` : undefined;
    if (error && signature && signature !== lastTemplateError.current) props.onError?.(error);
    lastTemplateError.current = signature;
  }, [props.onError, textTemplateState.error]);

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

  if (!previewState?.visible) {
    return <FormState>Este formulario no está disponible para el contexto actual.</FormState>;
  }
  if (textTemplateState.error) {
    return (
      <FormState title="No se pudo mostrar" variant="error">
        <span>{textTemplateState.error.message}</span>
      </FormState>
    );
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
      {textTemplateState.rendered.get(item.id)?.title && <h3>{textTemplateState.rendered.get(item.id)?.title}</h3>}
      <p>{textTemplateState.rendered.get(item.id)?.text ?? item.text}</p>
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
