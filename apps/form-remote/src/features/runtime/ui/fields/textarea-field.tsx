import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderTextareaField: FieldRenderer = (props) => <textarea {...commonInputProps(props)} rows={4} />;
