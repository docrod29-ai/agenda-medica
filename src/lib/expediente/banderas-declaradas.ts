/**
 * LO QUE ALGUIEN YA DECLARÓ COMO RIESGO, REUNIDO Y CON SU PROCEDENCIA.
 *
 * ── QUÉ FALTABA (WS-10) ─────────────────────────────────────────────────────
 *
 * El censo pedía «banderas de riesgo» y lo dejaba dicho con precisión: **el
 * catálogo de qué condición cuenta como bandera es política clínica y no está
 * decidido**. Fijarlo aquí sería exactamente lo que está prohibido.
 *
 * Lo que sí se puede hacer sin decidirlo es reunir lo que **ya está declarado**
 * en el árbol, con quién lo declaró y desde cuándo. Este módulo no inventa un
 * criterio: recoge juicios que ya hizo una persona.
 *
 * ── LAS TRES PATAS QUE PEDÍA EL CENSO, Y LA QUE NO EXISTE ───────────────────
 *
 * El censo nombraba tres fuentes: alergia con severidad grave, diagnóstico
 * marcado crónico, y **etiquetas manuales del paciente**. Al mirarlo:
 *
 *     PatientTag       13 valores declarados en `types/index.ts`
 *     PATIENT_TAG_CONFIG  su etiqueta y su color, para cada uno
 *     patient.tags     CERO escritores y CERO lectores en todo el árbol
 *
 * Ninguna pantalla pone una etiqueta y ninguna la enseña. `patient.tags` es
 * siempre `undefined`. **Recogerla habría sido recoger un campo que nunca tiene
 * nada** — y eso es peor que no recogerla, porque el eje diría «sin banderas» y
 * quien lo leyera entendería «sin riesgo declarado», cuando la verdad es que una
 * de sus tres fuentes no se puede llenar.
 *
 * Así que se declara, en `LO_QUE_NO_SE_VIGILA`, y no se recoge. Conectar las
 * etiquetas es otra unidad: hace falta la pantalla que las escriba primero.
 *
 * ── LA REGLA QUE HACE ESTO SEGURO ───────────────────────────────────────────
 *
 * **Este eje nunca tranquiliza.** Una lista vacía significa «nadie ha declarado
 * nada de lo que yo miro», no «este paciente no tiene riesgos». Es la regla 5 de
 * seguridad clínica —los vocabularios son vocabulario, no criterio— y la 4:
 * ausencia de dato no es dato de ausencia.
 *
 * Por eso `resumen()` **no** devuelve «Sin banderas» a secas, y por eso
 * `LO_QUE_NO_SE_VIGILA` es una exportación y no un comentario: tiene que poder
 * pintarse al lado de la lista.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No es una fuente de verdad: **proyecta**. La alergia sigue viviendo donde
 * vivía y el problema crónico dentro de su nota; esto los mira y los nombra
 * juntos. No calcula riesgo, no puntúa, no ordena por gravedad clínica y no
 * decide qué es una bandera.
 *
 * Y no añade motores: reutiliza `estadoDeAlergias` (REG-410) y `problemasActivos`,
 * que ya recorren el expediente entero. Un cuarto recorrido daría, tarde o
 * temprano, un número distinto para el mismo paciente.
 *
 * Módulo PURO.
 */
import type { EstadoDeAlergias } from './alergias-longitudinales'
import type { ProblemaVigente } from './problemas-activos'
import { peorSeveridadRegistrada } from './alergias-longitudinales'

/** De qué clase de declaración salió. No hay una quinta sin decidir el catálogo. */
export type ClaseDeBandera = 'alergia_grave' | 'problema_cronico'

export interface BanderaDeclarada {
  clase: ClaseDeBandera
  /** El alérgeno o el problema, tal como se escribió. */
  que: string
  /** Lo que la califica: la severidad registrada, o nada. */
  detalle?: string
  /**
   * ISO de cuándo se declaró por primera vez, o `null` si NO CONSTA.
   *
   * `null` es un valor legítimo y frecuente: una alergia que sólo está en el
   * campo de hoy no tiene fecha en ninguna parte. Poner la de hoy sería
   * fabricarla — diría «desde agosto de 2026» de algo que quizá lleva veinte
   * años escrito.
   */
  desde: string | null
  /** Dónde consta. Es la procedencia, y se pinta. */
  deDonde: string
}

export interface BanderasDelPaciente {
  banderas: BanderaDeclarada[]
  /**
   * true = el historial del que sale esto vino recortado. Entonces «no encontré
   * más» NO significa «no hay más», y la pantalla tiene que decirlo (REG-350).
   */
  historialIncompleto: boolean
}

const ES_GRAVE = (s: string | undefined): boolean => s === 'grave' || s === 'anafilaxia'

/**
 * Reúne lo declarado. No lee el reloj ni la base: se le pasan las proyecciones y
 * la lista que el llamador ya tiene.
 *
 * `listaDeHoy` es **la misma** que se le pasó a `estadoDeAlergias`, no otra
 * lectura. Hace falta porque una alergia recién escrita en esta consulta todavía
 * no tiene sello —`registros` viene vacío— y `peorSeveridadRegistrada` sólo mira
 * sellos. Sin ella, **una anafilaxia apuntada hoy no sería bandera hasta que se
 * firmara la nota**, que es justo cuando más falta hace.
 *
 * Cuando hay las dos, manda el sello: es la asimetría que ya tiene la proyección
 * de alergias —afirmar suma, el silencio no resta— y aquí no se cambia.
 */
