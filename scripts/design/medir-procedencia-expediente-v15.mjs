/**
 * MEDICIÓN EN NAVEGADOR REAL — §21 en el expediente: la nota archivada enseña
 * de dónde salió, y contra QUÉ se está contrastando.
 *
 * ── QUÉ PREGUNTA CONTESTA ───────────────────────────────────────────────────
 *
 * §21 llama a la inspección de la fuente la interacción de firma del producto.
 * Vivía en 2 de 6 superficies, y ninguna era el archivo — que es donde se
 * pregunta, porque nadie audita una nota el día que la firma. Esto mide si
 * ahora se puede **en el producto**, no en el diff:
 *
 *   1. ALCANCE — de las notas archivadas que se pueden abrir, ¿cuántas pueden
 *      inspeccionar su origen? ¿Sube §21 de 2 superficies a 3?
 *   2. LAS DOS PIEZAS — ¿aparece el sello donde hay bloque de extracción, y NO
 *      aparece donde no lo hay? La segunda mitad es la que importa: un sello
 *      sin extracción imprimiría «a mano» sobre datos de máquina.
 *   3. **CONTRA QUÉ SE CONTRASTA, COMPROBADO DEL OTRO LADO.** No basta con que
 *      la pantalla escriba «se contrasta contra el original»: hay que ver el
 *      texto del ORIGINAL dentro del panel. La siembra pone al reconocedor
 *      oyendo «hemoglobina glucosa hilada» donde el médico escribió
 *      «glucosilada»; si el panel enseña la segunda, está contrastando contra
 *      el texto editable y el respaldo está fabricado.
 *      Ésta es la mitad que la regla «el dato tiene que LLEGAR» dice que casi
 *      nadie hace.
 *   4. SITIO Y VUELTA (§21) — ¿empuja el expediente al abrir? ¿cierra con
 *      Escape? ¿vuelve el foco? ¿se restaura el desplazamiento exacto?
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 ni sustituye la lectura independiente que la iteración debe.
 * · No juzga si el texto de la nota es clínicamente bueno: dice de dónde salió.
 * · No mide la mitad de PROSA del manifiesto: ninguna superficie se la pasa
 *   todavía, y está declarado como unidad propia.
 *
 * Requiere: emuladores + siembra + build + next start
 * (`bash scripts/design/arnes-breakpoints-v15.sh <este script> [carpeta]`).
 *
 * Uso:
 *   node scripts/design/medir-procedencia-expediente-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-procedencia-expediente'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/* Aurelio tiene DOS notas firmadas: la primera con original del reconocedor +
   bloque de extracción, la segunda sólo con texto de trabajo. Las dos caras de
   la rebanada en una sola pantalla. */
const EXPEDIENTE = '/expediente/pac-aurelio-dominguez'

/* Lo que el reconocedor oyó y el médico corrigió. Si el panel enseña el
   corregido, el contraste está fabricado. */
