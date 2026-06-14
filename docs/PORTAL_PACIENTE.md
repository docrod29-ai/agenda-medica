# Portal del Paciente ("Mi Portal") — Plan

> Objetivo: cerrar el mayor hueco vs Doctoralia en experiencia del paciente.
> El paciente accede SIN contraseña (magic-link por WhatsApp) y gestiona lo suyo.
> Versión 2026.06.14 · incremental y NO rompe nada existente.

---

## Principios

1. **Sin contraseña.** Magic-link firmado (HMAC) enviado por WhatsApp. Cero fricción.
2. **Solo sus datos.** El token está atado a `{clinicId, patientId}`; la API jamás
   devuelve ni modifica datos de otro paciente.
3. **No rompe nada.** Rutas y API nuevas; el `Appointment` ya tiene los campos
   necesarios (`confirmadoPaciente`, `fechaConfirmacion`, estados `cancelada`/`reagendada`).
4. **Cumplimiento.** Acceso del titular a sus propios datos (LFPDPPP); se registra en
   bitácora; nada de PII en query strings; token con caducidad.

---

## Arquitectura

- **`src/lib/patient-token.ts`** (server-only, `node:crypto`): `crearTokenPaciente()` /
  `verificarTokenPaciente()`. Formato `base64url(payload).base64url(hmac)`,
  payload `{ c: clinicId, p: patientId, e: expEpoch }`. Secreto: `PORTAL_PACIENTE_SECRET`.
- **`src/app/api/portal/route.ts`** (POST, acción en el body): `session`, `confirmar`,
  `cancelar`, `slots`, `reagendar`. Cada acción verifica el token y filtra por `patientId`.
  Usa `adminDb` (firebase-admin) y aplica el alcance en código.
- **`src/app/mi/[token]/page.tsx`**: la UI del portal (client component, design system).
- Generación del link: helper `linkPortalPaciente(clinicId, patientId)` reutilizable desde
  recordatorios/WhatsApp.

### Reglas de auto-gestión
- **Confirmar**: set `confirmadoPaciente: true` + `fechaConfirmacion`.
- **Cancelar / Reagendar**: solo si faltan ≥ N horas (config de clínica, default 24h) y la
  cita no está ya atendida/cancelada. Reagendar usa `getAvailableSlots` (respeta agenda real
  y médico). Cancelar → estado `cancelada`; reagendar → nueva `fechaHora` (+ libera el hueco).

---

## Fases

**Fase 1 — Mis citas (MVP).** Ver próxima(s) cita(s): fecha, médico, tipo, lugar, "agregar al
calendario". Botones Confirmar / Reagendar / Cancelar con las reglas de arriba. Datos del
consultorio + cómo llegar. → menos no-shows, menos llamadas a la secretaria.

**Fase 2 — Mis documentos.** Historial de citas pasadas + descarga de recetas/órdenes ya
generadas por el médico (reutiliza RecetaDocumento / receta-word del cliente).

**Fase 3 — Reseñas automáticas.** Al marcar una cita como atendida/finalizada, disparar el
link de reseña por WhatsApp (engancha con `reviews.ts` + `/resena/[token]`). Primero botón
manual "pedir reseña", luego automático.

**Fase 4 — Pulido premium.** Marca por clínica, 100% móvil, microcopys, estados vacíos.

---

## Setup requerido (una vez)
- Variable de entorno **`PORTAL_PACIENTE_SECRET`** en Vercel (cadena aleatoria larga).
  En dev hay fallback; en producción es obligatoria (fail-closed).

## Verificación por fase
`npx tsc --noEmit && npx vitest run && rm -rf .next && npm run build`, bump de SW, commit.
