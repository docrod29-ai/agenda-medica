/**
 * GOLDEN — la franja de alergias del internamiento afirmaba que no había.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * En hospitalización, con el campo del expediente escrito así:
 *
 *     «Niega penicilina. Alérgico a sulfas»
 *
 * la franja de alergias —la que se ve en TODO momento del internamiento, y que
 * existe precisamente para que la vea quien no pasa por el punto de orden:
 * enfermería que administra, quien prescribe a mano— decía en gris:
 *
 *     «Alergias negadas por el paciente.»
 *
 * Sobre un paciente alérgico a sulfas. No es un aviso que falte: es el sistema
 * **afirmando la ausencia** de una alergia que el expediente sí registra.
 *
 * Y con las alergias sólo en `alergiasEstructuradas` —el paciente mejor
 * documentado— la franja decía «Sin alergias registradas».
 *
 * ── CÓMO SE DESCUBRIÓ, Y POR QUÉ EL GUARDIÁN NO LA VIO ───────────────────────
 *
 * REG-201 amplió el guardián de copias a `src/` entero, harto de listas de
 * archivos que hay que acordarse de ampliar. Barre esto:
 *
 *     alergia[A-Za-z]*[^\n]{0,60}\.split\(
 *
 * La franja **copiaba el campo a una variable antes de partirlo**:
 *
 *     const raw = patient?.alergias
 *     ... String(raw).split(/[,;\n]+/) ...
 *
 * La palabra «alergias» y el `.split(` quedaban en **líneas distintas**, así que
 * el barrido pasaba de largo. El guardián estaba en verde y la copia seguía ahí:
 * la misma forma de fallo que REG-201 documentó, un renombrado más tarde.
 *
 * Se reprodujo copiando la lógica de la franja **literalmente** a un script y
 * pasándole los tres campos de ejemplo.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Partía por `/[,;\n]+/`. Sin el punto entre los separadores el campo era UN
 * fragmento, y su regla de negación —«un solo fragmento que empiece por
 * niega/no/ninguna/sin»— daba `negadas = true`. `SEPARADORES` parte por `.\s+`
 * desde el 4-ago-2026 y su comentario nombra este caso exacto (REG-171).
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `negadas` sólo es cierto cuando **no queda ningún alérgeno** y hay al menos un
 * fragmento negado. Un campo vacío no niega nada: eso es «sin registro».
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No mejora el cruce alergia↔fármaco: sigue siendo por subcadena sobre el
 *   alérgeno, y esta franja no cruza nada — sólo enseña lo que hay.
 * - No normaliza lo que se enseña. «Niega penicilina. Alérgico a sulfas» sale
 *   como el alérgeno «Alérgico a sulfas»: correcto como alerta, feo como
 *   etiqueta. Normalizarlo es decisión del médico (C-6).
 * - El guardián nuevo caza la FORMA del splitter del campo (`.split(/[,;`).
 *   Alguien que parta por otro separador —o que lo haga en otro módulo y pase la
 *   lista ya partida— sigue sin ser visto por él: eso lo cubre `alergiasDe`
 *   aceptando el campo venga como venga, no el grep.
 * - No toca consulta, UCI, el punto de orden ni la nota firmada: ésas ya están
 *   migradas y tienen sus goldens (REG-171, REG-201, REG-203).
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estadoAlergias, alergenosDe } from '@/lib/seguridad/alergias'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ejecutar = (cmd: string) => {
  try {
    return execSync(cmd, { cwd: process.cwd(), encoding: 'utf8' })
  } catch {
    return ''
  }
}

describe('UNA PANTALLA NO PUEDE AFIRMAR UNA NEGACIÓN QUE EL CAMPO NO HACE', () => {
  it('«Niega penicilina. Alérgico a sulfas» NO son alergias negadas', () => {
    // El caso exacto que la franja anunciaba en gris como «negadas por el paciente».
    const e = estadoAlergias({ alergias: 'Niega penicilina. Alérgico a sulfas' })
    expect(e.negadas).toBe(false)
    expect(e.alergenos).toEqual(['Alérgico a sulfas'])
  })

  it('y con la «y» en vez del punto, tampoco', () => {
    // La otra forma de escribirlo, la de REG-201.
    const e = estadoAlergias({ alergias: 'Niega penicilina y alérgica a sulfas' })
    expect(e.negadas).toBe(false)
    expect(e.alergenos).toEqual(['alérgica a sulfas'])
  })

  it('«Niega alergias» sí las niega, y eso se dice', () => {
    /**
     * La otra mitad, y no es adorno: si se perdiera la distinción, la franja
     * pediría «verifícalo antes de prescribir» en cada visita a un paciente que
     * ya lo negó. Un aviso que salta donde no debe se acaba ignorando.
     */
    expect(estadoAlergias({ alergias: 'Niega alergias' })).toEqual({ alergenos: [], negadas: true })
    expect(estadoAlergias({ alergias: 'sin alergias conocidas' })).toEqual({ alergenos: [], negadas: true })
  })

  it('un campo VACÍO no niega nada: es «sin registro», no «no tiene»', () => {
    // Ausencia de dato no es dato de ausencia.
    expect(estadoAlergias({})).toEqual({ alergenos: [], negadas: false })
    expect(estadoAlergias({ alergias: '   ' })).toEqual({ alergenos: [], negadas: false })
  })

  it('las estructuradas se enseñan aunque el texto libre esté vacío', () => {
    expect(estadoAlergias({ alergiasEstructuradas: [{ alergeno: 'Penicilina' }] }))
      .toEqual({ alergenos: ['Penicilina'], negadas: false })
  })

  it('«Penicilina / Sulfas» son dos renglones, no una frase', () => {
    expect(estadoAlergias({ alergias: 'Penicilina / Sulfas' }).alergenos)
      .toEqual(['Penicilina', 'Sulfas'])
  })

  it('y «TMP/SMX» sigue entero: la barra sin espacio no separa', () => {
    // REG-172: los combinados que el Dr. ordena a diario se escriben con barra.
    expect(estadoAlergias({ alergias: 'Trimetoprima/sulfametoxazol (TMP/SMX)' }).alergenos)
      .toEqual(['Trimetoprima/sulfametoxazol (TMP/SMX)'])
  })

  it('el campo se acepta venga como venga: texto o lista ya partida', () => {
    expect(estadoAlergias({ alergias: ['Penicilina', 'Sulfas'] }).alergenos)
      .toEqual(['Penicilina', 'Sulfas'])
    expect(estadoAlergias({ alergias: ['Niega alergias'] })).toEqual({ alergenos: [], negadas: true })
  })

  it('y `estadoAlergias` no es un segundo parser: sale del mismo', () => {
    // Si alguien duplicara la lógica dentro del propio módulo, esto lo caza.
    for (const p of [
      { alergias: 'Penicilina y sulfas' },
      { alergias: 'Niega penicilina. Alérgico a sulfas' },
      { alergiasEstructuradas: [{ alergeno: 'Penicilina' }] },
    ]) {
      expect(estadoAlergias(p).alergenos).toEqual(alergenosDe(p))
    }
  })
})

