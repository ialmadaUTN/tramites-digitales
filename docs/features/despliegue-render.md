# Despliegue en Render

> **Mantené este documento al día.** Si cambia la arquitectura de publicación, un comando de producción, una variable de entorno o una restricción operativa, actualizá este documento y sumá una línea al historial en el mismo cambio.

## Qué resuelve

Describe cómo publicar el prototipo de Trámites Digitales en Render para que el CMS, el host de demostración, el renderer federado y el BFF puedan comunicarse desde internet. La configuración reproducible vive en [`render.yaml`](../../render.yaml).

## Cómo funciona

El Blueprint define cuatro servicios Node públicos, separados porque cada pieza tiene un ciclo de build y un punto de entrada distinto:

| Servicio                 | Código               | Rol en producción                                                                                                                              |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `tramites-web`           | `apps/web`           | Next.js: CMS y host que recibe el ID de formulario. Se ejecuta con `next start`.                                                               |
| `tramites-bff`           | `apps/bff`           | API NestJS bajo `/api/v1`; valida, publica y persiste usando Supabase. Expone `/api/v1/health` para el health check.                           |
| `tramites-form-remote`   | `apps/form-remote`   | Renderer Vite/Module Federation. Se sirve con `vite preview` y CORS habilitado para que el host pueda obtener `mf-manifest.json` y los chunks. |
| `tramites-dynamics-mock` | `apps/dynamics-mock` | Mock temporal de la API externa de Dynamics; recibe las entregas en `/tipifications`.                                                          |

El flujo observable sigue siendo el mismo:

1. `apps/web` usa `NEXT_PUBLIC_BFF_URL` para llamar al BFF y `NEXT_PUBLIC_REMOTE_ORIGIN` para cargar el renderer federado.
2. `apps/form-remote` recibe desde el host la URL del BFF y carga la definición publicada.
3. `apps/bff` aplica las reglas de `packages/form-contracts`, lee y escribe en Supabase y entrega la submission a `DYNAMICS_MOCK_URL`.
4. Supabase sigue siendo el almacenamiento externo del proyecto; el Blueprint no crea otra base de datos.

## Reglas y restricciones

- Todos los servidores HTTP deben escuchar en `0.0.0.0` y en el `PORT` provisto por Render. Los defaults locales siguen usando `127.0.0.1` y los puertos 3000–3003.
- `SUPABASE_SECRET_KEY` solo se configura en `tramites-bff`; nunca debe ser una variable `NEXT_PUBLIC_*` ni exponerse al navegador.
- `FORM_CONTEXT_JWT_SECRET` debe tener el mismo valor en `tramites-web` y `tramites-bff` para que el host pueda firmar contextos y el BFF verificarlos.
- `WEB_ORIGIN` debe coincidir con el origen público de `tramites-web`; restringe el CORS del BFF.
- El renderer necesita CORS para ser cargado por un host con otro origen. La configuración de preview de Vite lo habilita.
- Los uploads siguen deshabilitados por defecto. No se deben activar en internet hasta conectar autenticación y análisis antimalware reales.
- `tramites-dynamics-mock` es solo una dependencia de demostración. Para producción real, `DYNAMICS_MOCK_URL` debe reemplazarse por el endpoint autenticado de Dynamics y el mock no debe publicarse.
- Los servicios gratuitos pueden dormir por inactividad y no son adecuados para disponibilidad garantizada. El servicio mock público gratuito es una decisión temporal para poder ejecutar la demo completa sin contratar un servicio privado.

## Variables que hay que cargar al crear el Blueprint

Render solicita las variables marcadas con `sync: false` al aplicar el Blueprint:

- En `tramites-web`: `NEXT_PUBLIC_BFF_URL`, `NEXT_PUBLIC_REMOTE_ORIGIN` y `FORM_CONTEXT_JWT_SECRET`.
- En `tramites-bff`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `WEB_ORIGIN`, `DYNAMICS_MOCK_URL` y el mismo `FORM_CONTEXT_JWT_SECRET`.

Las URLs públicas se conocen después de crear los servicios. Por eso se cargan luego de obtener los dominios `onrender.com`, o se reemplazan por dominios propios cuando existan.

## Dónde mirar

| Qué                                       | Dónde                                      |
| ----------------------------------------- | ------------------------------------------ |
| Blueprint                                 | `render.yaml`                              |
| Puerto y host del BFF                     | `apps/bff/src/main.ts`                     |
| Health check del BFF                      | `apps/bff/src/health.controller.ts`        |
| Puerto y host del mock                    | `apps/dynamics-mock/src/config/env.ts`     |
| Exportaciones de contrato para producción | `packages/form-contracts/package.json`     |
| CORS del renderer                         | `apps/form-remote/vite.config.ts`          |
| URL pública del BFF y del renderer        | `apps/web/src/shared/config/public-env.ts` |
| Cliente que entrega a Dynamics            | `apps/bff/src/dynamics.client.ts`          |

## Historial de cambios

- **2026-08-28** — Se agregó el Blueprint inicial de Render con servicios separados para Next.js, NestJS, Module Federation y el mock de Dynamics; se adaptaron los procesos HTTP a `PORT`/`0.0.0.0`, se agregó el health check del BFF y se documentaron las variables, CORS y restricciones del despliegue.
- **2026-08-28** — Las exportaciones de `@tramites/form-contracts` usan `dist` bajo Node en producción y conservan `src` para desarrollo y bundlers, evitando que el BFF y el mock intenten cargar archivos `.js` inexistentes junto a los fuentes TypeScript.
