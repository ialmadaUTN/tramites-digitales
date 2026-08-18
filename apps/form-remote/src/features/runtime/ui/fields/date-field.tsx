import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderDateField: FieldRenderer = (props) => <input {...commonInputProps(props)} type="date" />;
