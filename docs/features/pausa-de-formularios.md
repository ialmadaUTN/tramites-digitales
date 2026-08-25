# Pausa de formularios

> **Mantené este documento al día.** Si cambiás el código HTTP, los caminos que se bloquean o el mensaje que ve el cliente, actualizá la sección correspondiente y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Que una gestión publicada se pueda sacar de circulación al instante, sin despublicarla ni borrarla, y volver a habilitarla después.

El caso real: un formulario ya está expuesto en el portal y aparece un problema — un campo mal definido, una tipificación que el CRM rechaza, una gestión que el negocio decide suspender. Sin pausa, las únicas salidas son dejarlo tomando envíos que después hay que descartar a mano, o intervenir la base.

La pausa es un **eje independiente de la publicación**. Un formulario pausado conserva su versión publicada; lo que cambia es que el runtime deja de entregarla.

## Cómo funciona

| Pieza | Rol |
| --- | --- |
| `supabase/migrations/20260820200000_form_pause.sql` | Agrega `paused_at timestamptz` a `public.forms`. Null es disponible; con fecha, pausado. Se guarda el instante y no un booleano para conservar la traza de cuándo se sacó de circulación. |
| `apps/bff/src/form-availability.ts` | La regla: `isPaused` y `assertFormAvailable`. Vive fuera del servicio para poder testearse sin simular Supabase. |
| `apps/bff/src/forms.service.ts` | `pause()`, `resume()` y el chequeo dentro de `runtime()`. |
| `apps/web` (CMS) | Botón Pausar/Reactivar y el estado en el listado. |
| `apps/form-remote` | Muestra el mensaje al cliente final. |

### El punto único de control

Los cuatro caminos de runtime pasan por `FormsService.runtime()`, así que el chequeo vive ahí y los cubre a todos:

| Entrada | Cómo llega |
| --- | --- |
| `GET /api/v1/runtime/forms/:formId` | `RuntimeController.runtime()` |
| `POST /api/v1/runtime/forms/:formId/submissions` | `SubmissionsService.submit()` |
| `POST /api/v1/runtime/forms/:formId/uploads` | `UploadsService.createUpload()` |
| `POST /api/v1/runtime/forms/:formId/uploads/:id/complete` | `UploadsService.completeUpload()` |

Para las submissions ese chequeo es necesario pero **no suficiente**: la garantía real la da el trigger de la base, más abajo.

La validación es **del lado del servidor**. El CMS y el renderer muestran el estado, pero no son los que lo aplican: un cliente que llame al BFF directamente recibe el mismo rechazo.

### Qué se bloquea y qué no

| Camino | Con el formulario pausado |
| --- | --- |
| Definición publicada (`mode=published`) | **409** `FORM_PAUSED` |
| Definición del borrador (`mode=draft`) | **Permitido.** La preview del CMS tiene que seguir funcionando: se pausa un formulario justamente para poder arreglarlo. |
| Submission nueva | **409**, y no se escribe ninguna fila |
| Reintento con una `Idempotency-Key` ya usada | **Permitido**, devuelve el receipt original (ver abajo) |
| Abrir una carga de archivo | **409** |
| Completar una carga ya abierta | **409.** La carga pudo empezar antes de la pausa, pero completarla no puede desembocar en nada —la submission se rechaza igual— y sí escribiría en storage. "Pausado" significa lo mismo en los cuatro caminos de runtime. |
| `POST /api/v1/submissions/:id/delivery/retry` | **Permitido.** Reintentar la entrega a Dynamics no es iniciar una submission: lo que se reintenta ya fue aceptado y el cliente ya tiene su número de gestión. |
| Editar y guardar el borrador | **Permitido** |
| Publicar una versión nueva | **Permitido, y no reactiva.** Reactivar por efecto secundario de otra acción es cómo se expone un formulario sin querer. |

### Código HTTP

**409 Conflict** con cuerpo `{ "code": "FORM_PAUSED", "message": "Este formulario no está disponible en este momento" }`.

Se descartaron las alternativas por estos motivos:

| Opción | Por qué no |
| --- | --- |
| `404` | Pierde la distinción entre "no existe" y "pausado", y el front no puede mostrar el mensaje específico de forma confiable. |
| `503` | Los balanceadores y el monitoreo lo leen como caída del servicio: un formulario pausado ensuciaría los dashboards y dispararía reintentos automáticos de infraestructura. |
| `423 Locked` | Semánticamente defendible, pero es de WebDAV y Nest no trae una excepción para ese código. |

El front discrimina por `code`, no por el status.

### El mensaje

`Este formulario no está disponible en este momento`, exportado como `FORM_PAUSED_MESSAGE` en `apps/bff/src/http-error.ts`. **Es el BFF quien lo define**; el renderer lo muestra tal cual y no lo duplica como literal, para que no puedan quedar dos textos distintos.

### Qué se puede pausar

Solo un formulario **con versión publicada**: pausar es sacar de circulación lo publicado. `pause()` rechaza el resto con 409.

Reactivar, en cambio, se permite siempre que `paused_at` esté presente, tenga o no versión publicada, y el CMS muestra el botón con el mismo criterio. Es deliberado: antes de esta regla un consumidor de la API podía dejar un borrador pausado, y la acción de reactivar colgaba de que hubiera versión publicada, así que esa fila quedaba sin forma de recuperarse desde la UI.

## La pausa es atómica con el alta de la submission

El chequeo del BFF **no alcanza por sí solo**. Entre `forms.runtime()` y el insert hay varias operaciones de I/O —verificación del token de contexto, validación del payload, lookup de la versión y de los adjuntos—, así que una pausa que ocurra en esa ventana dejaría entrar la submission después de que el cliente que pausó ya recibió una respuesta correcta.

