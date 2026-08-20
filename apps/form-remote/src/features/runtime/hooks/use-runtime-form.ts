import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import type { DynamicFormProps, FormDefinition, FormRuntimeError, RuntimeFormResponse, SubmissionReceipt, UploadReference } from '@tramites/form-contracts';
import { flattenFields } from '@tramites/form-contracts';
import { validateSubmission } from '@tramites/form-contracts/validation';
import { toErrorMessage } from '../../../shared/lib/http';
import type { FormValues } from '../../../shared/types/form-values';
import { createRuntimeApi, type RuntimeApi } from '../api/runtime-api';
import { getStorageClient } from '../api/storage-client';

function applyFieldErrors(
  setError: (name: string, error: { type: string; message: string }) => void,
  errors: Record<string, string>,
) {
  for (const [fieldName, message] of Object.entries(errors)) {
    setError(fieldName, { type: 'validate', message });
  }
}

function nestFieldErrors(errors: Record<string, string>): FieldErrors<FormValues> {
  const nested: Record<string, any> = {};
  for (const [path, message] of Object.entries(errors)) {
    const parts = path.split('.');
    let current = nested;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = { type: 'validate', message };
        return;
      }
      current[part] ??= {};
      current = current[part] as Record<string, any>;
    });
  }
  return nested as FieldErrors<FormValues>;
}

const createResolver = (getDefinition: () => FormDefinition | undefined): Resolver<FormValues> =>
  async (values) => {
    const definition = getDefinition();
    if (!definition) return { values, errors: {} };
    const result = validateSubmission(definition, values);
    if (result.success) return { values, errors: {} };
    return {
      values: {},
      errors: nestFieldErrors(result.errors),
    };
  };

export function useRuntimeForm(
  { formId, apiBaseUrl, mode = 'published', onSubmitted, onError }: DynamicFormProps,
  apiFactory: (baseUrl: string) => RuntimeApi = createRuntimeApi,
) {
  const api = useMemo(() => apiFactory(apiBaseUrl), [apiBaseUrl, apiFactory]);
  const [runtime, setRuntime] = useState<RuntimeFormResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<FormRuntimeError | null>(null);
  const uploadSession = useRef(crypto.randomUUID());
  const definitionRef = useRef<FormDefinition | undefined>(undefined);
  const form = useForm<FormValues>({
    mode: 'onTouched',
    reValidateMode: 'onChange',
    resolver: createResolver(() => definitionRef.current),
  });
  const values = form.watch();
  const definition = runtime?.definition;
  definitionRef.current = definition;
  const fieldMap = useMemo(
    () => new Map((definition ? flattenFields(definition) : []).map((field) => [field.id, field])),
    [definition],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .loadForm(formId, mode)
      .then((data) => {
        if (!cancelled) setRuntime(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(toErrorMessage(error, 'No se pudo cargar el formulario'));
      });
    return () => {
      cancelled = true;
    };
  }, [api, formId, mode]);

  async function submit(payload: FormValues) {
    if (!definition) return;
    setSubmitting(true);
    setReceipt(null);
    setRemoteError(null);
    const validation = validateSubmission(definition, payload);
    if (!validation.success) {
      applyFieldErrors(form.setError, validation.errors);
      setSubmitting(false);
      return;
    }
    if (!runtime.version) {
      setSubmitting(false);
      return;
    }
    try {
      const nextReceipt = await api.submit(formId, { version: runtime.version, payload: validation.data }, uploadSession.current);
      setReceipt(nextReceipt);
      onSubmitted?.(nextReceipt);
    } catch (error) {
      const formError: FormRuntimeError = {
        code: 'SUBMIT_ERROR',
        message: toErrorMessage(error, 'No se pudo enviar el formulario'),
      };
      setRemoteError(formError);
      onError?.(formError);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadFile(fieldName: string, file: File): Promise<UploadReference> {
    const storage = getStorageClient();
    if (!storage) throw new Error('La carga de archivos no está configurada en este ambiente');
    const ticket = await api.createUpload(formId, { fieldName, name: file.name, contentType: file.type, size: file.size }, uploadSession.current);
    const { error } = await storage.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, cacheControl: '3600' });
    if (error) throw new Error(error.message);
    return api.completeUpload(formId, ticket.uploadId, uploadSession.current);
  }

  const uploadCapability = getStorageClient() ? uploadFile : undefined;

  return {
    control: form.control,
    handleSubmit: form.handleSubmit,
    values,
    errors: form.formState.errors,
    definition,
    fieldMap,
    version: runtime?.version,
    loadError,
    receipt,
    submitting,
    remoteError,
    submit,
    uploadFile: uploadCapability,
  };
}
