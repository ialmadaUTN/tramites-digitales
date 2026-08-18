# Informe de Reunión — Kickoff Técnico: Proyecto "Trámites Digitales" (Galicia Seguros)

**Participantes identificados:**
- Adrian Maillo — Referente técnico / arquitectura, Galicia Seguros (GS)
- Lucas Saleme — Equipo externo (consultora)
- Marcelo Ruibal — Equipo externo (consultora)
- Federico Winnick — Equipo externo (consultora), mencionado pero no presente en la llamada
- Fernando ("Fer") — Mencionado como referente/sponsor de GS, copiado en todas las comunicaciones

**Nota:** la transcripción no especifica fecha exacta. La reunión funciona como kickoff funcional-técnico, donde Adrian Maillo (GS) le baja contexto, restricciones y lineamientos al equipo externo que va a desarrollar el proyecto.

---

## 1. Objetivo del proyecto

Construir una **Single Page Application (SPA)** que permita a clientes de Galicia Seguros hacer trámites/gestiones simples (ej. denuncia de siniestro, cambio de medio de pago) mediante **formularios dinámicos**, embebida vía iframe dentro de dos portales existentes:

- **Online Banking**
- **Sucursal Digital**

El proyecto es explícitamente un **piloto/testigo (MVP acotado)**, no un reemplazo de la autogestión existente. La idea es medir uso real: si una gestión tiene mucho tráfico, se migra más adelante como funcionalidad destacada dentro de los portales definitivos. Por eso el acceso a esta SPA se deja "escondido" en la navegación, no como entrada principal.

---

## 2. Accesos y onboarding (bloqueante para arrancar)

- El equipo externo necesita **usuarios de la compañía** para acceder al GitHub interno de GS (autenticación por SSO contra GS).
- Adrian debe dar de alta a los usuarios como si fueran externos/contratistas (mismo mecanismo que otros developers/QA externos).
- Se requiere un **contrato de confidencialidad**, a coordinar con Fer y a firmar por el dueño de la consultora.
- El alta de usuarios puede demorar **~1 semana**, por lo que se prioriza acelerar ese trámite.
- Se necesita también **usuario de VPN**, indispensable para acceder a la documentación interna del System Design (solo accesible dentro de la red de GS).
- Adrian pidió la nómina completa del equipo (DNI y otros datos) para gestionar los accesos — a enviar por mail una vez que él especifique qué datos exactos necesita.

---

## 3. Arquitectura general

- Solución compuesta por **Frontend + BFF**. Adrian no cree necesario un backend propio adicional para este desarrollo (aunque en el cierre menciona "frontend, BFF, backend y base de datos" al hablar del kickoff de repos — a confirmar si el backend es el `.NET` existente/template estándar o si terminan sin uno).
- **Ambos repositorios (frontend y BFF) los crea Adrian** desde una herramienta interna de la compañía que:
  - Genera los repos.
  - Clona templates ya definidos (frontend, BFF y backend tienen templates propios).
  - Aplica permisos para que el equipo externo pueda clonar y trabajar.
- El **frontend y el BFF van a estar expuestos a internet** (fuera de la red interna de GS), para que puedan ser consumidos por Online Banking y Sucursal Digital. Esa exposición la gestiona Adrian.
- La SPA **no tiene autenticación propia**: recibe todo el contexto (datos del cliente y del producto/póliza) desde la aplicación padre donde está embebida.
- El **backend habla en red interna de Galicia sin capa de seguridad** (el BFF lo consume libremente, sin autenticación).
- Entre **frontend y BFF sí hay un circuito de autenticación**, ya resuelto por el template existente (a definir en detalle más adelante).
- **No hay conexión directa al "core"** (sistema central de pólizas/clientes). Se evita deliberadamente por la complejidad que implicaría (cotizaciones, reglas de negocio, etc.).

---

## 4. Stack tecnológico definido

