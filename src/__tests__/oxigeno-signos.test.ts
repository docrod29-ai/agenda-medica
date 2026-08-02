/**
 * GOLDEN — el oxígeno de una toma de signos.
 *
 * Una SpO₂ de 94 respirando aire ambiente y una SpO₂ de 94 con 5 L/min son dos
 * pacientes muy distintos. La tabla de signos del episodio los pintaba
 * **idénticos**: no tenía columna de oxígeno.
 *
 * Y el dato existía. `RegistroSignos` declara `oxigeno`, `oxigenoFlujoLpm` y
 * `oxigenoFiO2`; el adaptador del monitor traduce los dos últimos desde LOINC
 * (3151-8 y 3150-0) y el export FHIR los emite. Se guardaban, viajaban a un
 * sistema externo… y el médico que abría la ficha no los veía por ninguna parte.
 * Tampoco había forma de teclearlos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { textoOxigeno, oxigenoSinDeclarar, POR_QUE_NO_SE_DEDUCE } from '@/lib/hospital/oxigeno'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('textoOxigeno', () => {
  it('con O₂ y cifras, enseña las cifras', () => {
    expect(textoOxigeno({ oxigeno: true, oxigenoFlujoLpm: 5 }).texto).toBe('5 L/min')
    expect(textoOxigeno({ oxigeno: true, oxigenoFiO2: 40 }).texto).toBe('FiO₂ 40%')
    expect(textoOxigeno({ oxigeno: true, oxigenoFlujoLpm: 5, oxigenoFiO2: 40 }).texto).toBe('5 L/min · FiO₂ 40%')
  })

  it('con O₂ y sin cifras, lo dice igual', () => {
    const r = textoOxigeno({ oxigeno: true })
    expect(r.texto).toBe('sí')
    expect(r.ayuda).toMatch(/No se registró flujo ni FiO₂/)
  })

  it('aire ambiente NO es lo mismo que «no se registró»', () => {
    // Un guion donde debería decir aire ambiente es un dato que falta, no un
    // paciente sin oxígeno.
    expect(textoOxigeno({ oxigeno: false }).texto).toBe('aire')
    expect(textoOxigeno({}).texto).toBe('—')
    expect(textoOxigeno(null).texto).toBe('—')
    expect(textoOxigeno(undefined).texto).toBe('—')
    expect(textoOxigeno({}).ayuda).toMatch(/No se registró/)
  })

  it('un valor basura no se pinta como cifra', () => {
    expect(textoOxigeno({ oxigeno: true, oxigenoFlujoLpm: NaN }).texto).toBe('sí')
  })
})

describe('cifras de oxígeno SIN el indicador que NEWS2 necesita', () => {
  it('no se deduce que recibe oxígeno: se DECLARA', () => {
    /**
     * Decidir que un flujo registrado significa «recibe O₂ suplementario» es una
     * regla clínica, y aplicarla cambiaría el NEWS2 —el modificador suma puntos—.
     * Se declara y lo decide el médico. NEEDS_CLINICAL_REVIEW.
     */
    const r = textoOxigeno({ oxigenoFlujoLpm: 3 })
    expect(r.texto).toBe('3 L/min ⚠')
    expect(r.ayuda).toMatch(/no dice si recibe O₂ suplementario/)
    expect(r.ayuda).toMatch(/el score puede quedar por debajo/)
    expect(POR_QUE_NO_SE_DEDUCE).toMatch(/NEEDS_CLINICAL_REVIEW/)
  })

  it('oxigenoSinDeclarar sólo marca ese caso', () => {
    expect(oxigenoSinDeclarar({ oxigenoFlujoLpm: 3 })).toBe(true)
    expect(oxigenoSinDeclarar({ oxigenoFiO2: 28 })).toBe(true)
    expect(oxigenoSinDeclarar({ oxigeno: true, oxigenoFlujoLpm: 3 })).toBe(false)
    expect(oxigenoSinDeclarar({ oxigeno: false })).toBe(false)
    expect(oxigenoSinDeclarar({})).toBe(false)
  })
})

describe('la ficha del episodio lo enseña y lo captura', () => {
  const s = leer('src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx')

  it('la tabla tiene columna de O₂', () => {
    expect(s).toContain("'SpO₂', 'O₂', 'Gluc.'")
    expect(s).toContain('textoOxigeno(s).texto')
    expect(s).toContain('textoOxigeno(s).ayuda')
  })

  it('el formulario deja teclear flujo y FiO₂', () => {
    expect(s).toContain('Flujo (L/min)')
    expect(s).toContain('FiO₂ (%)')
    // Sólo si marcó que recibe oxígeno: preguntarlo siempre invita a rellenarlo
    // en un paciente que respira aire.
    expect(s).toContain('{sg.oxigeno && (')
  })

  it('y se guardan de verdad, no sólo se teclean', () => {
    // El fallo más caro de este repositorio es justo el contrario: un campo con
    // su formulario y sin escritura.
    expect(s).toContain('oxigenoFlujoLpm: sg.oxigeno ? num(sg.o2Flujo) : undefined')
    expect(s).toContain('oxigenoFiO2: sg.oxigeno ? num(sg.o2FiO2) : undefined')
  })

  it('al corregir, se precargan los que ya había', () => {
    expect(s).toContain('o2Flujo: s.oxigenoFlujoLpm != null ? String(s.oxigenoFlujoLpm) : \'\'')
  })
})
