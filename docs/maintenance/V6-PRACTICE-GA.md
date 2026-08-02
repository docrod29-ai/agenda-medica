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
| P-002 | Auth y onboarding sin asistencia | **CASI HECHO — corregido tras leer el código.** Verificación de correo (v822) y teléfono del alta (v816). Y el `timeToFirst*` NO faltaba como yo había escrito: `lib/onboarding/embudo.ts` calcula `desdeCuentaMs` por hito y su MEDIANA agregada desde siempre. Lo que faltaba era **pintar la mediana** —se calculaba y no la mostraba nadie— y eso se hizo (v841). **FALTA sólo la decisión del Dr.**: el gate de tarjeta contradice la promesa de «14 días sin tarjeta». |
| P-003 | Agenda completa | **CASI HECHO** — sobreagendar autorizado y auditado, bloqueos validados en servidor, tope de huecos. **Horario partido y descansos (v829)**, y el mismo motor para los CINCO caminos que agendan (v830) — el horario del médico era un fósil que congelaba la agenda en el día del alta. **Festivos editables y recurrentes (v837)**. Los bloqueos ya se guardan en la zona del consultorio y el portal arma los días con su reloj (v836). **FALTA**: sucursales decorativas (`branchId` no lo escribe ninguna interfaz) y calendario externo unidireccional (no hay `freebusy`). |
| P-004 | Master Patient Record + duplicados | **HECHO** — detección de duplicados con bloqueo, nunca fusión automática, y la cita ya no cae en el paciente equivocado. |
| P-005 | Consultation workspace | **HECHO** — una sola pantalla con dictado, secciones, dx, plan, receta, órdenes, copiloto y evidencia, y el encabezado ya dice de un vistazo **alergias · problemas activos · última consulta · medicación vigente** (v828, v840), que era lo que el médico reconstruía abriendo notas hacia atrás. Verificado en producción. |
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
| P-019 | Portal del paciente | **HECHO** (v889) — citas, recetas, documentos, pagos, reagendar **y formulario previo a la consulta**. Lo que el paciente escribe NO pisa el expediente: se guarda aparte, marcado como dicho por él, y el médico decide qué pasa a la nota — si escribiera en `patient.alergias`, un «no» suyo borraría una alergia documentada. No puntúa ni calcula nada: es una declaración, no una valoración. |

## FASE 4 — SEGURIDAD Y CONFIABILIDAD

| # | Charter | Estado |
|---|---|---|
| P-020 | Security release gate | **PARCIAL** — aislamiento por tenant probado (102 specs de emulador), RBAC auditado y estrechado (v808, v818, v823), cabeceras, rate limits, bitácora con cola (v824). **CSP: el veredicto para pasar a bloqueo ya se puede consultar en Cumplimiento (v890)** — estaba escrito y probado, pero nadie leía los reportes, así que la decisión no se podía tomar. Barrido preliminar hecho el 2026-08-02: sin secretos expuestos, sin `.env` rastreado, cabeceras completas con `frame-ancestors 'none'` y `X-Frame-Options: DENY` en la zona autenticada, y **una** vulnerabilidad moderada real (`uuid`, bounds check en v3/v5/v6 con `buf`) que llega por las librerías de Google Cloud y no se dispara desde nuestro código. **FALTA y es DEL DR.**: MFA obligatorio o riesgo aceptado por escrito, PITR, simulacro de restauración, simulacro de incidente, **pentest externo**. El charter es explícito: Claude no aprueba su propia seguridad. |
| P-021 | Resiliencia | **HECHO** — las seis promesas verificadas y reparadas (v800): IA, transcripción, evidencia sin citas inventadas, Stripe sin duplicar, WhatsApp con rastro, autosave sin pérdida silenciosa (v811). |
| P-022 | Observabilidad | **HECHO, con un límite declarado.** **Técnico**: latencias p50/p95/p99 + la peor + tasa de fallo, por operación y por modelo (v842) — los datos ya se guardaban en cada asiento y no los leía nadie. **IA**: consumo, tokens, costo y fallos por modelo y por operación (libro de costos). **Financiero**: ingresos, margen, MRR y ahora **tasa de bajas** con su denominador correcto (v843); antes ni siquiera se guardaba la fecha de cancelación. **Clínico**: lo medible sin entrar al expediente está en `/cumplimiento` y `/cumplimiento/motores` (bitácora, motores sin validar, asientos pendientes). Lo que el charter pide como «tablero clínico» —desenlaces— **no se puede medir desde la plataforma sin pasearse por los expedientes de los clientes**, y eso ya se rechazó una vez al construir el embudo. Se declara en vez de fabricarlo. |

