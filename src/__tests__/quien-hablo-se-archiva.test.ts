/**
 * GOLDEN — el diálogo archivado no decía quién habló.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `rolesHablante` —«Médico», «Paciente», «Familiar»— se calcula con
 * `/api/expediente/atribuir-roles`, **se enseña en pantalla y el médico lo puede
 * corregir a mano**. Se usa para la procedencia al firmar… y ahí se acaba.
 *
 * Lo que se guardaba en `dialogoDiarizado` era `speaker`: la etiqueta del motor,
 * «A» y «B». O sea que la atribución que el médico confirmó se perdía en el
 * momento de guardar, y el expediente quedaba con un diálogo anónimo.
 *
 * ── POR QUÉ IMPORTA, Y NO ES COSMÉTICO ───────────────────────────────────────
 *
 * Es exactamente el dato que hace falta cuando se discute una nota: si «DM2» lo
 * **afirmó el paciente** o lo **nombró la pregunta del médico** («¿diabetes o
 * presión alta?» → «no»). Ese caso es real, salió de una consulta del Dr., y de
 * él nacieron el motor de negaciones y la procedencia V3.
 *
 * Las dos defensas funcionan **mientras dura la sesión**, porque leen
 * `rolesHablante` en memoria. Al archivar, el dato que las sostiene desaparecía.
 *
 * ── EL SELLO NO SE ROMPE ─────────────────────────────────────────────────────
 *
 * `dialogoDiarizado` ya iba sellado, y se sella **tal como está guardado**: las
 * notas viejas siguen sin `rol` y su canónico sale idéntico al del día que se
 * firmaron. El campo nuevo sólo aparece en las notas nuevas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAMPOS_SELLADOS_V3 } from '@/lib/expediente/integrity'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const vista = leer('src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx')
const tipos = leer('src', 'types', 'expediente.ts')

describe('EL ROL SE GUARDA', () => {
  it('el tipo lo admite', () => {
    expect(tipos).toContain('dialogoDiarizado?: { speaker: string; text: string; rol?: string }[]')
  })

  it('y la nota lo escribe desde los roles que el médico revisó', () => {
    expect(consulta).toContain('...(rolesHablante[u.speaker] ? { rol: rolesHablante[u.speaker] } : {})')
  })

  it('sin rol conocido NO se inventa uno', () => {
    /**
     * Escribir «Médico» por defecto sería peor que no escribir nada: pondría en
     * boca del médico frases del paciente, que es el error concreto del que
     * salió toda esta línea de trabajo.
     */
    expect(consulta).not.toMatch(/rol: rolesHablante\[u\.speaker\] \|\| 'Médico'/)
    expect(consulta).toContain("rolesHablante[u.speaker] ? {")
  })

  it('el turno sigue llevando su `speaker`, que es lo que dijo el motor', () => {
    // Si se sustituyera por el rol, se perdería la etiqueta original y ya no se
    // podría comprobar que dos turnos vienen de la misma voz.
    expect(consulta).toContain('speaker: u.speaker,')
  })
})

describe('Y SE LEE AL RELEER LA NOTA', () => {
  it('la vista enseña el rol cuando existe', () => {
    expect(vista).toContain('{t.rol || `Hablante ${t.speaker}`}')
  })

  it('las notas viejas —sin rol— no quedan rotas', () => {
    // Enseñan «Hablante A», que es la verdad de lo que se guardó, en vez de
    // fingir una atribución que nadie hizo.
    expect(vista).toContain('`Hablante ${t.speaker}`')
  })
})

describe('EL SELLO', () => {
  it('`dialogoDiarizado` sigue sellado, y se sella tal como está guardado', () => {
    /**
     * Por eso añadir una llave opcional no marca «alterada» ninguna nota vieja:
     * su documento no cambia, y el canónico se calcula sobre el documento.
     */
    expect(CAMPOS_SELLADOS_V3).toContain('dialogoDiarizado')
  })
})