| Capa | Tecnología |
|---|---|
| Frontend | **React** vía **Next.js** |
| BFF | **NestJS** (requiere **Node 22** local) |
| Backend | **.NET 8**, migrando a **.NET 10** |
| Base de datos | **SQL Server** propio de GS, exclusivo para este desarrollo |
| ORM | **Entity Framework** (Code First), vía template/librería interna de arquitectura de GS — habilita **Migrations** para CI/CD |
| Mensajería (integración CRM) | **Azure Service Bus** (Microsoft) detrás de la API de tipificación |
| Diseño / UI | **System Design** interno de GS (design system con componentes tipificados: inputs, calendarios, paneles, tablas, tabs, navbar, etc.) |

Restricciones no negociables: usar el System Design de la compañía para todo el look & feel, y Entity Framework/SQL Server para persistencia (aunque esta última restricción "sobra" para la complejidad real del proyecto, según Adrian).

---

## 5. Flujo funcional

1. La aplicación padre (Online Banking o Sucursal Digital) carga la SPA dentro de un iframe, pasándole el contexto por **query string**, idealmente como un **hash encriptado/ofuscado** (para evitar tampering — que el usuario manipule IDs).
2. El frontend recibe: datos del cliente, datos del producto/póliza, y el **canal de origen** (Online Banking / Sucursal Digital).
3. El frontend consulta al BFF las **gestiones disponibles**, filtradas por combinación **canal + producto**.
4. El usuario elige una gestión/trámite → se renderiza un **formulario dinámico** según la configuración persistida en base de datos (campos, tipos, orden, layout, dependencias, obligatoriedad).
5. Al enviar, se arma un **JSON de "tipificación"** específico de esa gestión y se lo manda a una API que en realidad encola el mensaje en un **Service Bus de Azure** (por eso no falla: ~99.9% uptime informado).
6. El sistema muestra el **número de gestión** devuelto, o un mensaje de error tipificado si falla la comunicación.
7. Del lado de GS, un **operador de call center** revisa la cola de gestiones en el CRM, toma los datos ya tipificados y ejecuta la acción manualmente contra el core (sin necesidad de recontactar al cliente, si los datos capturados son suficientes).

**Dato clave:** la única dependencia externa real del sistema es esa API de tipificación contra **Delfos** (nombre en código del proyecto de implementación del nuevo CRM de GS, que es **Microsoft Dynamics 365** — recién en producción). No hay conexión al core, ni a bases de otros sistemas.

---

## 6. Persistencia y modelo de datos (el corazón del proyecto)

Adrian fue explícito: **lo que más le importa del desarrollo es el "motor dinámico"** de persistencia y lectura de formularios — no el look & feel (eso lo define UX/UI y es "una pavada" ajustarlo después si el modelo de datos está bien resuelto).

**Objetivo de diseño:** agregar un formulario nuevo en el futuro debe implicar únicamente **insertar registros en la base de datos** (un script), sin tocar código de frontend, BFF ni backend.

El modelo debe contemplar:

- **Mapeo Canal × Producto × Gestión** → determina qué gestiones están disponibles para cada combinación. Este mapeo es estático y lo define el negocio (GS), se carga a mano.
- **Catálogo de tipos de control** (repositorio fijo/tipificado): input alfabético, numérico, alfanumérico, con máscara, day picker, time picker, combo, radio button (agrupado), grilla editable (para *n* elementos, ej. siniestros anteriores), panel/sección, etc.
- **Propiedades por control:** obligatoriedad, read-only, rango mínimo/máximo (para numéricos), rango de fechas (para date pickers), máscaras, etc.
- **Dependencias entre controles:** ej. un radio "¿tuvo siniestros anteriores?" habilita o inhabilita una grilla editable.
- **Estructura jerárquica y de layout:** Formulario → Secciones/Paneles → Filas/Columnas → Controles, cada nivel con su propio **atributo de orden** (orden de sección, orden de campo dentro de la sección, fila/columna o salto de línea).
- **Validaciones:** a nivel campo, a nivel panel/contenedor, y a nivel formulario completo.

