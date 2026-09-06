/**
 * EL TELÉFONO MEDIDO EN EL NAVEGADOR — las 28 pantallas del panel, a 390 px.
 *
 * ES EL NAVEGADOR QUE EL OTRO DECLARA QUE NO ES
 * ─────────────────────────────────────────────
 * `scripts/calidad/cabe-en-un-telefono.mjs` barre el CÓDIGO FUENTE buscando lo
 * que un teléfono no puede encoger —anchos fijos, suelos de `minmax`, columnas
 * clavadas en píxeles— y su propia cabecera avisa, con razón, de que **no
 * sustituye al navegador: acota**. Éste es el navegador. No lo reemplaza: lo
 * completa, y por eso lleva otro nombre.
 *
 * Y hacía falta: las rejillas que rompieron Finanzas eran `1.1fr 1fr 1fr` y
 * `1fr 1fr` —ni un píxel clavado, ni un `minmax` con suelo—, así que ninguna
 * de las cuatro clases que aquel barrido vigila las podía ver. Sólo se ven
 * pintadas.
 *
 * Dos preguntas DISTINTAS, que la primera versión de esta sonda confundió:
 *
 *  A · ARRASTRE LATERAL — algún contenedor de scroll acaba con más contenido
 *      que ancho, así que hay pantalla que sólo se alcanza arrastrando de
 *      lado. En un teléfono nadie descubre ese gesto si nada lo anuncia.
 *
 *  B · RECORTE MUDO — un texto se corta sin puntos suspensivos que lo digan.
 *      Con ellipsis el recorte está DECLARADO y el elemento sigue teniendo
 *      scrollWidth > clientWidth: eso es correcto. Medirlo como desborde fue
 *      el error de la primera versión, que sacó en rojo a /reactivacion
 *      teniendo la truncación bien puesta.
 *
 * QUÉ LO TRAJO
 * ────────────
 * `/finanzas` YA estaba en la lista del `trinquete-de-interfaz`, YA se medía a
 * 390 px, y su contador de desborde salía verde corrida tras corrida. Porque
 * preguntaba sólo `document.documentElement.scrollWidth`, y el documento no se
 * desbordaba: `<main>` lleva `overflow-x: auto` y se tragaba 295 px —la
 * tarjeta de Transferencia entera, con su importe— detrás de un arrastre
 * lateral. Un guardián que pregunta del lado equivocado de la frontera es un
 * guardián en verde sin nada vigilado. Ese contador ya está arreglado; esta
 * sonda es la que lo encontró y la que mira además el recorte mudo.
 *
 * En la primera corrida completa: 2 pantallas, 2 arrastres, 10 recortes mudos.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo Chromium.** No hay WebKit en este entorno: esto NO prueba iPhone.
 * · Sólo el ancho. Lo que se sale por abajo, o lo que queda tapado por algo
 *   que flota, lo miran `nada-flotante-tapa-un-control` y los suyos.
 * · Sólo el panel del médico con los datos del arnés. Otros datos —un nombre
 *   más largo, veinte cobros— pueden sacar pantallas que hoy caben.
 * · No juzga si lo que cabe se LEE. Que quepa no es que se entienda.
 * · No entra en pantallas que piden un id (consulta, expediente): esas las
 *   mide el trinquete de interfaz con su paciente sembrado.
 */
import { chromium } from 'playwright'

const RUTAS = process.argv[2]
  ? process.argv[2].split(',')
  : ['citas','dashboard','pacientes','finanzas','corte-caja','crm','lista-espera','pendientes',
     'expedientes','consultor','calendario','chat','configuracion','farmacia','operaciones',
     'resenas','reactivacion','membresias','cumplimiento','legal','guia','motores','referencia',
     'antibiograma','asistente','migracion','hospitalizacion','uci']

const B = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const b = await chromium.launch({ executablePath: B })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
await p.goto(BASE + '/login')
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL(/dashboard|citas/, { timeout: 30000 })
// El tour de bienvenida tapa la pantalla; se salta antes de medir o retratar.
// 'Saltar' lo llevan DOS botones (el aria-label de la ✕ y el de texto):
// sin .first() el localizador es ambiguo y el catch se tragaba el fallo.
try {
  await p.getByRole('button', { name: 'Saltar', exact: true }).first().click({ timeout: 6000 })
  await p.waitForSelector('text=BIENVENIDO A AUSCULTA', { state: 'detached', timeout: 6000 })
} catch {}

let totalA = 0, totalB = 0
const rotos = []
for (const r of RUTAS) {
  try {
    await p.goto(BASE + '/' + r, { timeout: 25000 })
    await p.waitForTimeout(1800)
    const d = await p.evaluate(() => {
      // ¿LLEGÓ LA HOJA DE ESTILO? Reconstruir bajo un `next start` en marcha
      // deja el chunk del CSS en 404: la página se pinta sin estilo, el menú
      // lateral de escritorio aparece a 390 px y TODAS las rutas salen en rojo.
      // Pasó justo aquí, y el trinquete de interfaz ya llevaba escrita esta
      // misma comprobación por lo mismo. Medir una página sin estilo no da un
      // número malo: da un número que no es de este producto.
      const hojas = [...document.styleSheets].filter(h => {
        try { return h.cssRules.length > 20 } catch { return false }
      }).length
      if (hojas === 0) return { sinEstilo: true, arrastre: [], mudos: [] }
      const arrastre = [], mudos = []
      const doc = document.documentElement
      if (doc.scrollWidth > doc.clientWidth + 1)
        arrastre.push({ q: 'documento', cw: doc.clientWidth, sw: doc.scrollWidth, txt: '' })
      for (const e of document.querySelectorAll('main, main *')) {
        const cs = getComputedStyle(e)
        if (cs.position === 'fixed' || e.clientWidth <= 1) continue
        const ex = e.scrollWidth - e.clientWidth
        if (ex <= 1) continue
        const txt = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
        const q = e.tagName + '.' + (e.className || '').toString().slice(0, 30)
        // A · ¿este contenedor DEJA arrastrar? entonces hay contenido escondido
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll')
          arrastre.push({ q, cw: e.clientWidth, sw: e.scrollWidth, txt })
        // B · ¿se corta sin decirlo? sólo cuenta si el recorte no está declarado
        else if (cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis' && e.children.length === 0 && txt)
          mudos.push({ q, cw: e.clientWidth, sw: e.scrollWidth, txt })
      }
      return { arrastre, mudos }
    })
    if (d.sinEstilo) {
      console.error(`\n  /${r}: la página cargó SIN hoja de estilo. Para el servidor, borra .next, construye, arranca y vuelve a medir.\n`)
      process.exit(2)
    }
    totalA += d.arrastre.length; totalB += d.mudos.length
    if (d.arrastre.length || d.mudos.length) {
      rotos.push(r)
      console.log(`✗ /${r}  arrastre:${d.arrastre.length}  recorte mudo:${d.mudos.length}`)
      for (const c of d.arrastre.slice(0, 2)) console.log(`    ARRASTRE ${c.q} ${c.cw}→${c.sw} «${c.txt}»`)
      for (const c of d.mudos.slice(0, 3)) console.log(`    MUDO     ${c.q} ${c.cw}→${c.sw} «${c.txt}»`)
    } else console.log(`· /${r}  cabe`)
  } catch (e) { console.log(`? /${r}  ${String(e).split('\n')[0].slice(0, 70)}`) }
}
console.log(`\n═══ 390px · arrastre lateral ${totalA} · recorte mudo ${totalB} · pantallas ${rotos.length}: ${rotos.join(' ') || '(ninguna)'} ═══`)
await b.close()
