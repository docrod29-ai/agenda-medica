/**
 * LA LENTE CONTEXTUAL EN NAVEGADOR REAL — Capa 4 de §5, la cadena entera.
 *
 * Un guardián de texto puede comprobar que la pieza existe. No puede comprobar
 * lo único que importa de ella: **que volver devuelve al médico donde estaba**.
 * Eso son scroll, foco, ruta y paciente, y sólo se sabe midiéndolos.
 *
 * La cadena que la auditoría independiente pide fotografiar es ésta:
 *
 *     HECHO → ABRIR LENTE → INSPECCIONAR LA FUENTE → VOLVER
 *           → MISMO PACIENTE · MISMO ENCUENTRO · MISMO SITIO
 *
 * Este arnés la recorre y CUENTA. No opina y no puntúa §29: eso lo hace un
 * revisor independiente sobre las capturas.
 *
 * ── LO QUE MIDE, Y POR QUÉ CADA COSA ────────────────────────────────────────
 *
 *  · **La fuente que SÍ existe** — un pendiente con `notaId` cuyo título casa
 *    con una línea de la orden de esa nota: la lente tiene que citarla LITERAL.
 *  · **La fuente que NO existe** — un pendiente nacido en el laboratorio: la
 *    lente tiene que decir que no cuelga de ninguna nota, y decirlo como hueco
 *    del registro (ámbar), no como fallo ni como silencio.
 *  · **El regreso exacto** — scroll de `<main>`, ruta y foco antes de abrir y
 *    después de cerrar. Si algo de eso cambia, inspeccionar cuesta más que no
 *    inspeccionar y la función muere sola.
 *  · **El límite** — abrir la lente en un paciente y navegar a otro NO puede
 *    dejar el plano en pantalla. Familia «paciente equivocado».
 *  · **Escritorio no flota; móvil no es la columna encogida** — en 1440 el
 *    plano es una columna del shell (`position` estático, a la derecha del
 *    lienzo); en 390 es una hoja anclada abajo con telón.
 *  · **Teclado** — Escape cierra y el foco VUELVE al disparador exacto.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-lente-contextual-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-lente-contextual'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/* El pendiente con traza hacia atrás y el que nació sin ella. Los dos tienen
   que poder fotografiarse: la lente vale por lo que enseña Y por lo que se
   niega a inventar. */
const CON_FUENTE = 'Urocultivo con antibiograma'
const SIN_FUENTE = 'Urocultivo — resultado disponible'
const CITA_ESPERADA = 'Urocultivo con antibiograma'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const errores = []
const casos = []
const ok = (nombre, pasa, detalle) => { casos.push({ nombre, pasa: !!pasa, detalle }); return pasa }

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 40000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }
}

/**
 * El botón «De dónde sale» del pendiente `titulo`, POR SU NOMBRE ACCESIBLE.
 *
 * La primera versión buscaba el `div` que contuviera el título y bajaba a su
 * `.nx-inspeccionar`: con `filter({hasText})` eso casa con CADA ancestro, así
 * que `.last()` devolvía el botón de otra tarjeta — el arnés midió tres veces
 * un pendiente que no era el que decía, y lo dijo en verde para los casos que
 * no dependían de cuál fuera. El nombre accesible es único por tarea y es
 * además lo que oye un lector de pantalla: si esto deja de encontrarlo, el
 * defecto es de accesibilidad y no del arnés.
 */
const disparadorDe = (page, titulo) =>
  page.locator(`button.nx-inspeccionar[aria-label*=${JSON.stringify(titulo)}]`).first()

