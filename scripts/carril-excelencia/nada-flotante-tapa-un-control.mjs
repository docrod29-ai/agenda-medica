/**
 * NADA QUE FLOTA TAPA UN CONTROL — y si lo tapa, que haya sitio al que moverlo.
 *
 * Recorre cada ruta, lleva el scroll AL FINAL y pregunta, control por control,
 * quién hay encima de su centro. Si quien contesta vive dentro de un subárbol
 * `position: fixed` o `sticky` que **no contiene** al control, ese control está
 * tapado: un clic ahí lo recibe la cosa que flota.
 *
 * QUÉ LO TRAJO
 * ────────────
 * En `/dashboard` a 1440, con el aviso de notificaciones puesto, **dos botones
 * «Consulta»** —la acción primera de dos de las citas del día— quedaban debajo
 * de la hoja fija. Y no era una fila que pasa por debajo mientras uno se
 * desplaza: se llevó el scroll de `<main>` hasta el final (189 de 189) y **los
 * dos seguían tapados**. Era el final de la lista, sin sitio al que moverla.
 *
 * POR QUÉ EN LOS DOS EXTREMOS DEL SCROLL, Y NO EN REPOSO
 * ──────────────────────────────────────────────────────
 * Que una fila pase por debajo de una hoja fija mientras se desplaza es normal
 * y se arregla solo: se sigue desplazando. Lo que no tiene arreglo es quedarse
 * debajo **en el extremo**, porque ahí ya no queda scroll que dé.
 *
 * Y el extremo depende de dónde esté anclada la hoja. La primera versión de
 * este guion sólo miraba abajo del todo y acusó a cuatro barras SUPERIORES
 * (`.mobile-topbar`) de tapar controles: falso. Una barra de arriba tapa
 * mientras uno baja, y se libera **subiendo**; la que atrapa de verdad es la de
 * abajo, y sólo cuando ya no se puede bajar más. Así que:
 *
 *   · capa anclada ABAJO  → atrapa con el scroll AL FINAL
 *   · capa anclada ARRIBA → atrapa con el scroll AL PRINCIPIO
 *
 * Se mide en los dos extremos y se acusa sólo a la capa que corresponde.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · Sólo mira el **centro** del control. Uno tapado a medias —con el centro
 *   libre— no se cuenta; se vería pulsable y lo es, aunque se lea mal.
 * · Sólo cuenta lo que flota (`fixed`/`sticky`). Un elemento del flujo normal
 *   que se solape por un `margin` negativo no entra aquí.
 * · Lo que aparece por interacción: diálogos, menús, avisos que sólo salen
 *   después de pulsar algo. Se mide la pantalla al aterrizar.
 * · No juzga si la cosa que flota DEBERÍA estar ahí. Dice que tapa, no qué
 *   hacer: apartar el contenido y mover la hoja son dos arreglos distintos.
 */
import { chromium } from 'playwright'
import { conPortal } from './token-del-portal.mjs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const ANCHOS = (process.env.ANCHOS ?? '1440,390').split(',').map(Number)
const RUTAS = (process.env.RUTAS ?? [
  '/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas',
  '/operaciones', '/dashboard', '/pacientes', '/pendientes', '/configuracion',
  '/crm', '/reactivacion', '/resenas', '/membresias', '/farmacia',
  '/corte-caja', '/cumplimiento', '/cumplimiento/retencion', '/consultor',
  '/guia', '/consulta/pac-001', '/expediente/pac-001',
].join(',')).split(',')

const nav = await chromium.launch({ executablePath: CHROME })
let tapadosTotal = 0
/* Rutas que montaron y no pintaron un solo control: sin medir, no en cero. */
const rutasVacias = []
/* El aviso de «portal sin medir» se dice UNA vez, no una por ancho. */
let avisoPortalPendiente = true
let controlesTotal = 0

