/**
 * GUARDIÁN — un CAMPO que nadie lee es un módulo huérfano en miniatura.
 *
 * ── POR QUÉ EXISTE, CON LOS SEIS CASOS QUE LO PIDIERON ───────────────────────
 *
 * `modulos-sin-conectar.test.ts` vigila archivos que nadie importa. Es el
 * guardián que nació de «escrito, probado y sin conectar», y funciona.
 *
 * Pero en una sola sesión aparecieron **seis** fallos de la misma familia que
 * ese guardián **no puede ver**, porque el módulo sí estaba importado: lo que no
 * se leía era **un campo concreto** del contrato.
 *
 *   · `ResultadoPipeline.cambiosNormalizacion` y `.cambiosSiglas` — se calculaban
 *     en cada dictado y no salían del pipeline. El médico veía las correcciones
 *     de fármacos y **no las de dosis**.
 *   · `ContextoDictado.especialidades` — declarado, viajando por cuatro capas, y
 *     **ninguna pantalla lo llenaba**: el vocabulario salía sólo del módulo.
 *   · La semilla de UCI llevaba `utterances` y **nadie los leía**: se apagaban a
 *     la vez la separación de voces, las palabras a verificar y la procedencia.
 *   · `rolesHablante` se usaba al firmar y se tiraba al archivar.
 *   · `ResultadoPipeline.crudo` se producía y se descartaba en la misma línea.
 *
 * Ninguno rompía nada. Los tests pasaban, el build pasaba, y el trabajo no le
 * llegaba al médico — la forma más cara de fallar, porque se paga entera y no se
 * nota.
 *
 * ── QUÉ VIGILA, Y POR QUÉ NO MÁS ─────────────────────────────────────────────
 *
 * Sólo los **contratos declarados**: las interfaces que cruzan una frontera
 * (motor → hook → pantalla → documento). Vigilar todos los campos de todas las
 * interfaces daría cientos de falsos positivos —tipos internos, formas de
 * respuesta de terceros, campos leídos por *spread*— y un guardián ruidoso se
 * apaga, que es peor que no tenerlo.
 *
 * ── LO QUE ESTE MÓDULO NO PUEDE SABER ────────────────────────────────────────
 *
 * Un campo leído por desestructuración con renombre, o por índice dinámico, se
 * le escapa. Por eso el veredicto no es «esto está mal» sino «esto no se ve leído
 * en ningún sitio»: quien lo conecte de otra forma lo declara en la lista, con su
 * razón, igual que en los demás trinquetes de este repositorio.
 *
 * Módulo PURO: no lee disco. Quien recorre archivos es la prueba.
 */

/** Un contrato a vigilar. */
export interface Contrato {
  /** Ruta del archivo que lo declara, relativa a la raíz. */
  archivo: string
  /** Nombre de la interfaz. */
  interfaz: string
  /** Por qué este contrato importa. Va en el mensaje del fallo. */
  porQue: string
  /**
   * ¿Es lo que el módulo PRODUCE o lo que RECIBE?
   *
   * Cambia qué se puede preguntar. En un contrato de **salida** el productor es
   * el propio módulo, así que exigir que alguien de fuera lo escriba marcaría
   * como huérfano todo lo que el módulo devuelve — que es todo. En uno de
   * **entrada** ocurre al revés: si nadie lo llena, el campo viaja vacío por
   * todas las capas, que es exactamente lo que pasó con `especialidades`.
   */
  direccion: 'entrada' | 'salida'
}

/**
 * Saca los nombres de campo declarados en una interfaz.
 *
 * Reconoce `nombre:`, `nombre?:` y los ignora dentro de comentarios. No
 * interpreta TypeScript: busca el bloque de la interfaz y lee las claves del
 * primer nivel, que es lo único que hace falta.
 */
export function camposDe(fuente: string, interfaz: string): string[] {
  const i = fuente.search(new RegExp(`(export\\s+)?interface\\s+${interfaz}\\b`))
  if (i < 0) return []
  const abre = fuente.indexOf('{', i)
  if (abre < 0) return []

  // Recorre contando llaves para quedarse con el cuerpo exacto.
  let nivel = 0, fin = -1
  for (let k = abre; k < fuente.length; k++) {
    if (fuente[k] === '{') nivel++
    else if (fuente[k] === '}') { nivel--; if (nivel === 0) { fin = k; break } }
  }
  if (fin < 0) return []

  const cuerpo = fuente.slice(abre + 1, fin)
  const out: string[] = []
  let profundidad = 0
  for (const linea of cuerpo.split('\n')) {
    const t = linea.trim()
    // Comentarios fuera: un `campo:` dentro de un ejemplo no es un campo.
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue
    if (profundidad === 0) {
      const m = /^([A-Za-z_$][\w$]*)\??\s*:/.exec(t)
      if (m) out.push(m[1])
    }
    profundidad += (linea.match(/\{/g) ?? []).length - (linea.match(/\}/g) ?? []).length
    if (profundidad < 0) profundidad = 0
  }
  return [...new Set(out)]
}

export interface CampoSinLeer {
  contrato: string
  campo: string
  porQue: string
}

