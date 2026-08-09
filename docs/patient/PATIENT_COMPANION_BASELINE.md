# Línea base del compañero del paciente

> **Unidad**: V9 · `PATIENT-UX-TRUTH-001` · 8-ago-2026
> **Qué es**: lo que existe **hoy** de cara al paciente, con su evidencia. No lo
> que debería existir — eso es la directiva.
> **Insumo de**: `PATIENT-COMPANION-001`, `POSTVISIT-001`, `DOCUMENTS-001`,
> `PATIENT-AI-001`, `PATIENT-LANGUAGE-001`.

---

## §0 — En una frase

**Ya existe un portal del paciente que funciona y hace bastante, y existe una
hoja para el paciente muy bien pensada que el producto no le entrega nunca.**

Nueve rutas llegan al paciente. El portal `/mi/[token]` confirma, reagenda,
cancela, cobra anticipo, recoge un formulario previo y deja descargar recetas.
Eso es más de lo que sugiere el estado del programa. Lo que no hay es nada de lo
que V9 llama compañero: ni plan de hoy, ni cambios de medicación, ni cartera de
documentos, ni preguntas, ni idioma, ni cuidador.

## §1 — Las nueve rutas del paciente

| Ruta | Qué puede hacer el paciente | Evidencia |
|---|---|---|
| `/mi/[token]` | **El portal.** 577 líneas | ver §2 |
| `/reservar/[clinicId]` | Autoagenda pública: tipo → fecha → hora → datos → consentimientos | `reservar/[clinicId]/page.tsx:33,71-75,110` |
| `/resena/[token]` | Calificar 1-5 + texto (1 000 caracteres) | `resena/[token]/page.tsx:52,63` |
| `/verificar/[token]` | Verificar una receta impresa por su QR: folio, médico, cédula, huella | `verificar/[token]/page.tsx:5-8` (`noindex`), `:157` |
| `/teleconsulta/[citaId]` | Entrar a la videollamada | `teleconsulta/[citaId]/page.tsx` |
| `/privacidad/[clinicId]` | **Derechos ARCO**, sin cuenta: 5 tipos, folio de 8 caracteres, plazo de 20 días hábiles | `privacidad/[clinicId]/page.tsx:105-107,157` |
| `/dr/[clinicId]` | Perfil público del médico, indexable, con `schema.org` | `dr/[clinicId]/page.tsx:16,101,111-131` |
| `/pago/exito`, `/pago/cancelado` | Vuelta de Stripe | `api/payment/create-checkout/route.ts:78-79` |

Las de PHI están declaradas en un solo sitio:
`src/lib/security/rutas-privadas.ts:119` — `RUTAS_PACIENTE_CON_PHI = ['mi',
'resena', 'verificar', 'teleconsulta']`.

## §2 — El portal, en detalle

Una sola página, todo por `POST /api/portal` con `{action, token}`
(`mi/[token]/page.tsx:57`):

| Capacidad | Dónde |
|---|---|
| Próximas citas con fecha, médico, tipo, lugar y «asistencia confirmada» | `:237-252` |
| **Confirmar** | `:288-292` → `api/portal/route.ts:222-236` |
| **Reagendar** con rejilla de huecos libres en vivo | `PanelReagenda` `:438-476`; `api/portal/route.ts:348-504` |
| **Cancelar** | `:296-298`; `api/portal/route.ts:238-346` |
| Añadir a Google Calendar | `:84-93` |
| **Entrar a la videoconsulta** (30 min antes → 2 h después) | `:267-283`; ventana en `telesalud/ventana-sala.ts:33-35` |
| **Formulario previo** — 6 campos: motivo, desde cuándo, medicamentos, alergias, antecedentes, otro | `FormularioPrevio` `:495-576`; `lib/portal/formulario-previo.ts:29-36`, tope 1 500 caracteres `:52` |
| **Pagar anticipo** (Stripe Checkout) | `:169-184` |
| Citas pasadas | `:366-383` |
| **«Mis recetas»** + descarga en Word | `:394-417`, `:186-207` |

**Lo que la gobierna**: cancelar y reagendar se bloquean dentro de
`politicaCancelacionHoras` (24 h por defecto, `api/portal/route.ts:25,246-248,
376-378`) y sólo sobre estados de la lista blanca (`lib/portal/estados.ts:49`).