for (const ancho of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } })
  const pag = await ctx.newPage()
  await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  try {
    await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
  } catch {
    console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
    console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del arnés.\n')
    await nav.close()
    process.exit(2)
  }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)

  console.log(`\n  ── ${ancho}px ─────────────────────────────`)
  /**
   * EL PORTAL DEL PACIENTE TAMBIÉN. Aquí importa más que en ninguna otra
   * pantalla: el 30-ago el trinquete de interfaz cazó el botón flotante del
   * tema tapando el destino «Perfil» de la barra del paciente. Un control
   * tapado en el lado del médico se sortea; el paciente no sabe que hay algo
   * debajo.
   */
  const rutasDeEsteAncho = conPortal(RUTAS, { avisar: avisoPortalPendiente })
  avisoPortalPendiente = false
  for (const ruta of rutasDeEsteAncho) {
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await pag.waitForTimeout(4500)
    for (const t of [/^saltar$/i, /^entendido$/i]) {
      const b = pag.locator('button:visible').filter({ hasText: t }).first()
      if (await b.count().catch(() => 0)) {
        await b.click().catch(() => {})
        await pag.waitForTimeout(600)
      }
    }

    const estado = await pag.evaluate(() => ({
      main: !!document.querySelector('main'),
      texto: (document.body.innerText || '').slice(0, 120),
    })).catch(() => ({ main: false, texto: '' }))
    if (!estado.main) {
      console.error(
        /404|no encontrada/i.test(estado.texto)
          ? `  ROTA  ${ruta} — 404: esta ruta NO EXISTE. Corrige la lista, no el build.`
          : `  ROTA  ${ruta} — no montó <main> y no es un 404; casi seguro el servidor sirve un build viejo.`,
      )
      await nav.close()
      process.exit(2)
    }

    const mirar = async (extremo) => {
      await pag.evaluate((e) => {
        const m = document.querySelector('main')
        if (m) m.scrollTop = e === 'final' ? m.scrollHeight : 0
        window.scrollTo(0, e === 'final' ? document.body.scrollHeight : 0)
      }, extremo)
      await pag.waitForTimeout(900)
      return pag.evaluate((extremo) => {
      const flota = (e) => {
        for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
          const p = getComputedStyle(n).position
          if (p === 'fixed' || p === 'sticky') return n
        }
        return null
      }
      /** Dónde está anclada la capa: la de abajo atrapa al final, la de arriba
       *  al principio. Una que no toque ningún borde no atrapa en ningún
       *  extremo — se puede desplazar hacia los dos lados. */
      const ancla = (capa) => {
        const q = capa.getBoundingClientRect()
        /* 64px de margen, y no 12: la hoja del aviso de notificaciones vive a
           `bottom: 16px` y con 12 se quedaba FUERA de las dos categorías, así
           que el guardián la ignoraba — no cazaba el defecto que lo trajo.
           Se descubrió probándolo al revés, quitando el arreglo. 64 cubre los
           desplazamientos que usa este producto (8, 16, 24) más el área
           segura del teléfono. */
        if (innerHeight - q.bottom <= 64) return 'final'
        if (q.top <= 64) return 'principio'
        return null
      }
      /**
       * LO QUE SE VE DE VERDAD, NO LO QUE DICE EL RECTÁNGULO.
       *
       * `getBoundingClientRect()` devuelve dónde ESTARÍA el control aunque un
       * antepasado con `overflow` lo tenga recortado. En `/finanzas` la lista de
       * cobros es una caja de 480px con scroll propio: sus filas de más abajo
       * dicen estar en y=840 —justo donde está la barra inferior— y ahí no hay
       * nada dibujado. La primera versión de este guion las acusó de estar
       * tapadas por la barra. No lo estaban: estaban recortadas.
       *
       * Así que el rectángulo se corta contra el de cada antepasado que recorta.
       */
      const visible = (e) => {
        let r = e.getBoundingClientRect()
        let caja = { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
        for (let n = e.parentElement; n && n !== document.documentElement; n = n.parentElement) {
          const c = getComputedStyle(n)
          if (c.overflow === 'visible' && c.overflowY === 'visible' && c.overflowX === 'visible') continue
          const p = n.getBoundingClientRect()
          caja = {
            top: Math.max(caja.top, p.top),
            bottom: Math.min(caja.bottom, p.bottom),
            left: Math.max(caja.left, p.left),
            right: Math.min(caja.right, p.right),
          }
          if (caja.bottom <= caja.top || caja.right <= caja.left) return null
        }
        caja = {
          top: Math.max(caja.top, 0),
          bottom: Math.min(caja.bottom, innerHeight),
          left: Math.max(caja.left, 0),
          right: Math.min(caja.right, innerWidth),
        }
        if (caja.bottom - caja.top < 4 || caja.right - caja.left < 4) return null
        return caja
      }
      const tapados = []
      let vistos = 0
      /*
       * TODO EL DOCUMENTO, no sólo `<main>`.
       *
       * Este guion nació de un aviso que tapaba dos botones DENTRO del
       * contenido, y se quedó mirando ahí. El armazón —el riel, la barra, el
       * pie— no lo miraba, y ahí estaba el caso peor: en `/consultor`, la barra
       * de preguntas es `position: fixed; left: 0`, así que en escritorio se
       * comía los 89px de abajo del riel y dejaba «Ayuda» y «Cerrar sesión»
       * imposibles de pulsar. Lo encontró el arnés de estaticidad por
       * casualidad —el control salía mudo porque el `:hover` caía en la barra—,
       * no éste, que es el que debía.
       */
      for (const e of document.querySelectorAll('a,button,[role=button],input,select,textarea')) {
        if (e.offsetParent === null) continue
        const v = visible(e)
        if (!v) continue
        vistos++
        const cx = (v.left + v.right) / 2
        const cy = (v.top + v.bottom) / 2
        const enc = document.elementFromPoint(cx, cy)
        if (!enc || enc === e || e.contains(enc) || enc.contains(e)) continue
        const capa = flota(enc)
        if (!capa || capa.contains(e)) continue
        if (ancla(capa) !== extremo) continue
        const nombre = (typeof capa.className === 'string' && capa.className)
          ? '.' + capa.className.split(' ').filter(Boolean)[0]
          : capa.tagName
        tapados.push(`${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 34)} ← ${nombre}`)
      }
      return { tapados, vistos }
      }, extremo)
    }

    const abajo = await mirar('final')
    const arriba = await mirar('principio')
    const tapados = [
      ...abajo.tapados.map(t => t + ' (abajo del todo)'),
      ...arriba.tapados.map(t => t + ' (arriba del todo)'),
    ]

    controlesTotal += abajo.vistos
    tapadosTotal += tapados.length
    if (tapados.length) {
      console.log(`  TAPA  ${ruta} — ${tapados.length}`)
      tapados.forEach(t => console.log(`          · ${t}`))
    } else {
      /**
       * VACÍO NO ES CERO, TAMBIÉN AQUÍ.
       *
       * Una ruta que monta su `<main>` y no pinta un solo control imprimía
       * `ok /ruta (0)`: cero tapados sobre cero mirados. El número se veía
       * —no era silencioso— pero nada lo ponía en rojo, y la salvaguarda
       * global (menos de 100 en total) no la salva: ese cero se absorbe
       * entre las otras veintitantas.
       *
       * Hermana de la misma regla en `acuse-puntero`, y de la que salvó la
       * unidad 88 en los diálogos, donde «Cobrar» dijo «sin abrir, queda sin
       * medir» en vez de 0 y por eso se investigó.
       */
      if (abajo.vistos === 0) {
        console.log(`  VACÍA ${ruta} — montó y no pintó nada que pulsar: sin medir, no en cero`)
        rutasVacias.push(ruta)
      } else {
        console.log(`    ok  ${ruta} (${abajo.vistos})`)
      }
    }
  }
  await ctx.close()
}

await nav.close()

if (rutasVacias.length) {
  console.error(
    '\n  Rutas que montaron sin un solo control — eso no es «0 tapados», es «sin medir»:\n' +
    rutasVacias.map(r => '   · ' + r).join('\n') + '\n',
  )
  process.exit(1)
}

if (controlesTotal < 100) {
  console.error(`\n  Sólo se miraron ${controlesTotal} controles. No está midiendo.\n`)
  process.exit(2)
}

console.log(`\n  ${controlesTotal} controles mirados abajo del todo · tapados por algo que flota: ${tapadosTotal}`)
if (tapadosTotal) {
  console.error('\n  Hay controles que no se pueden pulsar: algo flotante los tapa y el scroll no los libera.\n')
  process.exit(1)
}
console.log('  Nada que flota tapa un control.\n')
