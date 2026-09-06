import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * GUARDIÁN DE ZONA HORARIA — hallazgo confirmado de la auditoría del 26-jul.
 *
 * Las funciones de `src/lib/timezone.ts` aceptaban la zona del consultorio pero
 * **43 llamadas no se la pasaban** y caían a México central. Para Hermosillo
 * (UTC-7) o Tijuana (UTC-8) —zonas que la propia interfaz ofrece— eso corre 1-2 h
 * los recordatorios, el corte de caja y la validación de «no agendar en el
 * pasado». Y es SILENCIOSO: nadie ve un error, sólo citas a deshora.
 *
 * ── POR QUÉ ESTE ARCHIVO CAMBIÓ DE MEDIDA (30-jul-2026) ──────────────────────
 *
 * Antes contaba «llamadas sin argumento `tz`» y llevaba un trinquete en 43. Esa
 * medida servía cuando el valor por omisión era una constante quemada. Ya no lo
 * es: `hoyISO()` cae en `zonaActiva()`, que **en el navegador devuelve la zona
 * del consultorio** en cuanto la configuración se publica.
 *
 * Seguir contando llamadas sin argumento mediría la forma, no el riesgo. Lo que
 * de verdad hay que impedir es lo que se comprueba aquí:
 *
 *   1. Que NINGÚN código de servidor dependa del valor por omisión. Ahí no hay
 *      «zona actual»: una función de Vercel atiende a muchos consultorios.
 *   2. Que la zona NUNCA se publique desde el servidor, porque una variable de
 *      módulo se compartiría entre peticiones de consultorios distintos.
 *
 * En el cliente el valor por omisión ya es correcto, así que sus llamadas se
 * cuentan y se informan, pero no fallan.
 */

const RAIZ = join(process.cwd(), 'src')
const OMITIR = ['__tests__', 'node_modules']

const FUNCIONES = /\b(hoyISO|ahoraMinutosDelDia|fechaISOLocal|instanteMX|yaPaso)\(/
const TRAE_ZONA = /tzClinica|zonaHoraria|TZ_DEFAULT|zonaActiva|\btz\b/

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (OMITIR.includes(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...archivos(p))
    else if (/\.tsx?$/.test(e) && !p.endsWith('lib/timezone.ts')) out.push(p)
  }
  return out
}

