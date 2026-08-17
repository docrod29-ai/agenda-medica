/**
 * MEDICIÓN EN NAVEGADOR REAL — §10 en la cola de cierre: las cuatro preguntas,
 * y la traza que llevaba guardándose sin que nadie la leyera.
 *
 * ── QUÉ PREGUNTA CONTESTA ───────────────────────────────────────────────────
 *
 * §10 exige que cada entrada de `/pendientes` conteste cuatro: WHY IS THIS HERE
 * · WHO OWNS IT · WHAT HAPPENED · WHAT IS NEXT. Antes de esta rebanada
 * contestaba dos. Esto mide si ahora contesta las cuatro **en el producto**, no
 * en el diff:
 *
 *   1. ALCANCE — ¿cuántas entradas de la cola pueden inspeccionar su origen?
 *      Y de paso: ¿sube el alcance de §21 de 1 superficie a 2?
 *   2. LAS CUATRO — con la lente abierta, ¿están los cuatro rótulos, y con
 *      texto debajo? Un rótulo sin respuesta es peor que no preguntar.
 *   3. LA TRAZA LLEGA — ¿aparece el enlace a la consulta de origen, apunta a
 *      la ruta que `/consulta/[patientId]` sabe leer, y **carga de verdad**?
 *      Esto es lo que la regla «el dato tiene que LLEGAR» obliga a mirar del
 *      otro lado: `notaId` se escribía desde `derivar.ts` y su único lector
 *      era el compositor de ids de Firestore.
 *   4. SITIO Y VUELTA (§21) — ¿empuja la cola bajo el dedo al abrir? ¿cierra
 *      con Escape? ¿vuelve el foco al control que abrió? ¿se restaura el
 *      desplazamiento exacto?
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 ni sustituye la lectura independiente que la iteración debe.
 * · No mide el rol de asistente: la siembra sólo trae cuenta de médico.
 * · No dice si el TEXTO de las respuestas es clínicamente bueno: dice que
 *   están, que no están vacías y que la traza no es un enlace roto.
 *
 * Requiere: emuladores + siembra + build + next start
 * (`bash scripts/design/arnes-breakpoints-v15.sh <este script> [carpeta]`).
 *
 * Uso:
 *   node scripts/design/medir-por-que-esta-aqui-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-por-que-esta-aqui'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const COLA = '/pendientes'

const VIEWPORTS = [
  { nombre: 'escritorio-1440', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  { nombre: 'movil-390', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
]

/** Los cuatro rótulos de §10, tal como la pantalla los escribe. */
const LAS_CUATRO = ['Por qué está aquí', 'Quién responde', 'Qué ha pasado', 'Qué sigue']

fs.mkdirSync(DESTINO, { recursive: true })

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const acta = { base: BASE, fase: FASE, viewports: {}, errores: [] }

