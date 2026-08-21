# AGENTS.md

Reglas de trabajo para este repositorio. Aplican a cualquier persona o agente que implemente una feature.

> **No escribas política de proyecto en `apps/web/AGENTS.md` ni en `apps/web/CLAUDE.md`.** Esos dos archivos los genera y reescribe `next dev`; cualquier cosa que agregues ahí se pierde. Este archivo, en la raíz, es el que manda.

---

## Definición de "terminado"

Una feature **no está terminada** hasta que las tres cosas estén hechas:

1. El código.
2. La documentación (nueva o actualizada).
3. Los tests, y el CI en verde.

Entregar código sin los puntos 2 y 3 se considera trabajo incompleto, no un adelanto. Si algo de esto queda afuera, hay que decirlo explícitamente y explicar por qué.

---

## 1. Documentación

La documentación de funcionalidades vive en [`docs/features/`](docs/features/README.md) y **se mantiene junto con el código, en el mismo cambio**. No es una tarea posterior ni un ticket aparte: un documento desactualizado es peor que no tener documento, porque alguien lo va a creer.

Si tu cambio altera el comportamiento descrito en un documento y no lo actualizás, el cambio está incompleto. Eso incluye cosas chicas: renombrar un archivo que el documento referencia, cambiar el texto de un mensaje de error que está en una tabla, o agregar un valor a una lista.

La regla concreta depende de si ya existe documentación de esa funcionalidad:

### Si ya existe documentación de la funcionalidad

Actualizala con **el detalle del cambio**: qué cambió, por qué, y qué implica para quien la usa o la consume. Alcanza con ser breve y concreto — no hace falta reescribir el documento entero.

### Si no existe documentación de la funcionalidad

No documentes solo el cambio: escribí **la funcionalidad completa**, y dentro de eso incluí el cambio que acabás de hacer. La primera vez que se toca algo no documentado es cuando se paga la deuda.

### Dónde vive

Un archivo por funcionalidad en `docs/features/<nombre-en-kebab-case>.md`, listado en el índice de [`docs/features/README.md`](docs/features/README.md). Si creás un documento nuevo, agregalo al índice.

Cada documento abre con un recordatorio de que hay que mantenerlo al día y cierra con un **historial de cambios**: una línea por cambio relevante, con la fecha. Sumar esa línea es parte de actualizar el documento.

`docs/tramites-digitales-galicia.md` es el informe de kickoff y no es documentación de feature: no lo uses como índice ni lo edites para registrar cambios.

### Qué tiene que decir

Como mínimo:

- **Qué resuelve** la funcionalidad y para quién.
- **Cómo funciona**: el flujo real, incluyendo qué parte vive en el contrato (`packages/form-contracts`), en el CMS (`apps/web`), en el renderer (`apps/form-remote`) y en el BFF (`apps/bff`).
- **Reglas y restricciones** que aplica (validaciones, límites, combinaciones no permitidas).
- **Historial de cambios**: una línea por cambio relevante, con la fecha.

Referenciá archivos y funciones por su ruta real (`packages/form-contracts/src/field-rules.ts`) para que el documento se pueda seguir contra el código.

### Qué no documentar

No repitas lo que el código ya dice de forma obvia ni pegues bloques de código que van a quedar desactualizados. Documentá las decisiones y las reglas de negocio, que es lo que no se deduce leyendo el fuente.

---

## 2. Tests

### Por qué no hay un único umbral global

La primera versión de este documento pedía "85 % de cobertura" a secas. Medido en serio, ese número era imposible de interpretar:

| Paquete | Reportaba | Cobertura real |
| --- | --- | --- |
| `apps/form-remote` | **100 %** | **1,56 %** |
| `apps/bff` | 80,43 % | 9,39 % |
| `apps/web` | 61,73 % | 46,84 % |

Por defecto, v8 solo cuenta los archivos que **algún test importó**. `form-remote` tenía un test sobre un archivo trivial y 26 archivos sin tocar: reportaba 100 %. `apps/web`, que era el paquete **con más tests**, reportaba el número más bajo, porque tener tests es justamente lo que mete archivos en el denominador.

Con un umbral global de 85 % sobre esos números, el incentivo era perverso: **escribir tests empeoraba la métrica**, y no escribirlos la dejaba perfecta.

Dos cambios lo arreglan, y los dos ya están aplicados en `vitest.shared.ts`:

