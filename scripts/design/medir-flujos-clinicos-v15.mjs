/**
 * EL BANCO DE FLUJOS CLÍNICOS — V15-WORKFLOW-BENCHMARK-001.
 *
 * ── LA PREGUNTA QUE CONTESTA ────────────────────────────────────────────────
 *
 * ¿El modelo de producto de V15 hace los flujos clínicos reales más rápidos,
 * más claros, más seguros y más continuos SIN regresar conducta validada?
 *
 * No la contesta mirando pantallas: la contesta **haciendo el trabajo**. Diez
 * flujos, de principio a cierre, en navegador de verdad, a 1440×900 y a
 * 390×844, sobre datos sintéticos sembrados. De cada flujo se apunta lo que
 * le cuesta al médico —pasos, clics, transiciones, vueltas atrás, pérdidas de
 * contexto, carga de scroll, puntos de decisión, callejones— y lo que le
 * cuesta al PACIENTE: si en algún paso se pierde de vista de quién se está
 * hablando.
 *
 * ── POR QUÉ NO ES UN «MOTOR DE FLUJOS» ──────────────────────────────────────
 *
 * El encargo lo prohíbe explícitamente, y con razón: una abstracción que
 * describa flujos en datos convierte un defecto del producto en un defecto de
 * la descripción, y entonces el instrumento pasa a medirse a sí mismo. Aquí
 * los diez flujos están **escritos uno a uno**, con sus selectores reales y
 * sus condiciones de éxito reales. Lo único compartido es la BITÁCORA, que no
 * decide nada: cuenta.
 *
 * La bitácora no es producto y no puede serlo: vive en `scripts/design/`, no
 * la importa nada de `src/`, y su coste de retirada es borrar este archivo.
 *
 * ── LA REGLA DE HONESTIDAD (heredada de `medir-grabacion-v15.mjs`) ──────────
 *
 * Un paso que depende de algo que este contenedor no tiene —llaves del
 * proveedor de transcripción, un servicio de mensajería real, un pago— sale
 * `NO_COMPROBABLE` con la dependencia dicha por su nombre. **Nunca `PASA`.**
 * Un paso no comprobable no autoriza a parar: se apunta y se sigue.
 *
 * Y la regla hermana: donde no hay evidencia fiable de cómo era ANTES de V15,
 * el flujo se mide en absoluto y el antes se declara `UNVERIFIABLE`. No se
 * reconstruye una cifra vieja de memoria.
 *
 * ── QUÉ NO CUBRE ───────────────────────────────────────────────────────────
 *
 *  · No mide TIEMPO DE PERCEPCIÓN HUMANA. Los ms que apunta son de máquina en
 *    un contenedor sin carga real: sirven para comparar pasos entre sí dentro
 *    de la misma corrida, no para prometerle segundos a nadie.
 *  · No sustituye a axe: la accesibilidad de las superficies ya medidas vive
 *    en `axe-encuentro-v15.mjs`. Aquí sólo se comprueba lo que el propio flujo
 *    necesita para completarse con teclado.
 *  · No compara contra Abridge/Suki/Nabla/Huli. No hay evidencia comparable en
 *    este repositorio y fabricarla sería peor que no tenerla.
 *  · No prueba el multi-consultorio: una sola identidad sembrada.
 *
 * Uso: bash scripts/design/arnes-flujos-v15.sh
 *      (o suelto, con `next start` ya escuchando en :3000 y la siembra hecha)
 *   node scripts/design/medir-flujos-clinicos-v15.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.env.DESTINO_FLUJOS || 'docs/design/capturas/v15-flujos'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })

/* ──────────────────────────────────────────────────────────────────────────
   LA SONDA. Lee del DOM lo que hace falta para juzgar un flujo, y NADA más.
   Se inyecta antes de cada carga para que esté disponible desde el primer
   render, igual que en `medir-encuentro-v29.mjs`.
   ────────────────────────────────────────────────────────────────────────── */
const SONDA = `
window.__nxw = {
  visible(el) {
    if (!el) return false
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  },
  texto(el) { return (el?.textContent ?? '').replace(/\\s+/g, ' ').trim() },
  main() { return document.querySelector('main') },

  /* QUIÉN. La identidad del paciente tal y como el médico la ve, no como la
     dice la URL. Dos superficies la pintan de dos maneras y las dos valen:
     el ancla del expediente y el <h1> del encuentro. Si ninguna está, se
     devuelve null — y un null en un paso que DEBERÍA tener paciente es
     exactamente una pérdida de ancla. */
  identidad() {
    const ancla = document.querySelector('.nx-patient-anchor')
    if (ancla && this.visible(ancla)) {
      const h = ancla.querySelector('h1, .nx-ident, h2')
      return { fuente: 'ancla', nombre: this.texto(h || ancla).slice(0, 60) }
    }
    const h1 = document.querySelector('main h1.nx-vt-paciente, h1.nx-vt-paciente')
    if (h1 && this.visible(h1)) return { fuente: 'h1-encuentro', nombre: this.texto(h1).slice(0, 60) }
    /* LA FRANJA DEL SHELL. Vive FUERA de <main> —en la topbar del teléfono y
       en la banda de estado del escritorio— y es la que sostiene la identidad
       en las pantallas que no tienen ancla propia, como la receta. Buscar sólo
       dentro de <main> daba «ancla ausente» sobre una pantalla que llevaba el
       nombre del paciente arriba del todo, en persistente. */
    const franja = document.querySelector('.nx-ident-franja')
    if (franja && this.visible(franja)) return { fuente: 'franja', nombre: this.texto(franja).slice(0, 60) }
    return null
  },

  /* CUÁNTAS identidades distintas se ven a la vez en una superficie de
     paciente. Más de una en una pantalla que dice ser de UN paciente es la
     familia «paciente equivocado». */
  identidadesVisibles() {
    const n = new Set()
    for (const el of document.querySelectorAll('.nx-patient-anchor h1, .nx-patient-anchor .nx-ident, h1.nx-vt-paciente, .nx-ident-franja')) {
      if (this.visible(el)) n.add(this.texto(el))
    }
    return [...n]
  },

  /* LA SIGUIENTE ACCIÓN SEGURA. Cuántos rellenos primarios compiten dentro de
     <main>. Uno es jerarquía; tres es inventario. Se mide por la HOJA
     (.btn-primary y el CTA del héroe, que es primario por su propia clase),
     no por el color calculado: un botón puede ser primario y estar en hover. */
  primarias() {
    const m = this.main(); if (!m) return []
    return [...m.querySelectorAll('.btn-primary, .prox-hero-cta')]
      .filter(e => this.visible(e))
      .map(e => this.texto(e).slice(0, 34) || e.getAttribute('aria-label') || '(sin texto)')
  },

  /* LA CARGA DE SCROLL. El shell da a <main> su propio scroll: el documento
     no crece. Se mide en PANTALLAS, que es lo que le cuesta al médico. */
  scroll() {
    const m = this.main(); if (!m) return null
    return {
      alto: m.scrollHeight,
      viewport: m.clientHeight,
      pantallas: Math.round((m.scrollHeight / Math.max(1, m.clientHeight)) * 100) / 100,
      arriba: m.scrollTop,
    }
  },

  /* CUÁNTO hay que leer/decidir: controles interactivos visibles en <main>. */
  controles() {
    const m = this.main(); if (!m) return 0
    return [...m.querySelectorAll('button, a[href], input, select, textarea, [role=button]')]
      .filter(e => this.visible(e)).length
  },

  /* EL MOMENTO ACTUAL. ¿Dice la pantalla en qué estado está lo que enseña?
     Se busca por SIGNIFICADO (sello, estado de cita, sin firmar…), no por una
     clase concreta, para que renombrar el componente no falsee la medida. */
  momento() {
    const m = this.main(); if (!m) return []
    const RE = /sin firmar|borrador|firmada|en curso|en sala|pr[oó]xima|confirmada|por confirmar|vencid|pendiente|abierta|cerrad/i
    const fuera = new Set()
    for (const el of m.querySelectorAll('.nx-estado, .badge, [class*=status], [class*=estado], .t-overline')) {
      if (!this.visible(el)) continue
      const t = this.texto(el)
      if (t && RE.test(t)) fuera.add(t.slice(0, 40))
    }
    return [...fuera].slice(0, 8)
  },

  /* ¿DÓNDE aparece el nombre del paciente en esta pantalla, y con qué papel?
     «identidad()» sólo conoce las dos anclas canónicas (expediente y
     encuentro). Hay superficies clínicas que nombran al paciente de otra
     forma —la receta lo lleva en el documento, no en su encabezado— y la
     diferencia importa: en una receta, el ancla del paciente es lo último que
     puede faltar. Se pasa el nombre esperado porque buscar «un nombre» en
     abstracto no se puede; lo que se mide es dónde está el que TOCA. */
  dondeApareceElNombre(nombre) {
    if (!nombre) return null
    const m = this.main(); if (!m) return null
    const trozo = nombre.split(' ').slice(0, 2).join(' ')
    const casa = el => this.visible(el) && this.texto(el).includes(trozo)
    const h1 = m.querySelector('h1')
    const enH1 = h1 ? casa(h1) : false
    const nodos = [...m.querySelectorAll('h1, h2, h3, .nx-ident, .nx-patient-anchor, [class*=doc], [id*=doc], p, span, strong, td')]
      .filter(casa)
    const primero = nodos[0] ?? null
    const r = primero ? primero.getBoundingClientRect() : null
    const base = m.getBoundingClientRect().top - m.scrollTop
    return {
      enElEncabezado: enH1,
      apariciones: nodos.length,
      papelDelPrimero: primero ? primero.tagName.toLowerCase() + '.' + (primero.className || '').toString().slice(0, 28) : null,
      yDelPrimero: r ? Math.round(r.top - base) : null,
      enElPrimerViewport: r ? Math.round(r.top - base) < m.clientHeight : false,
    }
  },

  foco() {
    const a = document.activeElement
    if (!a || a === document.body) return null
    return {
      tag: a.tagName.toLowerCase(),
      id: a.id || null,
      texto: this.texto(a).slice(0, 34) || a.getAttribute('aria-label') || null,
    }
  },

  encabezado() {
    const h = document.querySelector('main h1') || document.querySelector('h1')
    return h && this.visible(h) ? this.texto(h).slice(0, 60) : null
  },
}
`

