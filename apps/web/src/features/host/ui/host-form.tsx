'use client';

import Link from 'next/link';
import { bffUrl } from '../../../shared/config/public-env';
import { RemoteForm } from './remote-form';

export function HostForm({ formId }: { formId: string }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="brand">
            Aplicación Host<span className="brand-dot">.</span>
            <span className="brand-tag">Demostración</span>
          </div>
        </div>

        <nav>
          <Link className="button secondary sm" href="/">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Volver al CMS
          </Link>
        </nav>
      </header>

      <main className="page">
        <section className="hero" style={{ marginBottom: 24 }}>
          <div className="eyebrow">Host de demostración · Runtime Federado</div>
          <h1>Formulario Federado Cargado en Tiempo de Ejecución</h1>
          <p>
            Esta página simula una aplicación cliente (portal, app de trámites, intranet). Solamente recibe el ID del formulario y carga el renderer remoto mediante Module Federation.
          </p>

          <div className="hero-chips" style={{ marginTop: 16 }}>
            <div className="chip">
              <strong>Form ID:</strong> <code style={{ marginLeft: 4 }}>{formId}</code>
            </div>
            <div className="chip">
              <strong>BFF URL:</strong> <code style={{ marginLeft: 4 }}>{bffUrl}</code>
            </div>
            <div className="chip badge-success">
              <span className="chip-dot"></span>
              Modo Producción / Publicado
            </div>
          </div>
        </section>

        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <RemoteForm formId={formId} apiBaseUrl={bffUrl} />
        </div>
      </main>
    </div>
  );
}
