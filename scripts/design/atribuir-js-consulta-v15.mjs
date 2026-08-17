/**
 * ATRIBUCIÓN DEL EXCEDENTE DE JS DE /consulta — V15-PERF-001, 3ª rebanada.
 *
 * El baseline midió que /consulta transfiere ~734 KB de JS contra ~490 KB de
 * sus hermanas de la cadena clínica. Antes de cortar nada hay que saber QUÉ
 * es ese excedente — y el camino obvio (`ANALYZE=true npm run build`) está
 * muerto en este build: @next/bundle-analyzer es un plugin de webpack y
 * Next 16 compila con Turbopack, que lo ignora en silencio (no produce
 * .next/analyze/*). La atribución honesta se hace donde importa: en el
 * navegador, con los chunks que de verdad viajan.
 *
 * Método:
 *   1. login (sesión puesta, no medida), SW bloqueado y caché apagada —
 *      mismo frío honesto que medir-perf-v15.mjs;
 *   2. visitar /expediente y registrar cada respuesta .js con su peso;
 *   3. visitar /consulta e igual;
 *   4. el diff (chunks que /consulta carga y /expediente no) ES el
 *      excedente; para cada chunk del diff se descarga el cuerpo y se
 *      extraen los marcadores de módulo que Turbopack deja en el código
 *      ("src/components/...", "src/lib/...", "node_modules/<paquete>") con
 *      los bytes aproximados entre marcador y marcador — suficiente para
 *      acusar módulos, no para contabilidad exacta.
 *
 * Uso (mismo patrón que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/atribuir-js-consulta-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { tablaDeMarcadores, acusarPorRuntime } from './lib/marcadores-runtime.mjs'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-perf'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE_SEMBRADO = 'pac-refugio-alcantara'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  const saltar = page.locator('button:has-text("Saltar")').first()
  try {
    await saltar.waitFor({ state: 'visible', timeout: 4000 })
    await saltar.click()
    await saltar.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour esta vez */ }
}

/** Visita la ruta y devuelve Map<url, bytes> de cada .js transferido. */
async function chunksDe(page, ruta) {
  const vistos = new Map()
  const handler = async (resp) => {
    const url = resp.url()
    if (!/\.js(\?|$)/.test(url)) return
    try {
      const cuerpo = await resp.body()
      vistos.set(url, cuerpo.length)
    } catch { /* respuesta ya descartada */ }
  }
  page.on('response', handler)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(4500)
  page.off('response', handler)
  return vistos
}

/**
 * Acusa a los módulos dentro de un chunk: Turbopack deja las rutas de módulo
 * como claves de texto plano. Se mide el hueco entre marcador y marcador —
 * aproximado, pero suficiente para saber quién pesa.
 */