/* ──────────────────────────────────────────────────────────────────────────
   LA BITÁCORA. No juzga: cuenta. Un paso es una intención del médico, con lo
   que costó y lo que quedó en pantalla al terminarlo.
   ────────────────────────────────────────────────────────────────────────── */
const PACIENTE_EN_RUTA = /\/(?:consulta|expediente|nota|receta|orden|referencia)\/(pac-[a-z0-9-]+)/i

class Bitacora {
  constructor(page, flujo, viewport) {
    this.page = page
    this.flujo = flujo
    this.viewport = viewport
    this.pasos = []
    this.clics = 0
    this.navegaciones = 0
    this.retrocesos = 0
    this.perdidasDeContexto = []
    this.callejones = []
    this.noComprobables = []
    this.errores = []
    this.notas = []
    this.completado = false
    this.urlPrevia = null
  }

  nota(t) { this.notas.push(t) }
  noComprobable(paso, dependencia) { this.noComprobables.push({ paso, dependencia }) }
  callejon(donde, porQue) { this.callejones.push({ donde, porQue }) }

  /** Un clic contado. Todo clic del flujo pasa por aquí o no se cuenta. */
  async clic(locator, comoSeLlama) {
    this.clics++
    await locator.click()
    this.ultimoClic = comoSeLlama
  }

  /** Cierra un paso: mide dónde quedó el médico y qué le costó. */
  async paso(que, fn, { esperaPaciente = null, esperaMs = 900 } = {}) {
    const t0 = Date.now()
    const clicsAntes = this.clics
    let fallo = null
    try { await fn() } catch (e) { fallo = String(e).split('\n')[0].slice(0, 180) }
    await this.page.waitForTimeout(esperaMs)
    const ms = Date.now() - t0

    const url = this.page.url().replace(BASE, '')
    const m = await this.page.evaluate(() => ({
      identidad: window.__nxw.identidad(),
      identidades: window.__nxw.identidadesVisibles(),
      primarias: window.__nxw.primarias(),
      scroll: window.__nxw.scroll(),
      controles: window.__nxw.controles(),
      momento: window.__nxw.momento(),
      foco: window.__nxw.foco(),
      encabezado: window.__nxw.encabezado(),
    })).catch(() => ({}))

    if (this.urlPrevia !== null && url !== this.urlPrevia) this.navegaciones++
    this.urlPrevia = url

    const pacienteURL = (url.match(PACIENTE_EN_RUTA) || [])[1] ?? null

    /* PÉRDIDA DE CONTEXTO. Dos formas, y las dos son de la misma familia:
       1. la ruta dice un paciente distinto del que el flujo venía tratando;
       2. la ruta dice un paciente y la PANTALLA no enseña ninguna identidad —
          el médico está escribiendo sobre alguien que no tiene delante. */
    if (esperaPaciente) {
      if (pacienteURL && pacienteURL !== esperaPaciente) {
        this.perdidasDeContexto.push({ paso: que, tipo: 'PACIENTE_DISTINTO_EN_RUTA', esperado: esperaPaciente, visto: pacienteURL })
      }
      if (pacienteURL === esperaPaciente && !m.identidad) {
        this.perdidasDeContexto.push({ paso: que, tipo: 'ANCLA_AUSENTE', esperado: esperaPaciente, visto: null })
      }
      if ((m.identidades ?? []).length > 1) {
        this.perdidasDeContexto.push({ paso: que, tipo: 'DOS_IDENTIDADES_A_LA_VEZ', visto: m.identidades })
      }
    }

    this.pasos.push({
      n: this.pasos.length + 1,
      que,
      url,
      ms,
      clics: this.clics - clicsAntes,
      pacienteURL,
      identidad: m.identidad ?? null,
      primarias: m.primarias ?? [],
      controles: m.controles ?? null,
      pantallasDeScroll: m.scroll?.pantallas ?? null,
      momento: m.momento ?? [],
      foco: m.foco ?? null,
      encabezado: m.encabezado ?? null,
      fallo,
    })
    if (fallo) this.callejon(que, fallo)
    return this.pasos[this.pasos.length - 1]
  }

  /** Una vuelta atrás explícita del médico. Se cuenta aparte de los clics. */
  async atras() {
    this.retrocesos++
    await this.page.goBack({ waitUntil: 'load' }).catch(() => {})
  }

  acta() {
    return {
      flujo: this.flujo,
      viewport: this.viewport,
      completado: this.completado,
      pasos: this.pasos.length,
      clics: this.clics,
      navegaciones: this.navegaciones,
      retrocesos: this.retrocesos,
      perdidasDeContexto: this.perdidasDeContexto,
      callejones: this.callejones,
      noComprobables: this.noComprobables,
      errores: this.errores,
      notas: this.notas,
      maxPantallasDeScroll: Math.max(0, ...this.pasos.map(p => p.pantallasDeScroll ?? 0)),
      detalle: this.pasos,
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Utilidades de sesión. Nada de esto es un flujo: es entrar a trabajar.
   ────────────────────────────────────────────────────────────────────────── */
async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 25000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 45000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }
  await page.waitForTimeout(1200)
}

const vistaDe = (b, sup) => path.join(DESTINO, `${b.viewport}-${b.flujo}-${sup}.png`)

/* ══════════════════════════════════════════════════════════════════════════
   LOS DIEZ FLUJOS. Escritos uno a uno, a propósito.
   ══════════════════════════════════════════════════════════════════════════ */

/** WF-01 · HOY → QUIÉN SIGUE → ABRIR EL ENCUENTRO.
 *  El primer gesto de las nueve de la mañana. Éxito = el médico está en el
 *  encuentro del paciente que Hoy le dijo que seguía, y es EL MISMO. */
async function wf01(page, viewport) {
  const b = new Bitacora(page, 'WF-01', viewport)
  await b.paso('abrir Hoy', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
  })

