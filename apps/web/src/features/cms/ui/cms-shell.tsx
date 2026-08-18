'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type CmsShellProps = {
  selectedId: string | null;
  children: ReactNode;
};

export function CmsShell({ selectedId, children }: CmsShellProps) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="brand">
            Trámites Digitales<span className="brand-dot">.</span>
            <span className="brand-tag">Studio</span>
          </div>
        </div>

        <nav>
          <Link className="nav-link active" href="/">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            CMS Builder
          </Link>
          {selectedId && (
            <Link className="nav-link" href={`/host/${selectedId}`} target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Abrir Host
            </Link>
          )}
        </nav>
      </header>

      <main className="page">
        <section className="hero">
          <div className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 8 8 12 12 16 12 8" />
            </svg>
            CMS Local · Form Builder
          </div>
          <h1>Diseñá formularios dinámicos sin tocar código</h1>
          <p>
            Configurá contenedores, campos, reglas de validación y claves de payload. El formulario publicado se compila y carga en runtime desde cualquier aplicación host.
          </p>
          <div className="hero-chips">
            <div className="chip">
              <span className="chip-dot"></span>
              Supabase DB
            </div>
            <div className="chip">🧩 Micro-frontend Federado</div>
            <div className="chip">⚡ BFF Sync</div>
            <div className="chip">🔒 Contrato @tramites/form-contracts</div>
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}
