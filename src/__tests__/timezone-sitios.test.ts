import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * GUARDIÁN DE ZONA HORARIA — hallazgo confirmado de la auditoría del 26-jul.
 *
 * Las funciones de `src/lib/timezone.ts` aceptan la zona del consultorio, pero
 * **32 llamadas no se la pasaban** y caían al default. Para Hermosillo (UTC-7) o
 * Tijuana (UTC-8) —zonas que la propia interfaz ofrece— eso corre 1-2 h los
 * recordatorios, el corte de caja y la validación de «no agendar en el pasado».
 *
 * Y es SILENCIOSO: nadie ve un error, sólo citas y mensajes a deshora.
 *
 * ── POR QUÉ UN CONTADOR Y NO UN CERO ─────────────────────────────────────────
 *
 * Hacer `tz` obligatoria rompe las 32 de golpe, y arreglarlas a ciegas —moviendo
 * declaraciones en diez páginas de producción— es justo como se introduce una
 * regresión. Lo intenté, vi el destrozo y lo revertí.
 *
 * Así que esto es un **trinquete**: el número sólo puede BAJAR. Cada llamada que
 * se arregle debe bajar el tope; una llamada nueva sin zona rompe la suite.
 *
 * Cuando llegue a 0, `tz` pasa a ser obligatoria en la firma y este archivo se
 * borra.
 */

const RAIZ = join(process.cwd(), 'src')
/** Llamadas sin zona. Sólo puede BAJAR. */
const TOPE = 43

const OMITIR = ['__tests__', 'node_modules']

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

/** Llamadas a las funciones de zona SIN pasarle la zona del consultorio. */
function sitiosSinZona(): string[] {
  const sitios: string[] = []
  for (const p of archivos(RAIZ)) {
    const src = readFileSync(p, 'utf8')
    src.split('\n').forEach((linea, i) => {
      if (linea.trimStart().startsWith('*') || linea.trimStart().startsWith('//')) return
      // Heurística por LÍNEA, no por conteo de argumentos: `slice(0, 10)` dentro
      // de la llamada rompe cualquier regex que cuente comas, y contarlo mal daba
      // un falso positivo en una línea que SÍ pasaba la zona.
      const llama = /\b(hoyISO|ahoraMinutosDelDia|fechaISOLocal|instanteMX|yaPaso)\(/.test(linea)
      const traeZona = /tzClinica|zonaHoraria|TZ_DEFAULT|\btz\b/.test(linea)
      if (llama && !traeZona) {
        sitios.push(`${p.replace(process.cwd() + '/', '')}:${i + 1}`)
      }
    })
  }
  return sitios
}

describe('zona horaria · trinquete de llamadas sin zona', () => {
  const sitios = sitiosSinZona()

  it(`no crece: como mucho ${TOPE} llamadas sin la zona del consultorio`, () => {
    expect(sitios.length, `Llamadas sin zona:\n${sitios.join('\n')}`).toBeLessThanOrEqual(TOPE)
  })

  it('el escáner NO pasa por vacío', () => {
    // Si el walker se rompe, la lista queda en 0 y el test de arriba pasa sin
    // comprobar nada. Mientras queden sitios, tiene que verlos.
    expect(archivos(RAIZ).length).toBeGreaterThan(100)
  })

  it('el cron de recordatorios ya NO está en la lista', () => {
    // Era el peor caso: `instanteMX` recibía la zona del consultorio y `hoyISO()`
    // tres líneas más abajo no, en la misma iteración.
    expect(sitios.filter(s => s.includes('cron/reminders'))).toEqual([])
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