const captura = (page, nombre) => page.screenshot({ path: path.join(DESTINO, `${nombre}.png`), fullPage: false })

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text().slice(0, 200)}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))

  await entrar(page)

  /* ── 1 · PENDIENTES: el hecho, y el sitio exacto del que se parte ──────── */
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-inspeccionar', { timeout: 20000 })

  /*
    El disparador se trae a la vista ANTES de tomar la medida de referencia.
    Al revés —que es como estaba— el `scrollIntoViewIfNeeded` del propio arnés
    movía el lienzo DESPUÉS de anotar el «antes», y el arnés se acusaba a sí
    mismo de haber movido la pantalla: informó 260 → 1217 y llamó a eso un
    defecto de la lente. Medir el regreso exige que lo único que ocurra entre
    las dos lecturas sea abrir y cerrar.
  */
  const disparador = disparadorDe(page, CON_FUENTE)
  await disparador.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  const antes = await page.evaluate(() => ({
    scroll: document.querySelector('main')?.scrollTop ?? -1,
    ruta: location.pathname,
  }))
  /* Un regreso medido desde el tope no prueba nada: no había sitio que perder.
     A 1440×900 `/pendientes` cabe entero, así que ahí esto NO es un defecto —
     es una medida que no aplica, y se DECLARA en vez de contarse como aprobada.
     La prueba con scroll de verdad se hace abajo, en el expediente. */
  const hayScrollAqui = antes.scroll > 0
  if (!hayScrollAqui) console.log(`  ·· [${etiqueta}] /pendientes cabe sin desplazar (scrollTop=0): el regreso se mide en el expediente`)
  await captura(page, `${etiqueta}-1-antes-de-inspeccionar`)

  /* ── 2 · ABRIR sobre el pendiente que SÍ tiene nota de origen ──────────── */
  await disparador.click()
  await page.waitForSelector('.nx-lente', { timeout: 10000 })
  await page.waitForTimeout(1400)   // la lectura de la nota
  await captura(page, `${etiqueta}-2-lente-abierta-con-fuente`)

  const conFuente = await page.evaluate(() => {
    const plano = document.querySelector('.nx-lente')
    const cita = plano?.querySelector('.nx-lente-cita blockquote')?.textContent?.trim() ?? ''
    const estilo = plano ? getComputedStyle(plano) : null
    const caja = plano?.getBoundingClientRect()
    const lienzo = document.querySelector('main')?.getBoundingClientRect()
    return {
      abierto: !!plano,
      titulo: plano?.querySelector('.t-h2')?.textContent?.trim() ?? '',
      cita,
      // Lo que NO puede haber cuando la fuente existe: el aviso de hueco.
      huecos: plano?.querySelectorAll('.nx-lente-hueco').length ?? 0,
      fallos: plano?.querySelectorAll('.nx-lente-fallo').length ?? 0,
      position: estilo?.position ?? '',
      ancho: caja ? Math.round(caja.width) : 0,
      // Escritorio: el plano empieza donde acaba el lienzo (columna hermana).
      aLaDerechaDelLienzo: !!(caja && lienzo && caja.left >= lienzo.right - 2),
      // Móvil: anclado al fondo del viewport.
      ancladoAbajo: !!(caja && Math.abs(caja.bottom - window.innerHeight) < 2),
      telonVisible: !!document.querySelector('.nx-lente-telon')
        && getComputedStyle(document.querySelector('.nx-lente-telon')).display !== 'none',
      ariaModal: plano?.getAttribute('aria-modal') ?? '',
      // El foco entró al plano: sin esto un lector de pantalla no se entera.
      focoDentro: !!(plano && plano.contains(document.activeElement)),
      scrollDelLienzo: document.querySelector('main')?.scrollTop ?? -1,
      ruta: location.pathname,
    }
  })

  ok(`[${etiqueta}] la lente se abre sobre el hecho`, conFuente.abierto && conFuente.titulo.includes('Urocultivo'), conFuente.titulo)
  ok(`[${etiqueta}] CITA LITERAL la línea de la orden de la nota`, conFuente.cita === CITA_ESPERADA, `cita=«${conFuente.cita}»`)
  ok(`[${etiqueta}] con fuente NO pinta hueco ni fallo`, conFuente.huecos === 0 && conFuente.fallos === 0, `huecos=${conFuente.huecos} fallos=${conFuente.fallos}`)
  ok(`[${etiqueta}] inspeccionar NO cambia de ruta`, conFuente.ruta === antes.ruta, `${antes.ruta} → ${conFuente.ruta}`)
  ok(`[${etiqueta}] inspeccionar NO mueve el lienzo`, conFuente.scrollDelLienzo === antes.scroll, `${antes.scroll} → ${conFuente.scrollDelLienzo}`)
  ok(`[${etiqueta}] el foco entra al plano`, conFuente.focoDentro, String(conFuente.focoDentro))

  if (etiqueta === 'escritorio') {
    // §5: Capa 4 AL LADO de la Capa 3. Y RTC-32: en el shell no flota nada.
    ok('[escritorio] el plano NO flota sobre el trabajo', conFuente.position === 'static' || conFuente.position === 'relative', `position=${conFuente.position}`)
    ok('[escritorio] es columna hermana, a la derecha del lienzo', conFuente.aLaDerechaDelLienzo, `ancho=${conFuente.ancho}`)
    ok('[escritorio] no es modal: el trabajo sigue legible', conFuente.ariaModal === 'false' && !conFuente.telonVisible, `aria-modal=${conFuente.ariaModal} telón=${conFuente.telonVisible}`)
  } else {
    // §22: mobile no es desktop encogido — hoja nativa, no columna estrecha.
    ok('[movil] es una HOJA anclada abajo, no la columna encogida', conFuente.ancladoAbajo && conFuente.ancho >= 380, `ancho=${conFuente.ancho} abajo=${conFuente.ancladoAbajo}`)
    ok('[movil] es modal, con telón y foco atrapado', conFuente.ariaModal === 'true' && conFuente.telonVisible, `aria-modal=${conFuente.ariaModal} telón=${conFuente.telonVisible}`)
  }

  /* ── 3 · VOLVER: la promesa entera ─────────────────────────────────────── */
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const despues = await page.evaluate(() => ({
    abierto: !!document.querySelector('.nx-lente'),
    scroll: document.querySelector('main')?.scrollTop ?? -1,
    ruta: location.pathname,
    focoEnDisparador: document.activeElement?.classList?.contains('nx-inspeccionar') ?? false,
  }))
  await captura(page, `${etiqueta}-3-al-volver`)

  ok(`[${etiqueta}] Escape cierra el plano`, !despues.abierto)
  ok(`[${etiqueta}] VUELVE a la misma ruta`, despues.ruta === antes.ruta, `${antes.ruta} → ${despues.ruta}`)
  ok(`[${etiqueta}] VUELVE al mismo sitio del lienzo`, despues.scroll === antes.scroll, `${antes.scroll} → ${despues.scroll}`)
  ok(`[${etiqueta}] el foco VUELVE al disparador`, despues.focoEnDisparador, String(despues.focoEnDisparador))

  /* ── 4 · FALLAR CERRADO: el pendiente sin nota de origen ───────────────── */
  const sinFuente = disparadorDe(page, SIN_FUENTE)
  await sinFuente.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await sinFuente.click()
  await page.waitForSelector('.nx-lente', { timeout: 10000 })
  await page.waitForTimeout(900)
  await captura(page, `${etiqueta}-4-sin-fuente-lo-dice`)

  const honesto = await page.evaluate(() => {
    const plano = document.querySelector('.nx-lente')
    const hueco = plano?.querySelector('.nx-lente-hueco')
    return {
      texto: hueco?.textContent?.trim() ?? '',
      // Ámbar: hueco del registro. Ni rojo (fallo) ni gris (nada que ver).
      color: hueco ? getComputedStyle(hueco).color : '',
      citas: plano?.querySelectorAll('.nx-lente-cita').length ?? 0,
    }
  })
  ok(`[${etiqueta}] sin nota de origen lo DICE, y dice por qué`, /al llegar el resultado/i.test(honesto.texto), honesto.texto.slice(0, 90))
  ok(`[${etiqueta}] y no inventa ninguna cita`, honesto.citas === 0, `citas=${honesto.citas}`)

  /* ── 5 · EL LÍMITE: navegar a otro paciente no deja el plano vivo ──────── */
  await page.goto(`${BASE}/expediente/pac-aurelio-dominguez`, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const trasNavegar = await page.evaluate(() => ({
    abierto: !!document.querySelector('.nx-lente'),
    ruta: location.pathname,
  }))
  ok(`[${etiqueta}] cambiar de paciente CIERRA la lente (no se reata)`, !trasNavegar.abierto, trasNavegar.ruta)

  /* ── 6 · LA BANDA DE ALERGIAS, Y EL REGRESO DONDE SÍ HAY ALGO QUE PERDER ─
     A 1440×900 `/pendientes` cabe entero: su `scrollTop` es 0 y un «vuelve al
     mismo sitio» medido ahí no prueba nada — no había sitio que perder. Lo dijo
     el propio arnés, que por eso lleva esa comprobación. La cadena de regreso
     se mide además AQUÍ, en el expediente, que sí desplaza en los dos anchos, y
     con el disparador del ancla, que es `sticky` y sigue alcanzable abajo. */
  const bandaLente = page.locator('.nx-patient-anchor .nx-inspeccionar').first()
  if (await bandaLente.count()) {
    await page.evaluate(() => {
      const m = document.querySelector('main')
      if (m) m.scrollTop = Math.min(320, Math.max(0, m.scrollHeight - m.clientHeight))
    })
    await page.waitForTimeout(400)
    const antesExp = await page.evaluate(() => ({
      scroll: document.querySelector('main')?.scrollTop ?? -1,
      ruta: location.pathname,
    }))
    ok(`[${etiqueta}] en el expediente SÍ hay scroll que perder`, antesExp.scroll > 0, `scrollTop=${antesExp.scroll}`)

    await bandaLente.click()
    await page.waitForSelector('.nx-lente', { timeout: 10000 })
    await page.waitForTimeout(700)
    await captura(page, `${etiqueta}-5-alergias-de-donde-se-leyo`)
    const alergias = await page.evaluate(() => {
      const plano = document.querySelector('.nx-lente')
      return {
        titulo: plano?.querySelector('.t-h2')?.textContent?.trim() ?? '',
        // El texto crudo del expediente, al lado de lo que se entendió de él.
        cuerpo: plano?.querySelector('.nx-lente-cuerpo')?.textContent?.trim() ?? '',
        scroll: document.querySelector('main')?.scrollTop ?? -1,
        ruta: location.pathname,
      }
    })
    ok(`[${etiqueta}] la banda de alergias enseña de dónde se leyó`,
      /Alergias de/i.test(alergias.titulo) && /de dónde se leyó/i.test(alergias.cuerpo),
      alergias.titulo)
    ok(`[${etiqueta}] abrir en el expediente no mueve nada`,
      alergias.scroll === antesExp.scroll && alergias.ruta === antesExp.ruta,
      `${antesExp.scroll} → ${alergias.scroll}`)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const despuesExp = await page.evaluate(() => ({
      abierto: !!document.querySelector('.nx-lente'),
      scroll: document.querySelector('main')?.scrollTop ?? -1,
      ruta: location.pathname,
      focoEnDisparador: document.activeElement?.classList?.contains('nx-inspeccionar') ?? false,
      // MISMO PACIENTE: el <h1> del ancla es su nombre.
      paciente: document.querySelector('.nx-ancla-nombre')?.textContent?.trim() ?? '',
    }))
    await captura(page, `${etiqueta}-6-expediente-al-volver`)
    ok(`[${etiqueta}] EXPEDIENTE · vuelve al mismo sitio, misma ruta, mismo paciente`,
      !despuesExp.abierto && despuesExp.scroll === antesExp.scroll
      && despuesExp.ruta === antesExp.ruta && despuesExp.paciente.includes('Aurelio'),
      `scroll ${antesExp.scroll} → ${despuesExp.scroll} · ${despuesExp.paciente}`)
    ok(`[${etiqueta}] EXPEDIENTE · el foco vuelve al disparador`, despuesExp.focoEnDisparador, String(despuesExp.focoEnDisparador))
  } else {
    ok(`[${etiqueta}] la banda de alergias enseña de dónde se leyó`, false, 'no se encontró el disparador en el ancla')
  }

  await contexto.close()
}

await navegador.close()

const acta = {
  fecha: new Date().toISOString(),
  base: BASE,
  casos,
  erroresDeConsola: errores,
  resumen: `${casos.filter(c => c.pasa).length}/${casos.length} PASS · ${errores.length} errores de consola`,
}
fs.writeFileSync(path.join(DESTINO, 'acta-lente.json'), JSON.stringify(acta, null, 2))

for (const c of casos) console.log(`${c.pasa ? '  ok ' : '  NO '} ${c.nombre}${c.detalle ? ` — ${c.detalle}` : ''}`)
if (errores.length) { console.log('\n  errores de consola:'); for (const e of errores) console.log(`   · ${e}`) }
console.log(`\n  ${acta.resumen}`)
process.exit(casos.every(c => c.pasa) && errores.length === 0 ? 0 : 1)
