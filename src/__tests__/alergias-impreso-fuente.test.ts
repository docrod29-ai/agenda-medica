/**
 * GOLDEN — la pantalla y el PAPEL leen las alergias de la misma fuente.
 *
 * ── LO QUE DECÍA EL PROPIO MÓDULO ────────────────────────────────────────────
 *
 * `alergiasParaImpreso` existe con esta advertencia escrita encima:
 *
 *   «Por qué existe este helper y por qué debe usarse en TODOS los caminos de
 *    impresión: la verificación en pantalla usa `alergiasDe`, que prefiere
 *    `alergiasEstructuradas` sobre el texto libre. Los impresos leían solo
 *    `patient.alergias`. Un paciente con la alergia únicamente en el campo
 *    estructurado veía una alerta roja en pantalla y un papel que decía
 *    "Negadas".»
 *
 * Cuando lo revisé, **de los cinco caminos de impresión sólo uno lo usaba**: la
 * orden médica. La receta —el papel que va a la farmacia—, la referencia —que
 * viaja a otro médico—, la nota y su exportación a Word seguían leyendo
 * `patient.alergias` en crudo.
 *
 * Hoy ninguna ruta de escritura llena `alergiasEstructuradas`, así que la
 * divergencia todavía no está activa. La activa el mismo día que entre una
 * importación de otro sistema — y entonces el hueco ya estaría en producción.
 * Cerrarlo antes cuesta esto; cerrarlo después cuesta una receta equivocada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alergiasParaImpreso, alergiasDe } from '@/lib/seguridad/alergias'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('el helper y la pantalla dicen lo mismo', () => {
  it('una alergia SÓLO estructurada también sale en el papel', () => {
    const p = { alergiasEstructuradas: [{ alergeno: 'Penicilina' }] }
    expect(alergiasDe(p).map(a => a.alergeno)).toEqual(['Penicilina'])
    expect(alergiasParaImpreso(p)).toBe('Penicilina')
  })

  it('el texto libre sigue funcionando igual', () => {
    expect(alergiasParaImpreso({ alergias: 'Penicilina, Sulfas' })).toBe('Penicilina, Sulfas')
  })

  it('un campo vacío devuelve vacío: el impreso decide cómo redactarlo', () => {
    // Lo que NUNCA debe hacer es afirmar «Negadas» a partir de un campo que
    // simplemente no se llenó: no es lo mismo que el paciente negara alergias
    // que que nadie preguntara.
    expect(alergiasParaImpreso({})).toBe('')
    expect(alergiasParaImpreso(null)).toBe('')
    expect(alergiasParaImpreso(undefined)).toBe('')
  })
})

describe('TODOS los caminos de impresión usan el helper', () => {
  const CAMINOS: [string, string[]][] = [
    ['receta (va a la farmacia)', ['src', 'components', 'RecetaDocumento.tsx']],
    ['orden médica', ['src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx']],
    ['referencia (viaja a otro médico)', ['src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx']],
    ['nota y su Word', ['src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx']],
  ]

  for (const [nombre, ruta] of CAMINOS) {
    it(`${nombre} lee de la misma fuente que la pantalla`, () => {
      const s = leer(...ruta)
      /**
       * MI-002 (Panel de Lujo, 6-sep-2026) — `alergiasParaElPapel` es
       * `alergiasParaImpreso` MÁS la frase de los tres estados (alérgeno /
       * «Sin registro en el expediente» / «NO DISPONIBLE»). Vive en
       * `impreso-medico.ts` y llama al helper de seguridad por dentro, así que
       * cualquiera de los dos nombres satisface esta regla: lo que se exige es
       * que el impreso NO se invente la fuente, no cómo se llama la función.
       */
      expect(s, `${nombre} no lee las alergias del helper compartido`)
        .toMatch(/alergiasParaImpreso|alergiasParaElPapel/)
      // Y ya no lee el texto libre por su cuenta.
      expect(s).not.toMatch(/\{\s*(data\.)?pa(ciente|tient)\??\.alergias\s*\}/)
    })
  }
})

describe('la receta no inventa un «sin alergias»', () => {
  it('cuando no hay dato, no se pinta el recuadro', () => {
    // Un recuadro rojo vacío o un «Negadas» de relleno son dos formas de mentir
    // en el papel que va a la farmacia.
    const s = leer('src', 'components', 'RecetaDocumento.tsx')
    expect(s).toContain('alergiasParaImpreso(data.paciente) && (')
  })
})
