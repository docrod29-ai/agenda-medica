/**
 * EL PLACEHOLDER DE ALERGIAS NO PUEDE AFIRMAR «SIN ALERGIAS».
 *
 * QUÉ FALLABA: en la consulta, el campo de alergias vacío mostraba
 * «Sin alergias conocidas — escribe aquí si hay…». Un campo VACÍO significa
 * que nadie lo ha llenado; el placeholder lo convertía en una afirmación
 * clínica de ausencia. El expediente, en cambio, decía «no registradas» —
 * la misma información con el sentido correcto.
 *
 * CÓMO SE DESCUBRIÓ: V10-TRUTH-001, 9-ago-2026. La primera captura
 * autenticada del golden flow (arnés de emuladores + paciente sintético SIN
 * alergias en el campo legado) mostró los dos banners lado a lado:
 * consulta-1440.png decía «Sin alergias conocidas», expediente-1440.png decía
 * «no registradas». Leyendo el JSX nadie lo había visto en meses.
 *
 * CAUSA RAÍZ: el placeholder se redactó como si el campo vacío fuera un dato.
 * Además «sin alergias conocidas» ES una frase de negación del vocabulario
 * clínico (alergias-negacion.test.ts la parsea como negación): si el médico la
 * escribe, es un dato suyo; si la pinta el placeholder, es la interfaz
 * poniendo palabras clínicas en la boca de nadie.
 *
 * LA REGLA QUE LO HACE SEGURO: regla 4 de `.claude/rules/clinical-safety.md` —
 * ausencia de dato NO es dato de ausencia. El texto de un campo clínico vacío
 * sólo puede describir el ESTADO DEL REGISTRO («no registradas»), nunca el
 * estado del paciente («sin alergias»).
 *
 * PROBADO AL REVÉS: restaurando el placeholder viejo, el caso 2 falla.
 *
 * QUÉ NO CUBRE: sólo el placeholder del campo de alergias de la consulta y el
 * texto vacío del banner del expediente. No audita otros placeholders clínicos
 * (signos vitales, antecedentes) ni valida el parser de negaciones — ese tiene
 * su propia suite. Tampoco impide que el MÉDICO escriba «sin alergias
 * conocidas» como dato: eso es legítimo y auditado (paciente_modificado).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const consulta = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
const expediente = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/expediente/[patientId]/page.tsx'), 'utf8')

/** Placeholders de los campos/banners de alergias, extraídos del JSX. */
function placeholdersDeAlergias(fuente: string): string[] {
  // Ventana de 400 caracteres tras cada mención de «alergias»/«Alergias:»
  // que contenga un placeholder= — suficiente para el input del banner.
  const res: string[] = []
  const re = /placeholder="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(fuente))) {
    const antes = fuente.slice(Math.max(0, m.index - 600), m.index)
    if (/[Aa]lergias/.test(antes.slice(-600))) res.push(m[1])
  }
  return res
}

describe('el texto de alergias vacías describe el registro, no al paciente', () => {
  it('1. la consulta tiene un placeholder de alergias (si esto falla, el guardián quedó ciego)', () => {
    expect(placeholdersDeAlergias(consulta).length).toBeGreaterThan(0)
  })

  it('2. ningún placeholder de alergias afirma ausencia («sin alergias», «niega», «no tiene»)', () => {
    for (const p of placeholdersDeAlergias(consulta)) {
      expect(p).not.toMatch(/sin alergias|niega|no tiene alergias|nkda/i)
    }
  })

  it('3. el vacío del banner del expediente sigue diciendo «no registradas»', () => {
    expect(expediente).toContain("'no registradas'")
  })
})