## §3 — El token: mejor de lo que se esperaba

`src/lib/patient-token.ts`. Formato `base64url(payload).HMAC-SHA256`, comparación
en tiempo constante (`:119-122`).

| Propiedad | Estado |
|---|---|
| Secreto | `PORTAL_PACIENTE_SECRET`, ≥16 caracteres, **falla duro en producción** (`:70-78`) |
| Vigencia | **7 días** (`:26`, bajado desde 30 con su razonamiento escrito); teleconsulta 1 día (`api/telesalud/token/route.ts:38`) |
| Ámbito | `agenda` \| `clinico` (`:46`). **Falla cerrado**: un token sin ámbito se degrada a `agenda` (`:135`) |
| Aislamiento | `clinicId` y `patientId` **salen del token, nunca del cuerpo** (`api/portal/route.ts:163`; `api/payment/create-checkout/route.ts:37`) |
| **Revocación** | **Existe** — contador `patients/{id}.portalTokenVersion`; se comprueba en cada petición (`api/portal/route.ts:177-183`). Interfaz en `expediente/[patientId]/page.tsx:259-271` |

**Dos huecos, ambos reales:**

- **P1 · La comprobación de revocación falla abierta.** Si la lectura de
  Firestore lanza, la petición pasa (`api/portal/route.ts:183`). Un enlace
  revocado vuelve a valer durante una incidencia de la base.
- **P1 · `/api/portal` no tiene límite de tasa.** No hay ningún `limitar*` en el
  archivo. Confirmar, cancelar, reagendar, enviar el formulario y listar recetas
  van sin freno. Sí lo tienen `telesalud/sala` (12/600 s) y `public/booking`
  (8/h por IP, 4/día por teléfono). Tampoco lo tienen `public/resena` ni
  `payment/create-checkout`.

## §4 — Defecto P0 encontrado **y reparado** en esta unidad

**El enlace de la videoconsulta del paciente no llevaba con qué entrar.**

`enlaceSalaPaciente()` componía `/teleconsulta/<citaId>?c=<clinicId>` y nada más.
`/api/telesalud/sala` exige token HMAC **o** sesión de miembro; el paciente no
tiene sesión, así que caía en la rama de rechazo — que devuelve **404 «Cita no
encontrada»** a propósito, para no confirmarle a un desconocido que ese `citaId`
existe.

El paciente pulsaba «Entrar a la videoconsulta» **dentro de su propio portal**,
donde el token estaba en la barra de direcciones, y la aplicación le decía que su
cita no existe. En la hora de su consulta.

Nadie de dentro lo veía: el botón del médico en `(dashboard)/citas` sí añade
`&t=`, con un token que emite `/api/telesalud/token`. **Sólo fallaba el camino
que ningún empleado recorre** — que es exactamente lo que V9 existe para mirar.

**Reparado**: el token es un parámetro **obligatorio** de `enlaceSalaPaciente`, y
el portal pasa el suyo. Sellado en
`src/__tests__/enlace-de-videoconsulta-lleva-token.test.ts` (REG-268).

**Lo que NO cierra**: el enlace que viaja por **WhatsApp**. `api/cron/reminders`
y el webhook componen el mensaje sin token porque hoy no lo acuñan. Desde este
cambio mandan «recibirás el enlace de la videollamada por este medio» en vez de
un enlace que contesta 404 — **honesto, pero todavía sin enlace**. Acuñarlo exige
firmar en el servidor y está abierto como `PATIENT-TELE-002` (P0) en el backlog.

## §5 — «Lo que se lleva el paciente»: existe, y no se le entrega

`src/components/HojaParaElPaciente.tsx`, 136 líneas. Cuatro bloques, los vacíos
se omiten (`:43`): sus medicamentos · estudios que le pidió el médico ·
indicaciones **literales** del médico · su próxima cita.

**Cómo se compone — y esto es lo bueno**: `lib/paciente/como-se-lo-explico.ts`
es **determinista, no un modelo**. Su cabecera lo dice (`:13-22`): Suki y Nabla
*generan* con un modelo; aquí se *compone* a partir de campos ya firmados. Sólo
se permiten dos transformaciones: la vía a español llano (`:93-98`, «vía oral» →
«por la boca») y la expansión exacta de 24÷n (`:106-113`, que **se niega** a
«cada 5 horas»). Sin red, sin IA. Es exactamente el principio de V9 §2 aplicado
antes de que V9 existiera.

