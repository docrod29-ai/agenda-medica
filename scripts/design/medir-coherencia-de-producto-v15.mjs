/**
 * LA MATRIZ DE COHERENCIA DE PRODUCTO — V15-FINAL-COHERENCE-001.
 *
 * ── LA PREGUNTA QUE CONTESTA ────────────────────────────────────────────────
 *
 * ¿Ausculta se comporta como UN producto clínico coherente, o como una
 * colección de superficies localmente correctas?
 *
 * No es la pregunta del banco de flujos (¿se puede hacer el trabajo?). Ésa ya
 * la contestó `medir-flujos-clinicos-v15.mjs` con 20/20. Ésta es la de al
 * lado: **el mismo objeto conceptual, ¿se comporta igual en todas partes?**
 * Un producto puede tener diez pantallas que pasan su compuerta una a una y
 * aun así obligar al médico a reaprender el idioma en cada una.
 *
 * ── QUÉ MIDE, Y POR QUÉ CADA COSA ───────────────────────────────────────────
 *
 * Se mide LO MISMO en TODAS las superficies, y el defecto es la VARIANZA, no
 * el valor. Por eso el instrumento no lleva umbrales por pantalla: lleva una
 * tabla y compara filas.
 *
 *   · IDENTIDAD DEL PACIENTE (§8 del encargo) — dónde vive, con qué voz
 *     tipográfica real (px y peso CALCULADOS, no la clase que se pretende), y
 *     si está en el primer viewport. El defecto de coherencia es que el mismo
 *     paciente sea encabezado dominante en una superficie y metadato de cromo
 *     en otra que decide su tratamiento.
 *
 *   · EL ENCABEZADO DOMINANTE (§17) — el `<h1>`: ¿nombra al PACIENTE, al
 *     TRABAJO, o a la HERRAMIENTA? «Generador de Receta» es un nombre de
 *     herramienta en la superficie que imprime una dosis con cédula
 *     profesional. Se clasifica comparando el texto contra el nombre del
 *     paciente sembrado — no contra una lista de palabras prohibidas, que
 *     sería una opinión disfrazada de medida.
 *
 *   · GRAMÁTICA DE ACCIÓN (§11) — cuántos rellenos primarios compiten dentro
 *     de `<main>` y cómo se llaman. Uno es jerarquía; tres es inventario.
 *
 *   · NAVEGACIÓN (§12) — destinos del riel y de la barra del pulgar, contados
 *     del DOM vivo. §14 del master loop exige ≤5 y Operaciones aparte.
 *
 *   · MOMENTO ACTUAL (§10) — qué estado declara la pantalla al aterrizar.
 *
 * ── LO QUE ESTE INSTRUMENTO NO PUEDE HACER ─────────────────────────────────
 *
 *  · No juzga si una diferencia entre superficies está JUSTIFICADA. Una receta
 *    y un expediente son contextos clínicos distintos y §7 del encargo prohíbe
 *    forzar consistencia superficial donde la diferencia es legítima. El
 *    instrumento publica la tabla; la decisión de si una fila es defecto la
 *    toma quien lee, con su razón escrita.
 *  · No mide estética, ni sustituye al trinquete de diseño ni a axe.
 *  · No mide percepción humana: los px son de máquina.
 *  · Una superficie que no se puede sembrar sale `NO_ALCANZABLE` con su razón,
 *    **nunca PASA**. La regla de honestidad es la del banco de flujos.
 *
 * Uso: bash scripts/design/arnes-coherencia-v15.sh
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.env.DESTINO_COHERENCIA || 'docs/design/capturas/v15-coherencia'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })

/* ──────────────────────────────────────────────────────────────────────────
   LA SONDA. Lee del DOM lo que hace falta para comparar superficies entre sí.
   Todo lo tipográfico se lee CALCULADO (getComputedStyle): una clase que se
   llame `.nx-ident` no demuestra que se pinte grande, y esta matriz existe
   justamente para cazar la superficie donde la clase está y la voz no.
   ────────────────────────────────────────────────────────────────────────── */
