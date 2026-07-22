# FULL_AUDIT NexusMED — inventario priorizado (2026-07)

Auditoría multi-agente (14 roles → 7 auditores) de TODA la app. Confirmados con archivo:línea + reproducción. Estado de reparación por ítem.

## REPARADO Y DESPLEGADO
- **v547** — P1 gate de negación de alergias (copiloto); P1 IA defaults falsos (via='oral'→'', severidad='moderada'→'desconocida'); P2 dosis mL→null + frecuencias en palabra; P2 nombre del paciente fuera del contexto IA; P2 audio de transcripción fallida ya no se sobrescribe.
- (v544–v546 previos) — abono→cita cobrada, membresía mes-calendario, cortesía, CMI-objeto, "No se detecta"→positivo, tazobactam, reprocesar borra Dx/med, autoguardado que no disparaba, enterococo TMP-SMX, gating fosfo/nitro.

## PENDIENTE — por lote

### Lote 2 · Rendimiento (verificable, bajo riesgo)
- **P1** `useNotificacionesCitas.ts:15` — listener de citas de 120 días montado en TODA pantalla (layout) aunque no haya permiso de push. Fix: guard por permiso + acotar query a hoy/mañana.
- **P2** `hospitalizacion/[internamientoId]/page.tsx:120` — `getPatients` (colección entera) para 1 paciente → `getPatient`.
- **P2** `citas/page.tsx:384,481` — `pacientes.find()` por fila + fila sin memo → Map<id,Patient> + React.memo.
- **P3** `firestore.ts:53` findNotaByIdInClinic N+1; `firestore.ts:158` deletePatientExpediente sin where.

### Lote 3 · Frontend cluster (bajo riesgo)
- **P2** hospitalización: modal de signos no resetea estado (`[internamientoId]/page.tsx:490,1037`); censo one-shot fetch (`hospitalizacion/page.tsx:83,63`).
- **P2** finanzas: tarjeta "cancelados" no refresca tras anular (`finanzas/page.tsx:182`).
- **P2** membresías: crear/asignar sin bloqueo doble-submit ni catch (`membresias/page.tsx:141,143,131,133`).
- **P2** pacientes: orden "con alerta" NaN (`pacientes/page.tsx:110`); "Todos A-Z" sin virtualización (`:115,254`).
- **P2** superadmin: borrar paquete sin confirm + ignora res.ok (`superadmin/page.tsx:459,470,483`).
- **P2** calendario mes: `dayAppts` sin sort antes de slice(0,3) oculta cita temprana (`calendario/page.tsx:357,380`).
- **P3** citas filtro "por-cobrar" atascado (`citas/page.tsx:326`); camas sin confirm (`camas/page.tsx:177`); reactivacion/resenas/lista-espera/chat sin catch/confirm.

### Lote 4 · PWA / privacidad
- **P1** logout NO limpia IndexedDB (Firestore persistentLocalCache + `nexusmed-recovery`/audio) → PHI en disco de dispositivo compartido. Fix: `clearIndexedDbPersistence`+`terminate` + `deleteDatabase('nexusmed-recovery')` tras signOut, respetando el latch anti-resurrección. (`local-drafts.ts:61`, `firebase.ts:56`, `useGrabacionAudio.ts:111`)
- **P2** íconos solo SVG → apple-touch-icon en blanco en iOS; faltan PNG 192/512 (requiere generar binarios). (`layout.tsx:37`, `manifest.ts:16`)
- **P3** SW `esRutaClinica` regex más angosto que rutas con PHI (hoy inocuo por 'use client'; deuda defensiva). (`sw.js:73`)

### Lote 5 · Seguridad (requiere cuidado / decisión del Dr)
- **P2** paywall de trial NO se enforza en servidor: `firestore.rules:69` no checa `trialEndsAt` y status ausente = fail-open + crear clínica sin reloj de trial. Riesgo de bloquear clínicas reales si se hace mal → diseñar con cuidado + input del Dr (periodo de gracia).
- **P2** proxy de imagen sin auth sirve firma/sello del médico y fotos clínicas indefinidamente (`receta/diseno/route.ts`). Fix: token firmado con expiración.
- **P3** `firestore.rules:452` clinic_review_requests delete cross-tenant; `:300` arco_requests create unauth sin rate-limit.

### Lote 6 · WhatsApp bot (REQUIERE prueba en vivo con el Dr — no verificable por mí)
- **P1** bot ignora time_blocks (vacaciones) → agenda en día bloqueado (`webhook/route.ts:100,533`).
- **P1** lista de espera agenda con MÉDICO equivocado: `waitlist-notify` no persiste `medicoId` del hueco → bot usa el primer doctor activo (`webhook:654`, `waitlist-notify:121`).
- **P2** citas del bot huérfanas: `pacienteId:''`, no busca/crea paciente por teléfono → no-show nunca contabilizado (`webhook:551`).
- **P3** duración fija 30 min ignora el tipo; doble conteo de contadores al alternar estado (`citas/page.tsx:156`).

### Lote 7 · Clínico que REQUIERE validación del Dr (NO tocar sin su OK)
- **P2** alergia "sulfas" marca furosemida/HCTZ como choque crítico (reactividad cruzada no sustentada) — ¿quitar diuréticos de la familia?
- **P2** choque betalactámico CRÍTICO uniforme para cefalosporinas/carbapenémicos ante alergia a penicilina — ¿graduar carbapenémicos a "precaución"?
- **P2** aviso de embarazo solo con `contraindicado`, ignora teratógenos `evitar` (estatinas/tetraciclinas/quinolonas/AINE) — ¿avisar cuando el Dx indique embarazo?
- **P2** preopInputs: ausencia = negativo alimenta RCRI/Caprini/ARISCAT sin marcar incertidumbre.
- P2/P3 IA: procesar devuelve crudo del LLM al fallar el schema (sin metadatos de seguridad, invisible); evidencia "Agregar a la nota" roto (res.json sobre stream); cefepime SDD dosis optimizada.
