import type { ReactElement } from 'react';
import type { Control, ControllerRenderProps } from 'react-hook-form';
import type { FormField, FormOption, UploadReference } from '@tramites/form-contracts';
import type { FormValues } from '../../../../shared/types/form-values';

export type FieldControlProps = {
  field: FormField;
  control: Control<FormValues>;
  enabled: boolean;
  options: FormOption[];
};

export type FieldInputProps = {
  field: FormField;
  controllerField: ControllerRenderProps<FormValues>;
  enabled: boolean;
  options: FormOption[];
  uploadFile?: (fieldName: string, file: File) => Promise<UploadReference>;
};

export type FieldRenderer = (props: FieldInputProps) => ReactElement;
