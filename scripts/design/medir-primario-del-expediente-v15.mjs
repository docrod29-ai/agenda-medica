/**
 * ¿CUÁNTO CUESTA LA FILA VACÍA DEL PRIMARIO DEL EXPEDIENTE?
 *
 * RTC-31 dejó una observación SIN tocar, a propósito: en `/expediente`,
 * «Nueva consulta» flota solo, alineado a la derecha, en una fila que por lo
 * demás está vacía. Se ve raro — pero «se ve raro» no es una medición, y
 * moverlo al ancla del paciente toca la rejilla móvil de V10-DEBT-006 y podría
 * competir con «Consulta sin cerrar — continuar». Antes de decidir, se mide.
 *
 * Qué mide, a 1440×900 y 390×844:
 *   · la altura REAL que consume la fila del primario (caja + márgenes);
 *   · cuánto espacio horizontal queda sin usar a su izquierda;
 *   · si el ancla del paciente tiene sitio libre en su propia fila;
 *   · si en ESE expediente hay un encuentro sin cerrar (o sea, si el primario
 *     tendría que convivir con «Consulta sin cerrar — continuar»);
 *   · dónde empieza la historia clínica, para saber qué se recupera.
 *
 * No cambia nada: sólo informa. La decisión se toma con el acta delante.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-primario-del-expediente-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc31-primario'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTES = ['pac-refugio-alcantara', 'pac-luzmaria-cervantes', 'pac-aurelio-dominguez']

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const errores = []
const medidas = {}

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))

  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }

  for (const pid of PACIENTES) {
    await page.goto(`${BASE}/expediente/${pid}`, { waitUntil: 'load' })
    await page.waitForTimeout(2600)
    const m = await page.evaluate(() => {
      const caja = el => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      }
      /* EL BOTÓN, ESTÉ DONDE ESTÉ. La primera pasada lo buscaba sólo dentro
         de `.exp-actions` — la fila que esta misma medición recomendó quitar—,
         así que la pasada de DESPUÉS informaba «?» en todo y no medía nada.
         Un instrumento que sólo sabe mirar el estado viejo no sirve para
         comprobar el cambio. Se busca por su nombre accesible. */
      const candidatos = [...document.querySelectorAll('button')]
        .filter(b => (b.textContent ?? '').trim().startsWith('Nueva consulta'))
      /* EL VISIBLE, NO EL PRIMERO. La acción existe en DOS sitios del ancla
         —fila del nombre en escritorio, bajo el aviso de alergias en el
         teléfono— y sólo uno se pinta por ancho. Coger el primero devolvía
         0×0 en móvil (el de escritorio, con display:none) y el arnés informaba
         que el botón medía cero. Tercera vez en esta rebanada que el defecto
         está en el instrumento. */
      const visibles = candidatos.filter(b => b.getBoundingClientRect().width > 0)
      const boton = visibles[0] ?? candidatos[0] ?? null
      const fila = document.querySelector('.exp-actions') ?? boton?.parentElement ?? null
      const contenedor = document.querySelector('.exp-actions')?.parentElement ?? boton?.parentElement ?? null
      const ancla = document.querySelector('.nx-patient-anchor')
      const filaDelAncla = ancla?.firstElementChild ?? null
      const nombre = ancla?.querySelector('.nx-ancla-nombre') ?? null
      const continuar = document.querySelector('.nx-anchor-continuar')
      const historia = document.querySelector('#spine-encuentros')
      const estilos = contenedor ? getComputedStyle(contenedor) : null
      return {
        primario: caja(boton),
        dondeVive: boton?.closest('.nx-patient-anchor') ? 'ancla' : boton ? 'fila propia' : 'no encontrado',
        /* INVARIANTE: el botón vive en dos sitios y NUNCA se pintan los dos.
           Dos primarios idénticos a la vez serían dos veces la misma acción. */
        copiasEnElDom: candidatos.length,
        copiasVisibles: visibles.length,
        /* ¿Se coló la acción ENTRE el paciente y sus alergias? En un ancho
           donde todo va en columna, el orden es la jerarquía. */
        avisoAntesQueLaAccion: (() => {
          const aviso = [...document.querySelectorAll('.nx-patient-anchor div')]
            .find(d => (d.textContent ?? '').includes('Alergias:'))
          if (!aviso || !boton) return null
          return Math.round(aviso.getBoundingClientRect().top) < Math.round(boton.getBoundingClientRect().top)
        })(),
        filaDelPrimario: caja(contenedor),
        /* El coste REAL incluye el margen inferior: es espacio que la fila
           reserva aunque no se vea. */
        margenInferior: estilos ? Math.round(parseFloat(estilos.marginBottom)) : null,
        anchoSinUsarALaIzquierda: (() => {
          const c = caja(contenedor); const b = caja(boton)
          return c && b ? b.x - c.x : null
        })(),
        filaDelAncla: caja(filaDelAncla),
        nombreDelPaciente: caja(nombre),
        /* ¿Queda sitio a la derecha del nombre en la fila del ancla? */
        huecoALaDerechaDelNombre: (() => {
          const f = caja(filaDelAncla); const n = caja(nombre)
          return f && n ? f.x + f.w - (n.x + n.w) : null
        })(),
        hayEncuentroSinCerrar: !!continuar,
        inicioDeLaHistoria: caja(historia)?.y ?? null,
        viewport: window.innerHeight,
      }
    })
    medidas[`${etiqueta}/${pid}`] = m
    console.log(
      `  ${etiqueta.padEnd(11)} ${pid.padEnd(24)} primario ${m.primario?.w ?? '?'}×${m.primario?.h ?? '?'} en ${m.dondeVive} · ` +
      `${m.copiasVisibles}/${m.copiasEnElDom} visible(s) · aviso de alergias antes: ${m.avisoAntesQueLaAccion} · hueco junto al nombre ${m.huecoALaDerechaDelNombre ?? '?'}px · ` +
      `encuentro sin cerrar: ${m.hayEncuentroSinCerrar ? 'SÍ' : 'no'} · historia a ${m.inicioDeLaHistoria ?? '?'}px de ${m.viewport}px`,
    )
    /* Una captura POR PACIENTE: la versión anterior sólo guardaba la del
       último del bucle, así que el caso más interesante —el que tiene un
       encuentro sin cerrar— no se veía nunca. */
    await page.screenshot({ path: path.join(DESTINO, `${pid}-${etiqueta}.png`) })
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de consola · acta en ${path.join(DESTINO, 'medicion.json')}`)