- **`all: true`** con `include: src/**/*.{ts,tsx}`. El denominador es todo el código del paquete, haya tests o no. A partir de acá, sumar tests nunca baja el número.
- **Exclusión de lo que no tiene comportamiento**: tipos generados por `supabase gen types`, archivos `.d.ts`, módulos que solo declaran tipos, y el bootstrap del framework (`main.ts`, `app.module.ts`, `src/app/**`). Contarlos solo diluye el porcentaje; no hay test que los cubra sin volverse un test del framework.

### El umbral es por capa, y es un ratchet

No todas las capas cuestan lo mismo de cubrir ni valen lo mismo cubiertas. La barra sale de eso:

| Capa | Barra | Por qué |
| --- | --- | --- |
| `packages/form-contracts` | 90 / 85 / 95 / 90 | Lógica pura y fuente de verdad de todo el sistema. Barato de testear y un bug acá corrompe cualquier formulario. |
| `apps/web` · `features/cms/model` | 90 / 85 / 95 / 93 | Ídem: decide si un formulario se puede guardar. |
| `apps/web` · `features/cms/ui` | Lo alcanzado | Se cubre con tests de interacción sobre la definición que produce, no línea por línea. |
| `apps/bff`, `apps/form-remote` | Lo alcanzado | Ver los huecos abiertos más abajo. |
| Adaptadores de I/O, shells de layout, generados | Excluidos | Su comportamiento real se verifica en los e2e, no con mocks que terminarían testeando al mock. Cada exclusión está comentada en el `vitest.config.ts` que la declara. |

Donde dice "lo alcanzado", el umbral es la cobertura actual redondeada hacia abajo: **funciona como ratchet, solo puede subir**. Cuando una tanda de tests sube el número, se sube el piso en el mismo commit. Nunca se baja un piso para que pase el build.

Los umbrales están declarados en el `vitest.config.ts` de cada paquete y **fallan el build**: no son documentación, son un gate.

### Qué forma darle a cada test

La forma importa más que el porcentaje.

**Reglas del contrato y del editor → tablas.** El valor del contrato está en lo que **rechaza**; cada regla sin un caso negativo es una regla que puede desaparecer sin que nadie se entere. `packages/form-contracts/src/rules.test.ts` es el índice de esas reglas: agregar una regla al contrato significa agregar una fila, no un `it` nuevo.

**Barridos exhaustivos donde el espacio es chico.** `apps/web/src/features/cms/model/field-type-change.test.ts` recorre las 15×15 transiciones de tipo de campo y verifica que ninguna deje una definición impublicable. Ese barrido encontró un bug real que ninguna prueba manual hubiera encontrado.

**UI → tests de interacción, no de markup.** Un `onChange` cableado al setter equivocado renderiza **exactamente igual**: un test sobre el HTML no lo ve. Los tests de UI simulan el uso y afirman sobre la **definición que produce el editor** (`*.interaction.test.tsx` y `definition-editor.test.tsx`). Los tests de estructura con `renderToStaticMarkup` siguen sirviendo para "qué controles aparecen para cada tipo", que es barato y corre sin DOM.

**Verificá que el test pueda fallar.** Antes de confiar en una tanda nueva, rompé a propósito la regla que dice cubrir y confirmá que el test se pone en rojo. Un test que pasa contra el código roto no está midiendo nada.

### Herramientas disponibles

- **Vitest** en los cuatro paquetes. Los tests de modelo corren en `node`.
- **Testing Library + jsdom** en `apps/web` y `apps/form-remote`. Los archivos que necesitan DOM lo declaran con `// @vitest-environment jsdom` en la primera línea; no hace falta tocar la config.
- **Playwright** para los e2e, en `tests/e2e/`.

### End to end: pocos y de recorrido completo

Los e2e levantan cuatro servidores y pegan contra un Supabase real. Pedir uno por feature los vuelve lentos, frágiles, y deja afuera a cualquiera que no tenga credenciales.

La regla es otra: **un e2e por recorrido de usuario crítico**, no por feature. Un e2e se justifica cuando verifica algo que los tests unitarios estructuralmente no pueden — que la federación, el BFF, la base y el contrato se pongan de acuerdo. Ejemplo: armar un formulario en el CMS, publicarlo, completarlo en el host y verificar que el submission llega bien.

Hoy hay dos specs en `tests/e2e/`:

