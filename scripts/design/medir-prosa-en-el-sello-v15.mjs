/**
 * MEDICIÓN EN NAVEGADOR REAL — el sello que se VE contra el sello que se ARCHIVA.
 *
 * ── QUÉ PREGUNTA CONTESTA ───────────────────────────────────────────────────
 *
 * `construirManifiesto` audita la prosa de la nota —cada sección y el resumen
 * ejecutivo, con su cita textual— desde hace versiones. Al FIRMAR, `/consulta`
 * se la pasaba, así que el sello que queda en el registro medicolegal la
 * contaba. Las dos superficies donde un humano LEE ese sello construían su
 * propio objeto a mano y omitían la prosa.
 *
 * Sobre la misma nota, medido en un módulo puro antes de tocar la interfaz:
 *
 * ```text
 *   lo que se ARCHIVA  →  7 campos, «3 del dictado · 4 a mano»
 *   lo que se VE       →  4 campos, «4 a mano»
 * ```
 *
 * Esto lo comprueba EN EL PRODUCTO:
 *
 *   1. CUÁNTOS CAMPOS enseña el panel, y con qué frase los resume el
 *      disparador. Es la fila que prueba o refuta la rebanada entera.
 *   2. QUÉ CAMPOS. No basta el total: se leen las etiquetas, y tienen que
 *      aparecer las cuatro secciones y el resumen.
 *   3. **LA CITA DEL PLAN, COMPROBADA DEL OTRO LADO.** La siembra pone al
 *      reconocedor oyendo «hemoglobina glucosa hilada» donde el médico
 *      escribió «HbA1c». Si la fila del Plan enseña esa cita, el panel está
 *      contrastando contra el material de origen. Si no aparece ninguna cita,
 *      la prosa llegó sin respaldo y la rebanada no sirve de nada.
 *   4. LAS DOS FAMILIAS SEPARADAS y el texto redactado PRIMERO (§16), con el
 *      rótulo como encabezado de verdad (§24).
 *   5. `/consulta` — una nota que sólo trae texto redactado (el borrador de Luz
 *      María: cero diagnósticos, cero medicamentos) no enseñaba NINGÚN sello.
 *   6. §21 sigue cumpliéndose: no empuja, Escape cierra, el foco vuelve, el
 *      desplazamiento se restaura, 0 errores de consola.
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 ni sustituye la lectura independiente de §26.
 * · No juzga si la prosa es clínicamente correcta: dice de dónde salió.
 * · No toca la compuerta de firma (`camposSinEvidencia`), que sigue sin mirar
 *   la prosa. Es conducta clínica sobre la firma y §1 la congela.
 *
 * Requiere: emuladores + siembra + build + next start
 * (`bash scripts/design/arnes-breakpoints-v15.sh <este script> [carpeta]`).
 *
 * Uso:
 *   node scripts/design/medir-prosa-en-el-sello-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-prosa-en-el-sello'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const EXPEDIENTE = '/expediente/pac-aurelio-dominguez'
/* El borrador que sólo tiene prosa: sin diagnósticos ni medicamentos, la
   condición vieja de `/consulta` no pintaba sello ninguno. */
const CONSULTA_SOLO_PROSA = '/consulta/pac-luzmaria-cervantes?nota=nota-luzmaria-borrador'

/* Lo que el reconocedor oyó, dentro de la cita del Plan. Si aparece, el panel
   contrasta contra el material de origen. */
const DIJO_EL_MOTOR = 'glucosa hilada'

/* Las secciones y el resumen sembrados. Que el panel los nombre es la mitad
   que un total no prueba: 7 campos podrían ser otros 7. */
const PROSA_ESPERADA = ['Resumen', 'Subjetivo', 'Objetivo', 'Análisis', 'Plan']