  const heroe = page.locator('.prox-hero').first()
  const hayHeroe = await heroe.isVisible().catch(() => false)
  if (!hayHeroe) {
    b.callejon('Hoy', 'no hay héroe NOW: ninguna cita por delante en la hora del consultorio')
    b.nota('sin héroe NOW la primera acción clínica de Hoy es la de la fila de agenda')
  }

  /* De quién dice Hoy que es el turno. Se lee ANTES de pulsar: si al aterrizar
     el encuentro fuera de otro, eso es la familia «paciente equivocado». */
  const quienSigue = hayHeroe
    ? (await heroe.locator('.nx-ident').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    : (await page.locator('.cita-fila .nx-ident').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
  b.nota(`Hoy dice que sigue: ${quienSigue || '(nadie)'}`)
  await page.screenshot({ path: vistaDe(b, 'hoy') })

  const abrir = hayHeroe
    ? page.locator('.prox-hero-cta').first()
    : page.locator('.cita-fila button:has-text("Consulta")').first()

  await b.paso('iniciar la consulta de quien sigue', async () => {
    await b.clic(abrir, 'iniciar consulta')
    await page.waitForURL('**/consulta/**', { timeout: 25000 })
  }, { esperaMs: 3200 })

  const pid = (page.url().match(PACIENTE_EN_RUTA) || [])[1] ?? null
  await b.paso('el encuentro abierto', async () => {}, { esperaPaciente: pid, esperaMs: 1200 })
  await page.screenshot({ path: vistaDe(b, 'encuentro') })

  const enPantalla = b.pasos.at(-1)?.identidad?.nombre ?? ''
  const mismoPaciente = !!quienSigue && !!enPantalla &&
    quienSigue.split(' ')[0].toLowerCase() === enPantalla.split(' ')[0].toLowerCase()
  if (!mismoPaciente) {
    b.perdidasDeContexto.push({
      paso: 'el encuentro abierto', tipo: 'IDENTIDAD_NO_COINCIDE_CON_HOY',
      esperado: quienSigue, visto: enPantalla,
    })
  }
  b.completado = !!pid && mismoPaciente
  b.nota(`paciente en la ruta: ${pid ?? '(ninguno)'} · en pantalla: ${enPantalla || '(ninguna)'}`)
  return b
}
/** WF-02 · BUSCAR → IDENTIFICAR AL CORRECTO → ENTENDER SU ESTADO → SEGUIR.
 *  Éxito = del buscador al expediente del paciente buscado, con su estado
 *  actual legible sin abrir nada más.
 *
 *  Las filas de `/pacientes` son `button.nx-fila-abrir`, NO enlaces: la primera
 *  versión de este medidor contó `a[href^="/expediente/"]` y publicó
 *  «resultados: 0» sobre una lista que sí tenía resultados. */
async function wf02(page, viewport) {
  const b = new Bitacora(page, 'WF-02', viewport)
  await b.paso('abrir Pacientes', async () => {
    await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  })

  const filas = () => page.locator('main button.nx-fila-abrir')
  b.nota(`pacientes listados antes de buscar: ${await filas().count()}`)

  const buscador = page.locator('input[aria-label^="Buscar un paciente"]').first()
  await b.paso('teclear el apellido', async () => {
    await buscador.fill('Cervantes')
  }, { esperaMs: 1600 })
  await page.screenshot({ path: vistaDe(b, 'busqueda') })

  const cuantos = await filas().count()
  const nombres = await filas().allInnerTexts().catch(() => [])
  b.nota(`resultados con «Cervantes»: ${cuantos} → ${nombres.map(t => t.replace(/\s+/g, ' ').trim()).join(' | ').slice(0, 90)}`)
  /* Que el filtro DISCRIMINE es la mitad segura del flujo: una búsqueda que
     devuelve la lista entera obliga a elegir a ojo entre homónimos. */
  const discrimina = cuantos > 0 && cuantos < 4

  await b.paso('abrir el expediente del resultado', async () => {
    await b.clic(filas().first(), 'fila del resultado')
    await page.waitForURL('**/expediente/**', { timeout: 25000 })
  }, { esperaMs: 3200 })

  const pid = (page.url().match(PACIENTE_EN_RUTA) || [])[1] ?? null
  await b.paso('leer el estado actual sin abrir nada', async () => {}, { esperaPaciente: pid, esperaMs: 1600 })
  await page.screenshot({ path: vistaDe(b, 'expediente') })

  const p = b.pasos.at(-1)
  const correcto = /luz|cervantes/i.test(p?.identidad?.nombre ?? '')
  if (!correcto) {
    b.perdidasDeContexto.push({ paso: 'abrir el expediente', tipo: 'RESULTADO_NO_ES_EL_BUSCADO', esperado: 'Cervantes', visto: p?.identidad?.nombre ?? null })
  }
  b.nota(`momento legible al aterrizar: ${(p?.momento ?? []).join(' · ') || '(nada)'}`)
  b.completado = !!pid && correcto && discrimina && (p?.momento ?? []).length > 0
  return b
}

/** WF-03 · PACIENTE → EXPEDIENTE LONGITUDINAL → PROCEDENCIA → VUELTA EXACTA.
 *
 *  Las notas del expediente son BOTONES («Nota de Seguimiento · Firmada · …»),
 *  no enlaces: la primera versión buscó `a[href*="/nota/"]` y declaró que el
 *  expediente no tenía ninguna nota abrible. Tenía dos. */
async function wf03(page, viewport) {
  const b = new Bitacora(page, 'WF-03', viewport)
  const PID = 'pac-aurelio-dominguez'

  await b.paso('abrir el expediente', async () => {
    await page.goto(`${BASE}/expediente/${PID}`, { waitUntil: 'load' })
  }, { esperaPaciente: PID, esperaMs: 3400 })
  await page.screenshot({ path: vistaDe(b, 'expediente') })

  const urlOrigen = page.url().replace(BASE, '')
  const scrollAntes = await page.evaluate(() => {
    const m = document.querySelector('main'); if (!m) return 0
    m.scrollTop = Math.round(m.scrollHeight * 0.35)
    return m.scrollTop
  })
  await page.waitForTimeout(600)

  const notas = page.locator('main button:has-text("Nota de")')
  const cuantas = await notas.count()
  b.nota(`notas abribles en el expediente: ${cuantas}`)
  if (!cuantas) b.callejon('expediente', 'ninguna nota abrible en el expediente')

  await b.paso('abrir una nota del expediente', async () => {
    if (!cuantas) throw new Error('sin nota abrible')
    await b.clic(notas.first(), 'nota del expediente')
  }, { esperaPaciente: PID, esperaMs: 3000 })
  await page.screenshot({ path: vistaDe(b, 'nota') })

  /* LA PROCEDENCIA. §21 pide poder preguntar de dónde salió lo escrito. Se
     busca por lo que HACE, dentro y fuera de <main> (puede vivir en la lente). */
  const procedencia = page.locator(
    'button:has-text("Procedencia"), button:has-text("¿De dónde salió esto?"), button:has-text("De dónde salió")',
  ).first()
  const hayProcedencia = await procedencia.isVisible().catch(() => false)
  b.nota(`la nota ofrece inspeccionar su procedencia: ${hayProcedencia}`)
  if (!hayProcedencia) b.callejon('nota', 'la nota abierta no ofrece inspeccionar su procedencia')

  await b.paso('inspeccionar la procedencia', async () => {
    if (!hayProcedencia) throw new Error('sin procedencia que inspeccionar')
    await b.clic(procedencia, 'procedencia')
  }, { esperaPaciente: PID, esperaMs: 2000 })
  await page.screenshot({ path: vistaDe(b, 'procedencia') })

  const urlTrasInspeccionar = page.url().replace(BASE, '')
  const inspeccionaEnElSitio = urlTrasInspeccionar.split('?')[0] === urlOrigen.split('?')[0]
  b.nota(`la inspección ocurre sin salir del expediente: ${inspeccionaEnElSitio}`)

  await b.paso('volver al punto exacto del expediente', async () => {
    /* Escape, y si queda algo abierto se cierra DENTRO de la lente.
       `button:has-text("Cerrar")` a secas casa con «Cerrar sesión», que vive en
       el shell: la primera versión de este medidor cerró la sesión y publicó
       «la vuelta aterriza en /login» como si fuera un defecto del expediente. */
    await page.keyboard.press('Escape')
    await page.waitForTimeout(700)
    const cerrar = page.locator('.nx-lente button:has-text("Cerrar"), .nx-lente [aria-label*="errar" i]').first()
    if (await cerrar.isVisible().catch(() => false)) await b.clic(cerrar, 'cerrar la lente')
  }, { esperaPaciente: PID, esperaMs: 2400 })

  const urlVuelta = page.url().replace(BASE, '')
  const scrollDespues = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0)
  b.nota(`ruta ida ${urlOrigen} · vuelta ${urlVuelta} · scroll ${scrollAntes} → ${scrollDespues}`)
  if (urlVuelta.split('?')[0] !== urlOrigen.split('?')[0]) {
    b.perdidasDeContexto.push({ paso: 'volver', tipo: 'RUTA_DE_VUELTA_DISTINTA', esperado: urlOrigen, visto: urlVuelta })
  }
  await page.screenshot({ path: vistaDe(b, 'vuelta') })
  b.completado = cuantas > 0 && hayProcedencia && urlVuelta.split('?')[0] === urlOrigen.split('?')[0]
  return b
}

/** WF-04 · ENCUENTRO SIN FIRMAR → PREPARAR/INICIAR → PAUSAR/REANUDAR → CERRAR.
 *
 *  Cada tramo se comprueba por la TRANSICIÓN DE ESTADO que deja, con espera
 *  real: «Grabar la consulta» → «Pausar la grabación» → «Reanudar la
 *  grabación» → «Pausar la grabación». Un clic que no cambia el estado no es
 *  un paso: es un clic. La primera versión miraba si el control existía justo
 *  después de pulsar y publicó «sin control de reanudar» sobre un ciclo que
 *  reanuda — el mismo falso rojo que hay que cazar en el instrumento antes de
 *  atribuírselo al producto.
 *
 *  Lo que depende del proveedor de transcripción sale NO_COMPROBABLE. */
async function wf04(page, viewport) {
  const b = new Bitacora(page, 'WF-04', viewport)
  /**
   * UN PACIENTE DISTINTO POR ANCHO, y no por capricho.
   *
   * `yaConsintio` mira `patient.consentimientoGrabacion.fecha`, que vive en el
   * EXPEDIENTE: una vez consentido, la compuerta no vuelve a preguntar por ese
   * paciente — que es lo correcto. Consecuencia para el banco: la corrida de
   * escritorio dejaba el consentimiento asentado y la de móvil, sobre el mismo
   * paciente, entraba a grabar sin ver la compuerta. El acta anterior lo apuntó
   * como `consentimiento: false` en el teléfono, que leído deprisa parece
   * «graba sin consentimiento» — y no lo es: es el banco pisándose a sí mismo.
   *
   * Con un paciente por ancho, los dos recorren la compuerta de verdad.
   */
  const PID = viewport === 'movil' ? 'pac-joaquin-esparza' : 'pac-aurelio-dominguez'
  b.nota(`paciente de este ancho: ${PID} (uno por ancho: el consentimiento queda en el expediente y no se vuelve a pedir)`)

  await b.paso('abrir el encuentro SIN firmar', async () => {
    await page.goto(`${BASE}/consulta/${PID}`, { waitUntil: 'load' })
  }, { esperaPaciente: PID, esperaMs: 4000 })
  await page.screenshot({ path: vistaDe(b, 'encuentro') })

  /* `:visible` no es adorno. Cada control del ciclo existe DOS veces —en el
     bloque de grabación y en el cromo flotante—, y `.first()` a secas se
     quedaba con el que en ese ancho está oculto: `waitFor('visible')` agotaba
     los 15 s sobre un botón que nunca iba a verse, y el acta anterior publicó
     «sin control de reanudar» sobre un ciclo que sí reanuda. */
  /* PAUSAR y REANUDAR son BOTONES DE ICONO: su rótulo vive en `aria-label`, no
     en el texto. `:has-text()` mira el contenido de texto y por eso no los veía
     — la corrida anterior publicó «sin control de reanudar» sobre un ciclo que
     sí pausa y sí reanuda (la captura `escritorio-WF-04-grabando.png` enseña el
     ⏸ junto al cronómetro corriendo). Se piden por lo que ANUNCIAN, que además
     es lo que oye un lector de pantalla. Y `:visible` porque cada control
     existe dos veces: en el bloque y en el cromo flotante. */
  const grabar = page.locator('button[aria-label^="Grabar la consulta"]:visible').first()
  const pausar = page.locator('button[aria-label*="ausar" i]:visible').first()
  const reanudar = page.locator('button[aria-label*="eanudar" i]:visible').first()
  const terminar = page.locator('button:has-text("Terminar"):visible').first()

  const hayGrabar = await grabar.isVisible().catch(() => false)
  if (!hayGrabar) b.callejon('encuentro', 'no se encontró el control de grabación')

  const transiciones = {}
  await b.paso('preparar: pedir grabar exige consentimiento', async () => {
    if (!hayGrabar) throw new Error('sin control de grabación')
    await b.clic(grabar, 'grabar')
    const consentir = page.locator('button:has-text("Confirmo el consentimiento"):visible').first()
    transiciones.consentimiento = await consentir.isVisible({ timeout: 8000 }).catch(() => false)
    if (transiciones.consentimiento) await b.clic(consentir, 'confirmar consentimiento')
    else b.callejon('grabación', 'se pidió grabar y NO apareció la compuerta de consentimiento sobre un paciente sin consentimiento previo')
  }, { esperaPaciente: PID, esperaMs: 2600 })
  await page.screenshot({ path: vistaDe(b, 'grabando') })

  await b.paso('iniciar: la pantalla pasa a estado de grabación', async () => {
    await pausar.waitFor({ state: 'visible', timeout: 15000 })
    transiciones.grabando = true
  }, { esperaPaciente: PID, esperaMs: 800 })

  await b.paso('pausar', async () => {
    await b.clic(pausar, 'pausar')
    await reanudar.waitFor({ state: 'visible', timeout: 15000 })
    transiciones.enPausa = true
  }, { esperaPaciente: PID, esperaMs: 800 })
  await page.screenshot({ path: vistaDe(b, 'en-pausa') })

  await b.paso('reanudar', async () => {
    await b.clic(reanudar, 'reanudar')
    await pausar.waitFor({ state: 'visible', timeout: 15000 })
    transiciones.reanudada = true
  }, { esperaPaciente: PID, esperaMs: 800 })

  await b.paso('cerrar la grabación', async () => {
    if (!(await terminar.isVisible().catch(() => false))) throw new Error('sin control de terminar')
    await b.clic(terminar, 'terminar')
    /* Terminar abre un aviso de salida del navegador en algunas rutas: se
       acepta si aparece, porque el punto del paso es cerrar el ciclo. */
    page.once('dialog', d => d.accept().catch(() => {}))
    transiciones.cerrada = await pausar.isHidden({ timeout: 12000 }).catch(() => false)
  }, { esperaPaciente: PID, esperaMs: 2600 })
  await page.screenshot({ path: vistaDe(b, 'cerrada') })

  b.nota(`transiciones: ${JSON.stringify(transiciones)}`)
  b.noComprobable('aparece la transcripción', 'llaves del proveedor de transcripción, ausentes en este contenedor')
  b.noComprobable('de la transcripción nace la nota', 'el mismo proveedor + audio sintético')
  b.completado = !!(transiciones.consentimiento && transiciones.grabando && transiciones.enPausa && transiciones.reanudada)
  return b
}

/** WF-05 · ENCUENTRO → RECETA → VOLVER A LA CONTINUIDAD DEL ENCUENTRO.
 *
 *  El camino lo abre `ComoCerrarLaConsulta`, que sólo existe sobre una nota
 *  FIRMADA y sólo ofrece receta si la nota trae medicamentos. La primera
 *  versión midió esto sobre un BORRADOR y concluyó «sin salida a receta»: era
 *  cierto, y no decía nada — en un borrador esa salida no debe existir.
 *
 *  La invariante dura es la segunda mitad: volver al MISMO encuentro. */
async function wf05(page, viewport) {
  const b = new Bitacora(page, 'WF-05', viewport)
  const PID = 'pac-luzmaria-cervantes'
  const NOTA = 'nota-luzmaria-1'   // firmada + 2 medicamentos (siembra aditiva)

  await b.paso('abrir el encuentro ya firmado', async () => {
    await page.goto(`${BASE}/consulta/${PID}?nota=${NOTA}`, { waitUntil: 'load' })
  }, { esperaPaciente: PID, esperaMs: 4200 })
  await page.screenshot({ path: vistaDe(b, 'encuentro') })
  const urlEncuentro = page.url().replace(BASE, '')

  /* La salida se busca por DESTINO, no por rótulo. Puede ser un enlace o un
     botón que hace `router.push`; se cubren los dos. */
  const salidaEnlace = page.locator(`main a[href^="/receta/"]`).first()
  const salidaBoton = page.locator('main button:has-text("receta"), main button:has-text("Receta")').first()
  const porEnlace = await salidaEnlace.isVisible().catch(() => false)
  const porBoton = !porEnlace && await salidaBoton.isVisible().catch(() => false)
  if (!porEnlace && !porBoton) {
    b.callejon('encuentro firmado', 'el cierre del encuentro no ofrece ninguna salida a la receta')
  }

  await b.paso('salir a la receta desde el cierre del encuentro', async () => {
    if (!porEnlace && !porBoton) throw new Error('sin salida a receta')
    await b.clic(porEnlace ? salidaEnlace : salidaBoton, 'receta')
    await page.waitForURL('**/receta/**', { timeout: 20000 })
  }, { esperaMs: 3400 })
  await page.screenshot({ path: vistaDe(b, 'receta') })

  await b.paso('la receta habla del mismo paciente', async () => {}, { esperaMs: 800 })
  const enReceta = page.url().includes('/receta/')

  /* EL ANCLA DEL PACIENTE EN LA RECETA. No se pide `esperaPaciente` en el paso
     anterior a propósito: la receta NO pinta ninguna de las dos anclas
     canónicas, y marcarlo como «ancla ausente» diría que falta el componente
     cuando lo que hay que saber es si el médico ve de quién es la receta que va
     a imprimir. Se mide dónde está el nombre y con qué papel. */
  const dondeElNombre = await page.evaluate(
    n => window.__nxw.dondeApareceElNombre(n),
    'Luz María Cervantes Ochoa',
  ).catch(() => null)
  const anclaDeLaReceta = await page.evaluate(() => window.__nxw.identidad()).catch(() => null)
  b.nota(`el paciente en la receta — ancla del shell: ${JSON.stringify(anclaDeLaReceta)}`)
  b.nota(`el paciente en el cuerpo de la receta: ${JSON.stringify(dondeElNombre)}`)
  /* La invariante NO es «el nombre está en el <h1>»: es «al llegar a la
     receta, el médico ve de quién es». Lo puede sostener la franja del shell
     —que es persistente— o el cuerpo del documento. Falla sólo si NINGUNA de
     las dos lo enseña sin desplazarse. */
  if (enReceta && !anclaDeLaReceta && !dondeElNombre?.enElPrimerViewport) {
    b.perdidasDeContexto.push({
      paso: 'la receta habla del mismo paciente', tipo: 'EL_PACIENTE_NO_SE_VE_AL_LLEGAR_A_LA_RECETA',
      esperado: 'el nombre visible sin desplazarse, en la franja o en el documento', visto: dondeElNombre,
    })
  }
  if (enReceta && !anclaDeLaReceta && !dondeElNombre?.apariciones) {
    b.perdidasDeContexto.push({
      paso: 'la receta habla del mismo paciente', tipo: 'EL_PACIENTE_NO_APARECE_EN_LA_RECETA',
      esperado: 'Luz María Cervantes Ochoa', visto: null,
    })
  }

  await b.paso('volver al encuentro', async () => {
    const volver = page.locator('button:has-text("Volver"), a:has-text("Volver")').first()
    if (await volver.isVisible().catch(() => false)) await b.clic(volver, 'volver')
    else await b.atras()
  }, { esperaPaciente: PID, esperaMs: 3400 })

  const urlVuelta = page.url().replace(BASE, '')
  const mismoEncuentro = urlVuelta.includes(`/consulta/${PID}`)
  const mismaNota = urlVuelta.includes(NOTA)
  if (enReceta && !mismoEncuentro) {
    b.perdidasDeContexto.push({ paso: 'volver al encuentro', tipo: 'NO_VUELVE_AL_ENCUENTRO', esperado: urlEncuentro, visto: urlVuelta })
  } else if (enReceta && !mismaNota) {
    b.perdidasDeContexto.push({ paso: 'volver al encuentro', tipo: 'VUELVE_AL_PACIENTE_PERO_NO_A_LA_NOTA', esperado: urlEncuentro, visto: urlVuelta })
  }
  /* ¿RECUERDA lo que se acaba de hacer? §33: al volver, el checklist de cierre
     no debe volver a pedir la receta que el médico acaba de abrir. */
  const textoVuelta = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ')
  const recuerda = /hecho|listo|✓/i.test(textoVuelta)
  b.nota(`ida ${urlEncuentro} · vuelta ${urlVuelta} · el cierre recuerda lo hecho: ${recuerda}`)
  await page.screenshot({ path: vistaDe(b, 'vuelta') })
  b.completado = enReceta && mismoEncuentro && mismaNota
  return b
}

/** WF-06 · ASUNTO SIN RESOLVER → REVISAR → DECIDIR → ACTUAR → CIERRE.
 *
 *  La lente se pinta por PORTAL fuera de `<main>` (`#nx-lente-hueco`): la
 *  primera versión la buscó dentro de `<main>` y publicó que la lente sólo
 *  contestaba una de las cuatro preguntas. Contesta las cuatro. */
async function wf06(page, viewport) {
  const b = new Bitacora(page, 'WF-06', viewport)

  await b.paso('abrir Pendientes', async () => {
    await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  }, { esperaMs: 3200 })
  await page.screenshot({ path: vistaDe(b, 'pendientes') })

  const asuntos = await page.locator('main .nx-ident').count()
  b.nota(`asuntos vivos listados: ${asuntos}`)

  const porQue = page.locator('button:has-text("¿Por qué está aquí?")').first()
  const hayLente = await porQue.isVisible().catch(() => false)
  if (!hayLente) b.callejon('pendientes', 'ningún asunto ofrece «¿Por qué está aquí?»')

  await b.paso('revisar: por qué está aquí', async () => {
    if (!hayLente) throw new Error('sin lente')
    await b.clic(porQue, '¿por qué está aquí?')
    await page.locator('.nx-lente').first().waitFor({ state: 'visible', timeout: 8000 })
  }, { esperaMs: 1400 })
  await page.screenshot({ path: vistaDe(b, 'lente') })

  const bloques = await page.locator('.nx-lente .nx-porque-rotulo').allInnerTexts().catch(() => [])
  b.nota(`la lente contesta: ${bloques.map(t => t.trim()).join(' · ') || '(nada)'}`)
  /* La hoja los pinta en VERSALITAS, así que `allInnerTexts()` los devuelve en
     mayúsculas: comparar distinguiendo caja daba «la lente no contesta» sobre
     una lente que contesta las cuatro. */
  const norm = t => t.trim().toLocaleLowerCase('es')
  const contestaLasCuatro = ['Por qué está aquí', 'Quién responde', 'Qué ha pasado', 'Qué sigue']
    .every(q => bloques.some(t => norm(t) === norm(q)))

  await b.paso('cerrar la lente y actuar sobre el asunto', async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(700)
    /* La acción de avance es el PRIMER botón de la fila de acciones de la
       tarjeta, y su rótulo cambia con el estado («Tomarla», «Ya se hizo»,
       «Lo revisé»). Se toma por posición dentro de la tarjeta, que es lo
       estable, y se apunta con qué rótulo salió. */
    /* Acotada a la TARJETA del asunto. Sin acotar, el primer `.btn` de `<main>`
       es el filtro de la pantalla («Ver sólo los míos»): la versión anterior lo
       pulsó y lo publicó como si fuera la acción clínica de avance. */
    const tarjeta = page.locator('main div').filter({ has: page.locator('button:has-text("¿Por qué está aquí?")') }).last()
    const accion = tarjeta.locator('.btn')
      .filter({ hasNotText: '¿Por qué está aquí?' })
      .filter({ hasNotText: 'Ya no aplica' }).first()
    if (!(await accion.isVisible().catch(() => false))) throw new Error('sin acción de avance visible junto al asunto')
    b.nota(`la acción de avance se llama: «${(await accion.innerText()).replace(/\s+/g, ' ').trim()}»`)
    await b.clic(accion, 'avanzar el asunto')
  }, { esperaMs: 2600 })
  await page.screenshot({ path: vistaDe(b, 'accion') })

