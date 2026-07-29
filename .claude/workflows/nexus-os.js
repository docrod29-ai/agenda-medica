export const meta = {
  name: 'nexus-os',
  description: 'Programa Nexus OS: lleva NexusMED de app médica a Clinical Intelligence Operating System (68 unidades, 10 etapas). REANUDABLE: el estado vive en disco y se guarda tras CADA unidad, así que quedarse sin créditos no pierde avance — al relanzar sigue exactamente donde se quedó.',
  whenToUse: 'Avanzar el roadmap Nexus OS por lotes. Seguro de relanzar cuantas veces se quiera: lo ya hecho se salta solo.',
  phases: [
    { title: 'Estado', detail: 'leer disco y elegir las siguientes unidades pendientes' },
    { title: 'Diseño', detail: 'diseñar cada unidad antes de tocar código' },
    { title: 'Implementación', detail: 'SERIAL: una unidad a la vez + gates + checkpoint en disco' },
    { title: 'Verificación', detail: 'refutar adversarialmente cada unidad entregada' },
    { title: 'Cierre', detail: 'consolidar estado y decir dónde se retoma' },
  ],
}

// ── Constantes ──────────────────────────────────────────────────────────────
const REPO = '/Users/davidrdz/Desktop/agenda-medica'
const DIR = `${REPO}/docs/roadmap/nexus-os`
/**
 * Los argumentos pueden llegar como OBJETO o como CADENA JSON según cómo se
 * invoque el workflow. Dos corridas seguidas ignoraron la lista de unidades del
 * operador por esto: llegaba `'{"soloUnidades":[...]}'`, así que `args.soloUnidades`
 * era `undefined`, `SOLO_UNIDADES` quedaba en null y el selector corría igual
 * eligiendo otras unidades. Se normaliza aquí, una sola vez.
 */
const A = (() => {
  if (typeof args === 'string') {
    try { return JSON.parse(args) } catch { return {} }
  }
  return args ?? {}
})()

const LOTE = Number(A?.lote) > 0 ? Number(A.lote) : 3
const SOLO_ETAPA = A?.soloEtapa || null
const SOLO_UNIDADES = Array.isArray(A?.soloUnidades) && A.soloUnidades.length ? A.soloUnidades : null
const DRY_RUN = A?.dryRun === true

log(SOLO_UNIDADES
  ? `Lista explícita del operador (${SOLO_UNIDADES.length}): ${SOLO_UNIDADES.map(u => (typeof u === 'string' ? u : u.id)).join(', ')}. Se salta la fase de selección.`
  : `Sin lista explícita — el selector elegirá ${LOTE} unidades${SOLO_ETAPA ? ` de la etapa ${SOLO_ETAPA}` : ''}.`)

/**
 * CARTA OPERATIVA — se inyecta en TODOS los agentes. No es decorativa: es el
 * límite que separa "software clínico defendible" de "IA que inventa medicina".
 */
const CARTA = `
REGLAS INVIOLABLES (carta operativa del proyecto):
1. NUNCA inventes una regla clínica, un umbral, una dosis ni un "gold answer". Si falta
   criterio médico, marca NEEDS_CLINICAL_REVIEW, explica QUÉ decisión falta y DETENTE
   en ese punto. Adivinar es la peor falla posible en este repo.
2. Trabaja SOLO con datos sintéticos, fixtures y casos ficticios. JAMÁS PHI real.
3. Los módulos clínicos son dominios de software: tipos, unidades, fixtures y tests.
   Tú no diagnosticas ni indicas tratamiento.
4. Prioridad: correctitud del software > seguridad > reproducibilidad > rendimiento > UX.
5. NO rompas funcionalidad existente. Si el cambio arriesga una regresión visible
   (migración de hashes, impresión, cobros, flujo de firma), entrega el PLAN y marca
   para decisión del médico dueño en vez de ejecutarlo a ciegas.
6. NO despliegues a producción. NO toques secretos. NO hagas git push.
7. El LLM nunca calcula dosis ni escalas: eso lo hace un motor determinista.
8. NUNCA corras un comando que no termine solo. Prohibido: \`npx playwright test\`,
   \`npm run dev\`, \`npm start\`, cualquier servidor, cualquier \`--watch\`. Un agente
   colgado en un proceso vivo tumba la corrida entera y pierde el lote (ya pasó).
   Los ÚNICOS gates son \`npx tsc --noEmit\`, \`npx vitest run src/__tests__/\` y
   \`npm run build\`. Si tu unidad entrega pruebas E2E, escribe el archivo .spec y
   documenta el comando para correrlo — pero NO lo ejecutes tú.
9. Estos gates son de MÁQUINA COMPARTIDA: si uno tarda muchísimo o falla raro,
   sospecha contención antes que del código. Repite una vez antes de declarar rojo.
`.trim()

