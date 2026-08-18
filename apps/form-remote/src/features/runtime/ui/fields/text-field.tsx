import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderTextField: FieldRenderer = (props) => <input {...commonInputProps(props)} type="text" />;