const SONDA = `
window.__nxc = {
  visible(el) {
    if (!el) return false
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  },
  texto(el) { return (el?.textContent ?? '').replace(/\\s+/g, ' ').trim() },
  main() { return document.querySelector('main') },

  /* La VOZ real de un elemento: px y peso calculados, más dónde cae. */
  voz(el) {
    if (!el) return null
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const m = this.main()
    const base = m ? m.getBoundingClientRect().top - m.scrollTop : 0
    return {
      texto: this.texto(el).slice(0, 70),
      px: Math.round(parseFloat(s.fontSize) * 10) / 10,
      peso: s.fontWeight,
      y: Math.round(r.top - base),
      enPrimerViewport: m ? Math.round(r.top - base) < m.clientHeight : r.top < innerHeight,
      selector: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
    }
  },

  /* DÓNDE vive la identidad del paciente y con qué voz. Se buscan los TRES
     portadores canónicos que el producto ya tiene, en el orden en que el
     médico los ve, y se devuelven TODOS los que estén — porque el dato
     interesante es cuál es el más fuerte, no si hay alguno. */
  portadoresDeIdentidad(nombre) {
    const trozo = nombre ? nombre.split(' ').slice(0, 2).join(' ') : null
    const casa = el => this.visible(el) && (!trozo || this.texto(el).includes(trozo))
    const out = []
    const push = (sel, papel) => {
      for (const el of document.querySelectorAll(sel)) {
        if (!casa(el)) continue
        out.push({ papel, ...this.voz(el) })
        break
      }
    }
    push('.nx-patient-anchor h1, .nx-patient-anchor .nx-ident', 'ancla')
    push('main h1', 'h1')
    push('.nx-ident-franja', 'franja')
    return out
  },

  /* El encabezado dominante, tal cual, sin interpretar. */
  encabezado() {
    const h = document.querySelector('main h1') || document.querySelector('h1')
    return h && this.visible(h) ? this.voz(h) : null
  },

  /* Rellenos primarios que compiten DENTRO de main. */
  primarias() {
    const m = this.main(); if (!m) return []
    return [...m.querySelectorAll('.btn-primary, .prox-hero-cta')]
      .filter(e => this.visible(e))
      .map(e => this.texto(e).slice(0, 40) || e.getAttribute('aria-label') || '(sin texto)')
  },

  /* Destinos de navegación primaria, contados del DOM vivo. */
  navegacion() {
    const riel = document.querySelector('nav[aria-label="Contextos clínicos"]')
    const rielItems = riel
      ? [...riel.querySelectorAll('a.nav-item')].filter(e => this.visible(e))
          .map(e => ({ texto: this.texto(e).slice(0, 30), subordinado: getComputedStyle(e).fontSize !== getComputedStyle(riel.querySelector('a.nav-item')).fontSize }))
      : []
    const barra = document.querySelector('.bottom-nav')
    const barraItems = barra
      ? [...barra.querySelectorAll('a, button')].filter(e => this.visible(e)).map(e => this.texto(e).slice(0, 24) || e.getAttribute('aria-label'))
      : []
    return { riel: rielItems, barra: barraItems }
  },

  /* El momento clínico declarado al aterrizar. */
  momento() {
    const m = this.main(); if (!m) return []
    const RE = /sin firmar|borrador|firmada|firmado|en curso|en sala|pr[oó]xima|confirmada|por confirmar|vencid|pendiente|abierta|cerrad|revisad/i
    const fuera = new Set()
    for (const el of m.querySelectorAll('.nx-estado, .badge, [class*=status], [class*=estado], .t-overline')) {
      if (!this.visible(el)) continue
      const t = this.texto(el)
      if (t && RE.test(t)) fuera.add(t.slice(0, 40))
    }
    return [...fuera].slice(0, 8)
  },

  scroll() {
    const m = this.main(); if (!m) return null
    return {
      pantallas: Math.round((m.scrollHeight / Math.max(1, m.clientHeight)) * 100) / 100,
    }
  },

  controles() {
    const m = this.main(); if (!m) return 0
    return [...m.querySelectorAll('button, a[href], input, select, textarea, [role=button]')]
      .filter(e => this.visible(e)).length
  },
}
`

/* ══════════════════════════════════════════════════════════════════════════
   LAS SUPERFICIES. Escritas una a una, con el paciente que le toca a cada
   una — no generadas, para que un cambio de ruta rompa aquí y no mienta.
   ══════════════════════════════════════════════════════════════════════════ */
const AURELIO = { id: 'pac-aurelio-dominguez', nombre: 'Aurelio Domínguez' }
const LUZMARIA = { id: 'pac-luzmaria-cervantes', nombre: 'Luz María Cervantes' }