**Y aun así, tres problemas:**

| Sev | Hallazgo | Evidencia |
|---|---|---|
| **P1** | **No hay compuerta de firma.** Se monta con el estado **en curso** de `medicamentos` y `estudiosOrden`; la única guarda es `{!esNotaHospital}` (`consulta:5098-5104`). Justo encima, `ComoCerrarLaConsulta` sí exige `{firmada && …}` (`:5060`). La cabecera afirma que el contenido sale de lo «ya revisado y firmado»: es intención de diseño, no precondición | `consulta:5098-5110` |
| **P1** | **El paciente no la recibe nunca.** Dos botones: copiar al portapapeles (`:45-51`) e imprimir (`:86`). No está en `/mi/[token]`, ni en `/api/portal`, ni en ninguna plantilla de WhatsApp. Sale del navegador del médico sólo si él la pega a mano | único importador: `consulta:53` |
| P2 | `proximaCita={undefined}` está **fijo** (`consulta:5108`): el cuarto bloque no puede renderizarse jamás | `consulta:5108` |

Esto es el núcleo de `POSTVISIT-001`: el contenido ya está resuelto y bien; lo
que falta es la compuerta de aprobación y el camino de entrega.

## §6 — Lo que no existe

| Capacidad de V9 | Estado | Evidencia |
|---|---|---|
| Artefacto DRAFT / RELEASED para el paciente | **AUSENTE** | Existe borrador/firmada para *notas*, pero **ningún** campo `publicado`/`liberado`/`visibleParaPaciente` en el repositorio |
| Cartera de documentos | **PARCIAL, derivada** | «Mis recetas» se **calcula en cada lectura** desde notas firmadas con ≥1 medicamento (`api/portal/route.ts:584-602`). No hay colección de documentos, ni versiones, ni resultados, ni órdenes, ni notas, ni imagen |
| IA de cara al paciente | **AUSENTE** | El bot de WhatsApp es una **máquina de estados determinista** (`api/whatsapp/webhook/route.ts:6-18`), sin llamada a modelo. `/api/ayuda-bot` es del personal y «no lee PHI» |
| Recordatorios | **EXISTE** (sólo WhatsApp) | `api/cron/reminders/route.ts`: ventanas de 24 h (`:237`) y mismo día (`:288`), idempotentes, por consultorio (`:137`), `CRON_SECRET` con fallo cerrado (`:83-88`) |
| Subida de documentos por el paciente | **AUSENTE** | Ni un `<input type="file">` en ninguna ruta del paciente. `storage.rules` permite dos espacios, ambos `request.auth.uid == uid`, y cierra el resto |
| Acceso de cuidador | **AUSENTE** | No hay `cuidador`/`tutor`/`representante`. «Acompañante» existe sólo como **rol de hablante** en diarización (`lib/asr/roles-hablante.ts:35`). El token ata a **un** `patientId`, y el mensaje pide no compartirlo (`AppointmentModal.tsx:401`) |
| Idioma del paciente | **AUSENTE** | No hay campo de idioma en `patients` ni en `ClinicConfig` |
| Plan de hoy · cambios de medicación · signos de alarma · preguntas sin responder | **AUSENTES** | ninguna búsqueda encuentra el concepto |

## §7 — Canales para llegar al paciente

- **WhatsApp — real, y el único.** Un solo punto de paso: `sendWhatsApp` en
  `lib/whatsapp-send.ts:128`. Proveedores 360dialog, Meta Cloud y Twilio
  (`:45,:99-114`). **Baja obligatoria** en mensajes proactivos, con su pie
  «Responda BAJA…» (`:136-143`). El token sale de un gestor de secretos, no del
  documento del consultorio (`:151`).
- **Enlaces `wa.me`** (`lib/whatsapp.ts:107`): así se entrega **hoy** el enlace
  del portal — un miembro pulsa un botón, se abre WhatsApp relleno, y lo manda a
  mano (`AppointmentModal.tsx:376-407`).
