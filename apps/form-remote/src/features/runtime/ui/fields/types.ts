import type { ReactElement } from 'react';
import type { Control, ControllerRenderProps } from 'react-hook-form';
import type { FormField, FormOption } from '@tramites/form-contracts';
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
};

export type FieldRenderer = (props: FieldInputProps) => ReactElement;