/**
 * ── DOS DEFECTOS DISTINTOS, Y LA PRIMERA VERSIÓN LOS CONFUNDÍA ──────────────
 *
 * Los seis casos que pidieron este guardián no eran todos lo mismo:
 *
 * · `ResultadoPipeline.cambiosNormalizacion` se **construía y no se leía nunca**,
 *   ni siquiera en su propio archivo. Es un campo MUERTO.
 * · `ContextoDictado.especialidades` sí se leía —`contextosActivos` lo usa— pero
 *   **nadie lo llenaba**. Es un campo HUÉRFANO DE PRODUCTOR.
 *
 * La primera versión los cazaba a los dos con una sola regla —«no se lee fuera
 * de su archivo»— y por eso también cazaba cosas sanas: `Contradiccion.enLaNota`
 * lo lee `avisoDeContradiccion`, que vive al lado y sí se usa fuera. Cuatro de
 * siete contratos daban falso positivo, y **un guardián ruidoso se apaga**, que
 * es peor que no tenerlo.
 *
 * Ahora son dos preguntas separadas, cada una con su regla.
 */
export interface CampoSinConectar extends CampoSinLeer {
  /** `'lectura'`: nadie lo lee. `'escritura'`: nadie lo llena. */
  falta: 'lectura' | 'escritura'
}

/**
 * ¿Alguien LEE este campo? `obj.campo` o `{ campo }` de una desestructuración.
 *
 * Cuenta también su propio archivo —quitando la línea de la declaración—: un
 * campo que consume una función de al lado que sí se usa fuera está conectado.
 * Exigir que lo leyera OTRO archivo marcaba como huérfano `Contradiccion.enLaNota`,
 * que lee `avisoDeContradiccion` dos funciones más abajo.
 */
function alguienLee(campo: string, fuentes: Record<string, string>, declara: string): boolean {
  const re = new RegExp(`(\\.${campo}\\b|\\{[^}\n]*\\b${campo}\\s*[,}])`)
  return Object.entries(fuentes).some(([ruta, texto]) => {
    const limpio = ruta === declara
      ? texto.replace(new RegExp(`^\\s*${campo}\\??\\s*:.*$`, 'gm'), '')
      : texto
    return re.test(limpio)
  })
}

/** ¿Alguien LO LLENA? `campo:` dentro de un literal, fuera de la declaración. */
function alguienEscribe(campo: string, fuentes: Record<string, string>, declara: string): boolean {
  const re = new RegExp(`\\b${campo}\\s*:`)
  return Object.entries(fuentes).some(([ruta, texto]) => ruta !== declara && re.test(texto))
}

/**
 * Los campos del contrato que **nadie lee** o que **nadie llena**.
 *
 * Es la versión precisa de `camposSinLeer`: distingue el campo muerto —se
 * construye y no lo consume nadie— del huérfano de productor —se consume y no lo
 * llena nadie—. Los dos son trabajo que no le llega al médico, pero se arreglan
 * de maneras opuestas, y decir cuál es ahorra el rato de buscarlo.
 */
export function camposSinConectar(
  contrato: Contrato,
  fuentes: Record<string, string>,
  aceptados: Record<string, string> = {},
): CampoSinConectar[] {
  const propio = fuentes[contrato.archivo] ?? ''
  const out: CampoSinConectar[] = []
  for (const campo of camposDe(propio, contrato.interfaz)) {
    if (`${contrato.interfaz}.${campo}` in aceptados) continue
    if (!alguienLee(campo, fuentes, contrato.archivo)) {
      out.push({ contrato: contrato.interfaz, campo, porQue: contrato.porQue, falta: 'lectura' })
    } else if (contrato.direccion === 'entrada' && !alguienEscribe(campo, fuentes, contrato.archivo)) {
      out.push({ contrato: contrato.interfaz, campo, porQue: contrato.porQue, falta: 'escritura' })
    }
  }
  return out
}

/**
 * Los campos del contrato que no aparecen leídos en ningún archivo de producción
 * distinto del que los declara.
 *
 * @param fuentes mapa `ruta → contenido` de TODO el código de producción.
 */
export function camposSinLeer(
  contrato: Contrato,
  fuentes: Record<string, string>,
  aceptados: Record<string, string> = {},
): CampoSinLeer[] {
  const propio = fuentes[contrato.archivo] ?? ''
  const campos = camposDe(propio, contrato.interfaz)
  const out: CampoSinLeer[] = []

  for (const campo of campos) {
    const llave = `${contrato.interfaz}.${campo}`
    if (llave in aceptados) continue
    /**
     * `.campo` o `campo:` o `campo,` en una desestructuración. Se busca en
     * TODOS los demás archivos: un campo leído sólo por quien lo declara no ha
     * cruzado ninguna frontera, que es justo lo que este guardián mira.
     */
    const re = new RegExp(`(\\.${campo}\\b|\\b${campo}\\s*[,}]|\\b${campo}\\s*:)`)
    const leido = Object.entries(fuentes).some(([ruta, texto]) =>
      ruta !== contrato.archivo && re.test(texto))
    if (!leido) out.push({ contrato: contrato.interfaz, campo, porQue: contrato.porQue })
  }
  return out
}

export const POR_QUE_SOLO_CONTRATOS =
  'Vigilar todos los campos de todas las interfaces daría cientos de falsos ' +
  'positivos —tipos internos, respuestas de terceros, campos leídos por spread— ' +
  'y un guardián ruidoso se apaga, que es peor que no tenerlo.'

export const POR_QUE_EL_VEREDICTO_ES_PRUDENTE =
  'Un campo leído por desestructuración con renombre o por índice dinámico se le ' +
  'escapa. Por eso no dice «esto está mal» sino «esto no se ve leído en ningún ' +
  'sitio»: quien lo conecte de otra forma lo declara, con su razón.'
