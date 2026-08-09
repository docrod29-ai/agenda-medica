/**
 * GOLDEN — V9 · NAVIGATION-001 · «volver» tiene que devolver lo que había.
 *
 * ── QUÉ FALLABA, EN EL CICLO QUE EL MÉDICO HACE TODO EL DÍA ─────────────────
 *
 * El requisito de la directiva es literal: *«Agenda → Paciente → Consulta →
 * Resultados → Consulta debe devolver **exactamente** el contexto anterior»*, y
 * la lista de lo que nunca se debe perder incluye `filters`.
 *
 * Se rompía en dos sitios, y los dos se pagan **una vez por paciente**:
 *
 *  1. **El atrás de la consulta no era un atrás.** Hacía `push` a un destino
 *     FIJO —el expediente— mientras la agenda entra directo a la consulta. El
 *     historial quedaba `/citas → /consulta → /expediente` y el médico oscilaba
 *     entre las dos últimas: para volver a la agenda tenía que renavegar.
 *     `useSmartBack` ya existía y lo usaban diez pantallas. La consulta, no.
 *
 *  2. **La agenda se olvidaba del día.** Fecha, filtro y búsqueda vivían en
 *     `useState`, y `(dashboard)/template.tsx` **garantiza** que la página se
 *     desmonta en cada navegación. Quien prepara el jueves desde el martes
 *     volvía al día de hoy después de cada paciente — y el día de hoy, vacío,
 *     se lee como «no hay nadie citado».
 *
 * ── Y UNA TERCERA, QUE ES PÉRDIDA DE DATOS ──────────────────────────────────
 *
 * `proximoSeguimiento` (REG-193) se había arreglado en **uno** de los tres
 * caminos de escritura del respaldo. Faltaba en el espejo en memoria —el que se
 * usa justo al volver de otra pantalla— y en `flushRespaldo`, que reescribe
 * `localStorage` **al desmontar**: o sea que salir de la consulta BORRABA la
 * copia buena que el rebote de 1500 ms ya había dejado.
 *
 * Un arreglo parcial se vuelve destructivo cuando el camino que falta es el
 * último en escribir. Y la ruta manual de restauración (el botón del banner)
 * tampoco lo reponía — el mismo error que ya se había cometido en este archivo
 * con el `notaId`, y que su propio comentario documenta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * `docs/design/NAVIGATION_STATE_AUDIT.md`, hallazgos nº 7, nº 9 y nº 10, de la
 * auditoría estática de `PATIENT-UX-TRUTH-001`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El respaldo tiene tres caminos de escritura y dos de lectura. La invariante no
 * es «que `proximoSeguimiento` esté»: es que **los cinco lleven el mismo juego
 * de campos**. Por eso este archivo los compara entre sí en vez de buscar un
 * nombre — así el campo que alguien añada mañana a uno solo también falla.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - **No se abrió un navegador.** `vitest` corre en entorno `node`, sin DOM, así
 *   que ningún caso de aquí renderiza la consulta ni pulsa el botón. Lo que se
 *   puede probar de verdad —la construcción de la URL— está extraído a funciones
 *   puras; lo demás se vigila leyendo la fuente, que detecta que el cableado
 *   desaparezca pero no que se comporte mal.
 * - **No comprueba `history.state.idx` real tras una recarga**, del que depende
 *   `useSmartBack`. Es la comprobación nº 5 de `NAV-NAVEGADOR-001`.
 * - **No cubre el scroll** (restaurado en una sola pantalla de la aplicación),
 *   ni el filtro del expediente, ni el panel de laboratorio sin confirmar.
 *   Siguen abiertos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { urlConParametro, urlSinParametro } from '@/hooks/useParametroDeUrl'

const consulta = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
const citas = readFileSync(join(process.cwd(), 'src/app/(dashboard)/citas/page.tsx'), 'utf8')

/** Quita comentarios de bloque y de línea, que si no ensucian el analizador. */
function sinComentarios(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * Las claves de PRIMER nivel de un objeto literal escrito en la fuente —tanto
 * `clave: valor` como la forma corta `clave`—, contando la profundidad de
 * llaves, paréntesis y corchetes para no confundir una clave anidada con una de
 * arriba.
 *
 * Se analiza la fuente y no el objeto en ejecución porque estos literales viven
 * dentro de un componente de React que esta suite no puede montar: `vitest`
 * corre en entorno `node`, sin DOM.
 */
function clavesDelLiteral(fuente: string, desde: number): Set<string> {
  const t = sinComentarios(fuente.slice(desde))
  const abre = t.indexOf('{')
  const claves = new Set<string>()
  const anotar = (bruto: string) => {
    const nombre = bruto.trim()
    if (/^[A-Za-z_$][\w$]*$/.test(nombre)) claves.add(nombre)
  }
  let prof = 0, actual = ''
  for (let i = abre; i < t.length; i++) {
    const c = t[i]
    if (c === '{' || c === '(' || c === '[') { prof++; actual = ''; continue }
    if (c === '}' || c === ')' || c === ']') {
      if (prof === 1) anotar(actual)          // forma corta antes del cierre
      prof--
      if (prof === 0) break
      actual = ''
      continue
    }
    if (prof !== 1) continue
    if (c === ',') { anotar(actual); actual = ''; continue }
    if (c === ':') {
      anotar(actual)
      // Saltar el valor hasta la coma de ESTE nivel.
      let p2 = 0
      for (i++; i < t.length; i++) {
        const d = t[i]
        if (d === '{' || d === '(' || d === '[') p2++
        else if (d === '}' || d === ')' || d === ']') { if (p2 === 0) { i--; break } p2-- }
        else if (d === ',' && p2 === 0) break
      }
      actual = ''
      continue
    }
    actual += c
  }
  return claves
}

describe('el respaldo de la consulta: TRES caminos de escritura, un solo juego de campos', () => {
  // 1 · rebote de 1500 ms → localStorage · 2 · espejo en memoria · 3 · flush al salir.
  const rebote = clavesDelLiteral(consulta, consulta.indexOf('localStorage.setItem(respaldoKey'))
  const memoria = clavesDelLiteral(consulta, consulta.indexOf('borradorMem.escribir(respaldoKey'))
  const flush = clavesDelLiteral(consulta, consulta.lastIndexOf('localStorage.setItem(respaldoKey'))

  it('los tres se encontraron y no están vacíos (si no, lo de abajo no prueba nada)', () => {
    for (const [nombre, c] of [['rebote', rebote], ['memoria', memoria], ['flush', flush]] as const) {
      expect(c.size, `${nombre}: no se pudo leer el literal`).toBeGreaterThan(6)
      expect([...c], `${nombre}`).toContain('resumen')
    }
    // Y que de verdad sean dos sitios distintos, no el mismo leído dos veces.
    expect(consulta.indexOf('localStorage.setItem(respaldoKey'))
      .not.toBe(consulta.lastIndexOf('localStorage.setItem(respaldoKey'))
  })

  /**
   * `ts` es sólo del respaldo persistido (el de memoria no caduca) y `notaId` se
   * escribe desde una `ref` en los tres, con nombres distintos. El resto del
   * contenido clínico tiene que coincidir.
   */
  const soloDelPersistido = new Set(['ts'])
  const contenido = (c: Set<string>) => [...c].filter(k => !soloDelPersistido.has(k)).sort()

  it('el espejo en MEMORIA lleva lo mismo que el respaldo persistido', () => {
    // Es el camino que se usa justo al volver de otra pantalla: lo que le falte
    // es exactamente lo que el médico ve en blanco al regresar.
    expect(contenido(memoria)).toEqual(contenido(rebote))
  })

  it('el FLUSH al salir lleva lo mismo — o borra lo que el rebote ya había guardado', () => {
    // Reescribe la MISMA clave de localStorage al desmontar. Un campo que le
    // falte no es «un campo que no se guarda»: es un campo que se BORRA.
    expect(contenido(flush)).toEqual(contenido(rebote))
  })

  it('y `proximoSeguimiento` está en los tres (REG-193, que sólo cubrió uno)', () => {
    for (const [nombre, c] of [['rebote', rebote], ['memoria', memoria], ['flush', flush]] as const) {
      expect([...c], nombre).toContain('proximoSeguimiento')
    }
  })

  it('las DOS rutas de restauración lo reponen, no sólo la automática', () => {
    // La automática y el botón del banner. Arreglar una y dejar la otra es el
    // error que este archivo ya cometió con `notaId`, y lo dice en un comentario.
    expect(consulta.match(/setProximoSeguimiento\(b\.proximoSeguimiento\)/g) ?? []).toHaveLength(2)
  })

  it('«¿hay algo que guardar?» también lo mira: escribir SÓLO la fecha se guarda', () => {
    // Si no, la fecha de la próxima consulta como único dato no dispara nada.
    // Sólo las que GUARDAN. Se reconocen porque miran `preop`: hay otra
    // `hayContenido` en el archivo que decide si confirmar un cambio de
    // modalidad, y ésa no tiene por qué mirar la fecha de seguimiento.
    const condiciones = (consulta.match(/const hay(?:Contenido)? =[\s\S]*?(?=\n\s*(?:if|\/\*\*|\/\/))/g) ?? [])
      .filter(c => /preop/.test(c))
    expect(condiciones.length, 'no se encontraron las condiciones de guardado').toBeGreaterThanOrEqual(4)
    for (const c of condiciones) expect(c, c.slice(0, 60)).toMatch(/proximoSeguimiento/)
  })
})

describe('el atrás de la consulta es un atrás', () => {
  it('usa `useSmartBack`, como las otras diez pantallas', () => {
    expect(consulta).toContain("from '@/hooks/useSmartBack'")
    expect(consulta).toMatch(/const volverAtras = useSmartBack\(volverA\)/)
  })

  it('el botón ya NO empuja a un destino fijo', () => {
    // `push(volverA)` en el botón era lo que dejaba el historial
    // `/citas → /consulta → /expediente` y obligaba a renavegar tras cada paciente.
    expect(consulta).not.toMatch(/<button onClick=\{\(\) => router\.push\(volverA\)\}/)
    expect(consulta).toMatch(/<button onClick=\{volverAtras\}/)
  })

  it('conserva el destino de reserva para quien llega por enlace directo', () => {
    // Sin historial (deep link, recarga, notificación) hay que ir a algún sitio,
    // y ese sitio depende de si la nota es de hospital o de consultorio.
    expect(consulta).toMatch(/const volverA = esNotaHospital \?/)
  })

  it('y dice a dónde va, para quien no ve el botón', () => {
    // La etiqueta pasó a «Atrás» porque el destino dejó de ser fijo; el destino
    // de reserva se sigue anunciando a quien usa lector de pantalla.
    expect(consulta).toMatch(/aria-label=\{esNotaHospital \? 'Volver al episodio' : 'Volver al expediente'\}/)
  })
})

describe('la agenda recuerda qué día estabas viendo', () => {
  it('fecha, vista y búsqueda viven en la URL', () => {
    expect(citas).toContain("useParametroDeUrl('f', todayStr())")
    expect(citas).toContain("useParametroDeUrl('v', 'todas')")
    expect(citas).toContain("useParametroDeUrl('q', ''")
  })

  it('la búsqueda va con rebote: un `replace` por tecla es historial por letra', () => {
    expect(citas).toMatch(/useParametroDeUrl\('q', '', \{ reboteMs: \d+ \}\)/)
  })

  it('cerrar el `?id=` de una cita ya no se lleva el resto de la URL por delante', () => {
    // Hacía `router.replace('/citas')`, que borraba TODA la cadena de consulta.
    // El defecto no existía antes porque no había nada más que borrar.
    expect(citas).not.toContain("router.replace('/citas'")
    expect(citas.match(/urlSinParametro\(pathname, params, 'id'\)/g) ?? []).toHaveLength(2)
  })
})

/**
 * Y LO ÚNICO QUE SE PUEDE PROBAR DE VERDAD SIN NAVEGADOR: la URL que se compone.
 * Está extraído a funciones puras justamente para que no dependa del DOM.
 */
describe('la URL que se compone', () => {
  it('conserva los demás parámetros al fijar uno', () => {
    expect(urlConParametro('/citas', '?f=2026-08-13&q=lopez', 'v', 'por-cobrar', 'todas'))
      .toBe('/citas?f=2026-08-13&q=lopez&v=por-cobrar')
  })

  it('el valor por DEFECTO no se escribe, y quita el que hubiera', () => {
    // `?v=todas` sugiere que alguien eligió «todas» cuando nadie eligió nada.
    expect(urlConParametro('/citas', '?f=2026-08-13&v=cancelada', 'v', 'todas', 'todas'))
      .toBe('/citas?f=2026-08-13')
  })

  it('la cadena vacía tampoco: borrar el buscador limpia la URL', () => {
    expect(urlConParametro('/citas', '?q=lopez', 'q', '', '')).toBe('/citas')
  })

  it('quitar un parámetro deja los demás en pie', () => {
    expect(urlSinParametro('/citas', new URLSearchParams('id=abc&f=2026-08-13'), 'id'))
      .toBe('/citas?f=2026-08-13')
    expect(urlSinParametro('/citas', new URLSearchParams('id=abc'), 'id')).toBe('/citas')
  })

  /**
   * PROBADO AL REVÉS: si `urlSinParametro` volviera a ser «devuelve el pathname y
   * ya», los dos casos de arriba pasarían igual en el caso de un solo parámetro.
   * Éste es el que distingue las dos implementaciones.
   */
  it('y NO es «devuelve el pathname pelado» disfrazado', () => {
    expect(urlSinParametro('/citas', new URLSearchParams('f=2026-08-13'), 'id'))
      .not.toBe('/citas')
  })
})
