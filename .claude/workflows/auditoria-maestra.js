export const meta = {
  name: 'auditoria-maestra',
  description: 'Auditoría multi-agente de NexusMED (clínico + seguridad + calidad) con verificación adversarial de cada hallazgo y gates deterministas; entrega fallos priorizados P0-P3 con evidencia. NO repara: solo detecta y verifica.',
  whenToUse: 'Cuando quieras detectar fallos/errores en la app con alta confianza (antes de un release, o mantenimiento periódico). Read-only: no edita código.',
  phases: [
    { title: 'Baseline', detail: 'tsc + vitest + build' },
    { title: 'Auditoría', detail: '10 auditores por dominio en paralelo' },
    { title: 'Verificación', detail: 'cada hallazgo se intenta refutar (anti falso-positivo)' },
    { title: 'Síntesis', detail: 'dedupe + priorización P0-P3 + informe' },
  ],
}

// ── El repo ────────────────────────────────────────────────────────────────
const REPO = '/Users/davidrdz/Desktop/agenda-medica'

// ── Esquemas de salida estructurada ────────────────────────────────────────
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
          archivo: { type: 'string' },
          linea: { type: 'number' },
          problema: { type: 'string' },
          impacto: { type: 'string' },
          comoSeReproduce: { type: 'string' },
          fixSugerido: { type: 'string' },
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
    real: { type: 'boolean' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    razon: { type: 'string' },
    severidadCorregida: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'no-aplica'] },
  },
  required: ['real', 'razon'],
}

const SINTESIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    resumen: { type: 'string' },
    releaseDecision: { type: 'string', enum: ['GO', 'CONDITIONAL_GO', 'NO_GO'] },
    p0: { type: 'array', items: { type: 'string' } },
    p1: { type: 'array', items: { type: 'string' } },
    p2: { type: 'array', items: { type: 'string' } },
    p3: { type: 'array', items: { type: 'string' } },
  },
  required: ['resumen', 'releaseDecision', 'p0', 'p1', 'p2', 'p3'],
}

// ── Dimensiones de auditoría (charter) ──────────────────────────────────────
const base = `Auditas SOLO-LECTURA la app médica multi-tenant en ${REPO} (Next.js 16 App Router, React 19, TS, Firestore, Stripe). NO edites nada. Reporta hallazgos REALES (no teóricos) con archivo:línea y cita el código. Sé escéptico y adversarial: si algo parece seguro, intenta encontrar cómo burlarlo. Detecta el stack real desde el repo.`

const DIMENSIONS = [
  { key: 'clinical-safety', prompt: `${base}\nDOMINIO: SEGURIDAD CLÍNICA. Motores deterministas en src/lib/uci/* y src/lib/expediente/*. Verifica: unidades ambiguas (Record<string,number> sin unidad → riesgo de escala tipo FIB-4 1000x), dosis pediátrica (kg/lb, topes mg/kg/día propagados a por-toma), aminoglucósidos (por-toma ≤ diaria), NEWS2/SOFA/APACHE (missing≠0, fuente única), CKD-EPI/FIB-4/MELD (fuente única, sin duplicados). Reporta motores sin versión/referencia/golden test.` },
  { key: 'authz-api', prompt: `${base}\nDOMINIO: AUTORIZACIÓN. Enumera src/app/api/**/route.ts. Para cada mutación/PHI/dinero verifica: autentica → resuelve clinicId SERVER-SIDE (no del body) → autoriza rol/capability → valida input → carga recurso autoritativo → deriva campos protegidos server-side. Busca cross-tenant/IDOR, escalada horizontal/vertical, mass-assignment ({...body} sin allowlist), campos protegidos fijados por cliente (estado/precio/rol/plan), endpoints sensibles con solo "es miembro".` },
  { key: 'firestore-rules', prompt: `${base}\nDOMINIO: FIRESTORE/STORAGE RULES (frontera independiente: el atacante usa el SDK directo). Lee firestore.rules y storage.rules. Matriz ROLE×TENANT×RESOURCE×ACTION. Verifica que NO reaparezcan: trialEndsAtMs/plan client-writable, cobroExento client-create, googleTokens client-read, hospital_roles auto-asignable, signos/alertas borrables, invitaciones sin hasOnly. Busca cross-tenant, mass-assignment por denylist (preferir allowlist), estado inicial forzado, default-deny, lectura de firma médica.` },
  { key: 'phi-logs', prompt: `${base}\nDOMINIO: PHI Y PRIVACIDAD. Busca PHI (nombre/CURP/email/tel/dx/alergia/medicación/nota/receta/audio/firma) en console.*, Sentry, analytics, URLs, query strings, webhooks. Verifica adopción del sanitizador (safeLog) vs console crudo en src/app/api. Mínimo privilegio: ¿recepción puede leer datos clínicos que no necesita? PHI en localStorage sin limpiar al logout.` },
  { key: 'payments', prompt: `${base}\nDOMINIO: PAGOS. El cliente NUNCA es fuente de verdad de monto/precio/descuento/plan/trial/saldo/exención. Verifica: monto derivado server-side, webhooks idempotentes (Stripe constructEvent + candado atómico), comparación monto esperado vs pagado, replay/evento duplicado, anticipo del paciente. Busca cualquier ruta donde el navegador fije el monto.` },
  { key: 'fhir', prompt: `${base}\nDOMINIO: FHIR / INTEROPERABILIDAD. Revisa src/lib/fhir-export.ts. Matriz campo interno → recurso FHIR. Busca datos estructurados internos que se PIERDEN al exportar (EVA/dolor, ACVPU completo, SpO2, O2 suplementario+flujo+FiO2, dispositivo, alergias, medicamentos, dx, labs, procedimientos). FHIR no debe ser una versión empobrecida del expediente.` },
  { key: 'performance', prompt: `${base}\nDOMINIO: PERFORMANCE. Sin medir en runtime, detecta por código: componentes cliente pesados que deberían ser server, listeners Firestore innecesarios, N+1, full-collection scans, documentos gigantes (config con base64), queries sin límite, imágenes/PDF sin lazy. Reporta los que más impacten TTFB/LCP/lecturas de Firestore.` },
  { key: 'a11y-ux-mobile', prompt: `${base}\nDOMINIO: ACCESIBILIDAD / UX / MÓVIL. WCAG: contraste, foco visible, labels/ARIA, touch targets ≥44px, no depender solo de color para riesgo clínico. Móvil/PWA: safe areas, offline de datos clínicos, propagación del service worker. Human factors: acciones irreversibles sin confirmación, datos que parecen editables pero no deberían, unidades no visibles.` },
  { key: 'deps-supply-chain', prompt: `${base}\nDOMINIO: DEPENDENCIAS / SUPPLY CHAIN. Lee package.json, lockfile, .github/workflows. Reporta: paquetes con advisories conocidos, versiones deprecated, majors atrasados críticos (Next/React/Firebase/Stripe), y si el CI corre tsc+lint+build+tests (no solo algunos). NO propongas actualizar majors a ciegas.` },
  { key: 'resilience-observability', prompt: `${base}\nDOMINIO: RESILIENCIA / OBSERVABILIDAD. Simula (por código) Firebase/Stripe/LLM caídos: ¿la consulta médica degrada seguro? ¿la caída de IA impide acceder al expediente/documentar/calcular determinista? Verifica: logs estructurados, error tracking, métricas (sin PHI), manejo de timeout/offline/duplicados. La lógica determinista NO debe depender de la IA.` },
]

