/**
 * EL SELLO DE PROCEDENCIA CONTABA CERO ALERGIAS — REG-278.
 *
 * ── EL CAMINO QUE FALTABA ───────────────────────────────────────────────────
 *
 * La compuerta que bloquea la firma **ya se había reparado**: sella
 * `alergias: alergiasDe(patient ?? {})`, que lee las dos fuentes.
 *
 * Lo que quedó atrás fue el **sello de procedencia** — el que dice de dónde
 * salió cada dato de la nota. Iba por un envoltorio de una línea:
 *
 *     function alergiasArray(alergias?: string) {
 *       return parsearAlergiasTexto(alergias).map(a => a.alergeno)
 *     }
 *
 * `parsearAlergiasTexto` mira **sólo el texto libre**. Un paciente cuya alergia
 * vive en `alergiasEstructuradas` sellaba una lista vacía, y con ella el dato se
 * quedaba fuera de `camposSinEvidencia`: el registro medicolegal decía que ahí
 * no había nada que respaldar.
 *
 * ── POR QUÉ SOBREVIVIÓ A DOS GUARDIANES ─────────────────────────────────────
 *
 * El guardián de copias busca **quién PARTE el campo a mano**, y este envoltorio
 * no parte nada: llama al partidor bueno. Sobre una sola de las dos fuentes.
 *
 * **Cuando un dato tiene dos orígenes, el guardián tiene que mirar qué función
 * se llama, no cómo se corta el texto.** Un envoltorio de una línea es
 * exactamente donde se esconde esa diferencia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { alergiasDe, parsearAlergiasTexto } from '@/lib/seguridad/alergias'

/** Paciente sintético: la alergia vive SÓLO en el campo estructurado. */
const SOLO_ESTRUCTURADA = {
  alergias: '',
  alergiasEstructuradas: [{ alergeno: 'Penicilina', severidad: 'grave' as const }],
}

describe('las dos lecturas del mismo campo, comparadas', () => {
  it('el partidor de texto libre NO ve la alergia estructurada', () => {
    /** No es un defecto suyo: es su contrato. El defecto era llamarlo aquí. */
    expect(parsearAlergiasTexto(SOLO_ESTRUCTURADA.alergias)).toEqual([])
  })

  it('`alergiasDe` sí la ve, y es la que tiene que usar el sello', () => {
    expect(alergiasDe(SOLO_ESTRUCTURADA).map(a => a.alergeno)).toEqual(['Penicilina'])
  })

  it('y sigue quitando lo que el campo NIEGA', () => {
    /**
     * El riesgo de cambiar de lectura es traerse las negaciones. «Niega alergia
     * a penicilina» no puede volver a contar como alergia: esa alerta bloquea la
     * firma y ya costó un REG.
     */
    expect(alergiasDe({ alergias: 'Niega alergia a penicilina' })).toEqual([])
  })
})

describe('la consulta sella por la lectura que ve las dos fuentes', () => {
  const pagina = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('`alergiasArray` recibe al PACIENTE, no una cadena', () => {
    /**
     * La firma es la que impide la recaída: mientras acepte `string`, alguien
     * volverá a pasarle `patient?.alergias` y el sello volverá a contar cero.
     */
    expect(pagina).toMatch(/function alergiasArray\(p\?: \{ alergias\?: string; alergiasEstructuradas/)
  })

  it('y por dentro usa `alergiasDe`, no el partidor de texto libre', () => {
    expect(pagina).toMatch(/function alergiasArray[\s\S]{0,200}alergiasDe\(/)
  })

  it('ninguna llamada le pasa ya sólo el texto libre', () => {
    expect(pagina).not.toContain('alergiasArray(patient?.alergias)')
  })

  it('la compuerta de firma sigue sellando por `alergiasDe`', () => {
    /** Lo que ya estaba bien no puede romperse al arreglar lo de al lado. */
    expect(pagina).toMatch(/alergias: alergiasDe\(patient \?\? \{\}\)/)
  })
})