describe('LA FRANJA DEL PISO LEE DE AHÍ', () => {
  const hosp = leer('src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx')

  it('usa el estado canónico', () => {
    expect(hosp).toContain('estadoAlergias(patient ?? {})')
  })

  it('y ya no decide «negadas» por su cuenta', () => {
    expect(hosp).not.toMatch(/const negadas = lista\.length === 1/)
  })
})

describe('EL GUARDIÁN YA NO SE DEJA ENGAÑAR POR UN RENOMBRADO', () => {
  it('ningún módulo parte el campo con la forma del splitter de alergias', () => {
    /**
     * El barrido de REG-201 exige la palabra «alergia» a menos de 60 caracteres
     * del `.split(`, en la MISMA línea. La franja copiaba el campo a `raw` y
     * partía en la línea siguiente: invisible.
     *
     * Este segundo barrido no busca el nombre del campo sino la **forma** del
     * splitter —`.split(/[,;`—, que es la firma de partir una lista escrita a
     * mano. Hoy sólo la tiene el canónico. Si aparece en otro sitio, o es otra
     * copia del parser de alergias, o es una lista que merece su propio módulo:
     * en los dos casos vale la pena mirarla.
     */
    const sospechosos = ejecutar(
      'grep -rlE "\\.split\\(/\\[,;" --include=*.ts --include=*.tsx src/',
    )
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      // El canónico ES el que parte el campo: es su trabajo.
      .filter(f => f !== 'src/lib/seguridad/alergias.ts')
      // Las pruebas hablan del defecto; citarlo no es cometerlo.
      .filter(f => !f.startsWith('src/__tests__/'))

    expect(sospechosos, 'alguien volvió a partir una lista del expediente a mano').toEqual([])
  })
})