const CTX = `Trabajas en ${REPO}: NexusMED, app médica multi-tenant en producción (Next.js 16 App Router, React 19, TypeScript, Firestore, Stripe, PWA). Tiene ~1885 tests en vitest. El roadmap del programa está en ${DIR}/backlog.json y el avance real en ${DIR}/estado.json.\n\n${CARTA}`

// ── Esquemas ────────────────────────────────────────────────────────────────
const SELECCION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    unidades: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string' }, titulo: { type: 'string' }, etapa: { type: 'string' },
          motivo: { type: 'string' },
        },
        required: ['id', 'titulo', 'etapa'],
      },
    },
    totalUnidades: { type: 'number' },
    yaCompletadas: { type: 'number' },
    pendientes: { type: 'number' },
    resumenEstado: { type: 'string' },
  },
  required: ['unidades', 'yaCompletadas', 'pendientes', 'resumenEstado'],
}

const DISENO_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' },
    yaHecho: { type: 'boolean' },
    archivosATocar: { type: 'array', items: { type: 'string' } },
    contrato: { type: 'string' },
    riesgoDeRegresion: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
    necesitaValidacionClinica: { type: 'boolean' },
    preguntasParaElMedico: { type: 'array', items: { type: 'string' } },
    plan: { type: 'string' },
  },
  required: ['id', 'yaHecho', 'archivosATocar', 'riesgoDeRegresion', 'necesitaValidacionClinica', 'plan'],
}

const RESULTADO_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' },
    estado: { type: 'string', enum: ['completada', 'bloqueada', 'necesita_validacion', 'ya_hecha'] },
    archivosTocados: { type: 'array', items: { type: 'string' } },
    testsAgregados: { type: 'array', items: { type: 'string' } },
    gates: {
      type: 'object', additionalProperties: false,
      properties: {
        tsc: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
        vitest: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
        build: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
        testsPasan: { type: 'number' },
      },
      required: ['tsc', 'vitest'],
    },
    resumen: { type: 'string' },
    bloqueo: { type: 'string' },
    siguientePaso: { type: 'string' },
  },
  required: ['id', 'estado', 'gates', 'resumen'],
}

const VERIF_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' },
    veredicto: { type: 'string', enum: ['CONFIRMADA', 'INCOMPLETA', 'REGRESION', 'NO_APLICA'] },
    cumpleAceptacion: { type: 'boolean' },
    problemas: { type: 'array', items: { type: 'string' } },
    evidencia: { type: 'string' },
  },
  required: ['id', 'veredicto', 'cumpleAceptacion', 'evidencia'],
}

// ── Fase 1: leer el estado del disco y elegir qué sigue ─────────────────────
phase('Estado')

const filtro = SOLO_UNIDADES
  ? `Usa EXACTAMENTE estas unidades (en este orden), ignorando el orden natural: ${SOLO_UNIDADES.join(', ')}. Esta lista es una ORDEN EXPLÍCITA del operador y MANDA sobre las reglas de exclusión de abajo: si una de estas unidades está en \`bloqueadas\`, hazla de todos modos (el operador ya sabe que estaba bloqueada — por eso la nombró). Lo único que NO puedes saltarte es la regla 1 de la carta: si falta criterio médico, te detienes.`
  : SOLO_ETAPA
    ? `Considera SOLO unidades de la etapa ${SOLO_ETAPA}.`
    : 'Considera todas las etapas en orden (E0 primero: el hardening bloquea al resto).'