## FASE 5 — GOLDEN FLOW Y LANZAMIENTO

| # | Charter | Estado |
|---|---|---|
| P-023 | Golden flow de extremo a extremo | **FALTA** — y hay un obstáculo real: el dueño tiene pase libre (`layout.tsx:475`), así que **probar con su cuenta no prueba nada**. Hace falta una cuenta con correo ajeno. **DEL DR.** |
| P-024 | Piloto 5–20 médicos | **DEL DR.** |
| P-025 | GA | **BLOQUEADO** por los gates de P-020 y P-023. |

## FASES 6–12 — SANDBOX, HOSPITAL OS, CRITICAL CARE, IA PLATFORM

**Verificado pieza por pieza el 2026-08-02, contra el código.** De las siete que
el charter llamaba «grandes y NUEVAS», **seis ya estaban construidas**:

| Pieza | Dónde está |
|---|---|
| `ICUStay` separado de la cama | `types/hospital.ts` + `icu_stays`, con archivado de la estancia previa al reingreso (v855) |
| `Infusion` con jerarquía de preparación | `lib/clinical/infusion-library.ts` (3 capas, y REFERENCIA nace vacía a propósito) + `lib/uci/infusiones.ts`, conectado al panel de UCI y a la verificación |
| Motor de confirmación por riesgo | `lib/uci/confirmacion.ts` |
| `ADT` | `lib/hospital/bed-assignment.ts` + traslados/egreso del gateway |
| Process mining de episodio | `lib/hospital/indicadores-episodio.ts` |
| Router de IA | `lib/ia/gateway.ts` |
| **Adaptadores de dispositivos** | **FALTABA — hecho en v891**: `lib/dispositivos/vitales-hl7.ts`, conectado a `api/hl7/convertir` |

Lo que queda de estas fases son **closed loops** (cerrar el círculo orden →
administración → efecto → ajuste), que es trabajo clínico del Dr. antes que
software: define qué lazo se cierra solo y cuál no.

---

## LO QUE SIGO YO, EN ORDEN

1. Esquema de clasificación de seguridad clínica (P-007) — el TIPO, no los fármacos.
2. `Status` y `Provenance` en la orden de medicamento (P-008).
3. ~~Provenance por campo~~ — YA EXISTÍA (`procedencia.ts`). Falta sólo distinguir
   `CALCULATED` e `IMPORTED` de `manual`, que es un matiz de vocabulario.
4. ~~Header de la consulta~~ — HECHO (v828, v840) y verificado en producción.
5. ~~Horario partido y descansos~~ — HECHO (v829-v830, v837).
6. ~~Métricas `timeToFirst*`~~ — YA EXISTÍAN en `lib/onboarding/embudo.ts`; faltaba pintarlas (v841).
7. ~~Tableros de observabilidad~~ — HECHO (v842-v843), con el límite del tablero clínico declarado.
8. `BillingEngine`/`StripeAdapter` (P-012) — **NO se hizo, a propósito**. El ciclo
   de vida ya está reparado y probado (v812-v826); extraer la abstracción hoy es
   mover código que funciona, sin un segundo proveedor de pago que lo justifique.
   Cuando lo haya, la refactorización se paga sola; hacerla antes es adivinar.

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
