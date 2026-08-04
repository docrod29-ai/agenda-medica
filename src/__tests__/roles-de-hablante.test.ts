/**
 * GOLDEN — sólo había tres roles, y el modelo estaba obligado a elegir uno.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `atribuir-roles` ofrecía «Médico», «Paciente» y «Acompañante». No había forma
 * de contestar «no lo sé»: el prompt pedía uno de los tres, y el saneado
 * descartaba cualquier otra cosa.
 *
 * En consultorio se sostiene. En hospital y en UCI no: allí hablan el adscrito,
 * el residente, enfermería, el terapeuta respiratorio, el interconsultante. Con
 * tres casillas, **enfermería sale como «Paciente»** — y desde que el rol se
 * archiva en la nota, esa suposición se queda en el expediente.
 *
 * ── POR QUÉ NO ES UNA ETIQUETA BONITA ────────────────────────────────────────
 *
 * De «quién dijo qué» cuelgan el motor de negaciones y la procedencia V3: la
 * diferencia entre *el paciente lo afirmó* y *la pregunta del médico lo nombró*.
 * Con un rol inventado, esas dos defensas razonan sobre una atribución falsa — y
 * responden con la misma seguridad que si fuera verdad.
 *
 * Y el módulo de discusión de UCI ya tenía seis roles escritos, «Hablante no
 * identificado» incluido. La API se había quedado atrás.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  rolesDe, esRolAtribuible, catalogoParaPrompt, NO_IDENTIFICADO,
  ROLES_POR_MODULO, POR_QUE_EXISTE_NO_IDENTIFICADO,
} from '@/lib/asr/roles-hablante'
import { ROL_UCI_LABEL } from '@/lib/uci/discusion'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'atribuir-roles', 'route.ts')
const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

describe('EL CATÁLOGO DEPENDE DEL MÓDULO', () => {
  it('el consultorio conserva los suyos', () => {
    expect(rolesDe('consulta')).toContain('Médico')
    expect(rolesDe('consulta')).toContain('Paciente')
    expect(rolesDe('consulta')).toContain('Acompañante')
  })

  it('hospital y UCI añaden a quien de verdad habla en un pase', () => {
    for (const m of ['hospitalizacion', 'uci']) {
      const r = rolesDe(m)
      expect(r, m).toContain('Enfermería')
      expect(r, m).toContain('Médico residente')
      expect(r, m).toContain('Médico adscrito')
    }
  })

  it('un módulo desconocido cae a consulta, no a vacío', () => {
    // Sin roles válidos, el saneado descartaría TODO y no habría atribución.
    expect(rolesDe(undefined).length).toBeGreaterThan(0)
    expect(rolesDe('modulo-inventado')).toEqual(rolesDe('consulta'))
  })

  it('las etiquetas coinciden con las del módulo de discusión de UCI', () => {
    /**
     * Si no coincidieran, el mismo turno se llamaría de dos maneras según qué
     * pantalla lo mire, y las heurísticas deterministas de UCI no podrían
     * cruzarse con la atribución de la IA.
     */
    for (const etiqueta of ['Médico adscrito', 'Médico residente', 'Enfermería']) {
      expect(Object.values(ROL_UCI_LABEL)).toContain(etiqueta)
      expect(rolesDe('uci')).toContain(etiqueta)
    }
    expect(NO_IDENTIFICADO).toBe(ROL_UCI_LABEL.desconocido)
  })
})

describe('«NO LO SÉ» ES UNA RESPUESTA POSIBLE — Y NO SE ARCHIVA', () => {
  it('está en todos los catálogos', () => {
    for (const m of Object.keys(ROLES_POR_MODULO)) {
      expect(rolesDe(m), m).toContain(NO_IDENTIFICADO)
    }
  })

  it('pero NO es atribuible: no se guarda como si fuera un dato', () => {
    expect(esRolAtribuible(NO_IDENTIFICADO)).toBe(false)
    expect(esRolAtribuible('Médico')).toBe(true)
    expect(esRolAtribuible('Enfermería', 'uci')).toBe(true)
  })

  it('un rol que no está en el catálogo tampoco pasa', () => {
    // Es la puerta contra un modelo que se invente una categoría.
    expect(esRolAtribuible('Enfermería', 'consulta')).toBe(false)
    expect(esRolAtribuible('Vecino')).toBe(false)
  })

  it('y está escrito por qué existe esa salida', () => {
    expect(POR_QUE_EXISTE_NO_IDENTIFICADO).toMatch(/enfermería acaba etiquetada como «Paciente»/i)
  })
})

describe('EL PROMPT OFRECE EL CATÁLOGO DEL MÓDULO', () => {
  it('los roles van entrecomillados, para que se copien tal cual', () => {
    expect(catalogoParaPrompt('consulta')).toContain('"Médico"')
    expect(catalogoParaPrompt('uci')).toContain('"Enfermería"')
  })

  it('la ruta lo usa y pide explícitamente que no adivine', () => {
    expect(ruta).toContain('catalogoParaPrompt(modulo)')
    expect(ruta).toMatch(/es preferible a adivinar/)
  })

  it('la ruta ya no tiene una lista fija de tres', () => {
    expect(ruta).not.toContain("new Set(['Médico', 'Paciente', 'Acompañante'])")
  })
})

describe('LA RUTA SANEA Y CUENTA LO QUE NO SUPO', () => {
  it('descarta lo que no está en el catálogo del módulo', () => {
    expect(ruta).toContain('if (!validos.has(r)) continue')
  })

  it('y no archiva «no identificado», pero dice cuántos hubo', () => {
    /**
     * Devolver sólo los que sí se pudieron nombrar enseñaría una lista que
     * parece completa. El número dice cuántas voces se quedaron sin nombre.
     */
    expect(ruta).toContain('if (!esRolAtribuible(r, modulo)) { sinIdentificar++; continue }')
    expect(ruta).toContain('sinIdentificar, hablantes: hablantes.length')
  })
})

describe('Y EL MÓDULO VIAJA DESDE LA PANTALLA', () => {
  it('la consulta manda hospitalización cuando el paciente está internado', () => {
    expect(page).toContain("contexto: internamientoActivo ? 'hospitalizacion' : 'consulta'")
  })

  it('con el internamiento en las dependencias del efecto', () => {
    // Sin él, cambiar de paciente no cambiaría el catálogo hasta recargar.
    expect(page).toContain('}, [audio.utterances, voz.grabando, internamientoActivo])')
  })
})