/**
 * ATAJO: si el operador ya dijo QUÉ unidades quiere, no hay nada que seleccionar.
 *
 * POR QUÉ EXISTE: el agente selector se colgó dos corridas seguidas — 6 reintentos
 * repitiendo la misma exploración de backlog.json/estado.json, 458k tokens y dos
 * horas sin emitir una sola unidad. Es un paso de pura contabilidad; hacerlo con un
 * LLM es gastar el riesgo de un agente en algo que no lo necesita. Con lista
 * explícita se salta entero y la corrida empieza por el diseño.
 *
 * `soloUnidades` acepta strings ('E0-05') u objetos ({id, titulo, etapa}).
 */
const seleccion = SOLO_UNIDADES
  ? {
      unidades: SOLO_UNIDADES.map(u =>
        typeof u === 'string'
          ? { id: u, titulo: u, etapa: u.split('-')[0] }
          : { id: u.id, titulo: u.titulo ?? u.id, etapa: u.etapa ?? String(u.id).split('-')[0] },
      ),
      resumenEstado: `Lista explícita del operador: ${SOLO_UNIDADES.map(u => (typeof u === 'string' ? u : u.id)).join(', ')}. Se saltó la fase de selección a propósito.`,
    }
  : await agent(`${CTX}

TAREA — determinar dónde vamos y qué sigue. Esto es lo que hace el programa reanudable,
así que sé literal y no asumas nada:

1. Lee ${DIR}/backlog.json (las 68 unidades) y ${DIR}/estado.json (el avance).
2. Lista el directorio ${DIR}/unidades/ y comprueba, para cada unidad, si existe
   \`${DIR}/unidades/<ID>/RESULTADO.json\`. **La existencia de ese archivo es la
   prueba de que la unidad está hecha** — manda sobre lo que diga estado.json.
3. Si estado.json y el disco discrepan, CORRIGE estado.json para que refleje el disco
   (escríbelo con el timestamp real: obtén la fecha con \`date -u +%Y-%m-%dT%H:%M:%SZ\`).
4. Elige las siguientes ${LOTE} unidades PENDIENTES aplicando estas reglas:
   - ${filtro}
   - Una unidad sólo es elegible si TODAS sus \`depende\` ya están completadas.
   - No elijas unidades que estén en \`bloqueadas\` o en \`necesitaValidacionDelDr\`
     de estado.json (esas esperan una decisión humana, no más trabajo mío).
   - Prefiere riesgo bajo/medio antes que alto cuando ambas sean elegibles.
5. Devuelve la selección, cuántas van completadas y cuántas quedan.

Si no queda ninguna unidad elegible, devuelve \`unidades: []\` y explica por qué en
resumenEstado (todo hecho, o todo lo elegible espera validación del médico).`,
  { label: 'estado:donde-vamos', schema: SELECCION_SCHEMA })

const elegidas = seleccion?.unidades ?? []

log(`Avance: ${seleccion?.yaCompletadas ?? 0}/${seleccion?.totalUnidades ?? 68} unidades. Pendientes: ${seleccion?.pendientes ?? '?'}.`)

if (!elegidas.length) {
  log('No hay unidades elegibles en esta corrida.')
  return { avance: seleccion, elegidas: [], mensaje: seleccion?.resumenEstado ?? 'Sin unidades elegibles.' }
}

log(`Lote de esta corrida: ${elegidas.map(u => u.id).join(', ')}`)

// ── Fase 2: diseñar cada unidad (paralelo — cada una escribe SU propio archivo) ──
phase('Diseño')

