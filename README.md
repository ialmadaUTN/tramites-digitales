# Trámites Digitales — entorno local

Prototipo local del CMS de formularios dinámicos. La solución contiene un CMS/host en Next.js, un renderer federado en React/Vite, un BFF NestJS, Supabase PostgreSQL remoto y un mock de la futura API de Dynamics.

## Requisitos

- Node.js 22 (la máquina puede tener una versión posterior, pero el proyecto apunta a Node 22).
- pnpm 11.
- Un proyecto Supabase accesible y una clave `sb_secret_*` sólo para el BFF.

## Arranque rápido sin Docker

```powershell
pnpm install
pnpm exec supabase login
pnpm exec supabase link --project-ref TU_PROJECT_REF
pnpm supabase:push:seed
```

Copiá la URL del proyecto, la clave secreta `sb_secret_*` y el esquema expuesto a un `.env.local` usando `.env.example` como plantilla. En un proyecto Supabase nuevo el esquema es `public`; este `Pulso Staging` ya tenía `pulso_api` como perfil REST, por eso el entorno configurado usa `SUPABASE_DB_SCHEMA=pulso_api`. La clave sólo se usa en NestJS y nunca debe comenzar por `NEXT_PUBLIC_`.

El BFF lee ese `.env.local` desde la raíz del workspace; Next.js y el remote usan los defaults de localhost definidos en el código.

```powershell
Copy-Item .env.example .env.local
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000). El CMS permite editar/publicar formularios y la pantalla de host consume el renderer federado por ID.

Servicios:

- Web/CMS: `http://localhost:3000`
- BFF: `http://localhost:3001`
- Remote federado: `http://localhost:3002`
- Mock Dynamics: `http://localhost:3003`
- Supabase: el proyecto remoto configurado en `SUPABASE_URL`.

## Flujo de trabajo

Las migraciones viven en `supabase/migrations` y el formulario de ejemplo en `supabase/seed.sql`. Para aplicar cambios al proyecto remoto:

```powershell
pnpm supabase:push:seed
```

`pnpm supabase:start`, `pnpm supabase:stop` y `pnpm supabase:reset` quedan disponibles como flujo opcional para una instalación local de Supabase CLI que sí use Docker; no son necesarios para este entorno.

Para verificar compilación y tests:

```powershell
pnpm build
pnpm test
```

Con las variables de Supabase configuradas, la suite E2E puede levantar los servicios de la aplicación automáticamente:

```powershell
$env:E2E_MANAGED_SERVERS = 'true'
pnpm test:e2e
```

El browser no accede a las tablas de Supabase ni conoce la clave secreta. Para adjuntos, cuando las tres flags de seguridad están activas, el BFF emite una URL firmada y el browser sube directamente el binario al bucket privado; la confirmación, validación de metadata y asociación a la submission siguen pasando por el BFF.

Los adjuntos permanecen deshabilitados por defecto (`FORM_UPLOADS_ENABLED=false`, `FORM_UPLOADS_AUTHENTICATED=false`, `FORM_UPLOADS_MALWARE_SCANNED=false`). Antes de activarlos en un ambiente real hay que conectar la autenticación del template corporativo y el análisis antimalware; el `X-Upload-Session` del prototipo local no reemplaza esa autenticación.

Las definiciones v2 usan `tipificationKey` y el BFF resuelve mappers registrados y versionados con la convención `clave@version` (por ejemplo, `claims@v2`).
