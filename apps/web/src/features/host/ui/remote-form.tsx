'use client';

import React, { Suspense, useEffect, useState } from 'react';
import type { DynamicFormProps } from '@tramites/form-contracts';
import { toErrorMessage } from '../../../shared/lib/http';
import { loadRemoteForm } from '../federation/load-remote-form';

function LoadingState({ label }: { label: string }) {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <svg
          className="animate-spin"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
      </div>
      <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{label}</p>
    </div>
  );
}

export function RemoteForm(props: DynamicFormProps) {
  const [Component, setComponent] = useState<React.ComponentType<DynamicFormProps> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadRemoteForm()
      .then((remoteComponent) => {
        if (active) setComponent(() => remoteComponent);
      })
      .catch((reason: unknown) => {
        if (active) setError(toErrorMessage(reason, 'No se pudo cargar el renderer federado'));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="status error" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 24, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Renderer federado no disponible
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
        <span className="hint" style={{ color: 'inherit', opacity: 0.85 }}>
          Verificá que el servicio <code>form-remote</code> esté corriendo en <code>http://localhost:3002</code>.
        </span>
      </div>
    );
  }

  if (!Component) return <LoadingState label="Cargando renderer federado..." />;

  return (
    <Suspense fallback={<LoadingState label="Cargando formulario..." />}>
      <Component {...props} />
    </Suspense>
  );
}
