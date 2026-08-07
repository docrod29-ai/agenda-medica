/**
 * ¿CON CUÁNTA SEGURIDAD LO DIJO? — la incertidumbre (§B6 del charter).
 *
 * ── EL CUARTO EJE ────────────────────────────────────────────────────────────
 *
 * Ya están medidos tres:
 *
 *     ¿sí o no?   → negaciones.ts      (REG-192)
 *     ¿cuándo?    → temporalidad.ts    (REG-200)
 *     ¿a quién?   → experienciador.ts  (REG-210)
 *     ¿qué tan seguro?  → esto
 *
 * El charter pide distinguir **presente, ausente, posible, probable, incierto,
 * histórico, condicional y no mencionado**. Sin este eje, los ocho estados
 * colapsan en dos: dicho o no dicho.
 *
 * ── EL DAÑO ─────────────────────────────────────────────────────────────────
 *
 *     «creo que me dijeron que tenía anemia»   →  Anemia
 *     «a lo mejor fue hepatitis, no sé»        →  Hepatitis
 *     «me dijeron que estaba prediabético»     →  Prediabetes
 *
 * Lo que el paciente ofreció como **duda** queda en el expediente como
 * **diagnóstico**. Y a partir de la segunda consulta ya nadie sabe que era una
 * duda: se lee igual que un dato confirmado, se arrastra a todas las notas
 * siguientes y termina cambiando tratamientos.
 *
 * Es el mismo modo de fallo de los otros tres ejes: **el error se lee bien**.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * No decide si el paciente tiene o no la enfermedad — eso es del médico. Sólo
 * dice **con cuánta seguridad se dijo**, para que la nota lo conserve y el
 * médico lo confirme o lo descarte. Un dato marcado como incierto sigue siendo
 * un dato útil; lo que se pierde al aplanarlo es la información de que hay que
 * comprobarlo.
 *
 * Módulo PURO, sin dependencias.
 */

export type Certeza = 'afirmado' | 'incierto'

/** Por qué es incierto. Cambia lo que hay que hacer con el dato. */
export type MatizDeDuda =
  /** El paciente duda: «creo que», «no estoy seguro». */
  | 'duda'
  /** Se plantea como posible: «a lo mejor», «tal vez», «probablemente». */
  | 'posibilidad'
  /** Se lo dijo otro: «me dijeron que», «en el otro hospital me comentaron». */
  | 'referido'
  /** La cifra o la fecha son aproximadas: «como cinco años», «más o menos». */
  | 'aproximado'

export interface QueTanSeguro {
  certeza: Certeza
  matiz?: MatizDeDuda
  /** La palabra que lo delató. Va a la pantalla para que se pueda comprobar. */
  marca?: string
  porQue: string
}

/**
 * Las marcas, en el español que se habla en un consultorio.
 *
 * El orden importa: se prueba de la más específica a la más general, porque
 * «no estoy seguro si me dijeron» es duda antes que referido — lo que domina es
 * lo que el paciente sabe, no de dónde viene.
 */
/**
 * ── EL `\b` FINAL, POR TERCERA VEZ EN UNA NOCHE ─────────────────────────────
 *
 * En JavaScript `\w` es ASCII. Un `\b` detrás de «quizá» **no encuentra límite
 * de palabra** y el patrón no dispara: reconocía «quizas» y no «quizá».
 *
 * Ya había pasado con «no sé» en el motor de negación y con «mamá» en el de
 * experienciador, las dos veces con el mismo síntoma —media función viva y media
 * muerta— y las dos veces se descubrió midiendo, no leyendo.
 *
 * Por eso aquí se cierra con `(?![\p{L}])`, y por eso hay un guardián que ahora
 * revisa TODOS los motores de lenguaje: la lección no cabía en un comentario.
 */
const MARCAS: ReadonlyArray<{ matiz: MatizDeDuda; re: RegExp }> = [
  {
    matiz: 'duda',
    re: /\b(?:no\s+estoy\s+segur[oa]|no\s+s[eé]\s+si|no\s+me\s+acuerdo\s+bien|no\s+recuerdo\s+bien|no\s+estoy\s+cier[ta]|ni\s+idea)(?![\p{L}])/iu,
  },
  {
    matiz: 'duda',
    re: /\b(?:creo\s+que|yo\s+creo|se\s+me\s+hace\s+que|siento\s+que|me\s+imagino\s+que)(?![\p{L}])/iu,
  },
  {
    /**
     * EL «CREO» QUE VA AL FINAL.
     *
     *     «mi mamá no tuvo cáncer, creo»
     *     «fue hace como diez años, creo yo»
     *
     * En el español hablado la duda se pospone muchísimo, y el patrón de arriba
     * —que exige «creo QUE»— la dejaba pasar entera. Lo encontró medir frases
     * compuestas, no leer el módulo.
     *
     * Se exige una coma o el final de la frase delante para no cazar el «creo»
     * de «creo un recordatorio».
     */
    matiz: 'duda',
    re: /(?:,\s*|^|\.\s*)(?:creo|supongo|imagino)(?:\s+yo)?\s*[.!?]?\s*$/iu,
  },
  {
    matiz: 'posibilidad',
    re: /\b(?:tal\s+vez|talvez|quiz[aá]s?|a\s+lo\s+mejor|capaz\s+que|puede\s+(?:ser|que)|posiblemente|probablemente|igual\s+y)(?![\p{L}])/iu,
  },
  {
    matiz: 'referido',
    re: /\b(?:me\s+(?:dijeron|dijo|comentaron|coment[oó]|mencionaron)|le\s+dijeron|seg[uú]n\s+(?:me|le)\s+dijeron|dice\s+que\s+le\s+dijeron)(?![\p{L}])/iu,
  },
  {
    matiz: 'aproximado',
    /**
     * «como cinco años», «como unos tres meses», «como 2 semanas».
     *
     * El número puede ir en cifra o en palabra: «como cinco años con la presión
     * alta» es la forma normal de dictar una fecha aproximada, y con el patrón
     * limitado a dígitos se escapaba entera.
     *
     * Se exige un número detrás a propósito. «Como» solo es demasiado común
     * —«trabaja como enfermero», «me siento como mareado»— y marcarlas todas
     * llenaría la nota de dudas inventadas.
     */
    re: /\b(?:m[aá]s\s+o\s+menos|aproximadamente|por\s+ah[ií]|algo\s+as[ií]|una\s+cosa\s+as[ií]|como\s+(?:unos?\s+|unas?\s+)?(?:\d|un[oa]?\b|dos\b|tres\b|cuatro\b|cinco\b|seis\b|siete\b|ocho\b|nueve\b|diez\b|once\b|doce\b|quince\b|veinte\b|treinta\b))/iu,
  },
]

