# MASTER EXECUTION LOOP V6 — estado real, fase por fase

**Objetivo del Dr.:** terminar el V6 completo (PRACTICE GA → SANDBOX → HOSPITAL OS
→ CRITICAL CARE OS).

**Cómo se lee esto:** cada punto dice qué exige el charter y qué hay HOY en el
código, verificado. `HECHO` significa desplegado y comprobado en producción.
`FALTA` trae por dónde entrar. `DEL DR.` es suyo y va al final.

Bitácora de versiones desplegadas: `BITACORA-2026-08-01-tarde.md`.

---

## FASE 1 — PRACTICE RELEASE READINESS

| # | Charter | Estado |
|---|---|---|
| P-001 | Auditoría global | **HECHO** — 9 auditores en paralelo (agenda, resiliencia, clínico, diseño, cumplimiento, contabilidad, Stripe, flujo comercial, pérdida de datos). ~90 hallazgos; los confirmados están reparados o en la cola de abajo. |
| P-002 | Auth y onboarding sin asistencia | **PARCIAL** — verificación de correo hecha (v822), teléfono del alta hecho (v816). **FALTA**: el gate de tarjeta contradice la promesa de «14 días sin tarjeta» → decisión del Dr. Y no se miden `timeToFirst*` (el embudo de `/superadmin/onboarding` mide hitos, no tiempos por hito). |
| P-003 | Agenda completa | **PARCIAL** — sobreagendar autorizado y auditado (v806-v807), bloqueos validados en servidor, zonas horarias, tope de huecos (v810). **FALTA**: horario partido y descansos no existen en el modelo (`DaySchedule` es un solo tramo, `src/types/index.ts:408`); festivos no recurrentes; sucursales decorativas (`branchId` no lo escribe ninguna interfaz ni lo mira `getAvailableSlots`); calendario externo unidireccional (no hay `freebusy`, un evento de Google no bloquea la agenda). |
| P-004 | Master Patient Record + duplicados | **HECHO** — detección de duplicados con bloqueo, nunca fusión automática, y la cita ya no cae en el paciente equivocado. |
| P-005 | Consultation workspace | **PARCIAL** — la consulta ya es una sola pantalla con dictado, secciones, dx, plan, receta, órdenes, copiloto y evidencia. **FALTA**: el header no muestra problemas activos ni medicamentos vigentes ni «última consulta» de un vistazo. |
| P-006 | Voice + Note engine con provenance | **CASI HECHO — corregido tras leer el código.** Mi primera lectura fue injusta: `lib/expediente/procedencia.ts` YA hace provenance POR CAMPO, y bien. No la declara: la **deriva de evidencia** — si el dato coincide con la extracción y trae `source_quote`, es `dictado` (y se puede leer la frase exacta); si coincide sin cita, es `ia`; si no coincide, lo escribió el médico. Además registra `confirmado` por campo, con un detalle fino: no compara índices entre las dos listas porque se desfasan al rechazar un ítem, y dar por confirmado un diagnóstico con el visto bueno de OTRO sería un dato falso en el registro. **FALTA sólo el vocabulario**: `CALCULATED` e `IMPORTED` no se distinguen de `manual`. Es un matiz, no un agujero. |
| P-007 | Clinical safety | **PARCIAL** — motores deterministas, dosis con unidad obligatoria, alergias, pediatría, embarazo. **FALTA**: la clasificación `BLOCK/CONTRAINDICATED/AVOID/NOT_RECOMMENDED/DOSE_ADJUST/MONITOR/PASSIVE/INFORMATION` no existe como tipo; hoy es `critica/media/baja`. Asignar cada fármaco es **DEL DR.**, pero el ESQUEMA es mío y falta. Y `BLOQUEA_RECETA` lo decide el LLM y no bloquea nada (`medical-ner.ts:176`). |
| P-008 | Medication engine | **PARCIAL** — modelo con dosis/unidad/vía/frecuencia/duración/indicación, chequeo renal y de alergias. **FALTA**: `Status` y `Provenance` en `MedicationOrder`. |
| P-009 | Task engine | **HECHO** — `lib/tareas-clinicas/` + `/pendientes` (v799). Estados del charter, escalación, dueño y fecha. |
| P-010 | Follow-up engine | **PARCIAL** — al firmar nacen tareas de estudios y receta. **FALTA**: instrucciones al paciente y próxima cita no entran al motor. |

## FASE 2 — FINANZAS, PRICING Y STRIPE

| # | Charter | Estado |
|---|---|---|
| P-011 | Evento clínico ≠ evento financiero | **HECHO** — `situacionDeCobro` con `parcial/exento/pagado`; el anticipo ya no salda la consulta entera (v802); doble cobro cerrado (v800, v803). |
| P-012 | Stripe adapter | **PARCIAL** — el ciclo de vida está reparado (v812-v826: cancelación indebida, ciclo anual, plan por precio, asientos, huérfanos, metadatos). **FALTA**: la arquitectura `BillingEngine → PaymentProviderInterface → StripeAdapter` no existe; la lógica vive en el webhook. |
| P-013 | Pricing engine | **PARCIAL** — catálogo editable en `/superadmin/planes`, precio público derivado. **FALTA**: `PlanVersion`, `LegacyPlan`, `OverageRule`, `Addon`, `Discount`. |
| P-014 | IA vendida como consultas | **HECHO** — `consultasIncluidasTexto()`, créditos secundarios. |
| P-015 | Cost engine | **HECHO** — libro de costos con medición real, proveedor tipado, tarifas con promoción y fecha. **FALTA**: las tarifas las carga el Dr. (nacen vacías a propósito). |
| P-016 | Pricing simulator | **HECHO** — `/superadmin/simulador`, 4 perfiles, punto de pérdida, y todo lo no medible declarado. |
| P-017 | Regla de cobro justo | **HECHO** — `gateCreditos` con modo económico y mensaje que dice qué SÍ funciona. |

