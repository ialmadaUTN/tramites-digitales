import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Trámites Digitales · CMS local', description: 'CMS local de formularios dinámicos' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