**Decisión explícita sobre alcance de validaciones:**
- Se descarta un motor de **validaciones dinámicas compiladas en runtime** (código de validación cargado desde la base de datos) — Adrian lo conoce de experiencia previa pero decide **no aplicarlo** en este proyecto por sobre-ingeniería.
- Se van a implementar solo **validaciones de tipo de dato**, intrínsecas al tipo de control (ej. un input numérico ya restringe a números por comportamiento del componente, sin necesidad de validación adicional).
- Se evitan **validaciones de negocio** dentro de este sistema — si aparecen, quedan del lado del backend/operador, no de la SPA.
- Validación puntual para medios de pago: **algoritmo de Luhn** (integridad del número) tanto para tarjeta de crédito como para CBU. No se valida fondos, vigencia ni nada que requiera ir al core — eso queda para el circuito de recaudación posterior.

**Base de datos:**
- SQL Server propio de GS, **esquema exclusivo** para este desarrollo (no compartido con otros sistemas).
- Adrian crea el esquema y lo deja disponible en todos los ambientes.
- No hay normativa estricta de nomenclatura de tablas/campos (preferencia personal de Adrian: en inglés), pero **sí hay nomenclatura obligatoria** para nombres de repositorios (Frontend/BFF/Backend) y para el nombre de la base de datos — la valida Adrian antes de arrancar.
- Se usa **Entity Framework Code First + Migrations**, integrado a CI/CD.

---

## 7. Integración con Delfos (CRM — Dynamics 365)

- "Delfos" es el **nombre de proyecto** de la implementación del nuevo CRM de GS (no es el nombre del producto, que es Microsoft Dynamics). Recién salió a producción.
- Para el equipo externo, Delfos **es simplemente una API**: se arma un JSON según la gestión y se hace un POST.
- Cada gestión tiene su propia tipificación (JSON con estructura propia), pero siempre es la misma estructura para esa gestión — no cambia dinámicamente.
- El JSON no necesita incluir todos los datos personales mostrados en pantalla: lo más relevante es el **ID de la póliza** (ramo/producto/póliza/certificado) y el **DNI/CUIT** del cliente — el operador entra por la póliza, no por el cliente.
- Excepción: gestiones de corrección de datos personales, donde sí es relevante el DNI para localizar al cliente en el core.
- La API de tipificación no falla en la práctica porque encola contra **Azure Service Bus** (alta disponibilidad garantizada).

---

## 8. UX/UI

- **Todo el look & feel debe validarse con el equipo de UX/UI interno** de GS antes de implementarse, ya que la SPA es consumida por clientes finales (si fuera de uso interno, el tratamiento sería distinto).
- UX/UI trabaja en **Figma**, alineado al System Design de la compañía.
- El layout va a ser el mismo para todos los formularios: una vez validado con 1-2 formularios de ejemplo, el resto sigue el mismo lineamiento (salvo controles específicos no contemplados).
- Adrian aclaró que, si UX/UI no está disponible o los tiempos no dan, el equipo externo puede avanzar en la parte de persistencia/modelo de datos sin esperar la definición visual final.
- Propuesta de Marcelo Ruibal: **layout con tabs** — un tab para carga del trámite, otro para consulta de gestiones. Adrian coincide en la idea general (aunque no está cerrada).

---

## 9. Feature pendiente de definición: "Mis Gestiones"

- Sección para que el cliente pueda **consultar el estado** de gestiones ya enviadas (pendiente / recibida / en proceso / finalizada / rechazada).
- Es **puramente informativa** (grilla de solo lectura, sin operaciones).
- Requiere el **circuito inverso**: en vez de tipificar hacia el CRM, hay que consultarle al CRM el estado.
- **No está definido** si esta funcionalidad va dentro de esta SPA o si queda del lado de Sucursal Digital (fuera del alcance del equipo externo). Pendiente de definición funcional en los próximos días.
- Duda abierta (Marcelo): si se debería filtrar por antigüedad (ej. solo último año) o mostrar todo el historial — el CRM trae todas las gestiones del cliente sin discriminar canal de origen.

