import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { edadParaDosificar, AVISO_SIN_EDAD_PARA_DOSIFICAR } from '@/lib/seguridad/edad-para-dosificar'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'

/**
 * LA EDAD QUE FALTA SE DICE; NO SE SUPONE ADULTO — REG-520.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La pantalla de receta decidía «¿es pediátrico?» con `patient.edad`, un
 * número congelado en el expediente. Un paciente dado de alta desde la reserva
 * pública nace sin `edad` y sin `fechaNacimiento`. Con `undefined`:
 * `esPediatrico` era `false`, no se pasaba el peso, la comprobación mg/kg no
 * corría y se aplicaban los TECHOS DE ADULTO a un niño. La restricción de
 * ketorolaco oral en menores tampoco se evaluaba, y el ajuste renal devolvía
 * `null`. La pantalla no lo decía: había un aviso pequeño para la TFG, y
 * ninguno para la dosis.
 *
 * Y aunque hubiera fecha de nacimiento, se ignoraba: `edad` es lo que se
 * escribió al capturar la fecha, y no se recalcula. Un niño de 11 registrado
 * hace tres años sigue teniendo 11 en ese campo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría read-only de medicación del 5-sep-2026, siguiendo el dato desde el
 * expediente hasta `revisarDosis`. Verificado por el orquestador en
 * `receta/[patientId]/[notaId]/page.tsx` antes de tocarlo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `edadParaDosificar`: la fecha de nacimiento manda (no envejece); si no hay,
 * la edad congelada; si no hay ninguna, `null` con `origen: 'desconocida'`, y
 * la receta lo pinta en ámbar junto a las dosis. **Regla 4 de seguridad
 * clínica**: ausencia de dato no es dato de ausencia. No se inventa una edad,
 * no se asume adulto, no se bloquea imprimir (eso es política del dueño, D-A).
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la receta como estaba, el guardián de abajo se pone rojo: seguía
 * leyendo `patient?.edad` a secas y no tenía ningún aviso por dosis.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No renderiza la receta: la función es pura y se prueba con tabla; el
 *   cableado se vigila por fuente con los comentarios quitados.
 * - No arregla que `patient.edad` se quede viejo en el expediente: eso es del
 *   directorio de pacientes. Aquí se deja de depender de él cuando hay fecha.
 * - No decide si sin edad se debe BLOQUEAR la impresión. Se dice; no se para.
 */

const HOY = '2026-09-05'

describe('REG-520 · edadParaDosificar', () => {
  it('la fecha de nacimiento manda: años cumplidos hoy, aunque la edad congelada diga otra cosa', () => {
    expect(edadParaDosificar({ fechaNacimiento: '2015-09-06', edad: 8 }, HOY)).toEqual({ edad: 10, origen: 'fecha_nacimiento' })
    expect(edadParaDosificar({ fechaNacimiento: '2015-09-05', edad: 8 }, HOY)).toEqual({ edad: 11, origen: 'fecha_nacimiento' })
  })

  it('sin fecha, vale la edad congelada — es lo único que hay', () => {
    expect(edadParaDosificar({ edad: 34 }, HOY)).toEqual({ edad: 34, origen: 'expediente' })
    expect(edadParaDosificar({ edad: 0 }, HOY)).toEqual({ edad: 0, origen: 'expediente' })
  })

  it('EL CASO: sin fecha y sin edad → null y «desconocida». Nunca un número inventado, nunca adulto', () => {
    expect(edadParaDosificar({}, HOY)).toEqual({ edad: null, origen: 'desconocida' })
    expect(edadParaDosificar(null, HOY)).toEqual({ edad: null, origen: 'desconocida' })
    expect(edadParaDosificar(undefined, HOY)).toEqual({ edad: null, origen: 'desconocida' })
  })

  it('una fecha inválida o una edad implausible no cuentan como dato', () => {
    expect(edadParaDosificar({ fechaNacimiento: 'no-es-fecha' }, HOY)).toEqual({ edad: null, origen: 'desconocida' })
    expect(edadParaDosificar({ fechaNacimiento: 'no-es-fecha', edad: 40 }, HOY)).toEqual({ edad: 40, origen: 'expediente' })
    expect(edadParaDosificar({ edad: 250 }, HOY)).toEqual({ edad: null, origen: 'desconocida' })
    expect(edadParaDosificar({ edad: Number.NaN }, HOY)).toEqual({ edad: null, origen: 'desconocida' })
  })

  it('el aviso nombra las dos redes que se apagan y pide la fecha de nacimiento, sin afirmar que sea adulto', () => {
    expect(AVISO_SIN_EDAD_PARA_DOSIFICAR).toMatch(/pediátricos/)
    expect(AVISO_SIN_EDAD_PARA_DOSIFICAR).toMatch(/ajuste renal/)
    expect(AVISO_SIN_EDAD_PARA_DOSIFICAR).toMatch(/fecha de nacimiento/)
    expect(AVISO_SIN_EDAD_PARA_DOSIFICAR).not.toMatch(/adulto/)
  })
})

describe('REG-520 · la receta y la consulta pasan por él (comentarios fuera)', () => {
  const receta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8'))
  const consulta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8'))

  it('la receta deriva la edad con edadParaDosificar y ya no lee patient.edad a secas', () => {
    expect(receta).toMatch(/edadParaDosificar\(\{ edad: edadCongelada, fechaNacimiento \}\)/)
    // Ninguna lectura directa que decida algo: ni en la dosis ni en el renal.
    expect(receta).not.toMatch(/!patient\?\.edad/)
    expect(receta).not.toMatch(/patient\.edad, patient\.sexo/)
  })

  it('la dosis y el renal usan la MISMA edad derivada', () => {
    expect(receta).toContain('edadAnios: edadPaciente ?? undefined')
    expect(receta).toContain('mgPorDl(cr), edadPaciente, patient.sexo')
    expect(receta).toMatch(/if \(!cr \|\| cr <= 0 \|\| edadPaciente == null \|\| !patient\) return null/)
  })

  it('y cuando la edad es desconocida se PINTA, junto a las dosis, con el aviso del módulo', () => {
    expect(receta).toMatch(/origenEdad === 'desconocida' && \(/)
    expect(receta).toContain('{AVISO_SIN_EDAD_PARA_DOSIFICAR}')
    const aviso = receta.indexOf('{AVISO_SIN_EDAD_PARA_DOSIFICAR}')
    const dosis = receta.indexOf('Revisa la dosis antes de imprimir')
    expect(aviso).toBeGreaterThan(-1)
    expect(aviso, 'el aviso va ANTES del bloque de dosis, donde se mira').toBeLessThan(dosis)
  })

  it('la barra de dosis de la consulta también pasa por él', () => {
    expect(consulta).toContain('edadAnios: edadParaDosificar(patient).edad ?? undefined')
  })
})
