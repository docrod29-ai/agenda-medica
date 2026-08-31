/**
 * EL TEMA CLARO TAMBIÉN CUENTA.
 *
 * El trinquete de interfaz mide 69 combinaciones —23 rutas × 3 anchos— y las
 * mide **todas en el mismo tema**. Este producto tiene dos, y sus tokens no son
 * los mismos: `--nexus` vale `#2AA5B5` en oscuro y `#12626E` en claro,
 * `--nexus-soft` cambia de alfa, y las superficies se invierten.
 *
 * Es decir: **la mitad de las decisiones de color de este producto no las estaba
 * mirando nadie desde este carril**. Y no es una preocupación teórica — el
 * historial del repositorio está lleno de defectos que sólo salían en claro:
 * «`--teal` de fondo daba 2.99:1 **en claro**», «con `--nexus` daba 2.93:1 —
 * axe, 390px».
 *
 * QUÉ COMPRUEBA
 * ─────────────
 *  1. **axe** (critical + serious) en las 22 rutas, a 1440 y a 390.
 *  2. **Que el foco se siga viendo**: el anillo es `--nexus`, y en claro es otro
 *     color sobre otro fondo. Que funcione en oscuro no dice nada del claro.
 *
 * LO QUE SE MIDIÓ EL 30-AGO-2026
 * ──────────────────────────────
 * A la primera salieron **dos defectos reales de contraste** que el tema por
 * defecto no enseñaba: `--text3` claro (`#6B6F75`) daba 4.46 : 1 sobre el crema
 * de los avisos en `/cumplimiento` y 4.33 : 1 sobre el tinte de la opción
 * elegida en `/asistente` — por debajo del 4.5 que pide AA. Con el token
 * corregido a `#63666B`: **44 combinaciones, axe 0, 0 de 91 campos sin foco**,
 * y lo mismo con `TEMA=auto`.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **El tema `auto` se mide con `TEMA=auto`** —se elige el modo automático y se
 *   le dice al navegador que el sistema pide claro—, pero **no en cada corrida**:
 *   el gasto se triplicaría. Conviene correrlo al tocar tokens de color.
 * · No repite en claro las demás sondas del carril —estaticidad, solapes,
 *   estados de carga—: son de estructura y no de color, y correrlas dos veces
 *   duplicaría el gasto sin cambiar el resultado. Si alguna vez un cambio de
 *   tema mueve una caja, esto no lo vería.
 * · axe no tiene regla de foco visible; por eso el segundo bloque existe.
 * · No compara capturas: no es una regresión visual, es una auditoría.
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const ANCHOS = (process.env.ANCHOS ?? '1440,390').split(',').map(Number)
/**
 * `light` fija el tema a mano. `auto` es el otro caso y **es el que más gente
 * tiene puesto sin saberlo**: no elige nada y manda el sistema operativo. Se
 * emula con `colorScheme` del navegador y sin escribir la llave, que es
 * exactamente lo que le pasa a quien nunca tocó el control del tema.
 */
const TEMA = process.env.TEMA ?? 'light'
const AUTO = TEMA === 'auto'

const RUTAS = (process.env.RUTAS ?? [
  '/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas',
  '/operaciones', '/dashboard', '/pacientes', '/pendientes', '/configuracion',
  '/crm', '/reactivacion', '/resenas', '/membresias', '/farmacia',
  '/corte-caja', '/cumplimiento', '/cumplimiento/retencion', '/consultor',
  '/guia', '/consulta/pac-001', '/expediente/pac-001',
].join(',')).split(',')

const nav = await chromium.launch({ executablePath: CHROME })
let violaciones = 0
let mudos = 0
let campos = 0
let medidas = 0