const SUPERFICIES = [
  { id: 'hoy', ruta: '/dashboard', clase: 'clinica-lista', paciente: null },
  { id: 'pacientes', ruta: '/pacientes', clase: 'clinica-lista', paciente: null },
  { id: 'pendientes', ruta: '/pendientes', clase: 'clinica-lista', paciente: null },
  { id: 'expediente', ruta: `/expediente/${AURELIO.id}`, clase: 'clinica-paciente', paciente: AURELIO },
  { id: 'consulta', ruta: `/consulta/${AURELIO.id}`, clase: 'clinica-paciente', paciente: AURELIO },
  { id: 'nota', ruta: `/nota/${AURELIO.id}/nota-aurelio-1`, clase: 'clinica-paciente', paciente: AURELIO },
  { id: 'receta', ruta: `/receta/${LUZMARIA.id}/nota-luzmaria-1`, clase: 'clinica-paciente', paciente: LUZMARIA },
  { id: 'orden', ruta: `/orden/${AURELIO.id}/nota-aurelio-1`, clase: 'clinica-paciente', paciente: AURELIO },
  { id: 'referencia', ruta: `/referencia/${AURELIO.id}`, clase: 'clinica-paciente', paciente: AURELIO },
  { id: 'operaciones', ruta: '/operaciones', clase: 'operaciones', paciente: null },
  { id: 'citas', ruta: '/citas', clase: 'clinica-lista', paciente: null },
  /* `/chat` entra por Operaciones. Se mide porque el inventario de encabezados
     lo señaló como la única superficie que TENÍA título y lo pintaba en un
     `<div>` — un título fingido no se ve en una captura, sólo comparando
     superficies. Y una vez reparado hay que mirarlo en navegador: un `<h1>`
     dentro de una fila flex puede empujar el layout si se le olvida el
     `margin: 0`, y eso no lo dice ninguna prueba de fuente. */
  { id: 'chat', ruta: '/chat', clase: 'operaciones', paciente: null },
]

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

/**
 * Clasifica el encabezado SIN una lista de palabras prohibidas: se compara
 * contra el nombre del paciente que toca. Lo que no nombra al paciente en una
 * superficie de paciente se marca `no-paciente` y se publica su texto —
 * decidir si eso es defecto es de quien lee, no del medidor.
 */
function clasificarEncabezado(h1, paciente) {
  if (!h1) return 'ausente'
  if (!paciente) return 'sin-paciente-en-ruta'
  const trozo = paciente.nombre.split(' ').slice(0, 2).join(' ')
  return h1.texto.includes(trozo) ? 'paciente' : 'no-paciente'
}

async function medirSuperficie(page, sup, viewport) {
  const errores = []
  const onErr = e => errores.push(String(e.message ?? e).slice(0, 160))
  page.on('pageerror', onErr)
  const onConsole = m => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)) }
  page.on('console', onConsole)

  let alcanzable = true
  let razon = null
  try {
    await page.goto(`${BASE}${sup.ruta}`, { waitUntil: 'load', timeout: 40000 })
    await page.waitForTimeout(1600)
  } catch (e) {
    alcanzable = false
    razon = String(e).split('\n')[0].slice(0, 160)
  }

  const urlFinal = page.url().replace(BASE, '')
  if (alcanzable && !urlFinal.startsWith(sup.ruta.split('?')[0])) {
    /* Redirigida: no se mide otra pantalla creyendo que es ésta. */
    alcanzable = false
    razon = `redirigida a ${urlFinal}`
  }

  let m = null
  if (alcanzable) {
    m = await page.evaluate(nombre => ({
      encabezado: window.__nxc.encabezado(),
      portadores: window.__nxc.portadoresDeIdentidad(nombre),
      primarias: window.__nxc.primarias(),
      navegacion: window.__nxc.navegacion(),
      momento: window.__nxc.momento(),
      scroll: window.__nxc.scroll(),
      controles: window.__nxc.controles(),
    }), sup.paciente?.nombre ?? null)
    await page.screenshot({ path: path.join(DESTINO, `${viewport}-${sup.id}.png`) })
  }

  page.off('pageerror', onErr)
  page.off('console', onConsole)

  return {
    superficie: sup.id,
    ruta: sup.ruta,
    clase: sup.clase,
    viewport,
    alcanzable,
    razon,
    urlFinal,
    encabezado: m?.encabezado ?? null,
    encabezadoNombra: clasificarEncabezado(m?.encabezado ?? null, sup.paciente),
    /* La voz MÁS FUERTE con la que esta superficie dice el nombre del
       paciente. Es el número que hace comparable una receta con un
       expediente. */
    identidadMasFuerte: (m?.portadores ?? []).reduce(
      (a, p) => (a == null || p.px > a.px ? p : a), null),
    portadores: m?.portadores ?? [],
    primarias: m?.primarias ?? [],
    navegacion: m?.navegacion ?? null,
    momento: m?.momento ?? [],
    pantallas: m?.scroll?.pantallas ?? null,
    controles: m?.controles ?? null,
    errores,
  }
}