  b.noComprobable('la comunicación al paciente sale de verdad', 'no hay mensajería real en este contenedor, y mandar mensajes reales está prohibido sin autorización del dueño')
  b.completado = hayLente && contestaLasCuatro && b.callejones.length === 0
  return b
}

/** Abre la lente sobre el PRIMER pendiente que sí ofrezca traza a su fuente, y
 *  de paso cuenta cuántos la ofrecen. Compartido por WF-07 y WF-08 porque es
 *  literalmente el mismo gesto en dos pantallas — no es una abstracción de
 *  flujo: es un gesto. */
async function abrirLenteConTraza(page, b) {
  const disparadores = page.locator('button:has-text("¿Por qué está aquí?")')
  const total = await disparadores.count()
  let conTraza = 0
  let abierta = -1
  for (let i = 0; i < total; i++) {
    await disparadores.nth(i).click()
    await page.waitForTimeout(1100)
    const tiene = await page.locator('.nx-lente .nx-porque-traza').first().isVisible().catch(() => false)
    if (tiene) { conTraza++; if (abierta < 0) { abierta = i; break } }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
  b.nota(`pendientes con lente: ${total} · el primero con traza a su fuente: ${abierta < 0 ? 'ninguno' : `#${abierta}`}`)
  return { total, abierta }
}

/** WF-07 · PENDIENTES → POR QUÉ ESTÁ AQUÍ → FUENTE → VUELTA EXACTA (§21). */
async function wf07(page, viewport) {
  const b = new Bitacora(page, 'WF-07', viewport)

  await b.paso('abrir Pendientes', async () => {
    await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  }, { esperaMs: 3200 })

  const urlOrigen = page.url().replace(BASE, '')
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 120 })
  await page.waitForTimeout(500)
  const scrollAntes = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0)

  let hallazgo = { total: 0, abierta: -1 }
  await b.paso('abrir la lente sobre un pendiente con fuente', async () => {
    hallazgo = await abrirLenteConTraza(page, b)
    if (hallazgo.abierta < 0) throw new Error('ningún pendiente ofrece traza a su fuente')
  }, { esperaMs: 900 })
  await page.screenshot({ path: vistaDe(b, 'lente') })

  const traza = page.locator('.nx-lente .nx-porque-traza').first()
  const hayTraza = hallazgo.abierta >= 0

  await b.paso('ir a la fuente que lo originó', async () => {
    if (!hayTraza) throw new Error('sin traza a la fuente')
    await b.clic(traza, 'traza a la fuente')
    await page.waitForURL('**/consulta/**', { timeout: 20000 })
  }, { esperaMs: 3600 })
  await page.screenshot({ path: vistaDe(b, 'fuente') })

  const urlFuente = page.url().replace(BASE, '')
  b.nota(`la fuente se abrió en ${urlFuente} · testigo de regreso en la URL: ${/[?&]volver=/.test(urlFuente)}`)

  const volver = page.locator('button.nx-volver').first()
  const hayVolver = await volver.isVisible({ timeout: 8000 }).catch(() => false)
  if (!hayVolver && await page.locator('.nx-volver-declinado').first().isVisible().catch(() => false)) {
    b.nota('el regreso se DECLINÓ explícitamente — falla cerrado, que es lo que la invariante pide')
  }
  b.nota(`la fuente ofrece el regreso rotulado: ${hayVolver}${hayVolver ? ` («${(await volver.innerText()).replace(/\s+/g, ' ').trim()}»)` : ''}`)

  await b.paso('volver exactamente a Pendientes', async () => {
    if (!hayVolver) throw new Error('sin control de regreso en la fuente')
    await b.clic(volver, 'volver a Pendientes')
  }, { esperaMs: 3200 })

  const urlVuelta = page.url().replace(BASE, '')
  const scrollDespues = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0)
  const foco = await page.evaluate(() => window.__nxw.foco())
  b.nota(`vuelta a ${urlVuelta} · scroll ${scrollAntes} → ${scrollDespues} · foco «${foco?.texto ?? '(ninguno)'}»`)
  const mismaRuta = urlVuelta.split('?')[0] === urlOrigen.split('?')[0]
  if (hayTraza && !mismaRuta) {
    b.perdidasDeContexto.push({ paso: 'volver', tipo: 'RUTA_DE_VUELTA_DISTINTA', esperado: urlOrigen, visto: urlVuelta })
  }
  /* El foco tiene que volver al control que abrió la inspección, no al body:
     «return exactly where you were» incluye el teclado. */
  b.nota(`el foco vuelve a un control: ${!!foco}`)
  await page.screenshot({ path: vistaDe(b, 'vuelta') })
  b.completado = hayTraza && hayVolver && mismaRuta && !!foco
  return b
}