- **Correo — AUSENTE.** Ni SendGrid, ni Resend, ni nodemailer, ni SMTP. Se
  **recoge** el correo (`reservar:74`, `privacidad:36`) y no se usa nunca.
- **SMS — AUSENTE.** Twilio está sólo como transporte de WhatsApp.

## §8 — Con qué se puede construir el `PatientVisitPackage`

Todo cuelga de `clinics/{clinicId}/patients/{patientId}`:

- `notas` (con `versions` y `adendas`) — **de aquí salen receta y órdenes**: hoy
  no son colecciones, se derivan de la nota firmada
  (`api/portal/route.ts:584-602`; vistas de impresión en
  `(dashboard)/receta/…` y `(dashboard)/orden/…`).
- `laboratorios` — resultados que sube el médico, interpretados por IA.
- `clinico` — alergias y antecedentes.
- `formularios_previos` — lo único que el paciente escribe hoy, y **lo escribe el
  servidor** tras validar el token (`matriz-acceso.ts:144-149`).
- `appointments` — citas.
- `tareas_clinicas` — cuelga del **consultorio**, no del paciente, a propósito
  (`lib/tareas-clinicas/firestore.ts:6`).

**Conclusión para `POSTVISIT-001`**: los datos están. Lo que no hay es un
artefacto a nivel de documento al que apuntar, con versión y estado. Eso es lo
que `PatientVisitPackage` tiene que introducir — y por el invariante nº1 del
proyecto **no puede duplicar** la fuente de verdad: tiene que **referenciar** la
nota firmada, no copiarla.

## §9 — Idioma

**Infraestructura escrita, adopción cero.**

`src/lib/i18n.ts` (111 líneas) tiene `Locale` de 7 idiomas (`:14`), un
diccionario de 17 claves (`:16-41`), `ES_MX` y `PT_BR`, y `setLocale`/`t`
(`:101-107`). Su propia cabecera lo admite (`:4-7`). Y hay prueba de que nadie lo
importa: `src/__tests__/modulos-sin-conectar.test.ts` lo lleva en la lista de
huérfanos aceptados, **línea 99**, y ese trinquete resuelve importaciones reales,
no nombres de archivo.

No hay `next-intl`, ni `react-intl`, ni `i18next`, ni carpeta de mensajes. El
idioma está fijo en `layout.tsx:53` (`locale: "es_MX"`) y las fechas en
`toLocaleDateString('es-MX', …)`.

**Cadenas en español a mano** (suelo, sólo cuenta las que llevan acento, `ñ`, `¿`
o `¡` — no cuenta «Confirmar», «Cancelar», «Guardar»):

| Medida | Cuántas |
|---|---|
| Literales con diacríticos en `.tsx`, sin comentarios | **~1 352** en **141 archivos** |
| Nodos de texto JSX con diacríticos | **~542** |
| Estimación realista de cadenas de interfaz | **2 000 – 4 000** |

En la superficie del paciente, que es por donde `PATIENT-LANGUAGE-001` empieza:
`mi/[token]` 70 · `reservar` 24 · `dr` 21 · `verificar` 18 · `privacidad` 17 ·
`HojaParaElPaciente` 15 · `resena` 9 · `teleconsulta` 6. **Unas 180 cadenas.**
Eso es abordable y es el argumento para empezar por ahí en vez de por toda la
aplicación.

## §10 — Qué **NO** cubre esta línea base

- **Nada se ejecutó.** Es lectura de código. El 404 de la teleconsulta se
  confirmó siguiendo tres archivos, no abriendo la aplicación — y la reparación
  necesita comprobación en navegador, que está en el backlog.
- **No se sabe cuánto falla en la práctica** el fallo-abierto de
  `portalTokenVersion` (`api/portal/route.ts:183`): no se observa desde el
  código.
- **No se trazó dónde se pinta `formularios_previos`** en la interfaz del médico.
  `resumenPrevio()` existe (`lib/portal/formulario-previo.ts:87`) y la colección
  se respalda, pero no se siguió hasta su pantalla. **Si no se pinta en ninguna,
  es un «escrito y sin conectar»** y hay que abrirlo.
- **El recuento de cadenas es aproximado** y no separa copia de interfaz de
  mensajes de registro y constantes clínicas.
- **No se auditó si la hoja del paciente es correcta clínicamente.** Se auditó su
  procedencia y su entrega.
