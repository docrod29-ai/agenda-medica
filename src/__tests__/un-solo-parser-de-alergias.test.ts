/**
 * GOLDEN — cuatro parsers distintos del MISMO campo de alergias.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * Leyendo el camino del alérgeno de punta a punta: dónde nace, quién lo lee y
 * dónde acaba. El módulo canónico lo dice desde que se escribió — «dos splitters
 * distintos daban listas distintas del MISMO campo» — y aun así había cuatro:
 * el canónico, el del sesgo de voz en la consulta, el de UCI (con su propia
 * heurística de negación) y el del extractor de entidades.
 *
 * ── QUÉ PERDÍAN LOS TRES DE FUERA ────────────────────────────────────────────
 *
 * 1. **La barra y la «y».** «Penicilina / Sulfas» y «Penicilina y sulfas» salían
 *    como UN término. Al motor de voz eso le llega como una frase, y el alérgeno
 *    de en medio deja de sesgar nada.
 * 2. **Las negaciones.** «Niega alergias» viajaba como si fuera un alérgeno: se
 *    le enseñaba al reconocedor a esperar esa frase, gastando sitio del sesgo.
 * 3. **`alergiasEstructuradas`.** Un paciente con sus alergias bien capturadas y
 *    el texto libre vacío mandaba **cero**: justo el mejor documentado.
 *
 * ── POR QUÉ DUELE MÁS EN EL SESGO QUE EN NINGÚN OTRO SITIO ───────────────────
 *
 * El cruce alergia↔fármaco compara contra **lo que se oyó**. Un alérgeno que no
 * llegó al sesgo puede salir mal transcrito, y entonces el cruce **nunca salta**:
 * no hay una segunda oportunidad más adelante.
 *
 * ── Y UNA NOTA SOBRE QUIÉN LO ESCRIBIÓ ───────────────────────────────────────
 *
 * `alergenosDe` se escribió el 4-ago y **salió a producción en la v1031 sin un
 * solo llamador**: escrita, probada y sin conectar, la misma clase de fallo que
 * este repositorio lleva el año persiguiendo. Se cazó revisando el estado antes
 * de seguir. Por eso esta prueba comprueba **los llamadores**, no sólo la función.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alergenosDe } from '@/lib/seguridad/alergias'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('LO QUE LOS PARSERS DE FUERA PERDÍAN', () => {
  it('«Penicilina / Sulfas» son DOS alérgenos, no una frase', () => {
    expect(alergenosDe({ alergias: 'Penicilina / Sulfas' })).toEqual(['Penicilina', 'Sulfas'])
  })

  it('y «penicilina y sulfas» también', () => {
    expect(alergenosDe({ alergias: 'penicilina y sulfas' })).toEqual(['penicilina', 'sulfas'])
  })

  it('«niega alergias» NO es un alérgeno', () => {
    // Mandarlo al sesgo le enseña al reconocedor a esperar esa frase y gasta
    // sitio del presupuesto en algo que no existe.
    expect(alergenosDe({ alergias: 'Niega alergias' })).toEqual([])
    expect(alergenosDe({ alergias: 'sin alergias conocidas' })).toEqual([])
  })

  it('las estructuradas mandan cuando existen', () => {
    expect(alergenosDe({ alergiasEstructuradas: [{ alergeno: 'Penicilina' }] })).toEqual(['Penicilina'])
  })

  it('y el campo se acepta venga como venga: texto o lista', () => {
    // En el repositorio llega de las dos formas, y eso no lo arregla un llamador.
    expect(alergenosDe({ alergias: ['Penicilina', 'Sulfas'] })).toEqual(['Penicilina', 'Sulfas'])
    expect(alergenosDe({ alergias: [{ alergeno: 'Penicilina' }] as never })).toEqual(['Penicilina'])
  })

  it('sin nada, nada: no inventa un alérgeno', () => {
    expect(alergenosDe({})).toEqual([])
    expect(alergenosDe({ alergias: '   ' })).toEqual([])
  })
})

describe('LOS TRES LLAMADORES USAN EL MISMO', () => {
  const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
  const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')

  it('el sesgo del reconocedor en la consulta', () => {
    expect(consulta).toContain('alergias: alergenosDe(patient ?? {})')
  })

  it('el extractor de entidades', () => {
    expect(consulta).toContain('const alergiasRegistradas = alergenosDe(patient ?? {})')
  })

  it('y UCI', () => {
    expect(uci).toContain('const lista = alergenosDe(paciente ?? {})')
  })

  it('y el cruce alergia↔fármaco del copiloto (REG-208)', () => {
    /**
     * El cuarto llamador, que esta lista no tenía: no partía el campo a mano
     * —por eso el guardián de abajo no lo veía— sino que lo leía ENTERO y
     * buscaba el fármaco dentro con un `includes`, negaciones incluidas.
     * Se apunta aquí porque ésta es la lista donde se mira quién lee el campo.
     */
    const copiloto = leer('src', 'lib', 'expediente', 'copiloto.ts')
    expect(copiloto).toContain('alergenosDe({')
  })

  it('y ya no queda ningún splitter propio del campo', () => {
    /**
     * El guardián que impide la quinta copia. Si alguien vuelve a partir el
     * campo a mano, esta prueba lo dice antes de que llegue a producción.
     */
    for (const [nombre, src] of [['consulta', consulta], ['uci', uci]] as const) {
      expect(src, `${nombre} volvió a partir las alergias a mano`)
        .not.toMatch(/alergias[^\n]*\.split\(\/\[/)
    }
  })
})