/** WF-08 · HOY → CONTINUIDAD → INSPECCIONAR EN EL SITIO → FUENTE → VUELTA.
 *  El punto es que NO haga falta irse de Hoy para entender lo que cruzó de
 *  ayer, y que la vuelta aterrice en Hoy y no en cualquier sitio. */
async function wf08(page, viewport) {
  const b = new Bitacora(page, 'WF-08', viewport)

  await b.paso('abrir Hoy', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
  }, { esperaMs: 3600 })
  await page.screenshot({ path: vistaDe(b, 'hoy') })

  const urlOrigen = page.url().replace(BASE, '')
  let hallazgo = { total: 0, abierta: -1 }
  await b.paso('inspeccionar EN HOY, sin irse', async () => {
    hallazgo = await abrirLenteConTraza(page, b)
    if (!hallazgo.total) throw new Error('la continuidad de Hoy no ofrece inspección en el sitio')
  }, { esperaMs: 900 })
  await page.screenshot({ path: vistaDe(b, 'lente-en-hoy') })

  const sigueEnHoy = page.url().replace(BASE, '').split('?')[0] === urlOrigen.split('?')[0]
  if (!sigueEnHoy) {
    b.perdidasDeContexto.push({ paso: 'inspeccionar', tipo: 'LA_INSPECCION_SACA_DE_HOY', esperado: urlOrigen, visto: page.url().replace(BASE, '') })
  }
  b.nota(`la inspección ocurre en el sitio: ${sigueEnHoy}`)

  const hayTraza = hallazgo.abierta >= 0
  await b.paso('ir a la fuente desde Hoy', async () => {
    if (!hayTraza) throw new Error('ningún asunto de continuidad ofrece traza')
    await b.clic(page.locator('.nx-lente .nx-porque-traza').first(), 'traza')
    await page.waitForURL('**/consulta/**', { timeout: 20000 })
  }, { esperaMs: 3600 })

  const volver = page.locator('button.nx-volver').first()
  const hayVolver = await volver.isVisible({ timeout: 8000 }).catch(() => false)
  b.nota(`la fuente ofrece el regreso: ${hayVolver}${hayVolver ? ` («${(await volver.innerText()).replace(/\s+/g, ' ').trim()}»)` : ''}`)

  await b.paso('volver exactamente a Hoy', async () => {
    if (!hayVolver) throw new Error('sin control de regreso')
    await b.clic(volver, 'volver a Hoy')
  }, { esperaMs: 3200 })
  await page.screenshot({ path: vistaDe(b, 'vuelta') })

  const urlVuelta = page.url().replace(BASE, '')
  const mismaRuta = urlVuelta.split('?')[0] === urlOrigen.split('?')[0]
  if (hayTraza && !mismaRuta) {
    b.perdidasDeContexto.push({ paso: 'volver', tipo: 'RUTA_DE_VUELTA_DISTINTA', esperado: urlOrigen, visto: urlVuelta })
  }
  b.completado = hallazgo.total > 0 && sigueEnHoy && hayTraza && hayVolver && mismaRuta
  return b
}