---

## 10. Propuesta de arquitectura — componente federado (Lucas Saleme)

Lucas planteó pensar el sistema como una especie de **CMS de formularios** y sugirió, para el repositorio del frontend, evaluar un enfoque de **componente federado (Module Federation / micro-frontend)** en lugar de una app "normal":

- Justificación: todos los repos de GS que consumen el System Design usan **Next.js**, por lo que un componente federado reduciría errores de build/render asociados a dependencias externas en micro-frontends.
- Adrian recibió la idea positivamente ("muy buen punto") pero **dejó la decisión de arquitectura final en manos del equipo externo** — no es un requisito impuesto por GS.

---

## 11. Filosofía y alcance del MVP

- El proyecto se concibe como un **sondeo/piloto**, priorizando velocidad y bajo costo (esfuerzo y recursos) por sobre cobertura funcional amplia.
- **No se contemplan** casos de uso complejos que requieran ir al core (ej. aumento de suma asegurada, que necesita cotización y validación de topes de negocio) — quedan explícitamente fuera de alcance.
- El criterio de éxito según Adrian: **poder cargar cualquier formulario nuevo con un simple insert/script en base de datos**, sin tocar código.
- Se espera un número acotado de formularios/gestiones iniciales (no se prevé un catálogo masivo ni cambios frecuentes).
- Prioridad de desarrollo: 1) motor dinámico de persistencia/lectura, 2) integración con Delfos, 3) look & feel (subordinado a UX/UI).

---

## 12. Próximos pasos acordados

1. **Adrian** arma la minuta y envía un mail con toda la información técnica (requisitos de stack, accesos necesarios, templates, links a System Design, etc.), siempre con copia a Fer.
2. **El equipo externo** debe enviar los datos de los 4 integrantes (Lucas Saleme, Marcelo Ruibal, Federico Winnick y un cuarto integrante) para el alta de usuarios — a esperar el detalle exacto de datos requeridos (incluiría DNI).
3. **Contrato de confidencialidad** a coordinar entre Fer y el dueño de la consultora, firmado por este último.
4. Una vez recibidos los datos, **Adrian gestiona**: alta de usuarios (~1 semana), creación de los repositorios (Frontend, BFF, Backend) y de la base de datos, y la exposición pública de frontend/BFF.
5. **El equipo externo puede arrancar en paralelo** con el diseño del modelo de persistencia (prueba y error, incluso usando como referencia el HTML de ejemplo mostrado en la reunión), sin esperar la definición final de UX/UI.
6. GS avanza en paralelo con la **definición funcional de gestiones** (qué campos, qué validaciones por campo) y con la definición de si "Mis Gestiones" queda dentro de este desarrollo o no.
7. **Entrega progresiva**: se van a ir entregando formularios a medida que estén terminados, siguiendo el orden en que UX/UI los vaya maquetando.

---

## 13. Puntos abiertos / pendientes de definición

- Si el sistema final tendrá o no un **backend propio** además del BFF (mencionado al pasar en el cierre, sin cerrar).
- Mecanismo exacto de paso de contexto por URL (formato del hash, algoritmo de encriptado/ofuscado).
- Definición funcional completa de las gestiones/formularios y sus campos (a cargo del negocio de GS).
- Si "Mis Gestiones" se desarrolla dentro de esta SPA o queda para Sucursal Digital.
- Decisión de arquitectura de frontend: **componente federado** vs. repo Next.js estándar (a definir por el equipo externo).
- Detalle del circuito de autenticación entre frontend y BFF (heredado del template, a revisar).
- Si se suma o no, más adelante, la validación de Luhn para tarjeta/CBU (queda como mejora incremental, no bloqueante para el MVP).
- Layout final del formulario y de la sección de confirmación/error (pendiente de Figma de UX/UI).
