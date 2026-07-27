export const meta = {
  name: 'auditoria-maestra',
  description: 'Auditoría EXHAUSTIVA de TODA la app NexusMED: descubre el inventario completo (cada ruta API, cada motor clínico, cada módulo, cada colección) y audita CADA pieza, con verificación adversarial de cada hallazgo + gates + crítico de completitud. Read-only: detecta y prioriza, no repara.',
  whenToUse: 'Auditoría completa de toda la aplicación (no muestreo). Antes de un release o mantenimiento profundo.',
  phases: [
    { title: 'Inventario', detail: 'mapear TODA la app (rutas, motores, módulos, colecciones)' },
    { title: 'Baseline', detail: 'tsc + vitest + build' },
    { title: 'Auditoría', detail: 'un auditor por CADA unidad del inventario + transversales' },
    { title: 'Verificación', detail: 'cada hallazgo se intenta refutar (anti falso-positivo)' },
    { title: 'Síntesis', detail: 'dedupe + P0-P3 + decisión' },
    { title: 'Completitud', detail: 'crítico: ¿qué quedó sin auditar?' },
  ],
}

const REPO = '/Users/davidrdz/Desktop/agenda-medica'
const base = `Auditas SOLO-LECTURA la app médica multi-tenant en ${REPO} (Next.js 16 App Router, React 19, TS, Firestore, Stripe, PWA). NO edites nada. Reporta hallazgos REALES (no teóricos) con archivo:línea y cita el código. Sé escéptico y adversarial: si algo parece seguro, intenta burlarlo.`

// ── Esquemas ────────────────────────────────────────────────────────────────
const INVENTARIO_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    rutasApi: { type: 'array', items: { type: 'string' } },
    motores: { type: 'array', items: { type: 'string' } },
    areas: { type: 'array', items: { type: 'string' } },
    colecciones: { type: 'array', items: { type: 'string' } },
    conteos: { type: 'string' },
  },
  required: ['rutasApi', 'motores', 'areas'],
}
const BASELINE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    tsc: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    vitest: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    build: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    testsPasan: { type: 'number' },
    detalle: { type: 'string' },
  },
  required: ['tsc', 'vitest', 'build', 'detalle'],
}
const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          titulo: { type: 'string' },
          severidad: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          archivo: { type: 'string' }, linea: { type: 'number' },
          problema: { type: 'string' }, impacto: { type: 'string' },
          comoSeReproduce: { type: 'string' }, fixSugerido: { type: 'string' },
        },
        required: ['titulo', 'severidad', 'archivo', 'problema', 'impacto'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    real: { type: 'boolean' }, confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    razon: { type: 'string' }, severidadCorregida: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'no-aplica'] },
  },
  required: ['real', 'razon'],
}
const SINTESIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    resumen: { type: 'string' }, releaseDecision: { type: 'string', enum: ['GO', 'CONDITIONAL_GO', 'NO_GO'] },
    p0: { type: 'array', items: { type: 'string' } }, p1: { type: 'array', items: { type: 'string' } },
    p2: { type: 'array', items: { type: 'string' } }, p3: { type: 'array', items: { type: 'string' } },
  },
  required: ['resumen', 'releaseDecision', 'p0', 'p1', 'p2', 'p3'],
}
const COMPLETITUD_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    cobertura: { type: 'string' },
    sinAuditar: { type: 'array', items: { type: 'string' } },
    recomendacion: { type: 'string' },
  },
  required: ['cobertura', 'sinAuditar'],
}

// ── Prompts por tipo de unidad ──────────────────────────────────────────────
const promptApi = (r) => `${base}\nAUDITA A FONDO el endpoint ${r}. Cadena obligatoria: autentica → resuelve clinicId SERVER-SIDE (no del body) → autoriza rol/capability → valida input → carga recurso autoritativo → valida transición → deriva campos protegidos server-side → escribe → audita. Busca: cross-tenant/IDOR, escalada, mass-assignment ({...body} sin allowlist), campos protegidos fijados por cliente (estado/precio/rol/plan/pago), auth ausente, PHI en logs/respuesta, falta de idempotencia/rate-limit en dinero.`
const promptMotor = (m) => `${base}\nAUDITA A FONDO el motor clínico ${m}. Verifica: unidad canónica explícita (no Record<string,number> ambiguo → riesgo de escala tipo FIB-4 1000x), fuente única (sin duplicados), missing≠0, no NaN/Infinity/negativos, topes/caps correctos y propagados (por-toma ≤ diaria), redondeo solo en presentación, versión/referencia/golden test presentes. Genera valores límite y fuera de rango mentalmente y ve si calcula silenciosamente con dato imposible.`
const promptArea = (a) => `${base}\nAUDITA A FONDO el módulo/área "${a}" (sus páginas en src/app y componentes en src/components). Busca: bugs de lógica, pérdida de datos (guardado/navegación), estados vacíos/carga/error mal manejados, acciones irreversibles sin confirmación, datos que parecen editables pero no deberían, cálculos/unidades mal mostrados, fugas de PHI, y problemas de UX/accesibilidad/móvil (touch targets, contraste, foco, color como único indicador de riesgo).`