- `authoring-journey.spec.ts` — el recorrido completo: crear un formulario en el CMS, configurarlo, publicarlo, completarlo en el host federado y verificar que el submission llega. Es el que verifica que contrato, CMS, BFF, base y micro-frontend se pongan de acuerdo.
- `form-flow.spec.ts` — carga por ID y creación desde el CMS.

Si tu feature cambia un recorrido existente, actualizá ese e2e. Si abre uno nuevo, agregalo. Si es una regla de validación más, ya está cubierta por las tablas del contrato y no necesita e2e.

Cuidado con las carreras de hidratación: el CMS es un client component, y un click disparado antes de que hidrate **no hace nada y no falla** — el test sigue y revienta más adelante, en un lugar que no tiene que ver. Esperá una señal de que la app ya está viva (la lista de formularios poblada, un aviso de estado) antes de interactuar.

### Estado actual y huecos abiertos

| Paquete | Cobertura | Tests |
| --- | --- | --- |
| `packages/form-contracts` | 94,63 % | 167 |
| `apps/web` | 66,61 % | 131 |
| `apps/bff` | 75,51 % | 4 |
| `apps/form-remote` | 31,41 % | 46 |

Lo que falta, en orden de valor:

1. **`apps/form-remote`**: `use-runtime-form.ts` y `dynamic-repeater.tsx` no tienen tests. Ahí vive la lógica de carga y de filas de grilla en runtime. Es el hueco más grande. De `dynamic-field.tsx` ya está cubierta la marca de obligatorio y el descarte de campos ocultos.
2. **`apps/web`**: `hooks/use-cms-workspace.ts` está en 0 %. Decide cuándo se puede guardar y publicar. No se excluyó justamente para que siga a la vista.
3. **`apps/bff`**: los servicios de submissions y uploads están excluidos por ser orquestación de I/O. Si les entra lógica de negocio, salen de la exclusión y se testean.

---

## 3. Integración continua

`.github/workflows/ci.yml` corre en **cada pull request** y en **cada push a `main`**:

- **`verify`** — instala, corre `pnpm lint` (chequeo de tipos en los cinco paquetes) y `pnpm test:coverage`. Falla si algún paquete baja de su umbral. No necesita secrets, así que corre siempre.
- **`e2e`** — corre Playwright después de `verify`. Necesita los secrets `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (y opcionalmente `SUPABASE_DB_SCHEMA`); si no están configurados el job **se saltea en vez de fallar**, para que un fork o un clon nuevo no quede con el CI en rojo por algo que no puede resolver.

Los reportes de cobertura y de Playwright quedan como artifacts de la corrida.

Un push nuevo sobre la misma rama cancela la corrida anterior.

---

## Verificación local antes de abrir el PR

Lo mismo que corre el CI:

```bash
pnpm lint
```

```bash
pnpm test:coverage
```

```bash
pnpm test:e2e
```

`pnpm lint` corre `tsc --noEmit` en cada paquete. Ojo con `apps/bff`: compila con `moduleResolution: NodeNext`, así que los imports relativos dentro de `packages/form-contracts` **necesitan la extensión `.js` explícita**. A la vez, `apps/web` compila con Turbopack, que **no resuelve esos especificadores `.js`**. Por eso lo que el CMS importa como valor vive en `packages/form-contracts/src/field-rules.ts`, un módulo sin imports de valor relativos, expuesto como subpath `@tramites/form-contracts/field-rules`. Si necesitás compartir algo nuevo con el CMS, agregalo ahí y no al barrel.

Verificar solo con tests no alcanza cuando la feature tiene UI: levantá la app y comprobá el comportamiento real en el navegador.

---

## Checklist

- [ ] El código está implementado y `pnpm lint` pasa.
- [ ] La documentación en `docs/features/` refleja el comportamiento nuevo: actualizada con el detalle del cambio, o escrita completa si no existía.
- [ ] El documento tocado tiene su línea nueva en el historial de cambios, con fecha.
- [ ] Ninguna referencia a archivos, funciones o mensajes quedó desactualizada en los documentos.
- [ ] Las reglas nuevas están como filas en las tablas de test, con su caso negativo.
- [ ] Si la feature toca UI, hay un test de interacción sobre lo que produce.
- [ ] Si cambia o abre un recorrido de usuario crítico, el e2e lo refleja.
- [ ] `pnpm test:coverage` pasa y ningún piso de cobertura bajó.
- [ ] Rompiste a propósito una regla nueva y confirmaste que el test la agarra.
- [ ] Si algo quedó afuera, está dicho explícitamente y con el motivo.