for (const ancho of ANCHOS) {
  const ctx = await nav.newContext({
    viewport: { width: ancho, height: 900 },
    // En `auto` se le dice al navegador que el sistema pide claro; el producto
    // lo recoge por `prefers-color-scheme` y no por la llave.
    ...(AUTO ? { colorScheme: 'light' } : {}),
  })
  /**
   * El tema se deja puesto ANTES de la primera pintada: el `layout` lleva un
   * script anti-parpadeo que lee esta llave y pone `data-theme`.
   *
   * Y en `auto` **también se escribe la llave**. La primera versión la borraba,
   * creyendo que «sin preferencia» era lo mismo que «automático». No lo es, y el
   * producto lo dice con todas las letras: sin nada guardado pinta OSCURO, que
   * es la identidad de la marca; `auto` sólo se alcanza eligiéndolo. Lo cazó la
   * comprobación de aquí abajo, que para eso está.
   */
  await ctx.addInitScript(t => { try { localStorage.setItem('nexusmed.theme', t) } catch {} }, TEMA)
  const pag = await ctx.newPage()

  await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  try {
    await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
  } catch {
    console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
    console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del arnés.\n')
    await nav.close(); process.exit(2)
  }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)

  /**
   * Y SE COMPRUEBA QUE EL TEMA QUEDÓ PUESTO, porque la primera versión de este
   * guion no lo hacía y midió el tema oscuro dos veces llamándolo claro: ponía
   * la llave con `process.env` DENTRO del navegador, donde `process` no existe,
   * la función lanzaba y el `catch` se lo tragaba. Cero violaciones, y era falso.
   */
  const estado = await pag.evaluate(() => ({
    atributo: document.documentElement.getAttribute('data-theme'),
    fondo: getComputedStyle(document.body).backgroundColor,
  }))
  const claroDeVerdad = /^rgb\((2[0-9]{2}|1[89][0-9]),/.test(estado.fondo)
  const bien = AUTO ? (estado.atributo === null && claroDeVerdad) : estado.atributo === TEMA
  if (!bien) {
    console.error(`\n  El tema no quedó puesto: se pidió «${TEMA}» y \`data-theme\` dice `
      + `«${estado.atributo}» con fondo ${estado.fondo}. Medir así sería medir otro tema y llamarlo éste.\n`)
    await nav.close(); process.exit(2)
  }
  console.log(`\n  ── ${ancho}px · tema ${TEMA} ──────────────────`)

  for (const ruta of RUTAS) {
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await pag.waitForTimeout(5000)
    for (const t of [/^saltar$/i, /^entendido$/i]) {
      const b = pag.locator('button:visible').filter({ hasText: t }).first()
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(600) }
    }

    await pag.evaluate(AXE)
    const malas = await pag.evaluate(async () => {
      const res = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      })
      return res.violations
        .filter(v => v.impact === 'critical' || v.impact === 'serious')
        .map(v => `${v.impact} ${v.id} ×${v.nodes.length} · ${(v.nodes[0]?.failureSummary || '').split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 130)}`)
    })

    // Y el foco, que axe no mira.
    const n = await pag.evaluate(() => {
      let i = 0
      document.querySelector('main')?.querySelectorAll('textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select').forEach(e => {
        if (!e.getBoundingClientRect().width || e.offsetParent === null) return
        e.dataset.focoClaro = 'f' + (i++)
      })
      return i
    })
    const foto = (e) => {
      const c = getComputedStyle(e)
      return [c.outlineWidth, c.outlineStyle, c.boxShadow, c.borderColor, c.backgroundColor].join('|')
    }
    let sinFoco = 0
    for (let i = 0; i < n; i++) {
      const el = pag.locator(`[data-foco-claro="f${i}"]`)
      try {
        const antes = await el.evaluate(foto)
        await el.evaluate(e => e.focus())
        await pag.waitForTimeout(110)
        if (antes === await el.evaluate(foto)) sinFoco++
        await el.evaluate(e => e.blur())
      } catch { /* se fue del árbol */ }
    }

    violaciones += malas.length
    mudos += sinFoco
    campos += n
    medidas++
    const mal = malas.length || sinFoco
    console.log(`  ${(mal ? 'FALLA' : '  ok ')} ${ruta.padEnd(24)} axe ${malas.length} · foco ${sinFoco}/${n}`)
    malas.forEach(v => console.log('        · ' + v))
  }
  await ctx.close()
}

await nav.close()

if (medidas < RUTAS.length * ANCHOS.length) {
  console.error(`\n  Sólo se midieron ${medidas} combinaciones. No está midiendo.\n`)
  process.exit(2)
}
console.log(`\n  ${medidas} combinaciones en tema ${TEMA} · axe ${violaciones} · campos sin foco ${mudos} de ${campos}`)
if (violaciones || mudos) {
  console.error(`\n  El tema ${TEMA} tiene defectos que el tema por defecto no enseñaba.\n`)
  process.exit(1)
}
console.log(`  El tema ${TEMA} está tan limpio como el otro.\n`)