## FASE 3 — WHATSAPP, PORTAL Y EXPERIENCIA

| # | Charter | Estado |
|---|---|---|
| P-018 | WhatsApp engine | **PARCIAL** — consentimiento, opt-out, ventana de 24 h, plantillas, entregabilidad, outbox. **FALTA**: el outbox tiene un solo llamador; los fallos ya quedan registrados (v810) pero sin reintento — necesita plantillas aprobadas en Meta (**DEL DR.**). |
| P-019 | Portal del paciente | **PARCIAL** — citas, recetas, documentos, pagos, reagendar. **FALTA**: formularios previos a la consulta. |

## FASE 4 — SEGURIDAD Y CONFIABILIDAD

| # | Charter | Estado |
|---|---|---|
| P-020 | Security release gate | **PARCIAL** — aislamiento por tenant probado (100 specs de emulador), RBAC auditado y estrechado (v808, v818, v823), cabeceras, rate limits, bitácora con cola (v824). **FALTA y es DEL DR.**: MFA obligatorio o riesgo aceptado por escrito, PITR, simulacro de restauración, simulacro de incidente, **pentest externo**. El charter es explícito: Claude no aprueba su propia seguridad. |
| P-021 | Resiliencia | **HECHO** — las seis promesas verificadas y reparadas (v800): IA, transcripción, evidencia sin citas inventadas, Stripe sin duplicar, WhatsApp con rastro, autosave sin pérdida silenciosa (v811). |
| P-022 | Observabilidad | **PARCIAL** — libro de costos, entregabilidad de WhatsApp, embudo de alta, CSP en observación. **FALTA**: los cuatro tableros separados del charter (técnico, clínico, IA, financiero) con latencias p50/p95/p99 y MRR/churn. |

## FASE 5 — GOLDEN FLOW Y LANZAMIENTO

| # | Charter | Estado |
|---|---|---|
| P-023 | Golden flow de extremo a extremo | **FALTA** — y hay un obstáculo real: el dueño tiene pase libre (`layout.tsx:475`), así que **probar con su cuenta no prueba nada**. Hace falta una cuenta con correo ajeno. **DEL DR.** |
| P-024 | Piloto 5–20 médicos | **DEL DR.** |
| P-025 | GA | **BLOQUEADO** por los gates de P-020 y P-023. |

## FASES 6–12 — SANDBOX, HOSPITAL OS, CRITICAL CARE, IA PLATFORM

Existe mucho ya construido (sandbox en `/demo`, hospitalización completa, Panel
UCI con ventilación/gasometría/SOFA/CKRT/ECMO/POCUS, HL7, motores de UCI). Lo que
el charter añade sobre eso son piezas grandes y NUEVAS —`ICUStay` separado de la
cama, `Infusion` con jerarquía de preparación, motor de confirmación por riesgo,
`ADT`, closed loops, process mining, adaptadores de dispositivos, router de IA—
que **no deben empezarse antes de cerrar PRACTICE GA**, por instrucción del propio
charter: «no implementar funciones futuras antes de cerrar los bloqueadores
actuales».

---

## LO QUE SIGO YO, EN ORDEN

1. Esquema de clasificación de seguridad clínica (P-007) — el TIPO, no los fármacos.
2. `Status` y `Provenance` en la orden de medicamento (P-008).
3. ~~Provenance por campo~~ — YA EXISTÍA (`procedencia.ts`). Falta sólo distinguir
   `CALCULATED` e `IMPORTED` de `manual`, que es un matiz de vocabulario.
4. Header de la consulta con problemas activos, medicamentos y última visita (P-005).
5. Horario partido y descansos (P-003).
6. Métricas `timeToFirst*` del onboarding (P-002).
7. Tableros de observabilidad separados (P-022).
8. `BillingEngine`/`StripeAdapter` (P-012) — sólo si sobra tiempo: hoy funciona.

## LO QUE ES DEL DR. (va al final, por su instrucción)

- Validación clínica de los 23 motores en `pendiente_validacion` (P6 del charter viejo).
- Asignar la clasificación de seguridad a cada fármaco (P-007).
- **Pentest externo, PITR, simulacro de restauración e incidente, MFA** (P-020).
- Cuenta de prueba con correo ajeno para el golden flow (P-023) y para el E2E en CI.
- Piloto de 5–20 médicos (P-024).
- Tarifas de los modelos de IA (el libro de costos nace vacío a propósito).
- Plantillas de WhatsApp aprobadas en Meta.
- **¿La prueba de 14 días es con o sin tarjeta?** El código promete una cosa en
  tres pantallas y hace la contraria.
- ¿Se puede repetir la prueba? Hoy sí, indefinidamente.
