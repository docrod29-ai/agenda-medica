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
    // ARCHIVOS de motor (no funciones) — evita el estallido de agentes.
    archivosMotor: { type: 'array', items: { type: 'string' } },
    areas: { type: 'array', items: { type: 'string' } },
    colecciones: { type: 'array', items: { type: 'string' } },
    conteos: { type: 'string' },
  },
  required: ['rutasApi', 'archivosMotor', 'areas'],
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
const promptArchivoMotor = (f) => `${base}\nAUDITA A FONDO TODO el archivo ${f} (todas sus funciones clínicas). Verifica: unidad canónica explícita (no Record<string,number> ambiguo → riesgo de escala tipo FIB-4 1000x), fuente única (sin motores duplicados/divergentes), missing≠0, guardas de finitud (NaN/∞/negativos NO deben caer a un estadio/score por la cascada), topes/caps correctos y propagados (por-toma ≤ diaria), negaciones ("niega X" no debe marcar X positivo), valores censurados (>/≥/≤) no perdidos, redondeo solo en presentación. Genera valores límite y fuera de rango y ve si calcula silenciosamente con dato imposible.`
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
  `${base}\nMapea TODA la app con grep/find. Devuelve listas EXHAUSTIVAS (no muestrees, lista TODO):\n- rutasApi: cada archivo src/app/api/**/route.ts (ruta relativa al repo)\n- archivosMotor: cada ARCHIVO (no función) con lógica clínica determinista en src/lib/uci/*, src/lib/expediente/**, src/lib/hospital/* (ruta relativa; un auditor cubrirá TODO el archivo)\n- areas: cada área/módulo de producto bajo src/app/(dashboard)/* y flujos públicos\n- colecciones: colecciones/subcolecciones Firestore en firestore.rules\nIncluye un string "conteos".`,
  { label: 'inventario', phase: 'Inventario', schema: INVENTARIO_SCHEMA },
)
log(`Inventario: ${inv?.rutasApi?.length ?? 0} rutas API · ${inv?.archivosMotor?.length ?? 0} archivos-motor · ${inv?.areas?.length ?? 0} áreas`)

// ── FASE 1 — Baseline ───────────────────────────────────────────────────────
phase('Baseline')
const baseline = await agent(
  `${base}\nEres QA. Corre EN ${REPO} y reporta PASS/FAIL con la línea de resumen: (1) \`npx tsc --noEmit\` (2) \`npx vitest run\` (cuántos pasan) (3) \`npm run build\`. Incluye errores exactos si fallan.`,
  { label: 'baseline', phase: 'Baseline', schema: BASELINE_SCHEMA },
)
log(`Baseline → tsc:${baseline?.tsc} vitest:${baseline?.vitest} build:${baseline?.build}`)

// ── FASE 2 — Construir la lista de unidades (por ARCHIVO/ruta/área, no función) ─
const unidades = [
  ...(inv?.rutasApi ?? []).map((r) => ({ tipo: 'api', id: r, prompt: promptApi(r) })),
  ...(inv?.archivosMotor ?? []).map((f) => ({ tipo: 'motor', id: f, prompt: promptArchivoMotor(f) })),
  ...(inv?.areas ?? []).map((a) => ({ tipo: 'area', id: a, prompt: promptArea(a) })),
  ...CROSSCUTTING.map((c) => ({ tipo: 'transversal', id: c.id, prompt: c.prompt })),
]
log(`Auditando ${unidades.length} unidades…`)

// ── FASE 2 — Auditar cada unidad (barrera: reunir TODOS los hallazgos) ────────
const auditorias = await parallel(unidades.map((u) => () =>
  agent(u.prompt, { label: `audit:${u.id}`, phase: 'Auditoría', schema: FINDINGS_SCHEMA })
    .then((r) => ({ u, findings: r?.findings ?? [] })).catch(() => ({ u, findings: [] }))))

// ── FASE 3 — Verificar SOLO los P0/P1 (los P2/P3 no gastan verificadores),
// con TOPE DURO de 80 para no acercarse al límite de agentes ─────────────────
const criticos = auditorias.filter(Boolean)
  .flatMap(({ u, findings }) => findings.filter((f) => f.severidad === 'P0' || f.severidad === 'P1').map((f) => ({ ...f, unidad: u.id, tipo: u.tipo })))
  .slice(0, 80)
const p2p3 = auditorias.filter(Boolean)
  .flatMap(({ u, findings }) => findings.filter((f) => f.severidad === 'P2' || f.severidad === 'P3').map((f) => ({ ...f, unidad: u.id, tipo: u.tipo })))
log(`Reportados P0/P1: ${criticos.length} (a verificar) · P2/P3: ${p2p3.length} (sin verificar)`)

const verificados = await parallel(criticos.map((f) => () =>
  agent(
    `${base}\nVERIFICACIÓN ADVERSARIAL. Intenta REFUTAR este hallazgo leyendo el código real. Si tras revisarlo NO puedes confirmar que es un fallo real y explotable, marca real=false. Default a false si dudas. Hallazgo (${f.unidad}): ${JSON.stringify(f)}`,
    { label: `verify:${f.unidad}`, phase: 'Verificación', schema: VERDICT_SCHEMA },
  ).then((v) => ({ ...f, verdict: v })).catch(() => null)))

const confirmados = verificados.filter(Boolean).filter((f) => f?.verdict?.real)
log(`P0/P1 confirmados: ${confirmados.length} de ${criticos.length}`)

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
  p2p3SinVerificar: p2p3.length,
}