const disenos = await parallel(elegidas.map(u => () => agent(`${CTX}

UNIDAD ${u.id} — ${u.titulo} (etapa ${u.etapa})

TAREA — DISEÑAR, sin implementar todavía.

1. PRIMERO comprueba si \`${DIR}/unidades/${u.id}/RESULTADO.json\` ya existe. Si existe,
   devuelve \`yaHecho: true\` con un plan vacío y NO hagas nada más (ahorra créditos).
2. Lee la definición completa de ${u.id} en ${DIR}/backlog.json: objetivo, entregables,
   criterio de aceptación, dependencias y riesgo.
3. Explora el código REAL para ver qué existe ya. Este repo tiene mucho construido:
   no propongas crear de cero algo que ya está. Cita archivo:línea de lo que encuentres.
4. Diseña el cambio mínimo que cumple el criterio de aceptación:
   - qué archivos se tocan y por qué
   - el contrato (tipos/firmas) de lo nuevo
   - qué tests lo prueban
   - riesgo de regresión REAL sobre funcionalidad en producción
5. Si el criterio de aceptación exige una decisión clínica que NO está en el repo ni en
   la definición (un umbral, un gold answer, una tabla de resistencias), marca
   \`necesitaValidacionClinica: true\` y escribe las preguntas concretas para el médico.
   NO inventes el dato para poder avanzar.
6. Escribe tu diseño en \`${DIR}/unidades/${u.id}/DISENO.md\` (crea el directorio).

${DRY_RUN ? 'MODO DRY-RUN: sólo diseña, no se implementará nada después.' : ''}`,
  { label: `diseño:${u.id}`, phase: 'Diseño', schema: DISENO_SCHEMA })
))

const disenoDe = {}
for (let i = 0; i < elegidas.length; i++) {
  if (disenos[i]) disenoDe[elegidas[i].id] = disenos[i]
}

if (DRY_RUN) {
  log('DRY-RUN: se diseñó sin implementar. Los diseños están en disco.')
  return { avance: seleccion, disenos: disenos.filter(Boolean), dryRun: true }
}

// ── Fase 3: implementar SERIALMENTE ─────────────────────────────────────────
// Serial a propósito: dos agentes editando el mismo repo en paralelo se pisan.
// Además, así el checkpoint en disco tras cada unidad es siempre consistente.
phase('Implementación')