/**
 * Lo que **cancela** la duda: el paciente trae constancia.
 *
 *     «traigo el estudio», «aquí está el resultado», «me lo confirmaron con
 *      biopsia»
 *
 * Sin esto, «me dijeron que tenía anemia, aquí traigo la biometría» quedaría
 * marcado como incierto **teniendo el papel en la mano** — y un aviso que salta
 * cuando no hace falta es un aviso que se aprende a cerrar.
 */
const HAY_CONSTANCIA = [
  /\b(?:traigo|traje|aqu[ií]\s+(?:est[aá]|traigo)|le\s+dejo)\s+(?:el|la|los|las)\s+(?:estudio|resultado|an[aá]lisis|laboratorio|biometr[ií]a|reporte|papel)/iu,
  /\b(?:confirmad[oa]|comprobad[oa])\s+(?:con|por)\b/iu,
  /\bcon\s+(?:biopsia|estudio|laboratorio|reporte)\b/iu,
] as const

/**
 * ¿Con cuánta seguridad se dijo esta frase?
 *
 * Por omisión, `afirmado`. **No al revés**: marcar como incierto lo que no lo es
 * llenaría la nota de dudas inventadas y el médico dejaría de mirar el aviso,
 * que es la forma más rápida de inutilizar una protección.
 */
export function queTanSeguro(frase: string): QueTanSeguro {
  const t = String(frase ?? '')
  if (!t.trim()) return { certeza: 'afirmado', porQue: 'frase vacía' }

  if (HAY_CONSTANCIA.some(re => re.test(t))) {
    return { certeza: 'afirmado', porQue: 'el paciente trae constancia del dato' }
  }

  for (const { matiz, re } of MARCAS) {
    const m = re.exec(t)
    if (m) {
      return {
        certeza: 'incierto',
        matiz,
        marca: m[0].trim(),
        porQue: `lo dijo con «${m[0].trim()}»`,
      }
    }
  }

  return { certeza: 'afirmado', porQue: 'la frase no marca duda' }
}

/** ¿Este dato entró como duda y no como hecho? */
export function esIncierto(frase: string): boolean {
  return queTanSeguro(frase).certeza === 'incierto'
}

/**
 * Las frases de un dictado que el paciente dijo **sin estar seguro**.
 *
 * Señala; no decide. Que un antecedente sea incierto no lo invalida — obliga a
 * comprobarlo, que es exactamente lo que se pierde cuando la nota lo aplana.
 */
/**
 * Dónde termina una idea y empieza otra.
 *
 * ── UNA FRASE PUEDE TENER DOS DUEÑOS ────────────────────────────────────────
 *
 *     «yo no tengo diabetes pero mi mamá sí»
 *
 * Analizada entera, esta frase se atribuye al familiar y se pierde lo que de
 * verdad dice: que **el paciente la niega** y que **la mamá sí la tiene**. Son
 * dos datos distintos, de dos personas distintas, en catorce palabras.
 *
 * Por eso se corta también en los conectores que cambian de sujeto —«pero»,
 * «aunque», «en cambio», «mientras que»— y no sólo en los puntos. Lo encontró
 * medir frases compuestas: cada motor por su lado acertaba, y juntos mentían.
 */
const SEPARADOR_DE_CLAUSULAS =
  /(?<=[.;:!?])\s+|\n+|\s+(?:pero|aunque|en\s+cambio|mientras\s+que|sin\s+embargo)\s+/iu

export function frasesInciertas(texto: string): { frase: string; matiz?: MatizDeDuda; marca?: string }[] {
  return String(texto ?? '')
    .split(SEPARADOR_DE_CLAUSULAS)
    .map(f => f.trim())
    .filter(Boolean)
    .map(f => ({ f, r: queTanSeguro(f) }))
    .filter(x => x.r.certeza === 'incierto')
    .map(x => ({ frase: x.f, matiz: x.r.matiz, marca: x.r.marca }))
}

export const POR_QUE_IMPORTA =
  'Lo que el paciente ofreció como duda queda en el expediente como diagnóstico. ' +
  'A partir de la segunda consulta ya nadie sabe que era una duda: se lee igual ' +
  'que un dato confirmado y se arrastra a todas las notas siguientes.'

export const POR_QUE_AFIRMADO_POR_OMISION =
  'Marcar como incierto lo que no lo es llenaría la nota de dudas inventadas, y ' +
  'el médico dejaría de mirar el aviso. Un aviso que salta de más se aprende a ' +
  'cerrar, y entonces ya no protege de nada.'
