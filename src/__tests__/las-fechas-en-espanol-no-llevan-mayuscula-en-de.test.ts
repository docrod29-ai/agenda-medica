/**
 * GOLDEN — «31 de agosto», no «31 De Agosto».
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `text-transform: capitalize` pone mayúscula en la primera letra de CADA
 * palabra: es la regla del inglés. En español, dentro de una frase, las
 * preposiciones van en minúscula. Ocho pantallas pintaban fechas con esa regla:
 *
 *   · portal de reserva     «Lun 31 De Ago»          (las doce fichas del día)
 *   · portal del asistente  «Agosto De 2026», «Domingo, 30 De Agosto»
 *   · calendario            la etiqueta del rango
 *   · finanzas              la etiqueta del periodo
 *   · chat                  el separador de fecha
 *   · portal del PACIENTE   el día de su cita, y «Primera Vez · Solicitada»
 *
 * ── LO QUE HACE ESTE DEFECTO ESPECIAL ───────────────────────────────────────
 *
 * Ya estaba fichado y ya estaba arreglado… en UNA pantalla. El comentario de
 * `citas/page.tsx` lo dice con todas las letras: «Mayúscula SÓLO la primera
 * letra — `text-transform: capitalize` produce "Domingo 9 De Agosto De 2026",
 * el mismo defecto ya fichado en calendario ("De Agosto", Visual DNA §6 nº18)».
 *
 * O sea: alguien lo vio, lo entendió, lo arregló donde estaba mirando, escribió
 * dónde más pasaba… y ahí se quedó. Saberlo y arreglarlo no son lo mismo, y por
 * eso esto es una prueba y no una nota. Familia «depende de que alguien se
 * acuerde».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando el portal de reserva en un navegador real, y otra vez el del
 * asistente. En una captura se lee sin buscarlo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - `capitalize` sobre una palabra SUELTA es correcto y se deja: el día corto
 *   de finanzas («lun») y el conmutador día/semana/mes del calendario.
 * - Es un barrido de fuente sobre una lista declarada: una pantalla nueva no se
 *   vigila hasta que se añada.
 * - No comprueba el texto pintado, sólo que la mayúscula la ponga el idioma y
 *   no el CSS. Lo pintado se vio en las capturas del carril.
 */
import { describe, it, expect } from 'vitest'
import { conMayusculaInicial } from '@/lib/texto-es'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('la regla del español, no la del inglés', () => {
  it('sólo la primera letra', () => {
    expect(conMayusculaInicial('lun 31 de ago')).toBe('Lun 31 de ago')
    expect(conMayusculaInicial('domingo, 30 de agosto')).toBe('Domingo, 30 de agosto')
    expect(conMayusculaInicial('agosto de 2026')).toBe('Agosto de 2026')
  })

  it('y CSS no puede hacer esto — por eso vive en el texto', () => {
    // Prueba al revés: así se comportaba `capitalize`, palabra por palabra.
    const comoElCss = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())
    expect(comoElCss('lun 31 de ago')).toBe('Lun 31 De Ago')
    expect(conMayusculaInicial('lun 31 de ago')).not.toBe(comoElCss('lun 31 de ago'))
  })

  it('no rompe lo que ya venía en mayúscula, ni lo vacío', () => {
    expect(conMayusculaInicial('Primera vez')).toBe('Primera vez')
    expect(conMayusculaInicial('')).toBe('')
    expect(conMayusculaInicial('éxito')).toBe('Éxito')   // acento en la inicial
  })
})

/**
 * Las pantallas que pintan una FECHA (o una frase de varias palabras). Si nace
 * otra, va aquí: la que no esté en la lista no se vigila, y eso es lo que hay
 * que declarar.
 */
const PANTALLAS_CON_FECHA = [
  'src/app/reservar/[clinicId]/page.tsx',
  'src/app/(dashboard)/asistente/page.tsx',
  'src/app/(dashboard)/calendario/page.tsx',
  'src/app/(dashboard)/citas/page.tsx',
  'src/app/(dashboard)/finanzas/page.tsx',
  'src/app/(dashboard)/chat/page.tsx',
  'src/app/mi/[token]/page.tsx',
]

describe('ninguna pantalla de fecha deja la mayúscula en manos del CSS', () => {
  for (const ruta of PANTALLAS_CON_FECHA) {
    it(ruta.replace('src/app/', ''), () => {
      const src = leer(ruta)
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
      // `finanzas` conserva UN capitalize legítimo: el día corto de una palabra.
      const permitidos = ruta.endsWith('finanzas/page.tsx') || ruta.endsWith('calendario/page.tsx') ? 1 : 0
      const cuantos = (codigo.match(/textTransform: 'capitalize'/g) ?? []).length
      expect(
        cuantos,
        `${ruta}: ${cuantos} usos de capitalize (permitidos ${permitidos}) — una fecha en español no lleva «De»`,
      ).toBe(permitidos)
      expect(src, `${ruta} no usa el helper compartido`).toContain('conMayusculaInicial')
    })
  }

  it('el helper vive en UN sitio — no vuelve la copia local', () => {
    /**
     * `citas/page.tsx` tenía su propio `f.charAt(0).toUpperCase() + f.slice(1)`.
     * Era correcto y era la única pantalla arreglada; ahora todas llaman al
     * mismo sitio, que es lo que impide que se vuelvan a desfasar.
     */
    for (const ruta of PANTALLAS_CON_FECHA) {
      const codigo = leer(ruta).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
      expect(codigo, `${ruta} reimplementa la mayúscula`).not.toMatch(/charAt\(0\)\.toUpperCase\(\)/)
    }
  })
})
