import { commonInputProps } from './common-props';
import type { FieldRenderer } from './types';

export const renderTimeField: FieldRenderer = (props) => <input {...commonInputProps(props)} type="time" />;
