/**
 * GOLDEN — el candado anti-IDOR del dictado se desactivaba solo.
 *
 * ── LOS DOS DEFECTOS, QUE SE POTENCIABAN ─────────────────────────────────────
 *
 * REG-030 cerró un IDOR: en modo prueba varias clínicas comparten la llave del
 * dueño, así que sin comprobar propiedad cualquiera podía leer el dictado de
 * otra con sólo tener el UUID. La reparación fue registrar el dueño en
 * `transcript_owners` al crear el trabajo y verificarlo al leerlo.
 *
 * Pero:
 *
 * 1. **El registro se escribía sin `await`** — `void … .set().catch(() => {})`.
 *    En un runtime serverless la función puede terminar antes de que la
 *    escritura llegue a Firestore, así que el registro podía no existir nunca.
 *
 * 2. **La lectura era fail-open**: «si no hay registro de dueño (jobs previos),
 *    se permite».
 *
 * Juntos convertían el candado en una sugerencia: bastaba con que la escritura
 * no llegara —cosa que podía pasar precisamente porque no se esperaba— para que
 * cualquier consultorio con el UUID leyera el dictado. El agujero que REG-030
 * cerró volvía a abrirse por una carrera.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Se espera la escritura, y si falla no se devuelve el id: se purga el trabajo
 * en el proveedor y se pide reintentar. Un transcript sin dueño es PHI sin
 * candado — mejor que el médico repita el envío a dejarlo accesible.
 *
 * Y como todo id que un cliente conoce ya tiene dueño, la excepción del
 * fail-open sobra: sin dueño no se entrega.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/expediente/transcribir-diarizado/route.ts'), 'utf8')

describe('EL DUEÑO SE REGISTRA DE VERDAD, NO A LA BUENA DE DIOS', () => {
  it('la escritura se espera', () => {
    expect(ruta).toContain("await adminDb.collection('transcript_owners').doc(String(id))")
  })

  it('y ya no se lanza al aire con `void`', () => {
    /**
     * `void … .set()` es exactamente la carrera que reabría el agujero: la
     * respuesta salía antes de que el candado existiera.
     */
    expect(ruta).not.toMatch(/void adminDb\.collection\('transcript_owners'\)\.doc\(String\(id\)\)\.set/)
  })

  it('si no se puede registrar, NO se devuelve el id', () => {
    // Un transcript sin dueño es PHI sin candado.
    const i = ruta.indexOf("no se pudo registrar el dueño")
    expect(i).toBeGreaterThan(0)
    expect(ruta.slice(i, i + 500)).toContain('status: 503')
  })

  it('y se purga el trabajo en el proveedor antes de rendirse', () => {
    /**
     * Si no, quedaría PHI en casa de un tercero sin nadie que la reclame ni la
     * pueda borrar.
     */
    const i = ruta.indexOf("no se pudo registrar el dueño")
    expect(ruta.slice(i, i + 500)).toMatch(/method: 'DELETE'/)
  })
})

describe('SIN DUEÑO NO SE ENTREGA — fail-closed', () => {
  it('se exige que el dueño exista Y coincida', () => {
    expect(ruta).toContain("if (!dueño || dueño !== clinicId)")
  })

  it('la excepción de los «jobs previos» ya no está', () => {
    /**
     * Era la puerta por la que se colaba todo: cubría un caso que ya no existe
     * —desde que el POST espera la escritura, todo id conocido tiene dueño— y a
     * cambio dejaba pasar cualquier fallo de registro.
     */
    expect(ruta).not.toMatch(/Si no hay registro de dueño \(jobs previos\), se permite/)
  })

  it('y si el registro no se puede leer, tampoco se entrega', () => {
    // No se puede comprobar de quién es: no se entrega. Es la misma regla.
    const i = ruta.indexOf("const owner = await adminDb.collection('transcript_owners')")
    const bloque = ruta.slice(i, i + 400)
    expect(bloque).toContain('.catch(() => null)')
    expect(bloque).toContain('!dueño')
  })
})