// ── Dimensiones TRANSVERSALES (además del inventario) ───────────────────────
const CROSSCUTTING = [
  { id: 'x:firestore-rules', prompt: `${base}\nTRANSVERSAL: firestore.rules + storage.rules como frontera independiente (SDK directo). Matriz ROLE×TENANT×RESOURCE×ACTION. Regresiones que no deben reaparecer (trialEndsAtMs, cobroExento, googleTokens, hospital_roles, signos/alertas, invitaciones hasOnly), cross-tenant, denylist vs allowlist, estado inicial, default-deny, lectura de firma médica, Storage size/MIME/owner.` },
  { id: 'x:pagos', prompt: `${base}\nTRANSVERSAL: PAGOS end-to-end. El cliente nunca fija monto/precio/plan/trial/saldo/exención. Webhooks idempotentes, monto esperado vs pagado, replay/duplicado, anticipo del paciente, CFDI.` },
  { id: 'x:fhir', prompt: `${base}\nTRANSVERSAL: FHIR export lossless (src/lib/fhir-export.ts). Matriz campo interno → recurso FHIR; datos estructurados que se pierden (EVA, ACVPU completo, SpO2, O2+flujo+FiO2, dispositivo, alergias, meds, dx, labs).` },
  { id: 'x:phi-logs', prompt: `${base}\nTRANSVERSAL: PHI en logs/URLs/telemetría/localStorage; adopción de safeLog vs console crudo; mínimo privilegio por rol; limpieza de PHI al logout.` },
  { id: 'x:performance', prompt: `${base}\nTRANSVERSAL: performance por código: client components pesados, listeners/queries Firestore sin límite, N+1, documentos gigantes (base64 en config), imágenes/PDF sin lazy.` },
  { id: 'x:deps', prompt: `${base}\nTRANSVERSAL: package.json/lockfile/CI. Advisories, deprecated, majors críticos atrasados, y si el CI corre tsc+lint+build+tests. No proponer majors a ciegas.` },
  { id: 'x:resiliencia', prompt: `${base}\nTRANSVERSAL: resiliencia/observabilidad. Firebase/Stripe/LLM caídos → ¿degrada seguro? ¿la caída de IA impide acceder al expediente/documentar/calcular determinista? Logs estructurados, timeout/offline/duplicados.` },
  { id: 'x:pwa-sw', prompt: `${base}\nTRANSVERSAL: PWA/Service Worker (public/sw.js) y Capacitor. Propagación de versión, caché de datos clínicos (no debe), offline, safe areas iOS.` },
]

// ── FASE 0 — Inventario COMPLETO ────────────────────────────────────────────
phase('Inventario')
const inv = await agent(
  `${base}\nMapea TODA la app con grep/find. Devuelve listas EXHAUSTIVAS (no muestrees, lista TODO):\n- rutasApi: cada archivo src/app/api/**/route.ts (ruta relativa al repo)\n- motores: cada motor clínico determinista exportado en src/lib/uci/*, src/lib/expediente/*, src/lib/hospital/* (formato "nombreFuncion — archivo")\n- areas: cada área/módulo de producto bajo src/app/(dashboard)/* y flujos públicos (agenda, citas, calendario, consulta, expediente, hospitalización, panel UCI, farmacia, finanzas, corte-caja, laboratorio, CRM, reseñas, configuración, equipo, superadmin, portal del paciente, teleconsulta, etc.)\n- colecciones: colecciones/subcolecciones Firestore que aparezcan en firestore.rules\nIncluye un string "conteos" con cuántos de cada uno.`,
  { label: 'inventario', phase: 'Inventario', schema: INVENTARIO_SCHEMA },
)
log(`Inventario: ${inv?.rutasApi?.length ?? 0} rutas API · ${inv?.motores?.length ?? 0} motores · ${inv?.areas?.length ?? 0} áreas`)