La decisión final la toma el trigger `submissions_reject_when_form_paused`, dentro de la misma transacción que el insert:

```sql
select paused_at into form_paused_at from public.forms where id = new.form_id for share;
```

El `for share` es lo que da atomicidad, no solo una ventana más chica:

- Si la pausa todavía no commiteó, el trigger toma el lock compartido y el `update forms set paused_at` **espera** a que el insert termine. La submission entra y el formulario queda pausado después: orden consistente.
- Si la pausa ya commiteó, el trigger ve `paused_at` y rechaza con SQLSTATE `TD001`, que el BFF traduce al mismo 409 `FORM_PAUSED`.

Vive en el esquema y no en el servicio para que la garantía valga para **cualquier cliente y cualquier camino**, incluido un insert directo contra PostgREST. Eso es lo que verifica `tests/e2e/pause-guard.spec.ts`, que saltea el BFF a propósito.

Un error de insert que no sea `TD001` **no** se traduce a 409: enmascarar cualquier fallo como "pausado" escondería incidentes reales.

## Consistencia ante caché, reintentos y sesiones abiertas

Tres casos que se resolvieron explícitamente, porque son los que hacen que una implementación pase los tests obvios y falle en producción:

**Caché.** `GET /runtime/forms/:formId` responde `Cache-Control: no-store` (`apps/bff/src/runtime.controller.ts`). Sin eso, una definición cacheada en el browser o en un CDN se seguiría sirviendo después de la pausa.

**Reintentos.** En `SubmissionsService.submit()` el lookup por `(form_id, idempotency_key)` corre **antes** del chequeo de disponibilidad. El caso que cubre: se envía con el formulario activo, se guarda bien, la respuesta se pierde por timeout, se pausa el formulario, y el cliente reintenta con la misma clave. Si la pausa se evaluara primero, ese reintento recibiría 409 por una submission que en realidad sí se guardó, y el cliente creería que se perdió.

**Sesiones ya iniciadas.** El formulario se cargó antes de la pausa y el envío llega después: `submit()` pasa por `runtime()` y recibe 409. El renderer conserva el `code` del BFF, así que muestra el mensaje de pausa y no un error genérico de envío.

## En el CMS

El listado rotula cada formulario con **precedencia pausado > publicado > borrador** (`apps/web/src/features/cms/model/availability.ts`). Un formulario pausado conserva su versión publicada, así que mostrarlo como "Publicado" haría creer que sigue disponible en el portal.

El botón del encabezado del workspace aparece cuando el formulario **está publicado o está pausado**:

- **Pausar** solo con versión publicada, porque es lo publicado lo que se saca de circulación.
- **Reactivar** siempre que esté pausado, aunque no tenga versión publicada, para poder recuperar una fila que haya quedado en ese estado.

## Restricciones y puntos abiertos

| Punto | Estado |
| --- | --- |
| La pausa es por formulario, no por versión | Decidido: se pausa la gestión, no una versión puntual. |
| No hay motivo de pausa ni autor | Fuera de alcance. `paused_at` deja la traza temporal; si hace falta auditoría, va en un cambio aparte. |
| Listado de gestiones disponibles por canal × producto | **Abierto.** Ese endpoint todavía no existe en el prototipo. Cuando exista, hay que definir si un formulario pausado desaparece de la lista o si sigue apareciendo y recién al entrar muestra el mensaje. Lo segundo es peor experiencia. |

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Guard atómico en la base | `supabase/migrations/20260822120000_pause_guard_submissions.sql` |
| Regla de disponibilidad | `apps/bff/src/form-availability.ts` |
| Error y mensaje | `apps/bff/src/http-error.ts` (`formPaused`, `FORM_PAUSED_MESSAGE`) |
| Chequeo en runtime, `pause()` y `resume()` | `apps/bff/src/forms.service.ts` |
| Endpoints | `apps/bff/src/forms.controller.ts` (`POST :formId/pause`, `POST :formId/resume`) |
| Orden idempotencia → disponibilidad | `apps/bff/src/submissions.service.ts` |
| Rótulo del listado | `apps/web/src/features/cms/model/availability.ts` |
| Botón Pausar/Reactivar | `apps/web/src/features/cms/ui/workspace-header.tsx` |
| Mensaje al cliente final | `apps/form-remote/src/features/runtime/ui/dynamic-form.tsx` |
| Tablas de la regla (tests) | `apps/bff/src/form-availability.test.ts`, `apps/web/src/features/cms/model/availability.test.ts` |
| Recorrido completo | `tests/e2e/authoring-journey.spec.ts` |

## Historial de cambios

- **2026-08-20** — Primera versión. Un formulario publicado se puede pausar y reactivar desde el CMS. El BFF responde 409 `FORM_PAUSED` en los tres caminos de runtime, la preview del borrador sigue habilitada, el reintento idempotente devuelve el receipt original y el reintento de entrega a Dynamics no se bloquea. De paso se corrigió el parseo de errores del renderer, que mostraba el JSON crudo de la respuesta en vez del `message`.
- **2026-08-22** — Revisión técnica. La pausa pasó a ser atómica con el alta de submissions mediante un trigger con `for share`, porque el chequeo del BFF corre varias operaciones de I/O antes del insert. Completar una carga ya abierta sobre un formulario pausado dejó de estar permitido. Pausar exige versión publicada, y el CMS ofrece reactivar siempre que el formulario esté pausado, para recuperar filas que hayan quedado en ese estado.