const resultados = []
for (const u of elegidas) {
  const d = disenoDe[u.id]

  if (d?.yaHecho) {
    log(`${u.id} ya estaba hecha — se salta.`)
    resultados.push({ id: u.id, estado: 'ya_hecha', gates: { tsc: 'SKIPPED', vitest: 'SKIPPED' }, resumen: 'Ya existía RESULTADO.json en disco.' })
    continue
  }

  if (d?.necesitaValidacionClinica) {
    log(`${u.id} requiere validación clínica del médico — no se implementa a ciegas.`)
    const r = await agent(`${CTX}

UNIDAD ${u.id} — ${u.titulo}

Esta unidad NO se puede completar sin una decisión clínica del médico dueño.
Preguntas detectadas en el diseño:
${(d.preguntasParaElMedico ?? []).map(p => `  - ${p}`).join('\n') || '  (ver DISENO.md)'}

TAREA — dejar el terreno preparado SIN inventar el criterio:
1. Implementa TODO lo que sí es software puro de esta unidad (tipos, estructura,
   andamiaje, tests de lo determinista), dejando el punto clínico como un hueco
   explícito marcado \`NEEDS_CLINICAL_REVIEW\` — no un valor inventado por defecto.
2. Corre los gates: \`npx tsc --noEmit\`, \`npx vitest run src/__tests__/\`.
3. Escribe \`${DIR}/unidades/${u.id}/RESULTADO.json\` con estado
   \`necesita_validacion\` y las preguntas exactas.
4. Actualiza \`${DIR}/estado.json\`: añade ${u.id} a \`necesitaValidacionDelDr\` con sus
   preguntas, pon \`unidadEnCurso: null\` y \`actualizado\` con la fecha real
   (\`date -u +%Y-%m-%dT%H:%M:%SZ\`).
5. Reescribe \`${DIR}/CHECKPOINT.md\` con el avance legible.

Devuelve estado \`necesita_validacion\`.`,
      { label: `impl:${u.id}(validación)`, phase: 'Implementación', schema: RESULTADO_SCHEMA })
    if (r) resultados.push(r)
    continue
  }

  const r = await agent(`${CTX}

UNIDAD ${u.id} — ${u.titulo} (etapa ${u.etapa})

Ya existe el diseño en \`${DIR}/unidades/${u.id}/DISENO.md\`. Léelo y ejecútalo.

TAREA — IMPLEMENTAR de verdad. Esta es la unidad de trabajo atómica del programa:
o queda entera y verificada, o queda marcada como bloqueada. Nada a medias.

1. Comprueba primero si \`${DIR}/unidades/${u.id}/RESULTADO.json\` existe → si sí,
   devuelve \`ya_hecha\` sin gastar más.
2. Marca el inicio: en \`${DIR}/estado.json\` pon \`unidadEnCurso: "${u.id}"\`.
   (Si los créditos mueren aquí, esto es lo que dice dónde se cortó.)
3. Implementa el diseño. Código idiomático con el repo: mismo estilo, mismos patrones,
   comentarios en español explicando el PORQUÉ del cambio (como el resto del repo).
4. Escribe tests que fallarían sin tu cambio. Un cambio sin test que lo pruebe NO
   cuenta como completado.
5. GATES OBLIGATORIOS, en este orden. Corre cada uno y guarda el resultado real:
   - \`npx tsc --noEmit\`
   - \`npx vitest run src/__tests__/\`
   - \`npm run build\`
   Si alguno falla: ARRÉGLALO. Si tras un intento honesto sigue fallando, revierte tus
   cambios con git para dejar el repo limpio, marca la unidad \`bloqueada\` con el error
   textual, y NO la marques completada. Un repo roto es peor que una unidad pendiente.
6. CHECKPOINT (lo más importante — hazlo SIEMPRE, aunque la unidad quede bloqueada):
   a. Escribe \`${DIR}/unidades/${u.id}/RESULTADO.json\` con archivos tocados, tests,
      gates reales y resumen. Escribe este archivo SOLO si la unidad quedó completada
      o necesita validación — si quedó bloqueada, NO lo escribas (para que se reintente
      en la siguiente corrida), pero sí deja nota del bloqueo en estado.json.
   b. Actualiza \`${DIR}/estado.json\`: mete ${u.id} en \`completadas\` (o en
      \`bloqueadas\` con el motivo), pon \`unidadEnCurso: null\`, y \`actualizado\` con
      la fecha real de \`date -u +%Y-%m-%dT%H:%M:%SZ\`.
   c. Reescribe \`${DIR}/CHECKPOINT.md\`: cuántas van, cuál sigue, qué espera al médico.
7. Haz UN commit de git con los cambios de esta unidad (mensaje: \`feat(nexus-os ${u.id}): <título>\`
   + Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>). NO hagas push. NO despliegues.

Devuelve el resultado real, sin adornar. Si algo no se pudo, dilo.`,
    { label: `impl:${u.id}`, phase: 'Implementación', schema: RESULTADO_SCHEMA })

  if (r) resultados.push(r)
}

// ── Fase 4: verificación adversarial (paralelo — sólo lectura) ──────────────
phase('Verificación')

const aVerificar = resultados.filter(r => r && (r.estado === 'completada' || r.estado === 'necesita_validacion'))

const verificaciones = await parallel(aVerificar.map(r => () => agent(`${CTX}

UNIDAD ${r.id}. Alguien afirma haberla implementado así:
"${(r.resumen || '').slice(0, 900)}"
Archivos que dice haber tocado: ${(r.archivosTocados ?? []).join(', ') || '(no declarados)'}

TAREA — REFUTAR. Eres el verificador adversarial: tu trabajo NO es confirmar, es
encontrar por qué esto podría estar mal. SOLO LECTURA, no edites nada.

1. Lee el criterio de aceptación de ${r.id} en ${DIR}/backlog.json.
2. Lee el código REAL que dice haber cambiado. ¿Existe? ¿Hace lo que dice?
3. Comprueba de forma independiente:
   - ¿El criterio de aceptación se cumple DE VERDAD, o sólo aparentemente?
   - ¿Los tests fallarían si se revierte el cambio, o pasan de todos modos?
   - ¿Se rompió alguna funcionalidad existente? (busca los callers del código tocado)
   - ¿Se inventó algún umbral, dosis o regla clínica sin fundamento? Esto es la falla
     más grave: búscala explícitamente.
   - ¿Quedó PHI real, un secreto o un dato de paciente en algún fixture?
4. Corre \`npx tsc --noEmit\` y \`npx vitest run src/__tests__/\` para comprobar el
   estado real del repo (no confíes en lo que se reportó).
5. Escribe tu veredicto en \`${DIR}/unidades/${r.id}/VERIFICACION.json\`.

Veredicto: CONFIRMADA sólo si la evidencia lo sostiene. INCOMPLETA si cumple a medias.
REGRESION si rompió algo. Cita archivo:línea en la evidencia — sin cita no vale.`,
  { label: `verificar:${r.id}`, phase: 'Verificación', schema: VERIF_SCHEMA })
))