/** ¿La línea es comentario? Incluye `/**`, que la versión anterior no veía. */
function esComentario(linea: string): boolean {
  const t = linea.trimStart()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

const rel = (p: string) => p.replace(process.cwd() + '/', '')
const esServidor = (ruta: string) => ruta.startsWith('src/app/api/')

/** Llamadas que dependen del valor por omisión. */
function sitiosSinZona(filtro?: (ruta: string) => boolean): string[] {
  const sitios: string[] = []
  for (const p of archivos(RAIZ)) {
    const r = rel(p)
    if (filtro && !filtro(r)) continue
    readFileSync(p, 'utf8').split('\n').forEach((linea, i) => {
      if (esComentario(linea)) return
      // Heurística por LÍNEA, no por conteo de argumentos: `slice(0, 10)` dentro
      // de la llamada rompe cualquier regex que cuente comas.
      if (FUNCIONES.test(linea) && !TRAE_ZONA.test(linea)) sitios.push(`${r}:${i + 1}`)
    })
  }
  return sitios
}

describe('zona horaria · el servidor no puede caer al valor por omisión', () => {
  it('ninguna ruta de API depende de la zona por omisión', () => {
    /**
     * En el servidor `zonaActiva()` devuelve SIEMPRE `TZ_DEFAULT`: publicar una
     * zona ahí sería compartirla entre peticiones de consultorios distintos. Así
     * que cada ruta tiene que ir a buscar `config.zonaHoraria`, o escribir
     * `TZ_DEFAULT` a la vista de quien lea el código.
     */
    const malos = sitiosSinZona(esServidor)
    expect(malos, `Rutas de API sin la zona del consultorio:\n${malos.join('\n')}`).toEqual([])
  })

  it('la zona NUNCA se publica desde el servidor', () => {
    // `fijarZonaConsultorio` ya se protege sola (comprueba `window`), pero una
    // llamada en el servidor sería una intención equivocada aunque no hiciera daño.
    const enServidor = archivos(RAIZ).map(rel).filter(esServidor)
      .filter(r => /fijarZonaConsultorio/.test(readFileSync(join(process.cwd(), r), 'utf8')))
    expect(enServidor).toEqual([])
  })

  it('el cron de recordatorios sigue pasando la zona de cada consultorio', () => {
    // Era el peor caso: `instanteMX` recibía la zona del consultorio y `hoyISO()`
    // tres líneas más abajo no, en la misma iteración.
    expect(sitiosSinZona(r => r.includes('cron/reminders'))).toEqual([])
  })

  it('las horas de silencio se calculan POR consultorio', () => {
    // Estaban fuera del bucle: un solo valor decidía la ventana de silencio para
    // todas las clínicas a la vez.
    const cron = readFileSync(join(RAIZ, 'app/api/cron/reminders/route.ts'), 'utf8')
    const iTz = cron.indexOf('const tzClinica')
    const iMin = cron.indexOf('const minMx')
    expect(iTz).toBeGreaterThan(-1)
    expect(iMin).toBeGreaterThan(iTz)
  })
})

describe('zona horaria · el escáner no pasa por vacío', () => {
  it('ve el árbol completo', () => {
    expect(archivos(RAIZ).length).toBeGreaterThan(100)
  })

  it('ve rutas de API', () => {
    // Si el filtro de servidor dejara de casar, el test de arriba pasaría sin
    // comprobar absolutamente nada.
    expect(archivos(RAIZ).map(rel).filter(esServidor).length).toBeGreaterThan(20)
  })

  it('CONTROL POSITIVO: detecta una llamada sin zona y respeta una con zona', () => {
    const detecta = (linea: string) => FUNCIONES.test(linea) && !TRAE_ZONA.test(linea)
    expect(detecta('  const hoy = hoyISO()')).toBe(true)
    expect(detecta('  const d = instanteMX(fecha, hora)')).toBe(true)
    expect(detecta('  const hoy = hoyISO(config.zonaHoraria || TZ_DEFAULT)')).toBe(false)
    expect(detecta('  const hoy = hoyISO(tzClinica)')).toBe(false)
    expect(detecta('  const hoy = hoyISO(tz)')).toBe(false)
    // Y no confunde un comentario con código: la versión anterior contaba dos
    // líneas de JSDoc de `whatsapp/proactivo.ts` como llamadas reales.
    expect(esComentario('   * hoyISO() en MX. Si se da, se respeta el tope.')).toBe(true)
    expect(esComentario('  /** hoyISO() en MX */')).toBe(true)
  })
})

describe('zona horaria · el cliente ya recibe la zona del consultorio', () => {
  it('sus llamadas sin argumento son correctas por el valor por omisión', () => {
    /**
     * Se informan, no fallan: `zonaActiva()` les da la zona del consultorio en
     * cuanto `useConfig` la publica, y desde la segunda carga del navegador la
     * tienen ya en el primer render.
     *
     * El tope existe para que el número esté A LA VISTA y no se confunda «no
     * falla» con «aquí no hay nada».
     */
    /**
     * 40 → 43 (Panel de Lujo, C-015, sep-2026). Los tres nuevos son la fecha
     * del NOMBRE DE ARCHIVO de la receta, la orden y la carta de referencia, y
     * la de los dos exportadores a Word. No son deuda nueva: **sustituyen** a
     * `new Date().toISOString().slice(0, 10)`, que daba el día en UTC y fechaba
     * los archivos con el día de mañana a partir de las 18:00 en México. Pasar
     * de UTC a la zona del consultorio es exactamente lo que este guardián
     * quiere; el contador sube porque ahora esas líneas EXISTEN como llamadas.
     */
    /**
     * 43 → 45 (Panel de Lujo, sep-2026). Por el mismo motivo, y comprobado uno
     * por uno contra el árbol anterior:
     *
     * · `FotosClinicas` estrena la FECHA DE LA TOMA (MO-008). Antes la foto se
     *   fechaba con `new Date().toISOString()` —el instante de la SUBIDA, en
     *   UTC—, así que una foto tomada el lunes por la tarde y subida a las
     *   19:30 de México quedaba fechada el martes. Ahora la fecha se pide, y
     *   por omisión es hoy EN LA ZONA DEL CONSULTORIO.
     * · La devolución de un cobro (rebanada DINERO) sella su `dia` con
     *   `fechaISOLocal`, igual que ya hacía el cobro original.
     *
     * Ninguna es deuda: las dos llaman a funciones cuyo valor por omisión ES
     * `zonaActiva()`. Suben el contador porque el contador cuenta llamadas sin
     * argumento explícito, y eso es justo lo que se quiere tener a la vista.
     */
    const cliente = sitiosSinZona(r => !esServidor(r))
    expect(cliente.length).toBeGreaterThan(0)
    expect(cliente.length, `Llamadas de cliente:\n${cliente.join('\n')}`).toBeLessThanOrEqual(45)
  })
})
