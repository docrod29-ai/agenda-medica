/**
 * NINGÚN CAMINO PUEDE VOLVER A EMPAREJAR POR TELÉFONO A SOLAS.
 *
 * ── EL FALLO, EN UNA FRASE ───────────────────────────────────────────────────
 *
 * Cuatro caminos distintos decidían a qué expediente pertenece una cita, y tres
 * lo hacían buscando por TELÉFONO y quedándose con el primero. En México el
 * celular es de la casa: la reserva de un hijo aterrizaba en el expediente de
 * quien se hubiera registrado antes con ese número — y con ella la nota, el
 * diagnóstico y la receta que se escribieran después.
 *
 * No es un expediente partido, que se arregla. Es información clínica en la
 * persona equivocada, y no se ve como un error: se ve como un paciente que vino
 * a consulta.
 *
 * ── POR QUÉ UNA PRUEBA QUE LEE EL CÓDIGO ─────────────────────────────────────
 *
 * Es exactamente el fallo que vuelve: alguien añade un cuarto camino —un portal
 * nuevo, otro bot— y «buscar el paciente por su teléfono» es lo primero que se
 * le ocurre a cualquiera. Es la solución obvia, y es la equivocada.
 *
 * Esta prueba recorre los archivos que deciden y falla si alguno vuelve a
 * emparejar sin pasar por el motor, que exige parecido de NOMBRE.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

/** Los caminos por los que una cita puede acabar colgada de un expediente. */
const CAMINOS = [
  'src/app/(dashboard)/asistente/page.tsx',      // el mostrador
  'src/app/api/public/booking/route.ts',         // el paciente reservando solo
  'src/app/api/whatsapp/webhook/route.ts',       // el bot
]

describe('a qué expediente se cuelga una cita', () => {
  for (const archivo of CAMINOS) {
    it(`${archivo.split('/').slice(-2).join('/')} decide con el motor, no con el teléfono`, () => {
      expect(
        leer(archivo),
        `${archivo} empareja pacientes sin pasar por elegirExpedienteParaCita. ` +
        'El teléfono NO basta: lo comparte la familia, y la cita acabaría en el expediente de otra persona.',
      ).toMatch(/elegirExpedienteParaCita/)
    })
  }

  it('ninguno se queda con «el primero» de una búsqueda por teléfono', () => {
    /**
     * `limit(1)` sobre una consulta por teléfono es la forma exacta que tenía el
     * fallo: pide UN documento y lo usa, así que el índice elige por ti a qué
     * paciente pertenece la cita.
     */
    for (const archivo of CAMINOS) {
      const src = leer(archivo)
      const sospechoso = /where\(\s*['"]telefono['"][\s\S]{0,80}?limit\(1\)/.test(src)
      expect(sospechoso, `${archivo} vuelve a quedarse con el primer expediente que tenga ese teléfono`).toBe(false)
    }
  })
})
