# Entorno local para Trámites Digitales

## Resumen

Crear un monorepo local que reproduzca la arquitectura futura sin depender de accesos de Galicia:

```text
Next.js CMS/Host
       │
       ├── carga en runtime ──> Form Renderer federado
       │                              │
       └──────────── HTTP ────────────┤
                                      ▼
                                  NestJS BFF
                                  │         │
                           Supabase      Mock Dynamics
                           PostgreSQL
```

No se implementará autenticación ni seguimiento de gestiones. Todos los servicios escucharán únicamente en localhost.

## Implementación

- Crear un workspace pnpm con:

  - `web`: Next.js 16, CMS y página host de demostración.
  - `form-remote`: React 19 + Vite, exponiendo `DynamicForm` mediante Module Federation.
  - `bff`: NestJS 11, único acceso a datos.
  - `dynamics-mock`: API HTTP local que recibe el objeto tipificado.
  - `form-contracts`: tipos y esquemas Zod compartidos.

- El host Next.js cargará el remote exclusivamente en cliente mediante el runtime de Module Federation. Se evitará `nextjs-mf`; el remote Vite seguirá la [integración oficial de Module Federation](https://module-federation.io/integrations/build-tool/vite).

- El CMS permitirá:

  - Crear y listar formularios.
  - Configurar título general y texto del botón.
  - Agregar, quitar y ordenar contenedores.
  - Configurar título y layout de una o dos columnas.
  - Agregar, quitar y ordenar campos.
  - Editar tipo, label, placeholder, ayuda, `fieldName`, opciones, valor inicial y ancho.
  - Configurar reglas y mensajes de error.
  - Configurar visibilidad, habilitación y obligatoriedad condicional.
  - Previsualizar el borrador y publicar una versión.

- Controles iniciales: text, textarea, number, date, time, checkbox, radio, select y combobox buscable con opciones cerradas.

- Usar React Hook Form y Zod. Las reglas admitidas serán required, min/max numérico, min/max de longitud, regex y condiciones declarativas; nunca JavaScript almacenado en la base.

## Contratos, API y persistencia

- Contrato federado principal:

```ts
type DynamicFormProps = {
  formId: string;
  apiBaseUrl: string;
  mode?: "published" | "draft";
  onSubmitted?: (receipt: SubmissionReceipt) => void;
  onError?: (error: FormRuntimeError) => void;
};
```

- Cada campo tendrá un ID interno y un `fieldName` único, con formato `^[A-Za-z_][A-Za-z0-9_]*$`. El objeto final será plano y conservará los tipos JSON: string, number o boolean.

- Las condiciones referenciarán IDs internos y soportarán `all`/`any` con operadores `equals`, `notEquals`, `in`, `notIn`, comparaciones numéricas y empty/notEmpty. Se impedirán referencias a sí mismo y ciclos. Los campos ocultos o deshabilitados se limpian y no se validan ni envían.

- Endpoints del BFF:

  - `GET/POST /api/v1/forms`
  - `GET/PUT /api/v1/forms/:formId/draft`
  - `POST /api/v1/forms/:formId/publish`
  - `GET /api/v1/forms/:formId/versions`
  - `GET /api/v1/runtime/forms/:formId`
  - `POST /api/v1/runtime/forms/:formId/submissions`
  - `POST /api/v1/submissions/:submissionId/delivery/retry`

- Cada submit exigirá un `Idempotency-Key`. Nest volverá a validar el payload contra la versión utilizada, eliminará campos inactivos y rechazará claves desconocidas.

- El mock recibirá:

```json
{
  "submissionId": "uuid",
  "formId": "uuid",
  "formVersion": 1,
  "submittedAt": "ISO-8601",
  "data": {
    "nombreConfigurado": "valor"
  }
}
```

- Primero se persistirá la submission y después se llamará al mock con timeout. Si falla, el formulario seguirá recibiendo HTTP 201 y `deliveryStatus: "failed"`; el registro quedará disponible para reintento.

- Modelo PostgreSQL:

  - `forms`: identidad interna, UUID público, nombre, definición borrador y versión publicada actual.
  - `form_versions`: versiones publicadas e inmutables en JSONB.
  - `submissions`: formulario, versión, idempotency key, payload JSONB, estado y datos del último intento externo.

- Usar IDs internos `bigint identity` y UUID público para las interfaces. Agregar índices para claves foráneas, formulario/versión e idempotencia.

- Inicializar Supabase local mediante CLI, migraciones SQL y `seed.sql`, siguiendo el [flujo local recomendado](https://supabase.com/docs/guides/local-development/cli-workflows). Incluir un formulario de ejemplo que ejercite todos los controles y condiciones.

- Nest usará `@supabase/supabase-js` con una clave secreta exclusivamente server-side. Las tablas tendrán RLS activado, sin acceso para `anon`/`authenticated` y grants explícitos para `service_role`, acorde con los [cambios actuales de exposición de tablas](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Verificación

- Unitarios para contratos, reglas, condiciones, generación del objeto plano y detección de ciclos.
- Integración del BFF contra Supabase local para CRUD, publicación, versiones inmutables, validación e idempotencia.
- Pruebas del renderer para todos los controles, mensajes debajo del campo y comportamiento condicional.
- Pruebas del adaptador externo para entrega exitosa, timeout, error y reintento.
- Playwright para crear un formulario, publicarlo, cargarlo por ID desde el host federado y verificar la submission en PostgreSQL.
- Build de todos los proyectos y prueba explícita de carga del `remoteEntry`, compartiendo React como singleton.
- `supabase db reset` deberá reconstruir completamente esquema y datos de ejemplo.

## Supuestos

- UI neutral con CSS Modules y variables CSS, preparada para reemplazar estilos cuando llegue el Design System de Galicia.
- Sin drag-and-drop, archivos, campos repetibles, seguimiento de gestiones ni transformación configurable del payload.
- Puertos locales: web `3000`, BFF `3001`, remote `3002` y mock `3003`.
- Node.js 22 como versión objetivo de Galicia; dependencias y lockfile quedarán fijados. La máquina actual tiene Node 24, por lo que deberá instalarse o seleccionarse Node 22 para la verificación final.
- No se necesita un proyecto cloud de Supabase; posteriormente podrá vincularse uno remoto sin cambiar las migraciones.