const DIJO_EL_MOTOR = 'glucosa hilada'
const ESCRIBIO_EL_MEDICO = 'glucosilada'

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
    visible(el) {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    },
    main() { return document.querySelector('main') },
    lente() { return document.querySelector('.nx-lente[data-abierta="si"]') },
    /* Las cabeceras de las notas del expediente: el control que las abre. */
    notas() {
      return [...document.querySelectorAll('button')]
        .filter(b => /firmada|borrador/i.test(b.textContent ?? '') && window.__nxSonda.visible(b))
    },
    /* Los dos reveladores de §21. Se buscan por su texto: no llevan marca
       propia, igual que en el arnés de la Capa 4. */
    reveladorFuente() {
      return [...document.querySelectorAll('button')]
        .find(b => /de d[oó]nde sali[oó] esto/i.test(b.textContent ?? '') && window.__nxSonda.visible(b)) ?? null
    },
    reveladorSello() {
      return [...document.querySelectorAll('button')]
        .find(b => /procedencia de la nota/i.test(b.textContent ?? '') && window.__nxSonda.visible(b)) ?? null
    },
    /* La sección entera de §21 dentro de la nota abierta. */
    bloque() { return document.querySelector('.nx-proc-nota') },
    /* La frase que dice contra qué se contrasta. Sin ella, un revisor supone
       que el respaldo es contra el original aunque no lo sea. */
    fuenteDicha() {
      const p = document.querySelector('.nx-proc-fuente')
      return p ? (p.textContent ?? '').trim() : null
    },
    rotuloEsEncabezado() {
      const h = document.querySelector('.nx-proc-rotulo')
      return h ? h.tagName : null
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

  const notas = []

  /* Se miden LAS DOS notas firmadas: la que tiene sello y original, y la que
     sólo tiene texto de trabajo. Medir una sola dejaría sin fotografiar la
     rama honesta —«no se archivó el original»—, que es la que un cambio futuro
     rompe en silencio. */
  for (let i = 0; i < 2; i++) {
    await page.goto(`${BASE}${EXPEDIENTE}`, { waitUntil: 'load' })
    await page.waitForTimeout(3500)

    if (i === 0) {
      const encuadre = await page.evaluate(() => ({
        huecoDeLente: !!document.getElementById('nx-lente-hueco'),
        notasEnElExpediente: window.__nxSonda.notas().length,
        alto: window.__nxSonda.main()?.scrollHeight ?? null,
      }))
      acta.viewports[vp.nombre] = { encuadre, notas }
      await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-expediente.png`), fullPage: false })
    }

    const abierta = await page.evaluate(async (idx) => {
      const s = window.__nxSonda
      const cab = s.notas()[idx]
      if (!cab) return null
      cab.scrollIntoView({ block: 'center' })
      await new Promise(r => setTimeout(r, 400))
      cab.click()
      await new Promise(r => setTimeout(r, 900))
      return {
        titulo: (cab.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        bloqueDe21: !!s.bloque(),
        rotulo: s.rotuloEsEncabezado(),
        conSello: !!s.reveladorSello(),
        conFuente: !!s.reveladorFuente(),
        fuenteDicha: s.fuenteDicha(),
      }
    }, i)

    if (!abierta) { notas.push({ indice: i, error: 'no se encontró la nota' }); continue }

    await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-nota-${i}-abierta.png`), fullPage: false })

    /* ── §21: EL SITIO Y LA VUELTA ──────────────────────────────────────── */
    let inspeccion = null
    if (abierta.conFuente) {
      inspeccion = await page.evaluate(async () => {
        const s = window.__nxSonda
        const m = s.main()
        const b = s.reveladorFuente()
        if (!b || !m) return null
        b.scrollIntoView({ block: 'center' })
        await new Promise(r => setTimeout(r, 400))
        const antes = {
          scrollTop: Math.round(m.scrollTop), alto: m.scrollHeight,
          rect: Math.round(b.getBoundingClientRect().top),
          expandido: b.getAttribute('aria-expanded'),
        }
        b.focus(); b.click()
        await new Promise(r => setTimeout(r, 900))
        const l = s.lente()
        const texto = (l?.textContent ?? '')
        return {
          antes,
          despues: {
            scrollTop: Math.round(m.scrollTop), alto: m.scrollHeight,
            rect: Math.round(b.getBoundingClientRect().top),
            expandido: b.getAttribute('aria-expanded'),
            lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
            disparadorTapado: (() => {
              const r = b.getBoundingClientRect()
              const en = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
              return !(en && (b === en || b.contains(en) || en.contains(b)))
            })(),
            frasesDelPanel: l ? l.querySelectorAll('p').length : 0,
            /* LO QUE DE VERDAD IMPORTA: qué transcripción está dentro. */
            textoDelPanel: texto.replace(/\s+/g, ' ').slice(0, 4000),
          },
        }
      })

      await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-nota-${i}-fuente-abierta.png`), fullPage: false })

      await page.keyboard.press('Escape')
      await page.waitForTimeout(600)
      const trasEscape = await page.evaluate(() => {
        const s = window.__nxSonda
        const b = s.reveladorFuente()
        const m = s.main()
        return {
          alto: m?.scrollHeight ?? null,
          scrollTop: Math.round(m?.scrollTop ?? 0),
          expandido: b?.getAttribute('aria-expanded') ?? null,
          lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
          focoEnElDisparador: !!b && document.activeElement === b,
        }
      })
      if (inspeccion) inspeccion.trasEscape = trasEscape
    }

    /* ── EL SELLO, CUANDO LO HAY ────────────────────────────────────────── */
    let sello = null
    if (abierta.conSello) {
      sello = await page.evaluate(async () => {
        const s = window.__nxSonda
        const b = s.reveladorSello()
        if (!b) return null
        b.scrollIntoView({ block: 'center' })
        await new Promise(r => setTimeout(r, 300))
        b.focus(); b.click()
        await new Promise(r => setTimeout(r, 900))
        const l = s.lente()
        const t = (l?.textContent ?? '').replace(/\s+/g, ' ')
        return {
          abrio: !!l,
          expandido: b.getAttribute('aria-expanded'),
          campos: l ? l.querySelectorAll('[style*="border-radius: 8px"], [style*="borderRadius"]').length : 0,
          /* Los distintivos de origen que el sello imprime. Que aparezca «IA»
             en un dx sin cita y «Dictado» en un signo con cita es la prueba
             de que el manifiesto se construyó con la extracción archivada. */
          diceIA: /\bia\b/i.test(t),
          diceDictado: /dictado/i.test(t),
          diceAceptado: /lo aceptaste/i.test(t),
        }
      })
      await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-nota-${i}-sello-abierto.png`), fullPage: false })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    }

    notas.push({ indice: i, ...abierta, inspeccion, sello })
  }

  if (!acta.viewports[vp.nombre]) acta.viewports[vp.nombre] = { encuadre: null, notas }
  else acta.viewports[vp.nombre].notas = notas

  await contexto.close()

  /* ── Informe legible ───────────────────────────────────────────────────── */
  const v = acta.viewports[vp.nombre]
  console.log(`\n══════ ${vp.nombre} (${FASE}) ══════`)
  if (v.encuadre) {
    console.log(`Capa 4 montada: ${v.encuadre.huecoDeLente} · notas en el expediente: ${v.encuadre.notasEnElExpediente} · alto ${v.encuadre.alto}px`)
  }
  for (const n of v.notas) {
    console.log(`\nNOTA ${n.indice} — «${n.titulo ?? n.error}»`)
    console.log(`  bloque §21: ${n.bloqueDe21} · rótulo: ${n.rotulo ?? '(ninguno)'}`)
    console.log(`  sello: ${n.conSello} · «¿de dónde salió esto?»: ${n.conFuente}`)
    console.log(`  contra qué se contrasta: ${n.fuenteDicha ? `«${n.fuenteDicha.slice(0, 120)}»` : 'NO SE DICE'}`)
    if (n.inspeccion) {
      const a = n.inspeccion.antes, d = n.inspeccion.despues, e = n.inspeccion.trasEscape
      console.log(`  alto del expediente ${a.alto} → ${d.alto} (${d.alto - a.alto >= 0 ? '+' : ''}${d.alto - a.alto}px)`)
      console.log(`  el disparador se movió ${d.rect - a.rect}px · scroll ${a.scrollTop} → ${d.scrollTop} → ${e?.scrollTop}`)
      console.log(`  aria-expanded ${a.expandido} → ${d.expandido} · lentes abiertas ${d.lentesAbiertas}`)
      console.log(`  disparador tapado: ${d.disparadorTapado} · frases en el panel: ${d.frasesDelPanel}`)
      console.log(`  ESCAPE → cerró: ${e?.lentesAbiertas === 0} · foco vuelve: ${e?.focoEnElDisparador} · scroll exacto: ${a.scrollTop === e?.scrollTop}`)
      /* LA COMPROBACIÓN DEL OTRO LADO. */
      const t = d.textoDelPanel ?? ''
      const conMotor = t.includes(DIJO_EL_MOTOR)
      const conMedico = t.includes(ESCRIBIO_EL_MEDICO) && !conMotor
      console.log(`  EL PANEL ENSEÑA: ${conMotor ? `el ORIGINAL («${DIJO_EL_MOTOR}») ✓` : conMedico ? `el texto EDITADO («${ESCRIBIO_EL_MEDICO}») ✗ respaldo fabricado` : '(ninguno de los dos — nota sin original)'}`)
    }
    if (n.sello) {
      console.log(`  SELLO abierto: ${n.sello.abrio} · dice IA: ${n.sello.diceIA} · dice dictado: ${n.sello.diceDictado} · «lo aceptaste»: ${n.sello.diceAceptado}`)
    }
  }
}

console.log(`\nErrores de consola/página: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 12)) console.log(`  · ${e}`)

fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\nActa: ${path.join(DESTINO, `acta-${FASE}.json`)}`)

await navegador.close()