// ── Fase 5: cierre y punto de reanudación ───────────────────────────────────
phase('Cierre')

const vs = verificaciones.filter(Boolean)
const confirmadas = vs.filter(v => v.veredicto === 'CONFIRMADA').map(v => v.id)
const problematicas = vs.filter(v => v.veredicto === 'INCOMPLETA' || v.veredicto === 'REGRESION')

const cierre = await agent(`${CTX}

Cierra la corrida y deja el punto de reanudación impecable. Esto es lo que permite
retomar sin perder nada cuando vuelvan los créditos.

Resultados de esta corrida:
${resultados.map(r => `- ${r.id}: ${r.estado} — ${(r.resumen || '').slice(0, 180)}`).join('\n')}

Verificación adversarial:
${vs.map(v => `- ${v.id}: ${v.veredicto}${v.cumpleAceptacion ? '' : ' (NO cumple aceptación)'} ${(v.problemas ?? []).slice(0, 2).join('; ')}`).join('\n') || '- (sin verificaciones)'}

TAREA:
1. Reconcilia \`${DIR}/estado.json\` con la realidad del disco y con la verificación:
   - Una unidad marcada completada pero verificada como INCOMPLETA o REGRESION debe
     SALIR de \`completadas\` y entrar en \`bloqueadas\` con el motivo, y hay que BORRAR
     su \`unidades/<ID>/RESULTADO.json\` para que se reintente en la próxima corrida.
     (No queremos que un falso "hecho" quede enterrado para siempre.)
   - Añade una entrada al array \`runs\` con: fecha real (\`date -u +%Y-%m-%dT%H:%M:%SZ\`),
     unidades intentadas, completadas, bloqueadas y las que esperan al médico.
   - \`unidadEnCurso\` debe quedar en null.
2. Reescribe \`${DIR}/CHECKPOINT.md\` para que cualquiera (o yo en otra sesión) entienda
   en 30 segundos: cuántas de 68 van, qué se hizo hoy, CUÁL ES LA SIGUIENTE UNIDAD, y
   qué está esperando una decisión del médico.
3. Verifica que el repo quedó limpio: \`git status --short\` y \`npx tsc --noEmit\`.
   Si hay basura sin commitear de una unidad bloqueada, revierte esos archivos.

Devuelve un resumen honesto en 6-10 líneas: qué avanzó realmente, qué no, y cuál es
exactamente la siguiente unidad a ejecutar.`,
  { label: 'cierre:checkpoint', phase: 'Cierre' })

return {
  avanceInicial: `${seleccion?.yaCompletadas ?? 0}/${seleccion?.totalUnidades ?? 68}`,
  intentadas: elegidas.map(u => u.id),
  confirmadas,
  problematicas: problematicas.map(v => ({ id: v.id, veredicto: v.veredicto, problemas: v.problemas })),
  esperanValidacionDelMedico: resultados.filter(r => r.estado === 'necesita_validacion').map(r => r.id),
  bloqueadas: resultados.filter(r => r.estado === 'bloqueada').map(r => ({ id: r.id, motivo: r.bloqueo })),
  cierre,
  comoRetomar: `Relanzar el workflow nexus-os. Lee ${DIR}/estado.json y continúa en la siguiente unidad pendiente. Es idempotente: lo ya hecho se salta solo.`,
}
