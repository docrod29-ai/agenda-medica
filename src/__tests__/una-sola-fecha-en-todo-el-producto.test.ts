/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * MEDIDO el 1-sep-2026 sobre el árbol entero: SIETE pantallas de cara al médico
 * imprimían la fecha en ISO crudo —`2026-09-01`, el formato en que la base la
 * guarda— y había seis o más especificaciones de formato distintas para la misma
 * clase de hecho.
 *
 * En el expediente longitudinal convivían TRES en el mismo pliegue:
 *
 *   «última visita 01 sep 2026»   ← `{ day: '2-digit', month: 'short' }`
 *   «· desde 1 sep 2026»          ← `{ dateStyle: 'medium' }`
 *   «· desde el 2026-09-01»       ← `.slice(0, 10)`
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando el expediente en el navegador y leyendo dos renglones seguidos que
 * decían la misma fecha de dos maneras. Después se contó en el árbol.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Dos formas y ninguna más, en un módulo: `fechaCorta` y `fechaConHora`. Ningún
 * renglón de cara al médico enseña un ISO.
 *
 * Y el guardián busca la FAMILIA, no una ortografía: cualquier `.slice(0, 10)`
 * interpolado dentro de JSX, con o sin espacios. La lección viene de la unidad
 * 92, donde mi primer guardián pedía la ortografía exacta que ya había visto y
 * dejó pasar la misma copia escrita de otra forma.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Los usos TÉCNICOS de `slice(0, 10)` son legítimos y quedan fuera por lista
 *   explícita: nombres de archivo de exportación, construir un `datetime-local`,
 *   y un identificador de referencia recortado. Se nombran uno por uno para que
 *   añadir uno nuevo sea una decisión y no un descuido.
 * · No vigila las fechas dentro de documentos imprimibles (receta, nota Word):
 *   ésos tienen su propio formato legal y no se tocan aquí.
 * · No cuenta formatos en el navegador: cuenta lo que el código puede producir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fechaCorta, fechaConHora } from '@/lib/formato/fecha'

describe('el producto enseña la fecha de una sola forma', () => {
  it('«1 sep 2026», sin cero a la izquierda', () => {
    /*
     * Se fija la FORMA, no la cadena. La abreviatura del mes la decide el ICU
     * del entorno —«sep» en este Node, «sept» en algunos navegadores— y clavar
     * la cadena exacta haría un guardián que falla al actualizar Node sin que
     * nada del producto haya cambiado. Lo que importa es que no lleve cero a la
     * izquierda, que lleve el año y que NO sea un ISO.
     */
    const f = fechaCorta('2026-09-01')
    expect(f).toMatch(/^1 \S+ 2026$/)
    expect(f).not.toMatch(/^01 /)
    expect(f).not.toMatch(/^\d{4}-/)
  })

  it('un ISO completo da lo mismo que un `YYYY-MM-DD`', () => {
    expect(fechaCorta('2026-09-01T23:30:00.000Z')).toBe(fechaCorta('2026-09-01'))
  })

  it('`YYYY-MM-DD` NO retrocede un día por la zona horaria', () => {
    // Sin el mediodía, `new Date('2026-09-01')` es UTC y en México cae el 31.
    expect(fechaCorta('2026-09-01')).toContain('1 ')
    expect(fechaCorta('2026-01-01')).toContain('1 ')
  })

  it('lo que no es una fecha devuelve vacío, no «Invalid Date» ni el ISO', () => {
    for (const malo of ['', '   ', 'no-es-fecha', null, undefined]) {
      expect(fechaCorta(malo)).toBe('')
      expect(fechaConHora(malo)).toBe('')
    }
  })

  it('con hora, cuando la hora es parte del hecho', () => {
    expect(fechaConHora('2026-09-01T12:00:00')).toMatch(/^1 \S+ 2026,/)
    expect(fechaConHora('2026-09-01T12:00:00')).toMatch(/\d{2}:\d{2}/)
  })

  /**
   * LA CONEXIÓN: que nadie vuelva a enseñar un ISO. Es lo que fallaba, y es lo
   * único que una prueba de fuente puede sostener de verdad.
   */
  it('ninguna pantalla del médico interpola un ISO crudo', () => {
    /** Usos técnicos legítimos, nombrados uno a uno: añadir otro es una decisión. */
    const PERMITIDOS = new Set([
      'src/app/(dashboard)/configuracion/page.tsx',      // arma un `datetime-local`
      'src/app/(dashboard)/migracion/page.tsx',          // nombre de archivo de exportación
      'src/app/pago/exito/page.tsx',                     // identificador de referencia, no una fecha
      'src/app/api/clinic/exportar/route.ts',            // nombre de archivo del respaldo
      'src/app/api/clinic/exportar-csv/route.ts',        // nombre de archivo del respaldo
      'src/app/api/clinic/exportar-excel/route.ts',      // nombre de archivo del respaldo
      'src/hooks/useAppointments.ts',                    // clave de agenda `YYYY-MM-DD HH:mm`, no texto de pantalla
      'src/lib/clinica/descargar-respaldo.ts',           // nombre de archivo del respaldo
      'src/app/superadmin/planes/page.tsx',              // consola del dueño, no pantalla del médico
      'src/lib/fhir/recursos.ts',                        // FHIR EXIGE `birthDate` en ISO
      'src/lib/google-calendar.ts',                      // arma el `datetime` de la API de Google
      'src/lib/clinica/simulacro.ts',                    // título del acta de mantenimiento, no pantalla clínica
      'src/lib/formato/fecha.ts',                        // el propio módulo
    ])
    const raiz = join(__dirname, '..', '..')
    const malos: string[] = []
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) { if (e !== 'node_modules' && e !== '__tests__') recorrer(p); continue }
        if (!/\.tsx?$/.test(e)) continue
        const rel = p.slice(raiz.length + 1)
        if (PERMITIDOS.has(rel)) continue
        const src = readFileSync(p, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
        // La FAMILIA, no una ortografía: `{ … .slice(0, 10) }` interpolado en JSX,
        // con o sin espacios, que es como se enseña un ISO sin querer.
        for (const l of src.split('\n')) {
          if (/\.slice\(\s*0\s*,\s*10\s*\)\s*\}/.test(l)) malos.push(`${rel}: ${l.trim().slice(0, 90)}`)
        }
      }
    }
    recorrer(join(raiz, 'src'))
    expect(malos, `Estas líneas enseñan una fecha ISO al médico. Usa \`fechaCorta\` de `
      + `\`@/lib/formato/fecha\`, o añade el archivo a PERMITIDOS si el uso es técnico:\n  `
      + malos.join('\n  ')).toEqual([])
  })
})