// ── FASE 1 — Baseline (gates deterministas) ─────────────────────────────────
phase('Baseline')
const baseline = await agent(
  `${base}\nEres QA. Corre EN ${REPO} y reporta PASS/FAIL de cada gate con su línea de resumen: (1) \`npx tsc --noEmit\` (2) \`npx vitest run\` (cuántos pasan) (3) \`npm run build\`. Si alguno falla, incluye el error exacto. NO edites nada.`,
  { label: 'baseline', phase: 'Baseline', schema: BASELINE_SCHEMA },
)
log(`Baseline → tsc:${baseline?.tsc} vitest:${baseline?.vitest} build:${baseline?.build} (${baseline?.testsPasan ?? '?'} tests)`)

// ── FASE 2+3 — Auditoría por dominio + verificación adversarial (pipeline) ───
// Cada dimensión audita; en cuanto entrega, sus hallazgos se verifican en
// paralelo (intento de refutación) sin esperar a las otras dimensiones.
const porDominio = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { label: `audit:${d.key}`, phase: 'Auditoría', schema: FINDINGS_SCHEMA }),
  (rev, d) => parallel((rev?.findings ?? []).map((f) => () =>
    agent(
      `${base}\nVERIFICACIÓN ADVERSARIAL. Intenta REFUTAR este hallazgo leyendo el código real; si tras revisarlo NO puedes confirmar que es un fallo real y explotable, márcalo real=false. Default a false si dudas (evita falsos positivos). Hallazgo (dominio ${d.key}): ${JSON.stringify(f)}`,
      { label: `verify:${d.key}`, phase: 'Verificación', schema: VERDICT_SCHEMA },
    ).then((v) => ({ ...f, dominio: d.key, verdict: v })).catch(() => null),
  )),
)

// Solo los CONFIRMADOS reales sobreviven.
const confirmados = porDominio.flat().filter(Boolean).filter((f) => f?.verdict?.real)
log(`Hallazgos confirmados (verificados): ${confirmados.length}`)

// ── FASE 4 — Síntesis + priorización ────────────────────────────────────────
phase('Síntesis')
const informe = await agent(
  `Eres el líder de la auditoría. Sintetiza estos hallazgos YA VERIFICADOS como reales. Quita duplicados, agrupa por severidad P0/P1/P2/P3 (usa verdict.severidadCorregida si existe), y da la decisión de release (NO_GO si hay P0: cálculo clínico incorrecto, cross-tenant, bypass auth, fuga PHI, precio client-controlled, firma manipulable). Baseline: ${JSON.stringify(baseline)}. Hallazgos: ${JSON.stringify(confirmados)}`,
  { label: 'sintesis', phase: 'Síntesis', schema: SINTESIS_SCHEMA },
)

return {
  baseline,
  totalConfirmados: confirmados.length,
  informe,
  hallazgos: confirmados,
}
