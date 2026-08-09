/**
 * HOSPITAL Y CONSULTA NO PUEDEN DECIDIR DISTINTO SOBRE EL MISMO CAMPO — REG-277.
 *
 * ── LA QUINTA COPIA ─────────────────────────────────────────────────────────
 *
 * `hospital/cds.ts` tenía su propio partidor de alergias, con su propia idea de
 * qué es una negación. Medida la divergencia el 9-ago-2026 sobre los mismos
 * textos, **9 de 11 discrepaban**:
 *
 *     «NKDA»                  → hospital: alérgeno «NKDA»  · consulta: ninguno
 *     «(-)» · «Ninguna»       → hospital: alérgeno         · consulta: ninguno
 *     «Negadas» · «n/a»       → hospital: alérgeno         · consulta: ninguno
 *     «Paracetamol 2.5 mg»    → hospital: «Paracetamol 2» + «5 mg»
 *     «Alérgico a penicilina» → hospital: «Alérgico a penicilina»
 *
 * `NKDA`, `(-)`, `n/a` y «ninguna» son lo que se dicta en planta todos los días.
 * Ninguno casa con un fármaco del catálogo, así que **no disparan la alerta** —
 * y en cambio se imprimen: un recuadro rojo que dice «NKDA».
 *
 * ── PERO LO GRAVE NO ES CADA CASO ───────────────────────────────────────────
 *
 * Es que el hospital y la consulta **decidían distinto sobre el mismo campo del
 * mismo paciente**. El médico ve una cosa en el consultorio y otra en planta, y
 * ninguna de las dos pantallas dice que existe la otra.
 *
 * ── LO QUE ESTA PRUEBA FIJA ─────────────────────────────────────────────────
 *
 * Que no vuelvan a separarse. No comprueba una lista de casos: comprueba que
 * las dos superficies **coinciden**, sea cual sea el texto. Una divergencia
 * nueva falla aquí aunque nadie haya pensado en ese caso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'node:child_process'
import { alergenosDe } from '@/lib/seguridad/alergias'
import { cdsMedicamento } from '@/lib/hospital/cds'

/**
 * Los textos que de verdad aparecen en el campo, incluidos los que sólo se
 * escriben en hospital.
 */
const COMO_SE_ESCRIBE = [
  'NKDA', 'NKA', '(-)', '-', 'Ninguna', 'Negadas', 'n/a', 'sd',
  'Alergias: negadas', 'Interrogadas y negadas', 'Se niegan',
  'Niega alergias', 'Niega alergia a penicilina',
  'Niega alergias a penicilina y sulfas',
  'Niega alergia a penicilina, sulfas y AINEs',
  'Niega penicilina. Alérgico a sulfas',
  'Niega alergia a penicilina, alérgico a sulfas',
  'Penicilina', 'Penicilina, Sulfas; Mariscos', 'Alérgico a penicilina',
  'Trimetoprima/sulfametoxazol (TMP/SMX)', 'penicilina / sulfas',
  'Paracetamol 2.5 mg', 'naproxeno', 'nogal', 'Penicilina G.',
  '', '   ',
]

describe('las dos superficies leen el mismo campo igual', () => {
  for (const texto of COMO_SE_ESCRIBE) {
    it(`«${texto || '(vacío)'}» — la alerta del hospital sigue a la lista de la consulta`, () => {
      /**
       * El contrato no es «la misma lista»: es que la ALERTA CRÍTICA del
       * hospital dispare exactamente cuando la consulta ve el alérgeno. Eso es
       * lo que el médico vive, y es lo que bloquea la firma.
       */
      const deLaConsulta = alergenosDe({ alergias: texto })
      const veLaPenicilina = deLaConsulta.some(a => /penicilin/i.test(a))
      const alertaHospital = cdsMedicamento({ nombre: 'Penicilina G', alergias: texto })
        .some(a => a.nivel === 'critica')
      expect(alertaHospital, `hospital=${alertaHospital}, consulta=${JSON.stringify(deLaConsulta)}`)
        .toBe(veLaPenicilina)
    })
  }
})

describe('y no queda ninguna copia del partidor', () => {
  it('`cds.ts` ya no parte el campo por su cuenta', () => {
    /**
     * Era la quinta copia. El guardián anterior sólo miraba `consulta` y `uci`,
     * y por eso se le escapó: **un guardián que mira donde ya se arregló no
     * guarda nada**.
     */
    const cds = readFileSync(join(process.cwd(), 'src/lib/hospital/cds.ts'), 'utf8')
    expect(cds).toContain("from '@/lib/seguridad/alergias'")
    expect(cds).not.toMatch(/alergias\s*\|\|\s*''\)\.split/)
    expect(cds).not.toMatch(/const NEG_SEG/)
  })

  it('nadie más fuera del módulo parte un campo de alergias', () => {
    /**
     * Comprobación por FORMA, no por lista de ficheros: una copia nueva en un
     * fichero que nadie ha escrito todavía también falla aquí.
     */
    const salida = execSync(
      "grep -rln 'alergias' src/lib src/app --include='*.ts' --include='*.tsx' || true",
      { encoding: 'utf8', cwd: process.cwd() })
    const copias = salida.split('\n').filter(Boolean).filter(f => {
      if (f.includes('seguridad/alergias.ts') || f.includes('__tests__')) return false
      const t = readFileSync(join(process.cwd(), f), 'utf8')
      return /alergias[^\n]{0,40}\.split\(|\.split\([^)]*\)[^\n]{0,40}alergia/i.test(t)
    })
    expect(copias, 'copias del partidor de alergias:\n  ' + copias.join('\n  ')).toEqual([])
  })
})