/** WF-09 · OPERACIONES → EXCEPCIÓN REAL → DETALLE → DESTINO DE ACCIÓN.
 *
 *  Se mide la FRANJA de excepciones (`EstadoDeOperaciones`) aparte del índice
 *  de secciones. La primera versión tomó «el primer `a[href]` de `<main>`» y
 *  lo llamó excepción: eso mide el índice, no el control operativo. */
async function wf09(page, viewport) {
  const b = new Bitacora(page, 'WF-09', viewport)

  await b.paso('abrir Operaciones', async () => {
    await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
  }, { esperaMs: 3600 })
  await page.screenshot({ path: vistaDe(b, 'operaciones') })

  /* La franja vive ANTES del primer grupo del índice. Se toma por posición en
     el orden de lectura, no por una clase: los enlaces del índice llevan su
     «para qué» y los de la franja no. */
  /* La franja se lee por el contrato que ella misma declara
     (`data-estado-operaciones`), no por la posición de sus enlaces: tomar «el
     primer a[href] de <main>» medía el ÍNDICE de secciones y lo llamaba
     excepción. El rótulo lleva el recuento y cada fila su detalle. */
  const franja = await page.evaluate(() => {
    const sec = document.querySelector('[data-estado-operaciones]')
    if (!sec) return null
    const filas = [...sec.querySelectorAll('a[href]')].filter(e => window.__nxw.visible(e))
    return {
      estado: sec.getAttribute('data-estado-operaciones'),
      rotulo: window.__nxw.texto(sec.querySelector('h2')).slice(0, 70),
      limpio: window.__nxw.texto(sec.querySelector('[data-comprobado-limpio]')).slice(0, 120),
      /* Una excepción es la FILA (`data-comprobacion`), no su enlace: el enlace
         sólo lleva el rótulo del destino («Citas»), y leer eso daba «0 entradas
         con un dato concreto» sobre una franja donde cada fila trae su
         recuento, su detalle y su dueño. */
      filas: [...sec.querySelectorAll('[data-comprobacion]')].map(f => {
        const destino = f.querySelector('a[href]')
        return {
          id: f.getAttribute('data-comprobacion'),
          estado: f.getAttribute('data-estado'),
          titulo: window.__nxw.texto(f.querySelector('.t-body')).slice(0, 60),
          detalle: window.__nxw.texto(f.querySelectorAll('p.t-caption')[0]).slice(0, 90),
          quien: window.__nxw.texto(f.querySelectorAll('p.t-caption')[1]).slice(0, 50),
          href: destino ? destino.getAttribute('href') : null,
          conCifra: /\d/.test(window.__nxw.texto(f.querySelector('.t-body'))),
        }
      }),
      enlacesSueltos: filas.length,
    }
  })
  if (!franja) {
    b.callejon('operaciones', 'la pantalla no declara ninguna franja de estado: es sólo un índice')
  }
  const excepciones = franja?.filas ?? []
  b.nota(`franja: ${franja?.estado ?? '(ninguna)'} · rótulo «${franja?.rotulo ?? ''}»`)
  b.nota(`comprobado y limpio: «${franja?.limpio ?? '(nada)'}»`)
  b.nota(`excepciones nombradas: ${excepciones.length}`)
  for (const e of excepciones) b.nota(`   · «${e.titulo}» — ${e.detalle} — ${e.quien} → ${e.href}`)
  const conCifra = excepciones.filter(e => e.conCifra).length
  /* Que la franja diga «nada pide atención» es una RESPUESTA, no un vacío: con
     la siembra actual puede ser la verdad. Se apunta cuál de los dos casos se
     midió, para que el veredicto no confunda «sin excepciones» con «mudo». */
  const sinExcepciones = franja?.estado === 'sin-excepcion'
  b.nota(`de ellas, con un dato concreto (una cifra): ${conCifra}${sinExcepciones ? ' · la franja declara que HOY no hay excepción' : ''}`)

  await b.paso('seguir la excepción a su destino', async () => {
    if (!excepciones.length) throw new Error('la franja no ofrece ninguna entrada accionable')
    const destino = page.locator(`[data-comprobacion="${excepciones[0].id}"] a[href]`).first()
    await b.clic(destino, `destino ${excepciones[0].href}`)
  }, { esperaMs: 3400 })
  await page.screenshot({ path: vistaDe(b, 'destino') })

  const llego = page.url().replace(BASE, '')
  const declarado = excepciones[0]?.href ?? null
  const aterrizoDondeDijo = !!declarado && llego.split('?')[0] === declarado.split('?')[0]
  b.nota(`destino declarado ${declarado} · aterrizaje real ${llego}`)
  if (declarado && !aterrizoDondeDijo) {
    b.callejon('operaciones', `la entrada decía ${declarado} y aterrizó en ${llego}`)
  }
  /* COMPLETO = la pantalla contesta «¿qué pide atención hoy?» con un estado
     declarado, y si hay algo que perseguir, lleva a donde se resuelve. Una
     franja que dice «nada pide atención» y lo respalda con lo comprobado es
     una respuesta completa: exigirle una excepción sería exigirle que invente
     una. */
  b.completado = !!franja && (sinExcepciones || (excepciones.length > 0 && aterrizoDondeDijo))
  return b
}