export function banderasDeclaradas(
  alergias: EstadoDeAlergias,
  problemas: readonly ProblemaVigente[],
  listaDeHoy: readonly { alergeno: string; severidad?: string }[] = [],
): BanderasDelPaciente {
  const banderas: BanderaDeclarada[] = []
  const hoyPorAlergeno = new Map(
    listaDeHoy.map(a => [String(a.alergeno ?? '').trim().toLowerCase(), a]),
  )

  for (const a of alergias.alergias) {
    /* La severidad la escribió alguien. Aquí no se deduce de la reacción ni del
       alérgeno: sin severidad registrada, esta alergia no es una bandera GRAVE
       — lo que no quiere decir que sea leve, sino que nadie lo dijo. */
    const peor = peorSeveridadRegistrada(a)
    const deHoy = hoyPorAlergeno.get(a.alergeno.trim().toLowerCase())
    const severidad = peor && ES_GRAVE(peor.severidad) ? peor.severidad
      : ES_GRAVE(deHoy?.severidad) ? deHoy!.severidad
        : null
    if (!severidad) continue
    banderas.push({
      clase: 'alergia_grave',
      que: a.alergeno,
      detalle: severidad,
      desde: a.desde || null,
      deDonde: a.desde ? `nota firmada del ${a.desde.slice(0, 10)}` : 'la lista de alergias de hoy',
    })
  }

  for (const p of problemas) {
    /* `estado: 'cronico'` lo puso el médico en la nota. No se infiere de la
       enfermedad: que la diabetes suela ser crónica no autoriza a decir que
       ÉSTA lo es si nadie lo escribió. */
    if (p.diagnostico.estado !== 'cronico') continue
    const que = String(p.diagnostico.descripcion ?? '').trim()
    if (!que) continue
    banderas.push({
      clase: 'problema_cronico',
      que,
      desde: p.dichoEn || null,
      deDonde: p.dichoEn ? `nota firmada del ${p.dichoEn.slice(0, 10)}` : 'el expediente',
    })
  }

  return { banderas, historialIncompleto: alergias.historialIncompleto }
}

/**
 * LO QUE ESTE EJE NO MIRA. Se exporta para PINTARSE, no para documentar.
 *
 * Una lista de banderas vacía al lado de nada se lee como «este paciente no
 * tiene riesgos». Al lado de esto se lee como lo que es.
 */
export const LO_QUE_NO_SE_VIGILA: readonly string[] = [
  'Las etiquetas del paciente (`PatientTag`): el tipo y sus 13 valores están declarados, pero ninguna pantalla las escribe ni las lee, así que el campo siempre está vacío. No se recoge un campo que nadie llena.',
  'Cualquier catálogo de «qué condición es una bandera»: eso es política clínica y no está decidido. Aquí sólo entra lo que una persona ya declaró.',
  'Los antecedentes familiares, el riesgo social y los hábitos: no tienen campo propio en el expediente; viven en la prosa de la nota.',
  'La gravedad de una alergia sin severidad registrada: sin ella no entra, y eso NO quiere decir que sea leve — quiere decir que nadie la calificó.',
  'La respuesta al tratamiento: nada del expediente liga un fármaco con el desenlace del problema que trata.',
]

/**
 * Cómo se dice lo que hay. **Nunca tranquiliza.**
 *
 * Sin banderas no se escribe «Sin banderas»: se escribe qué se miró. La
 * diferencia es toda la seguridad de este módulo.
 */
export function resumenDeBanderas(b: BanderasDelPaciente): string {
  if (!b.banderas.length) {
    return 'Nadie ha declarado alergias graves ni problemas crónicos en este expediente.'
  }
  const nombres = b.banderas.map(x => x.detalle ? `${x.que} (${x.detalle})` : x.que)
  return nombres.length <= 3
    ? nombres.join(' · ')
    : `${nombres.slice(0, 3).join(' · ')} y ${nombres.length - 3} más`
}

export const POR_QUE_NO_DICE_SIN_BANDERAS =
  'Porque una lista vacía significa «nadie ha declarado nada de lo que yo miro», '
  + 'no «este paciente no tiene riesgos». Una de las fuentes que el censo pedía '
  + '—las etiquetas del paciente— es un campo que ninguna pantalla llena, y dos '
  + 'de las que sí existen dependen de que alguien escribiera la severidad o '
  + 'marcara el problema como crónico. Ausencia de dato no es dato de ausencia.'

export const POR_QUE_NO_HAY_UN_CUARTO_RECORRIDO =
  'Porque `estadoDeAlergias` y `problemasActivos` ya recorren el expediente '
  + 'entero, y un recorrido propio daría tarde o temprano un número distinto '
  + 'para el mismo paciente. Esto proyecta lo que ellos devuelven; no vuelve a '
  + 'leer las notas.'