function acusarModulos(texto) {
  const marcador = /"\[project\]\/([^"]{3,160}?)(?: \[[^"]*)?"/g
  const golpes = []
  let m
  while ((m = marcador.exec(texto)) !== null) golpes.push({ ruta: m[1], desde: m.index })
  const pesos = new Map()
  for (let i = 0; i < golpes.length; i++) {
    const hasta = i + 1 < golpes.length ? golpes[i + 1].desde : texto.length
    const bytes = hasta - golpes[i].desde
    // node_modules se agrega por paquete; src por archivo.
    let clave = golpes[i].ruta
    const np = clave.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
    if (np) clave = `node_modules/${np[1]}`
    pesos.set(clave, (pesos.get(clave) || 0) + bytes)
  }
  return pesos
}

/**
 * ── Marcadores de RUNTIME (5ª rebanada) ──
 *
 * Los marcadores de path ("[project]/…") NO sobreviven en los chunks más
 * minificados: el chunk de página (~219 KB) y el de la maquinaria de
 * grabación (~103 KB) salen de `acusarModulos` casi sin nombres. Lo que SÍ
 * sobrevive a la minificación son los LITERALES de cadena — la lección del
 * verificador del dictado diferido («dicen cosas opuestas del paciente» se
 * encuentra en el chunk construido tal cual).
 *
 * Cada candidato se fingerprintea con sus literales más distintivos, leídos
 * de su PROPIA fuente al momento de correr — no hay tabla a mano que se
 * pudra cuando alguien reescriba un texto. Un candidato está PRESENTE en un
 * chunk si ≥2 de sus marcadores aparecen (≥1 si sólo tiene 1-2 marcadores):
 * un literal suelto puede ser coincidencia; dos del mismo archivo, no.
 */
const CANDIDATOS = [
  // la página misma y su UI local
  'src/app/(dashboard)/consulta/[patientId]/page.tsx',
  'src/app/(dashboard)/consulta/[patientId]/consulta-ui.tsx',
  // maquinaria de grabación eager (el pipeline ya va diferido)
  'src/hooks/useGrabacionAudio.ts',
  'src/hooks/useGrabacionVoz.ts',
  'src/hooks/useComandoVoz.ts',
  'src/hooks/usePorcupineComando.ts',
  'src/lib/expediente/confianza-audio.ts',
  'src/lib/asr/eco-de-cabecera.ts',
  'src/lib/asr/cambios-visibles.ts',
  'src/components/MientrasHablas.tsx',
  'src/components/EmpezarAGrabar.tsx',
  'src/components/AlertasDictado.tsx',
  // siempre-montados a propósito (3ª rebanada)
  'src/components/Copiloto.tsx',
  'src/components/AntesDeFirmar.tsx',
  'src/components/HojaParaElPaciente.tsx',
  'src/components/HistorialVersiones.tsx',
  // sospechosos del chunk de página
  'src/components/PanelRazonamiento.tsx',
  'src/lib/expediente/razonamiento.ts',
  'src/lib/expediente/copiloto.ts',
  'src/lib/expediente/medical-vocabulary.ts',
  'src/lib/expediente/medical-dictionary.ts',
  'src/lib/expediente/farmacovigilancia.ts',
  'src/lib/expediente/proa.ts',
  'src/lib/expediente/nom004.ts',
  'src/lib/expediente/pediatria.ts',
  'src/lib/expediente/calculadoras.ts',
  'src/lib/expediente/avisos-consulta.ts',
  'src/lib/expediente/temporalidad.ts',
  'src/lib/expediente/procedencia.ts',
  'src/lib/seguridad/dosis.ts',
  'src/lib/seguridad/dosis-de-la-lista.ts',
  'src/components/Herramientas.tsx',
  'src/components/Cie10Autocomplete.tsx',
  'src/components/PlanPorProblema.tsx',
  'src/components/DeDondeSalioEsto.tsx',
  'src/components/SelloProcedencia.tsx',
  // el resto de los imports de runtime de la página — para que ningún
  // chunk del excedente quede a medio nombrar (5ª rebanada)
  'src/lib/expediente/sugerencias-ia.ts',
  'src/lib/expediente/templates.ts',
  'src/lib/expediente/cuadro-completo.ts',
  'src/lib/expediente/ordenes-medicamento.ts',
  'src/lib/expediente/problemas-activos.ts',
  'src/lib/expediente/duracion-cumplida.ts',
  'src/lib/expediente/lo-que-se-reviso.ts',
  'src/lib/expediente/cuando-avisar.ts',
  'src/lib/expediente/que-falta-para-cerrar.ts',
  'src/lib/expediente/cierre-hechos.ts',
  'src/lib/expediente/la-reescritura-no-pierde-cifras.ts',
  'src/lib/expediente/integrity.ts',
  'src/lib/expediente/negaciones.ts',
  'src/lib/expediente/experienciador.ts',
  'src/lib/expediente/certeza.ts',
  'src/lib/expediente/trazabilidad.ts',
  'src/lib/expediente/via-asumida.ts',
  'src/lib/expediente/via-parenteral.ts',
  'src/lib/expediente/labs-desde-texto.ts',
  'src/lib/expediente/fusionar-diagnosticos.ts',
  'src/lib/expediente/que-va-en-la-receta.ts',
  'src/lib/expediente/audit-log.ts',
  'src/lib/learning.ts',
  'src/lib/planes-ia.ts',
  'src/lib/herramientas-por-especialidad.ts',
  'src/lib/asr/especialidad-del-medico.ts',
  'src/lib/asr/aprendizaje.ts',
  'src/lib/asr/aprendizaje-firestore.ts',
  'src/lib/asr/un-solo-hablante.ts',
  'src/lib/asr/politica-critica.ts',
  'src/lib/seguridad/alergias.ts',
  'src/lib/seguridad/dosis-desconocida.ts',
  'src/lib/seguridad/ofuscar-local.ts',
  'src/lib/seguridad/estoy-grabando.ts',
  'src/lib/finanzas/precio-consulta.ts',
  'src/lib/tareas-clinicas/derivar.ts',
  'src/lib/tareas-clinicas/reconciliacion.ts',
  'src/lib/tareas-clinicas/firestore.ts',
  'src/lib/mobile/local-drafts.ts',
  'src/components/QueNotaEs.tsx',
  'src/components/CambiosCifrasPanel.tsx',
  'src/components/CorreccionesPanel.tsx',
  'src/components/SelloMotor.tsx',
  'src/components/ComoCerrarLaConsulta.tsx',
  'src/components/CierreAlPulgar.tsx',
]

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const cdp = await contexto.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

await login(page)

const expediente = await chunksDe(page, `/expediente/${PACIENTE_SEMBRADO}`)
const consulta = await chunksDe(page, `/consulta/${PACIENTE_SEMBRADO}`)

const kb = (b) => Math.round(b / 1024)
const totalExp = [...expediente.values()].reduce((a, b) => a + b, 0)
const totalCon = [...consulta.values()].reduce((a, b) => a + b, 0)
console.log(`expediente: ${expediente.size} chunks, ${kb(totalExp)} KB (cuerpo)`)
console.log(`consulta:   ${consulta.size} chunks, ${kb(totalCon)} KB (cuerpo)`)

// El excedente: chunks que consulta carga y expediente no.
const soloConsulta = [...consulta.entries()].filter(([url]) => !expediente.has(url))
const excedente = soloConsulta.reduce((a, [, b]) => a + b, 0)
console.log(`\nexcedente (sólo-consulta): ${soloConsulta.length} chunks, ${kb(excedente)} KB\n`)

// Descargar cada chunk del excedente y acusar módulos — por path Y por runtime.
const tabla = tablaDeMarcadores(CANDIDATOS)
const acusados = new Map()
const runtimePorChunk = []
for (const [url, bytes] of soloConsulta.sort((a, b) => b[1] - a[1])) {
  const resp = await page.request.get(url)
  const texto = await resp.text()
  const pesos = acusarModulos(texto)
  const top = [...pesos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log(`── ${kb(bytes)} KB  ${url.split('/').pop().slice(0, 60)}`)
  for (const [ruta, peso] of top) console.log(`     ${String(kb(peso)).padStart(5)} KB  ${ruta}`)
  for (const [ruta, peso] of pesos) acusados.set(ruta, (acusados.get(ruta) || 0) + peso)
  const presentes = acusarPorRuntime(texto, tabla)
  if (presentes.length > 0) {
    console.log('     · runtime:')
    for (const p of presentes) console.log(`       ${p.golpes}/${p.de}  ${p.modulo}`)
  }
  runtimePorChunk.push({
    url: url.split('/').pop(), kb: kb(bytes),
    modulos: presentes.map(p => ({ modulo: p.modulo, golpes: p.golpes, de: p.de })),
  })
}

console.log('\n══ ACUSADOS DEL EXCEDENTE (agregado, top 30) ══')
const ranking = [...acusados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
for (const [ruta, peso] of ranking) console.log(`  ${String(kb(peso)).padStart(6)} KB  ${ruta}`)

fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(
  path.join(DESTINO, 'atribucion-consulta.json'),
  JSON.stringify({
    fecha: new Date().toISOString(),
    expedienteKB: kb(totalExp),
    consultaKB: kb(totalCon),
    excedenteKB: kb(excedente),
    chunksSoloConsulta: soloConsulta.map(([url, b]) => ({ url: url.split('/').pop(), kb: kb(b) })),
    acusados: ranking.map(([ruta, b]) => ({ ruta, kb: kb(b) })),
    runtimePorChunk,
  }, null, 2),
)
console.log(`\nEscrito ${path.join(DESTINO, 'atribucion-consulta.json')}`)

await contexto.close()
await navegador.close()
