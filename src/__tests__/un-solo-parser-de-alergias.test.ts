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
import { execSync } from 'node:child_process'
import { alergenosDe, alergiasDe } from '@/lib/seguridad/alergias'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** `grep` sin coincidencias sale con 1; aquí eso es la lista vacía, no un error. */
const ejecutar = (cmd: string) => {
  try {
    return execSync(cmd, { cwd: process.cwd(), encoding: 'utf8' })
  } catch {
    return ''
  }
}

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

  it('y ya no queda ningún splitter propio del campo, EN TODO EL REPOSITORIO', () => {
    /**
     * ── EL GUARDIÁN MIRABA SÓLO DONDE YA SE HABÍA ARREGLADO (6-ago-2026) ─────
     *
     * Esto se llamaba «el guardián que impide la quinta copia» y recorría dos
     * archivos: `consulta/page.tsx` y `uci/page.tsx` — precisamente los dos que
     * acababan de repararse. La quinta copia **existía mientras el guardián
     * estaba en verde**: vivía en `hospital/cds.ts`, el punto de orden, y allí
     * el guardián no miraba (REG-201).
     *
     * Un candado que sólo inspecciona los archivos que ya arreglaste no puede
     * encontrar el que se te pasó. Es la misma clase de fallo que REG-191: la
     * intención era buena y la implementación la impedía.
     *
     * Por eso ahora barre `src/` entero. La lista de archivos deja de ser algo
     * que alguien tenga que acordarse de ampliar.
     */
    const sospechosos = ejecutar(
      'grep -rlE "alergia[A-Za-z]*[^\\n]{0,60}\\.split\\(" --include=*.ts --include=*.tsx src/',
    )
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      // El canónico ES el que parte el campo: es su trabajo, y de él salen los demás.
      .filter(f => f !== 'src/lib/seguridad/alergias.ts')
      // Las pruebas hablan del defecto; citarlo no es cometerlo.
      .filter(f => !f.startsWith('src/__tests__/'))

    expect(sospechosos, 'alguien volvió a partir el campo de alergias a mano').toEqual([])
  })
})

/**
 * ── EL SEXTO CAMINO: LO QUE SE FIRMA (8-ago-2026, REG-203) ──────────────────
 *
 * REG-201 amplió el guardián a `src/` entero para que ninguna copia se
 * escondiera en un archivo que la lista no nombraba. Barre lo que **parte** el
 * campo a mano. Y quedaban dos sitios de la consulta que no partían nada: el
 * campo `alergias` de la NOTA QUE SE FIRMA y la lista del sello de procedencia
 * (tres usos, tras un ayudante local de una línea, `alergiasArray`). Los dos
 * llamaban a `parsearAlergiasTexto` — el partidor bueno, sobre **una sola de las
 * dos fuentes**.
 *
 * Reproducido con las funciones reales, sobre un paciente sintético cuya alergia
 * vive sólo en `alergiasEstructuradas`:
 *
 *     pantalla / receta impresa → [{ alergeno: 'Penicilina', severidad: 'grave' }]
 *     NOTA FIRMADA / sello      → []
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * La nota firmada es el registro medicolegal, y es lo que leen la consulta
 * siguiente y quien reciba al paciente. Decía «no consta ninguna alergia» de un
 * paciente con alergia grave a penicilina documentada, mientras la misma
 * pantalla la enseñaba en rojo. Y el sello de procedencia, al contar cero
 * alergias, dejaba fuera de `camposSinEvidencia` justo el dato que gobierna la
 * compuerta de la receta.
 *
 * `alergiasEstructuradas` está en `CAMPOS_CLINICOS_PACIENTE` —lista blanca de
 * escritura—, así que cualquier importación o mapeo desde otro sistema lo activa
 * el mismo día. Es el modo de fallo que `alergiasParaImpreso` ya había cerrado
 * para el papel; faltaba cerrarlo para lo que se firma.
 *
 * ── LO QUE ESTA FAMILIA DE FALLOS ENSEÑA ─────────────────────────────────────
 *
 * Los guardianes anteriores buscaban un **partidor propio**. Aquí no faltaba el
 * partidor: faltaba **una fuente**. Por eso estas afirmaciones miran qué función
 * se llama, no cómo se corta el texto.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No comprueba que la nota se GUARDE con ese campo —eso vive del otro lado de la
 * frontera de escritura—, ni que `alergiasEstructuradas` se llene alguna vez: hoy
 * ninguna ruta de la app lo escribe. Cubre que, si llega, la firma la vea.
 */
describe('LA NOTA FIRMA LO MISMO QUE LA PANTALLA ENSEÑA', () => {
  const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('una alergia que sólo vive en el campo estructurado llega a la nota', () => {
    // Sintético. Es exactamente el paciente que salía con `alergias: []` firmado.
    const paciente = { alergiasEstructuradas: [{ alergeno: 'Penicilina', severidad: 'grave' as const }] }
    expect(alergiasDe(paciente)).toEqual([{ alergeno: 'Penicilina', severidad: 'grave' }])
  })

  it('y también al sello de procedencia, que contaba cero', () => {
    expect(alergenosDe({ alergiasEstructuradas: [{ alergeno: 'Penicilina' }] })).toEqual(['Penicilina'])
  })

  it('el mismo alérgeno escrito dos veces se firma una', () => {
    // La nota llevaba ['Penicilina', 'penicilina']; la pantalla, una sola.
    expect(alergiasDe({ alergias: 'Penicilina, penicilina' })).toEqual([{ alergeno: 'Penicilina' }])
  })

  it('el campo de la nota firmada usa el canónico', () => {
    expect(consulta).toContain('alergias: alergiasDe(patient ?? {})')
  })

  it('y los tres usos del sello también', () => {
    const usos = consulta.match(/alergias: alergenosDe\(patient \?\? \{\}\)/g) ?? []
    // Uno es el sesgo del reconocedor; los otros tres, el sello de procedencia:
    // el manifiesto de la nota, `camposSinEvidencia` y el panel en pantalla.
    expect(usos.length).toBe(4)
  })

  it('y la consulta ya no tiene ayudante propio de alergias', () => {
    /**
     * `alergiasArray` era un envoltorio de una línea sobre `parsearAlergiasTexto`.
     * Parecía inofensivo —usaba el partidor bueno— y por eso sobrevivió a dos
     * limpiezas: lo que perdía no era el partidor, era la otra fuente.
     */
    expect(consulta, 'volvió el ayudante local de alergias').not.toContain('function alergiasArray')
    // La LLAMADA, no la mención: el comentario del arreglo nombra la función que
    // se retiró, y es justo lo que explica por qué se retiró.
    expect(consulta, 'la consulta volvió a leer sólo el texto libre').not.toMatch(/parsearAlergiasTexto\(/)
  })
})