async function corrida(viewport, tam) {
  /* Misma convención que `axe-encuentro-v15.mjs`: si el contenedor trae un
     Chromium preinstalado, se usa ÉSE. Sin esto, un `@playwright/test` más
     nuevo que los navegadores del contenedor aborta con «Executable doesn't
     exist» y la matriz entera se queda sin medir — que es un fallo del ARNÉS
     y saldría confundido con un fallo del producto. */
  const navegador = await chromium.launch(
    fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
  )
  const ctx = await navegador.newContext({
    viewport: tam,
    isMobile: viewport === 'movil',
    hasTouch: viewport === 'movil',
    /* La zona del CONSULTORIO, no la del contenedor: el héroe NOW de Hoy sólo
       se pinta con una cita por delante en hora de México, y medirlo en UTC
       daría «Hoy sin acción primaria» — defecto de instrumento, no de
       producto. Es la misma decisión, y por la misma razón, que tomó el banco
       de flujos; la mezcla de relojes sigue siendo deuda P2 declarada. */
    timezoneId: 'America/Mexico_City',
    locale: 'es-MX',
  })
  await ctx.addInitScript(SONDA)
  const page = await ctx.newPage()
  await entrar(page)

  const filas = []
  for (const sup of SUPERFICIES) {
    filas.push(await medirSuperficie(page, sup, viewport))
  }
  await navegador.close()
  return filas
}

const filas = [
  ...(await corrida('escritorio', { width: 1440, height: 900 })),
  ...(await corrida('movil', { width: 390, height: 844 })),
]

const acta = { generado: 'medir-coherencia-de-producto-v15.mjs', filas }
fs.writeFileSync(path.join(DESTINO, 'acta-coherencia.json'), JSON.stringify(acta, null, 2))

/* ── LA TABLA, para leerla sin abrir el JSON ─────────────────────────────── */
for (const vp of ['escritorio', 'movil']) {
  console.log(`\n══════ ${vp.toUpperCase()} ══════`)
  console.log('superficie      | h1 nombra    | h1 px/peso | ident px/peso (papel) | 1er vp | primarias | pant. | ctrl')
  for (const f of filas.filter(x => x.viewport === vp)) {
    if (!f.alcanzable) { console.log(`${f.superficie.padEnd(15)} | NO_ALCANZABLE — ${f.razon}`); continue }
    const h = f.encabezado
    const i = f.identidadMasFuerte
    console.log(
      `${f.superficie.padEnd(15)} | ${String(f.encabezadoNombra).padEnd(12)} | ` +
      `${h ? `${h.px}/${h.peso}`.padEnd(10) : '—'.padEnd(10)} | ` +
      `${i ? `${i.px}/${i.peso} (${i.papel})`.padEnd(21) : '(ninguno)'.padEnd(21)} | ` +
      `${i ? String(i.enPrimerViewport).padEnd(6) : '—'.padEnd(6)} | ` +
      `${String(f.primarias.length).padEnd(9)} | ${String(f.pantallas).padEnd(5)} | ${f.controles}`
    )
  }
}

console.log('\n── ENCABEZADOS, tal cual ──')
for (const f of filas.filter(x => x.viewport === 'escritorio' && x.alcanzable)) {
  console.log(`  ${f.superficie.padEnd(14)} h1: ${f.encabezado?.texto ?? '(sin h1)'}`)
}

console.log('\n── PRIMARIAS por superficie (escritorio) ──')
for (const f of filas.filter(x => x.viewport === 'escritorio' && x.alcanzable)) {
  console.log(`  ${f.superficie.padEnd(14)} [${f.primarias.length}] ${f.primarias.join(' · ') || '(ninguna)'}`)
}

console.log('\n── NAVEGACIÓN ──')
const nEsc = filas.find(f => f.viewport === 'escritorio' && f.navegacion)?.navegacion
const nMov = filas.find(f => f.viewport === 'movil' && f.navegacion)?.navegacion
console.log('  riel (escritorio):', nEsc?.riel?.map(r => r.texto).join(' · '))
console.log('  barra (móvil):    ', nMov?.barra?.join(' · '))

const conErrores = filas.filter(f => f.errores.length)
console.log('\n── ERRORES DE CONSOLA ──')
if (!conErrores.length) console.log('  ninguno')
for (const f of conErrores) console.log(`  ${f.viewport}/${f.superficie}: ${f.errores.join(' | ')}`)

console.log(`\nacta: ${path.join(DESTINO, 'acta-coherencia.json')}`)