const VIEWPORTS = [
  { nombre: 'escritorio-1440', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  { nombre: 'movil-390', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
]

fs.mkdirSync(DESTINO, { recursive: true })

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const acta = { base: BASE, fase: FASE, viewports: {}, errores: [] }

const SONDA = `
  window.__nxSonda = {
    ETIQUETAS: [
      'del dictado (con cita)', 'inferencia de IA', 'capturado a mano',
      'calculado por el sistema', 'importado de un dispositivo',
    ],
    visible(el) {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    },
    main() { return document.querySelector('main') },
    lente() { return document.querySelector('.nx-lente[data-abierta="si"]') },
    notas() {
      return [...document.querySelectorAll('button')]
        .filter(b => /firmada|borrador/i.test(b.textContent ?? '') && window.__nxSonda.visible(b))
    },
    reveladorSello() {
      return [...document.querySelectorAll('button')]
        .find(b => /procedencia de la nota/i.test(b.textContent ?? '') && window.__nxSonda.visible(b)) ?? null
    },
    /**
     * LA FRASE DEL DISPARADOR — «3 del dictado · 4 a mano». Es el resumen que
     * el médico lee sin abrir nada, y la que divergía del registro.
     */
    fraseDelSello() {
      const b = window.__nxSonda.reveladorSello()
      if (!b) return null
      const t = (b.textContent ?? '').replace(/\\s+/g, ' ').trim()
      return t.replace(/^Procedencia de la nota\\s*/i, '')
    },
    /**
     * LAS FILAS DEL PANEL, contadas por su DISTINTIVO DE ORIGEN y no por una
     * clase: el distintivo existe igual antes y después de la rebanada, así
     * que la misma sonda mide las dos fases. Contar por una clase nueva sólo
     * sabría contar el «después».
     */
    filas() {
      const l = window.__nxSonda.lente()
      if (!l) return []
      return [...l.querySelectorAll('span')]
        .filter(s => window.__nxSonda.ETIQUETAS.includes((s.textContent ?? '').trim()))
        .map(badge => {
          const fila = badge.closest('div[style*="border-radius: 8px"]') ?? badge.parentElement?.parentElement
          const etiqueta = fila
            ? [...fila.querySelectorAll('span')].map(x => (x.textContent ?? '').trim()).find(x => x.endsWith(':'))
            : null
          const texto = (fila?.textContent ?? '').replace(/\\s+/g, ' ')
          return {
            etiqueta: etiqueta ? etiqueta.replace(/:$/, '') : null,
            origen: (badge.textContent ?? '').trim(),
            /* La cita se pinta en cursiva entre comillas tipográficas. */
            cita: (texto.match(/[\\u201C]([^\\u201D]*)[\\u201D]/) ?? [])[1] ?? null,
          }
        })
    },
    /** Los rótulos de familia dentro del panel, y su etiqueta HTML (§24). */
    grupos() {
      const l = window.__nxSonda.lente()
      if (!l) return []
      return [...l.querySelectorAll('h3')].map(h => ({
        texto: (h.textContent ?? '').trim(), tag: h.tagName,
      }))
    },
  }
`

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

/** Abre el sello, lee todo lo que hay dentro y lo cierra con Escape. */
async function abrirSelloYLeer(page, etiqueta, vpNombre) {
  const antes = await page.evaluate(() => {
    const s = window.__nxSonda
    const b = s.reveladorSello()
    const m = s.main()
    if (!b) return { hay: false }
    b.scrollIntoView({ block: 'center' })
    return {
      hay: true,
      frase: s.fraseDelSello(),
      expandido: b.getAttribute('aria-expanded'),
      alto: m?.scrollHeight ?? null,
      scrollTop: Math.round(m?.scrollTop ?? 0),
      rect: Math.round(b.getBoundingClientRect().top),
    }
  })
  if (!antes.hay) return { hay: false }

  await page.waitForTimeout(400)
  const dentro = await page.evaluate(async () => {
    const s = window.__nxSonda
    const b = s.reveladorSello()
    b.focus(); b.click()
    await new Promise(r => setTimeout(r, 900))
    const m = s.main()
    return {
      abrio: !!s.lente(),
      lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
      expandido: b.getAttribute('aria-expanded'),
      alto: m?.scrollHeight ?? null,
      rect: Math.round(b.getBoundingClientRect().top),
      grupos: s.grupos(),
      filas: s.filas(),
      /* El primer rótulo del panel: §16 pide el texto redactado ARRIBA. */
      textoDelPanel: (s.lente()?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 6000),
    }
  })

  await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vpNombre}-${etiqueta}-sello-abierto.png`), fullPage: false })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const trasEscape = await page.evaluate(() => {
    const s = window.__nxSonda
    const b = s.reveladorSello()
    const m = s.main()
    return {
      lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
      expandido: b?.getAttribute('aria-expanded') ?? null,
      focoEnElDisparador: !!b && document.activeElement === b,
      scrollTop: Math.round(m?.scrollTop ?? 0),
      alto: m?.scrollHeight ?? null,
    }
  })

  return { hay: true, antes, dentro, trasEscape }
}

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => acta.errores.push(`${vp.nombre}: pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') acta.errores.push(`${vp.nombre}: consola: ${m.text().slice(0, 160)}`) })
  await page.addInitScript(SONDA)
  await entrar(page)

  /* ── 1. EL ARCHIVO — la nota firmada con extracción ───────────────────── */
  await page.goto(`${BASE}${EXPEDIENTE}`, { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  /* LA NOTA SE ELIGE POR SU NOMBRE, no por su índice. El expediente ordena por
     fecha, así que `notas()[0]` es la de Seguimiento — la que NO archivó bloque
     de extracción y por diseño no pinta sello. Medir ésa habría dado «no hay
     sello» en las dos fases y habría parecido que la rebanada no hace nada. */
  await page.evaluate(async () => {
    const cab = window.__nxSonda.notas().find(b => /primera vez/i.test(b.textContent ?? ''))
    if (!cab) return
    cab.scrollIntoView({ block: 'center' })
    await new Promise(r => setTimeout(r, 400))
    cab.click()
    await new Promise(r => setTimeout(r, 900))
  })
  await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-expediente-nota.png`), fullPage: false })
  const expediente = await abrirSelloYLeer(page, 'expediente', vp.nombre)

  /* ── 2. LA CONSULTA — el borrador que sólo tiene prosa ────────────────── */
  await page.goto(`${BASE}${CONSULTA_SOLO_PROSA}`, { waitUntil: 'load' })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-consulta.png`), fullPage: false })
  const consulta = await abrirSelloYLeer(page, 'consulta', vp.nombre)

  acta.viewports[vp.nombre] = { expediente, consulta }
  await contexto.close()

  /* ── Informe legible ───────────────────────────────────────────────────── */
  console.log(`\n══════ ${vp.nombre} (${FASE}) ══════`)
  for (const [donde, r] of [['EXPEDIENTE (nota firmada)', expediente], ['CONSULTA (borrador sólo-prosa)', consulta]]) {
    console.log(`\n── ${donde} ──`)
    if (!r?.hay) { console.log('  NO HAY SELLO EN PANTALLA'); continue }
    console.log(`  frase del disparador: «${r.antes.frase}»`)
    console.log(`  campos en el panel: ${r.dentro.filas.length}`)
    const prosaVista = r.dentro.filas.map(f => f.etiqueta).filter(e => PROSA_ESPERADA.includes(e ?? ''))
    console.log(`  de ellos, texto redactado: ${prosaVista.length} → ${prosaVista.join(', ') || '(ninguno)'}`)
    console.log(`  faltan: ${PROSA_ESPERADA.filter(e => !prosaVista.includes(e)).join(', ') || '(ninguno)'}`)
    console.log(`  grupos: ${r.dentro.grupos.map(g => `${g.tag} «${g.texto}»`).join(' · ') || '(ninguno)'}`)
    const plan = r.dentro.filas.find(f => f.etiqueta === 'Plan')
    console.log(`  cita del Plan: ${plan?.cita ? `«${plan.cita.slice(0, 90)}»` : '(sin cita)'}`)
    console.log(`  LA CITA ENSEÑA EL ORIGINAL («${DIJO_EL_MOTOR}»): ${plan?.cita?.includes(DIJO_EL_MOTOR) ? 'sí ✓' : 'NO'}`)
    console.log(`  orígenes: ${[...new Set(r.dentro.filas.map(f => f.origen))].join(' · ')}`)
    console.log(`  alto ${r.antes.alto} → ${r.dentro.alto} (${r.dentro.alto - r.antes.alto >= 0 ? '+' : ''}${r.dentro.alto - r.antes.alto}px) · el disparador se movió ${r.dentro.rect - r.antes.rect}px`)
    console.log(`  aria-expanded ${r.antes.expandido} → ${r.dentro.expandido} · lentes abiertas ${r.dentro.lentesAbiertas}`)
    console.log(`  ESCAPE → cerró: ${r.trasEscape.lentesAbiertas === 0} · foco vuelve: ${r.trasEscape.focoEnElDisparador} · scroll exacto: ${r.antes.scrollTop === r.trasEscape.scrollTop}`)
  }
}

console.log(`\nErrores de consola/página: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 12)) console.log(`  · ${e}`)

fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\nActa: ${path.join(DESTINO, `acta-${FASE}.json`)}`)

await navegador.close()