/** WF-10 · INTERRUPCIÓN EN EL MÓVIL Y REGRESO.
 *
 *  El teléfono se va a segundo plano y vuelve con una recarga a mitad del
 *  encuentro. Éxito = vuelve al MISMO paciente y al MISMO encuentro, y lo
 *  escrito **o sigue, o se ofrece recuperarlo**. Perderlo sin decir nada, con
 *  el respaldo en disco, es la pérdida silenciosa que este flujo caza.
 *
 *  Se espera 4 s tras teclear: el respaldo local lleva un debounce de 1 500 ms
 *  y medir antes contaría un respaldo que aún no se había escrito. */
async function wf10(page, viewport) {
  const b = new Bitacora(page, 'WF-10', viewport)
  const PID = 'pac-luzmaria-cervantes'
  const NOTA = 'nota-luzmaria-borrador'
  const MARCA = 'marca del banco de flujos v15'

  await b.paso('abrir el encuentro a medias', async () => {
    await page.goto(`${BASE}/consulta/${PID}?nota=${NOTA}`, { waitUntil: 'load' })
  }, { esperaPaciente: PID, esperaMs: 4200 })
  const urlAntes = page.url().replace(BASE, '')

  const campo = page.locator('main textarea').first()
  const hayCampo = await campo.isVisible().catch(() => false)
  await b.paso('escribir en la nota', async () => {
    if (!hayCampo) throw new Error('sin campo de texto libre en el encuentro')
    const antes = (await campo.inputValue().catch(() => '')) || ''
    await campo.fill(`${antes}\n${MARCA}`)
    await page.waitForTimeout(4000)   // > 1500 ms del debounce del respaldo local
  }, { esperaPaciente: PID, esperaMs: 1200 })
  await page.screenshot({ path: vistaDe(b, 'a-medias') })

  const respaldoAntes = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('nx.consulta.bkp')))
  b.nota(`respaldo local escrito antes de la interrupción: ${JSON.stringify(respaldoAntes)}`)

  await b.paso('interrupción: la app se va a segundo plano', async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('pagehide'))
    })
  }, { esperaMs: 1600 })

  await b.paso('el médico vuelve: recarga', async () => {
    await page.reload({ waitUntil: 'load' })
  }, { esperaPaciente: PID, esperaMs: 5000 })
  await page.screenshot({ path: vistaDe(b, 'vuelta') })

  const urlDespues = page.url().replace(BASE, '')
  const mismoSitio = urlDespues === urlAntes
  const textoDespues = await page.locator('main textarea').first().inputValue().catch(() => '')
  const sigueEscrito = textoDespues.includes(MARCA)
  const respaldoDespues = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('nx.consulta.bkp')))
  const seOfrece = await page.locator('main button:has-text("Restaurar")').first().isVisible().catch(() => false)

  b.nota(`ruta ${urlAntes} → ${urlDespues}`)
  b.nota(`lo escrito sigue en pantalla: ${sigueEscrito} · respaldo local tras recargar: ${JSON.stringify(respaldoDespues)} · se ofrece restaurar: ${seOfrece}`)

  if (!mismoSitio) {
    b.perdidasDeContexto.push({ paso: 'volver', tipo: 'LA_RECARGA_CAMBIA_DE_SITIO', esperado: urlAntes, visto: urlDespues })
  }
  /* LA INVARIANTE: con un respaldo en disco, o el trabajo sigue o se ofrece.
     Que no siga Y no se ofrezca, teniéndolo, es pérdida silenciosa. */
  const recuperable = sigueEscrito || seOfrece
  if (hayCampo && respaldoDespues.length > 0 && !recuperable) {
    b.perdidasDeContexto.push({
      paso: 'volver', tipo: 'PERDIDA_SILENCIOSA_CON_RESPALDO_EN_DISCO',
      esperado: 'lo escrito sigue, o se ofrece restaurarlo', visto: respaldoDespues,
    })
  }
  b.completado = mismoSitio && recuperable
  return b
}

