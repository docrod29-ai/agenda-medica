/**
 * GOLDEN — REG-271: transcribir una grabación no puede borrar el audio de OTRA
 * que nadie transcribió.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `borrarChunks(recoveryKey)` borraba el rango COMPLETO de la llave
 * (`IDBKeyRange.bound([k,0], [k,MAX_SAFE_INTEGER])`), mientras que el blob que
 * se manda a transcribir se arma **sólo con los trozos de la sesión en curso**
 * (`todosChunksRef`, que se vacía en cada desmontaje).
 *
 * Y la llave no es por sesión: es `consulta-{patientId}`, la misma cada vez que
 * se abre ese paciente. El hook ya lo sabía —al empezar a grabar cuenta los
 * trozos que ya hay y arranca su índice DESPUÉS (`recoveryBaseRef`), para no
 * pisar audio huérfano—. La defensa estaba escrita a medias: protegía al
 * escribir y no al borrar.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría del producto real (PATIENT-UX-TRUTH-001, 8-ago-2026), leyendo el
 * camino de navegación de la consulta. Se cruzó con PATIENT-AUDIO-002 —navegar
 * termina la grabación sin transcribirla— que es justo lo que FABRICA el
 * huérfano. Los dos juntos son la pérdida: uno lo deja tirado, el otro lo barre.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ────────────────────────────────────────
 *
 * Secuencia real y nada rebuscada: dictar 22 minutos de consulta → tocar
 * «Agenda» en la barra inferior para mirar la hora del siguiente → volver →
 * dictar 90 segundos más → detener. Los 90 segundos se transcriben, salen en
 * pantalla, todo parece bien — y los 22 minutos desaparecen de IndexedDB sin
 * haber pasado por ningún transcriptor. No hay error, no hay aviso, y el cartel
 * de «Recuperar audio» ya no tiene nada que ofrecer. La consulta se perdió.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Sólo se borra lo que se leyó. Quien transcribe un rango parcial borra ese
 * rango parcial (`desde = recoveryBase`); quien transcribe todo —recuperación
 * manual— o descarta a propósito, borra todo (`desde = 0`).
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · No arregla PATIENT-AUDIO-002: navegar sigue terminando la grabación sin
 *   transcribirla. Esto sólo garantiza que ese audio SOBREVIVA para recuperarse.
 * · No arregla PATIENT-AUDIO-003: el cierre por inactividad sigue llamando a
 *   `deleteDatabase('nexusmed-recovery')`, que se lleva la base entera y no pasa
 *   por estas funciones.
 * · No prueba el hook: `useGrabacionAudio.ts` arrastra React, Firebase y el
 *   pipeline de ASR, y la suite corre en `node`. Lo que se prueba aquí es el
 *   almacén, con un IndexedDB de verdad; el cableado del hook lo vigila la
 *   aserción estática del final.
 * · No cubre la carrera entre dos pestañas grabando al mismo paciente a la vez.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guardarChunk, leerChunks, borrarChunks } from '@/lib/audio/recuperacion-chunks'

/** Un trozo reconocible por su contenido, para poder decir CUÁL sobrevivió. */
const trozo = (marca: string) => new Blob([marca], { type: 'audio/webm' })
const textos = async (blobs: Blob[]) => Promise.all(blobs.map(b => b.text()))

const LLAVE = 'consulta-paciente-sintetico-001'

beforeEach(async () => {
  await borrarChunks(LLAVE, 0)
})

describe('REG-271 · el borrado se limita a lo que SÍ se transcribió', () => {
  it('la grabación huérfana sobrevive a una transcripción posterior exitosa', async () => {
    // Sesión 1 — 22 minutos que se quedaron sin transcribir (se navegó fuera).
    await guardarChunk(LLAVE, 0, trozo('huerfano-0'))
    await guardarChunk(LLAVE, 1, trozo('huerfano-1'))
    await guardarChunk(LLAVE, 2, trozo('huerfano-2'))

    // Sesión 2 — arranca DESPUÉS del huérfano, como hace `recoveryBaseRef`.
    const base = (await leerChunks(LLAVE)).length
    expect(base).toBe(3)
    await guardarChunk(LLAVE, base + 0, trozo('nuevo-0'))
    await guardarChunk(LLAVE, base + 1, trozo('nuevo-1'))

    // `detener()` transcribe SÓLO los trozos de esta sesión y limpia SU rango.
    await borrarChunks(LLAVE, base)

    // Con el borrado completo, aquí quedaban cero trozos y los 22 min se perdían.
    const quedan = await textos(await leerChunks(LLAVE))
    expect(quedan).toEqual(['huerfano-0', 'huerfano-1', 'huerfano-2'])
  })

  it('sin huérfano previo, la limpieza sigue dejando la llave vacía', async () => {
    /**
     * El caso normal —el 99 % de las consultas— no puede quedarse con basura:
     * si `base` es 0, borrar «desde 0» es exactamente el borrado de siempre. Sin
     * esta prueba, el arreglo podría conservar audio de más y hacer que la
     * siguiente grabación se transcribiera pegada a la anterior.
     */
    await guardarChunk(LLAVE, 0, trozo('a'))
    await guardarChunk(LLAVE, 1, trozo('b'))
    await borrarChunks(LLAVE, 0)
    expect(await leerChunks(LLAVE)).toEqual([])
  })

  it('borrar un rango de una llave no toca a otro paciente', async () => {
    /**
     * El rango lleva la llave en las dos cotas. Si alguien lo simplificara a un
     * rango sólo por índice, borrar la consulta de un paciente se llevaría la de
     * otro — que es fuga de datos entre expedientes, no sólo pérdida.
     */
    const otra = 'consulta-paciente-sintetico-002'
    await borrarChunks(otra, 0)
    await guardarChunk(LLAVE, 0, trozo('mio'))
    await guardarChunk(otra, 0, trozo('del-otro'))
    await borrarChunks(LLAVE, 0)
    expect(await textos(await leerChunks(otra))).toEqual(['del-otro'])
    await borrarChunks(otra, 0)
  })

  it('el hook borra el rango de la sesión, no el rango completo', async () => {
    /**
     * EL DATO TIENE QUE LLEGAR. Que `borrarChunks` sepa recortar el rango no
     * sirve de nada si el hook lo sigue llamando sin `desde`: el defecto vuelve
     * entero y esta prueba seguiría verde con el arreglo desconectado.
     *
     * Se comprueban las TRES salidas exitosas de `detener()` —dictado sin
     * diarización, diarización, y transcripción por partes—, que son las tres
     * que borran tras transcribir sólo lo de esta sesión. El número va fijado a
     * propósito: si mañana aparece una CUARTA salida y nadie le pasa `desde`,
     * esta prueba se pone roja en vez de dejarla entrar sin defensa.
     */
    const hook = readFileSync(join(process.cwd(), 'src', 'hooks', 'useGrabacionAudio.ts'), 'utf8')
    const borradosTrasTranscribir = hook.match(/borrarChunks\(recoveryKeyRef\.current[^)]*\)/g) ?? []
    expect(borradosTrasTranscribir.length).toBe(3)
    for (const llamada of borradosTrasTranscribir) {
      expect(llamada).toContain('recoveryBaseRef.current')
    }
  })
})
