import type { ReactNode } from 'react';

type FormStateProps = {
  title?: string;
  children: ReactNode;
  variant?: 'default' | 'success' | 'error';
};

export function FormState({ title, children, variant = 'default' }: FormStateProps) {
  const className = variant === 'default' ? 'form-state' : `form-state form-${variant}`;
  return (
    <div className={className}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}