/* ══════════════════════════════════════════════════════════════════════════
   LA CORRIDA. Cada flujo en su propio contexto: una sesión sucia arrastra el
   estado del flujo anterior y falsea el siguiente (el contrato de regreso en
   sessionStorage y el respaldo local, sobre todo).
   ══════════════════════════════════════════════════════════════════════════ */
const FLUJOS = [
  ['WF-01', wf01], ['WF-02', wf02], ['WF-03', wf03], ['WF-04', wf04], ['WF-05', wf05],
  ['WF-06', wf06], ['WF-07', wf07], ['WF-08', wf08], ['WF-09', wf09], ['WF-10', wf10],
]

const navegador = await chromium.launch({
  ...(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}),
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})

const acta = { base: BASE, fecha: new Date().toISOString(), corridas: [] }

for (const [vp, ancho, alto] of [['escritorio', 1440, 900], ['movil', 390, 844]]) {
  for (const [nombre, fn] of FLUJOS) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho, height: alto },
      isMobile: ancho < 700, hasTouch: ancho < 700,
      permissions: ['microphone'],
      serviceWorkers: 'block',
      /* EL RELOJ DEL DISPOSITIVO ES EL DEL CONSULTORIO, como el del médico que
         usa esto. Sin fijarlo, el contenedor corre en UTC y el héroe NOW de Hoy
         no se pinta —`stats.prox` compara la FECHA del consultorio contra la
         HORA del navegador—, así que WF-01 auditaría la pantalla sin su acción
         primaria y no lo diría. Que esa mezcla de relojes sea además un defecto
         del producto se apunta aparte: aquí se quita del camino del banco. */
      timezoneId: 'America/Mexico_City',
    })
    const page = await contexto.newPage()
    const errores = []
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 180)) })
    page.on('pageerror', e => errores.push('pageerror: ' + e.message.slice(0, 180)))
    await page.addInitScript(SONDA)

    let b
    try {
      await entrar(page)
      b = await fn(page, vp)
    } catch (e) {
      b = new Bitacora(page, nombre, vp)
      b.callejon('la corrida', String(e).split('\n')[0].slice(0, 200))
    }
    b.errores = errores
    const a = b.acta()
    acta.corridas.push(a)
    console.log(
      `${vp.padEnd(11)} ${nombre}  ${a.completado ? 'COMPLETA  ' : 'INCOMPLETA'} ` +
      `pasos ${String(a.pasos).padStart(2)} · clics ${String(a.clics).padStart(2)} · nav ${String(a.navegaciones).padStart(2)} · ` +
      `atrás ${a.retrocesos} · pérdidas ${a.perdidasDeContexto.length} · callejones ${a.callejones.length} · ` +
      `scroll ${a.maxPantallasDeScroll} pantallas · consola ${a.errores.length}`,
    )
    for (const p of a.perdidasDeContexto) console.log(`            ⚠ ${p.tipo} — esperado ${p.esperado} · visto ${JSON.stringify(p.visto)}`)
    for (const c of a.callejones) console.log(`            ✖ ${c.donde}: ${c.porQue}`)
    for (const n of a.notas) console.log(`            · ${n}`)
    await contexto.close()
  }
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'acta-flujos.json'), JSON.stringify(acta, null, 2))

console.log('\n══════════ RESUMEN ══════════')
const total = acta.corridas.length
const completas = acta.corridas.filter(c => c.completado).length
const perdidas = acta.corridas.reduce((s, c) => s + c.perdidasDeContexto.length, 0)
const callejones = acta.corridas.reduce((s, c) => s + c.callejones.length, 0)
const erroresConsola = acta.corridas.reduce((s, c) => s + c.errores.length, 0)
console.log(`corridas ${total} · completas ${completas} · pérdidas de contexto ${perdidas} · callejones ${callejones} · errores de consola ${erroresConsola}`)
console.log(`acta → ${path.join(DESTINO, 'acta-flujos.json')}`)
