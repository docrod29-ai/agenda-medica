/**
 * GOLDEN — el aviso de dosis llegaba DESPUÉS de firmar.
 *
 * ── EL HUECO DE FLUJO (5-ago-2026) ───────────────────────────────────────────
 *
 * `revisarUnidadDosis` existe y funciona bien:
 *
 *   · dosis vacía  → severidad ALTA, «la receta no lleva cantidad; quien la
 *     surta no puede saber cuánto dispensar».
 *   · «100» sin unidad → «se lee como 100 mg, y en lo que se dosifica en
 *     microgramos eso son mil veces la dosis».
 *
 * Pero sólo se ejecutaba en la pantalla de la RECETA y en hospitalización. En la
 * consulta no — y la consulta es donde se firma.
 *
 * Auditando las notas firmadas del Dr. aparecieron **4 medicamentos sin dosis de
 * 28**. El aviso llegaba cuando la nota ya era inmutable y sólo podía corregirse
 * con una adenda.
 *
 * ── LO QUE ESTE GOLDEN NO HACE ───────────────────────────────────────────────
 *
 * No exige que la firma se bloquee. Qué es exigible en una receta es una
 * decisión del médico dueño y está en su cola — avisar no necesita su permiso,
 * bloquear sí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { revisarUnidadDosis } from '@/lib/seguridad/dosis'

const consulta = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('EL MOTOR YA SABÍA DETECTARLO', () => {
  it('una dosis vacía es severidad alta', () => {
    const a = revisarUnidadDosis('Amoxicilina', '')
    expect(a?.severidad).toBe('alta')
    expect(a?.codigo).toBe('dosis_sin_cifra')
  })

  it('y una cifra sin unidad también', () => {
    const a = revisarUnidadDosis('Levotiroxina', '100')
    expect(a?.severidad).toBe('alta')
    expect(a?.codigo).toBe('dosis_sin_unidad')
  })

  it('una dosis correcta no molesta', () => {
    // Un aviso que salta siempre se acaba ignorando junto con los que importan.
    expect(revisarUnidadDosis('Amoxicilina', '500 mg')).toBeNull()
  })
})

describe('AHORA SE VE ANTES DE FIRMAR', () => {
  it('la consulta lo calcula', () => {
    expect(consulta).toContain('revisarUnidadDosis(m.nombre, m.dosis)')
    expect(consulta).toContain('const dosisIncompletas')
  })

  it('y lo enseña', () => {
    expect(consulta).toContain('Falta la dosis o su unidad')
  })

  it('en rojo, porque el motor lo marca de severidad alta', () => {
    /**
     * Una receta sin cantidad no se puede surtir, y «100» sin unidad se lee como
     * 100 mg. Eso no es un aviso ámbar.
     */
    const i = consulta.indexOf('Falta la dosis o su unidad')
    expect(consulta.slice(i - 300, i)).toContain('tone="danger"')
  })

  it('con «Ya lo revisé», como los demás avisos', () => {
    // El Dr lo pidió con estas palabras: «estas cosas deben poderse quitar».
    expect(consulta).toContain("marcarRevisado('dosis', d.med)")
    expect(consulta).toContain('avisosRevisados.includes(`dosis:${x.med}`)')
  })

  it('y NO bloquea la firma', () => {
    /**
     * Qué es exigible en una receta lo decide el médico dueño. Avisar no
     * necesita su permiso; bloquear sí, y esa decisión está en su cola.
     */
    const i = consulta.indexOf('const dosisIncompletas')
    // El porqué va en el comentario que PRECEDE al cálculo.
    expect(consulta.slice(Math.max(0, i - 1400), i)).toMatch(/No bloquea/)
    expect(consulta.slice(i, i + 900)).not.toContain('No se puede firmar')
  })
})

describe('UN RENGLÓN A MEDIO ESCRIBIR NO CUENTA', () => {
  it('sin nombre, no hay aviso', () => {
    /**
     * Mientras el médico teclea, el renglón está vacío. Avisar ahí sería gritar
     * en cada pulsación.
     */
    const i = consulta.indexOf('const dosisIncompletas')
    expect(consulta.slice(i, i + 400)).toContain("filter(m => m.nombre?.trim())")
  })
})
