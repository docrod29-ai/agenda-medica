/**
 * GOLDEN — la red de la dosis estaba en la receta y no en el hospital.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * La receta corre `revisarUnidadDosis` y `revisarDosis` sobre cada renglón:
 * unidad ausente, error de decimal, tope de adulto, mg/kg pediátrico. En
 * **hospitalización no corría ninguna**.
 *
 * Y ahí la dosis es un campo de **texto libre** («otra»), la indicación se arma
 * concatenando `descripción + dosis + vía`, y de ahí va al **MAR**, donde
 * **enfermería administra lo que está escrito**.
 *
 * O sea: la red estaba donde el paciente se va a su casa con un papel, y no
 * donde está internado y otra persona le pone el medicamento.
 *
 * ── POR QUÉ SÓLO LA UNIDAD, Y SE DICE ────────────────────────────────────────
 *
 * `revisarDosis` necesita el **peso de dosificación** para la comprobación
 * mg/kg, que es la que de verdad protege a un niño. Esa pantalla no lo tiene:
 * `pesoDosificacion` vive en la estancia de UCI y el charter §16 prohíbe fijarlo
 * solo. Correrla sin peso daría **topes de adulto sobre un niño**, que es peor
 * que no correrla — el mismo defecto que ya se reparó una vez en la receta.
 *
 * La comprobación de unidad no necesita peso ni edad, y es la que atrapa el caso
 * que más asusta en un MAR: «meropenem 2 cada 8 horas».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { revisarUnidadDosis } from '@/lib/seguridad/dosis'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hosp = leer('src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx')

describe('EL MOTOR ES EL MISMO — no hay un segundo criterio', () => {
  it('una cantidad sin unidad se marca', () => {
    const a = revisarUnidadDosis('meropenem', '2', 'indicacion_hospital')
    expect(a?.codigo).toBe('dosis_sin_unidad')
    expect(a?.severidad).toBe('alta')
  })

  it('una dosis completa no molesta', () => {
    // Un aviso que sale siempre se apaga, y con él el que sí importaba.
    expect(revisarUnidadDosis('meropenem', '2 g', 'indicacion_hospital')).toBeNull()
    expect(revisarUnidadDosis('paracetamol', '500 mg', 'indicacion_hospital')).toBeNull()
  })

  it('sin cantidad también se marca', () => {
    expect(revisarUnidadDosis('meropenem', '', 'indicacion_hospital')?.codigo).toBe('dosis_sin_cifra')
  })
})

describe('EL TEXTO HABLA DEL TRABAJO DE QUIEN LO LEE', () => {
  it('en el hospital nombra a ENFERMERÍA, no a quien surte', () => {
    /**
     * Decirle a un intensivista «quien la surta no puede saber cuánto
     * dispensar» es texto de otro sitio, y un aviso que no habla de su trabajo
     * se lee como ruido.
     */
    const h = revisarUnidadDosis('meropenem', '', 'indicacion_hospital')!
    expect(h.mensaje).toMatch(/Enfermería no puede administrar/)
    expect(h.mensaje).not.toMatch(/surta|dispensar/)
  })

  it('en la receta sigue diciendo lo de siempre', () => {
    // El contexto cambia el TEXTO, nunca el criterio.
    const r = revisarUnidadDosis('meropenem', '')!
    expect(r.mensaje).toMatch(/surta/)
    expect(r.codigo).toBe(revisarUnidadDosis('meropenem', '', 'indicacion_hospital')!.codigo)
    expect(r.severidad).toBe(revisarUnidadDosis('meropenem', '', 'indicacion_hospital')!.severidad)
  })

  it('sin contexto se comporta como antes', () => {
    // Los llamadores que ya existían no cambian de comportamiento.
    expect(revisarUnidadDosis('meropenem', '2')).toEqual(revisarUnidadDosis('meropenem', '2', 'receta'))
  })
})

describe('Y LA PANTALLA DE HOSPITALIZACIÓN LO USA', () => {
  it('calcula la alerta sobre lo que se está escribiendo', () => {
    expect(hosp).toContain("revisarUnidadDosis(indForm.descripcion, indForm.dosis, 'indicacion_hospital')")
  })

  it('sólo para medicamentos: una dieta no lleva dosis', () => {
    // Marcar «dieta blanda» por no traer miligramos sería ruido puro.
    expect(hosp).toContain("indForm.tipo === 'medicamento' && indForm.descripcion.trim()")
  })

  it('y la enseña en el modal, no sólo la calcula', () => {
    expect(hosp).toContain('{alertaUnidadIndicacion.mensaje}')
  })

  it('está escrito por qué NO se corre la comprobación mg/kg aquí', () => {
    /**
     * Es la parte que más importa de esta versión: se declara el límite en vez
     * de fingir una cobertura que no hay.
     */
    expect(hosp).toMatch(/pesoDosificacion` vive en la estancia de UCI/)
    expect(hosp).toMatch(/topes de adulto sobre un niño/)
  })
})