// ── FASE 1 — Baseline ───────────────────────────────────────────────────────
phase('Baseline')
const baseline = await agent(
  `${base}\nEres QA. Corre EN ${REPO} y reporta PASS/FAIL con la línea de resumen: (1) \`npx tsc --noEmit\` (2) \`npx vitest run\` (cuántos pasan) (3) \`npm run build\`. Incluye errores exactos si fallan.`,
  { label: 'baseline', phase: 'Baseline', schema: BASELINE_SCHEMA },
)
log(`Baseline → tsc:${baseline?.tsc} vitest:${baseline?.vitest} build:${baseline?.build}`)

// ── FASE 2 — Construir la lista COMPLETA de unidades a auditar ───────────────
const unidades = [
  ...(inv?.rutasApi ?? []).map((r) => ({ tipo: 'api', id: r, prompt: promptApi(r) })),
  ...(inv?.motores ?? []).map((m) => ({ tipo: 'motor', id: m, prompt: promptMotor(m) })),
  ...(inv?.areas ?? []).map((a) => ({ tipo: 'area', id: a, prompt: promptArea(a) })),
  ...CROSSCUTTING.map((c) => ({ tipo: 'transversal', id: c.id, prompt: c.prompt })),
]
log(`Auditando ${unidades.length} unidades (cada una con verificación adversarial de sus hallazgos)…`)

// ── FASE 2+3 — Auditar CADA unidad, verificar cada hallazgo (pipeline) ───────
const porUnidad = await pipeline(
  unidades,
  (u) => agent(u.prompt, { label: `audit:${u.id}`, phase: 'Auditoría', schema: FINDINGS_SCHEMA }),
  (rev, u) => parallel((rev?.findings ?? []).map((f) => () =>
    agent(
      `${base}\nVERIFICACIÓN ADVERSARIAL. Intenta REFUTAR este hallazgo leyendo el código real. Si tras revisarlo NO puedes confirmar que es un fallo real y explotable, marca real=false. Default a false si dudas (evita falsos positivos). Unidad ${u.id}. Hallazgo: ${JSON.stringify(f)}`,
      { label: `verify:${u.id}`, phase: 'Verificación', schema: VERDICT_SCHEMA },
    ).then((v) => ({ ...f, unidad: u.id, tipo: u.tipo, verdict: v })).catch(() => null),
  )),
)

const confirmados = porUnidad.flat().filter(Boolean).filter((f) => f?.verdict?.real)
log(`Hallazgos confirmados: ${confirmados.length} de ${porUnidad.flat().filter(Boolean).length} reportados`)

// ── FASE 4 — Síntesis ───────────────────────────────────────────────────────
phase('Síntesis')
const informe = await agent(
  `Eres el líder de la auditoría. Sintetiza estos hallazgos YA VERIFICADOS. Dedupe, agrupa P0/P1/P2/P3 (usa verdict.severidadCorregida si existe), decisión de release (NO_GO si hay P0: cálculo clínico incorrecto, cross-tenant, bypass auth, fuga PHI, precio client-controlled, firma manipulable, pérdida irreversible de datos). Baseline: ${JSON.stringify(baseline)}. Hallazgos: ${JSON.stringify(confirmados)}`,
  { label: 'sintesis', phase: 'Síntesis', schema: SINTESIS_SCHEMA },
)

// ── FASE 5 — Crítico de COMPLETITUD (¿se auditó TODO?) ───────────────────────
phase('Completitud')
const completitud = await agent(
  `${base}\nEres el crítico de COMPLETITUD. El inventario de la app es: ${JSON.stringify(inv)}. Se auditaron estas unidades: ${JSON.stringify(unidades.map((u) => u.id))}. Verifica contra el repo real si quedó ALGÚN área/ruta/motor/colección importante SIN auditar (p.ej. crons, webhooks, Server Actions, middleware, tipos, hooks, o módulos nuevos). Lista lo que falte cubrir en una próxima corrida.`,
  { label: 'completitud', phase: 'Completitud', schema: COMPLETITUD_SCHEMA },
)

return {
  inventario: inv?.conteos ?? inv,
  baseline,
  unidadesAuditadas: unidades.length,
  totalConfirmados: confirmados.length,
  informe,
  completitud,
  hallazgos: confirmados,
}