const SONDA = `
  window.__nxSonda = {
    visible(el) {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    },
    /* Los disparadores de §10. Se buscan por su texto, igual que en el arnés
       de la Capa 4: no llevan marca propia. */
    reveladores() {
      const RE = /por qu[eé] est[aá] aqu[ií]/i
      return [...document.querySelectorAll('button')]
        .filter(b => RE.test((b.textContent ?? '')) && window.__nxSonda.visible(b))
    },
    main() { return document.querySelector('main') },
    lente() { return document.querySelector('.nx-lente[data-abierta="si"]') },
    /* Los cuatro rótulos + si cada uno tiene algo debajo. Un rótulo sin
       respuesta es un hueco con nombre. */
    respuestas() {
      const l = window.__nxSonda.lente()
      if (!l) return null
      return [...l.querySelectorAll('.nx-porque-rotulo')].map(h => {
        const sec = h.parentElement
        const cuerpo = (sec?.textContent ?? '').replace(h.textContent ?? '', '').trim()
        return { rotulo: (h.textContent ?? '').trim(), etiqueta: h.tagName, largo: cuerpo.length }
      })
    },
    traza() {
      const l = window.__nxSonda.lente()
      const a = l?.querySelector('a.nx-porque-traza')
      return a ? { href: a.getAttribute('href'), texto: (a.textContent ?? '').trim() } : null
    },
    /* La rama honesta: cuando no consta de qué consulta salió, se DICE. */
    sinTraza() {
      const l = window.__nxSonda.lente()
      return !!l && /no consta de qu[eé] consulta/i.test(l.textContent ?? '')
    },
  }
`

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => acta.errores.push(`${vp.nombre}: pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') acta.errores.push(`${vp.nombre}: consola: ${m.text().slice(0, 160)}`) })
  await page.addInitScript(SONDA)

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

  await page.goto(`${BASE}${COLA}`, { waitUntil: 'load' })
  await page.waitForTimeout(3500)

  const alcance = await page.evaluate(() => ({
    /* Cuántas entradas hay y cuántas pueden inspeccionar su origen. Si el
       segundo número es menor que el primero, hay entradas mudas. */
    entradas: document.querySelectorAll('h2').length
      ? [...document.querySelectorAll('button')].filter(b => /ya no aplica/i.test(b.textContent ?? '')).length
      : 0,
    reveladores: window.__nxSonda.reveladores().length,
    huecoDeLente: !!document.getElementById('nx-lente-hueco'),
    altoDeLaCola: window.__nxSonda.main()?.scrollHeight ?? null,
  }))

  await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-cola-cerrada.png`), fullPage: false })

  const comportamiento = []
  /* Se miden TRES entradas y no una: la que trae traza, la que no, y una
     cerrada. Medir sólo la primera dejaría sin fotografiar justo la rama que
     dice «no consta» — la que un cambio futuro puede romper en silencio. */
  const cuantos = Math.min(alcance.reveladores, 3)
  for (let i = 0; i < cuantos; i++) {
    if (i > 0) { await page.goto(`${BASE}${COLA}`, { waitUntil: 'load' }); await page.waitForTimeout(3000) }

    const paso = await page.evaluate(async (idx) => {
      const s = window.__nxSonda
      const m = s.main()
      const b = s.reveladores()[idx]
      if (!b || !m) return null

      b.scrollIntoView({ block: 'center' })
      await new Promise(r => setTimeout(r, 500))

      const antes = {
        scrollTop: Math.round(m.scrollTop),
        alto: m.scrollHeight,
        rect: Math.round(b.getBoundingClientRect().top),
        expandido: b.getAttribute('aria-expanded'),
      }

      b.focus()
      b.click()
      await new Promise(r => setTimeout(r, 800))

      return {
        entrada: (() => {
          /* Defecto propio del instrumento en la fase «antes»: `closest('div[style]')`
             se quedaba en la fila de botones y las tres entradas salieron
             «(sin identidad)». Se sube hasta el ancestro que de verdad
             contiene la identidad del paciente. */
          let n = b.parentElement
          while (n && !n.querySelector('.nx-ident')) n = n.parentElement
          return (n?.querySelector('.nx-ident')?.textContent ?? '').trim().slice(0, 40)
        })(),
        antes,
        despues: {
          scrollTop: Math.round(m.scrollTop),
          alto: m.scrollHeight,
          rect: Math.round(b.getBoundingClientRect().top),
          expandido: b.getAttribute('aria-expanded'),
          lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
          /* Un panel que cubre su propio disparador perdió el sitio aunque no
             haya movido un píxel. */
          disparadorTapado: (() => {
            const r = b.getBoundingClientRect()
            const en = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
            return !(en && (b === en || b.contains(en) || en.contains(b)))
          })(),
          respuestas: s.respuestas(),
          traza: s.traza(),
          sinTraza: s.sinTraza(),
        },
      }
    }, i)

    if (!paso) continue

    await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-entrada-${i}-abierta.png`), fullPage: false })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const trasEscape = await page.evaluate((idx) => {
      const s = window.__nxSonda
      const b = s.reveladores()[idx]
      const m = s.main()
      return {
        alto: m?.scrollHeight ?? null,
        scrollTop: Math.round(m?.scrollTop ?? 0),
        expandido: b?.getAttribute('aria-expanded') ?? null,
        lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
        focoEnElDisparador: !!b && document.activeElement === b,
      }
    }, i)

    comportamiento.push({ ...paso, trasEscape })
  }

  /* ── LA TRAZA, DEL OTRO LADO ────────────────────────────────────────────
     No basta con que el enlace exista y apunte bien: hay que ir y ver que la
     consulta carga con SU nota. Es la mitad que la regla «el dato tiene que
     LLEGAR» dice que casi nadie hace. */
  let traza = { href: null, cargó: null, url: null, errores: 0 }
  const conTraza = comportamiento.find(c => c.despues.traza?.href)
  if (conTraza) {
    const href = conTraza.despues.traza.href
    const antesErr = acta.errores.length
    await page.goto(`${BASE}${href}`, { waitUntil: 'load' })
    await page.waitForTimeout(3500)
    traza = {
      href,
      url: page.url().replace(BASE, ''),
      cargó: await page.evaluate(() => !!document.querySelector('main') && (document.querySelector('main')?.scrollHeight ?? 0) > 400),
      errores: acta.errores.length - antesErr,
    }
    await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-traza-aterriza.png`), fullPage: false })
  }

  acta.viewports[vp.nombre] = { alcance, comportamiento, traza }
  await contexto.close()

  /* ── Informe legible ───────────────────────────────────────────────────── */
  console.log(`\n══════ ${vp.nombre} (${FASE}) ══════`)
  console.log(`ALCANCE — entradas en la cola: ${alcance.entradas} · con «¿por qué está aquí?»: ${alcance.reveladores}`)
  console.log(`Capa 4 montada en el shell: ${alcance.huecoDeLente} · alto de la cola: ${alcance.altoDeLaCola}px`)
  for (const c of comportamiento) {
    console.log(`\nINSPECCIONAR «${c.entrada || '(sin identidad)'}»`)
    console.log(`  alto de la cola     ${c.antes.alto} → ${c.despues.alto} (${c.despues.alto - c.antes.alto >= 0 ? '+' : ''}${c.despues.alto - c.antes.alto}px)`)
    console.log(`  el disparador se movió ${c.despues.rect - c.antes.rect}px · scroll ${c.antes.scrollTop} → ${c.despues.scrollTop}`)
    console.log(`  aria-expanded ${c.antes.expandido} → ${c.despues.expandido} · lentes abiertas ${c.despues.lentesAbiertas}`)
    console.log(`  disparador tapado por lo abierto: ${c.despues.disparadorTapado}`)
    const r = c.despues.respuestas
    if (!r) console.log('  LAS CUATRO: no se abrió la lente')
    else {
      const faltan = LAS_CUATRO.filter(x => !r.some(y => y.rotulo === x))
      const vacias = r.filter(y => y.largo < 5).map(y => y.rotulo)
      console.log(`  LAS CUATRO: ${r.length}/4 · faltan: ${faltan.length ? faltan.join(', ') : 'ninguna'}` +
        ` · sin respuesta: ${vacias.length ? vacias.join(', ') : 'ninguna'} · etiquetas: ${[...new Set(r.map(y => y.etiqueta))].join('/')}`)
    }
    console.log(`  TRAZA: ${c.despues.traza ? c.despues.traza.href : (c.despues.sinTraza ? 'no consta (dicho)' : 'AUSENTE Y CALLADA')}`)
    console.log(`  ESCAPE → alto ${c.trasEscape.alto} · scroll ${c.trasEscape.scrollTop} · aria-expanded ${c.trasEscape.expandido}` +
      ` · lentes ${c.trasEscape.lentesAbiertas} · foco en el disparador: ${c.trasEscape.focoEnElDisparador}`)
  }
  if (traza.href) {
    console.log(`\nLA TRAZA DEL OTRO LADO — ${traza.href}`)
    console.log(`  aterriza en ${traza.url} · cargó: ${traza.cargó} · errores nuevos: ${traza.errores}`)
  } else {
    console.log('\nLA TRAZA DEL OTRO LADO — ninguna entrada medida traía traza')
  }
}

await navegador.close()
acta.resumen = { errores: acta.errores.length }
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\nErrores de consola/página: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 12)) console.log(`  · ${e}`)
console.log(`Acta: ${path.join(DESTINO, `acta-${FASE}.json`)}`)
