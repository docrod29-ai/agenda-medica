/**
 * GOLDEN — los turnos del pase de UCI viajaban a la consulta y no los leía nadie.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * El pase se dicta en `/uci` y se firma en `/consulta`. La v-anterior arregló
 * que el dictado **viajara** en la semilla de `sessionStorage`, y puso en el
 * tipo de la semilla `utterances?: unknown[]`.
 *
 * Y ni una línea lo consumía. `grep` de `parsed.utterances` fuera de este
 * archivo daba **cero**: los turnos llegaban a la consulta y se tiraban.
 *
 * Es el patrón «escrito, probado y sin conectar» —el fallo más caro de este
 * repositorio— dentro del arreglo que venía a cerrar exactamente eso.
 *
 * ── LO QUE SE APAGABA CON ELLOS ──────────────────────────────────────────────
 *
 * Sin turnos no hay confianzas por palabra, y sin confianzas por palabra se caen
 * a la vez: la separación de voces archivada, la lista de palabras a verificar,
 * el sexto motivo de confirmación —«el audio dudó justo donde había una dosis»,
 * que sólo se puede emitir desde aquí— y la procedencia V3, que decide **de
 * quién es cada cita**.
 *
 * O sea que el camino que más nota firmada produce en cuidados intensivos era el
 * que menos defensas tenía. Y desde la v996 también se archivaba sin material de
 * origen, porque el crudo del motor ni siquiera se metía en la semilla.
 *
 * ── LO QUE NO SE HACE ────────────────────────────────────────────────────────
 *
 * Si la pantalla de origen no manda el crudo, **no se inventa uno**: no se copia
 * el texto de trabajo al sitio del original. Eso es justo lo que la v996 cerró.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')
const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

describe('EL ORIGEN SALE DE UCI', () => {
  it('la semilla lleva los turnos Y el crudo del motor', () => {
    expect(uci).toContain('utterances: audio.utterances')
    expect(uci).toContain('crudo: audio.transcripcionMotor')
  })
})

describe('Y LA CONSULTA LO ADOPTA — que era lo que faltaba', () => {
  it('los turnos se leen de la semilla, no se ignoran', () => {
    expect(consulta).toContain('const turnos = Array.isArray(parsed) ? [] : (parsed?.utterances ?? [])')
  })

  it('y se siembran en el hook, que es quien los usa', () => {
    expect(consulta).toContain('audio.sembrarDictado({ crudo: crudo || undefined, utterances: turnos })')
  })

  it('la semilla vieja —sin turnos— sigue funcionando', () => {
    /**
     * Puede quedar una semilla escrita por la pestaña anterior. Romperla
     * perdería el pase que el médico acaba de dictar.
     */
    expect(consulta).toContain('Array.isArray(parsed) ? [] :')
    expect(consulta).toContain("Array.isArray(parsed) ? '' : String(parsed?.crudo ?? '')")
  })

  it('sin turnos ni crudo no se llama a sembrar', () => {
    expect(consulta).toContain('if (turnos.length || crudo)')
  })
})

describe('LA SIEMBRA JUEGA CON LAS MISMAS REGLAS', () => {
  it('emite el sexto motivo, que necesita las confianzas por palabra', () => {
    expect(hook).toContain('if (dudaEnZonaCritica(us, UNIDADES_CANONICAS))')
    expect(hook).toContain("'confianza_baja_con_termino_critico'")
  })

  it('sin duplicar el motivo si ya estaba', () => {
    expect(hook).toMatch(/m\.includes\('confianza_baja_con_termino_critico'\) \? m :/)
  })

  it('mantiene el espejo en referencia junto al estado', () => {
    // `aplicar` y el gate leen `utterancesRef`. Sembrar sólo el estado dejaría
    // la referencia vacía y el motivo no saldría nunca.
    expect(hook).toContain('setUtterances(us); utterancesRef.current = us')
  })

  it('NO inventa un crudo cuando la pantalla de origen no lo manda', () => {
    /**
     * Rellenarlo con el texto de trabajo archivaría como «original» algo ya
     * corregido por tres etapas y editable a mano: el defecto de la v996.
     */
    expect(hook).toContain('if (semilla.crudo) setTranscripcionMotor(semilla.crudo)')
    expect(hook).toMatch(/El crudo NO se inventa/)
  })

  it('no graba ni transcribe: sólo adopta', () => {
    expect(hook).toMatch(/No graba nada ni transcribe nada: sólo \*\*adopta\*\*/)
  })
})
