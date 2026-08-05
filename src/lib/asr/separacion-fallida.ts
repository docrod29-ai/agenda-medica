/**
 * CUANDO LA SEPARACIÓN DE VOCES NO SEPARÓ NADA.
 *
 * ── EL HALLAZGO, MEDIDO ──────────────────────────────────────────────────────
 *
 * En el corpus actuado (12 diálogos, 72 turnos), la atribución de rol acertó el
 * 81,94 %. Al abrir el detalle, **6 de las 9 confusiones venían de sólo dos
 * diálogos**: aquéllos en los que el proveedor devolvió **UNA sola voz**.
 *
 * Esto es lo que devolvió en uno de ellos, como un único turno del «Hablante A»:
 *
 *     «¿Ha fumado alguna vez? Fumé como 10 años, pero lo dejé hace 5.
 *      ¿Toma alcohol? No, nunca he tomado. ¿Le han operado de algo?
 *      Me operaron de la vesícula en 2019.»
 *
 * Las preguntas del médico y las respuestas del paciente, juntas. Y como el
 * texto está lleno de preguntas clínicas, el atribuidor contestó «Médico» con
 * toda naturalidad: **todo lo que dijo el paciente quedó registrado como dicho
 * por el médico**.
 *
 * ── POR QUÉ ESTO ES LO MÁS PELIGROSO DE TODA LA CADENA ───────────────────────
 *
 * De «quién dijo qué» cuelgan el motor de negaciones y la procedencia: la
 * diferencia entre *el paciente afirmó* y *la pregunta lo nombró*. Es el mismo
 * mecanismo del peor defecto que ha tenido este sistema — «¿diabetes o presión
 * alta?» «No» convertido en «paciente con DM2 e HTA» —, sólo que aquí la
 * atribución falsa se produce antes, y las dos defensas razonan sobre ella con
 * la misma seguridad que si fuera cierta.
 *
 * ── LO QUE NO SE PUEDE HACER: DAR POR BUENO EL «MÉDICO» ──────────────────────
 *
 * Un único hablante **puede** ser legítimo: el médico dictando solo, sin paciente
 * delante, es un uso normal de esta aplicación. Así que no basta con desconfiar
 * de todo turno único.
 *
 * Lo que distingue los dos casos no es una probabilidad: es una marca gramatical
 * que se puede comprobar. Un diálogo mezclado tiene, **en boca del mismo
 * hablante**, preguntas dirigidas al otro en segunda persona («¿ha fumado?») y
 * respuestas sobre uno mismo en primera («fumé como 10 años»). Un dictado no
 * hace eso: el médico habla del paciente en tercera persona («refiere que fumó»)
 * y no se pregunta a sí mismo.
 *
 * ── LA ASIMETRÍA QUE JUSTIFICA MARCAR ────────────────────────────────────────
 *
 * Equivocarse marcando cuesta poco: el rol queda sin asignar y la pantalla
 * enseña «Hablante A», que es lo que ya hace hoy cuando el modelo no sabe, y el
 * médico lo corrige en un clic.
 *
 * Equivocarse callando cuesta lo de arriba: una negación del paciente archivada
 * como afirmación del médico, en un expediente que se firma.
 *
 * Módulo PURO.
 */

/** Marcas de que se le está preguntando A OTRO. Usted y tú, como se habla aquí. */
const SEGUNDA_PERSONA = [
  /\b(ha|has|había|habías)\s+\w+(ado|ido)\b/i,
  /\b(usted|ustedes)\b/i,
  /\b(le|les)\s+(duele|molesta|pasa|ocurre|han|ha)\b/i,
  /\b(toma|tomas|siente|sientes|tiene|tienes|puede|puedes|nota|notas)\b/i,
  /\b(desde\s+cuándo|qué\s+le\s+trae|cómo\s+se\s+siente)\b/i,
]

/**
 * Marcas de que alguien habla DE SÍ MISMO.
 *
 * `refiere`, `niega` y `comenta` quedan fuera a propósito: son la voz del médico
 * relatando al paciente en tercera persona, que es justo lo que un dictado
 * legítimo hace todo el rato.
 */
const PRIMERA_PERSONA = [
  /\bme\s+(duele|dueles|operaron|siento|molesta|pasa|dijeron|mandaron|recetaron)\b/i,
  /\b(tomo|tomé|fumé|fumo|siento|sentí|tengo|tuve|estoy|estuve|he\s+tomado|he\s+tenido)\b/i,
  /\b(mi|mis)\s+(mamá|papá|hijo|hija|esposo|esposa|familia|azúcar|presión|dolor)\b/i,
  /\bnunca\s+he\b/i,
]

const TERCERA_PERSONA_CLINICA = /\b(refiere|niega|comenta|presenta|acude|se\s+observa|a\s+la\s+exploración)\b/i

/**
 * EL VOCATIVO: «está bien, doctor».
 *
 * Es la señal más limpia que hay, y la encontró el corpus. El segundo diálogo
 * que el proveedor colapsó en una sola voz no tenía interrogatorio —eran
 * indicaciones de tratamiento y el paciente contestando—, así que la vía de
 * «pregunta en segunda / responde en primera» no lo veía. Pero decía esto:
 *
 *     «Le voy a dejar paracetamol 500 miligramos cada 8 horas […]
 *      ¿Ese es el que viene en pastilla blanca? Ese mismo. […]
 *      **Está bien, doctor.** Tómelos con alimento.»
 *
 * Nadie se llama «doctor» a sí mismo mientras dicta. Si el ÚNICO hablante usa
 * ese vocativo, entonces ahí dentro hay alguien dirigiéndose al médico — es
 * decir, hay dos personas y el separador no las distinguió.
 *
 * Se exige la coma (o el arranque de la frase) y se excluye el nombre propio:
 * «me comentó el doctor García» es el médico relatando, no un paciente
 * hablándole. Sin esa exclusión, un dictado normal se marcaría.
 */
const VOCATIVO_AL_MEDICO = /(^|[,;¿?¡!])\s*(gracias\s+)?(doctor|doctora|doc)\b(?!\s+[A-ZÁÉÍÓÚÑ])/i

/** Parte el texto en oraciones, conservando si eran pregunta. */
function oraciones(texto: string): { texto: string; esPregunta: boolean }[] {
  return String(texto ?? '')
    .split(/(?<=[.?!¿]|\?)\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => ({ texto: s, esPregunta: s.includes('?') }))
}

export interface SenalesDeMezcla {
  /** Preguntas dirigidas al otro, en segunda persona. */
  preguntasDirigidas: number
  /** Afirmaciones sobre uno mismo, en primera persona. */
  respuestasPropias: number
  /** Frases de dictado clínico en tercera persona («refiere que…»). */
  relatoEnTercera: number
  /** Veces que este hablante le dice «doctor» a alguien. Ver `VOCATIVO_AL_MEDICO`. */
  vocativosAlMedico: number
}

/** Cuenta las señales en el texto de UN hablante. Determinista y auditable. */
export function senalesDeMezcla(texto: string): SenalesDeMezcla {
  let preguntasDirigidas = 0, respuestasPropias = 0, relatoEnTercera = 0, vocativosAlMedico = 0
  for (const o of oraciones(texto)) {
    // El vocativo se cuenta SIEMPRE, incluso en una frase de dictado: es la
    // señal más fuerte y no debe perderse por el orden de las comprobaciones.
    if (VOCATIVO_AL_MEDICO.test(o.texto)) vocativosAlMedico++
    if (TERCERA_PERSONA_CLINICA.test(o.texto)) { relatoEnTercera++; continue }
    if (o.esPregunta && SEGUNDA_PERSONA.some(r => r.test(o.texto))) preguntasDirigidas++
    else if (!o.esPregunta && PRIMERA_PERSONA.some(r => r.test(o.texto))) respuestasPropias++
  }
  return { preguntasDirigidas, respuestasPropias, relatoEnTercera, vocativosAlMedico }
}

export type VeredictoSeparacion = 'separado' | 'dictado_de_una_voz' | 'mezcla_sin_separar'

export interface DiagnosticoSeparacion {
  veredicto: VeredictoSeparacion
  /** Se dice con palabras, para poder enseñarlo. */
  motivo: string
  senales?: SenalesDeMezcla
}

/**
 * ¿La separación de voces hizo su trabajo?
 *
 * Con dos o más hablantes se confía en el proveedor: si se equivocó al repartir
 * turnos, eso es otro problema y no se resuelve adivinando aquí.
 *
 * Con UNO solo se mira el contenido, porque es el único caso en el que el
 * silencio del separador puede confundirse con un hecho («lo dijo todo el
 * médico»).
 */
export function diagnosticarSeparacion(args: {
  hablantes: readonly string[]
  texto: string
}): DiagnosticoSeparacion {
  if (args.hablantes.length !== 1) {
    return { veredicto: 'separado', motivo: `${args.hablantes.length} hablantes distinguidos` }
  }

  const s = senalesDeMezcla(args.texto)
  /**
   * DOS Y DOS, no uno y uno.
   *
   * Con una sola pregunta y una sola frase en primera persona, un dictado normal
   * dispararía la alarma («¿le pido la biometría? Tengo la impresión de…»). Dos
   * de cada una, en el mismo hablante, ya no es una forma de hablar: es una
   * conversación que no se separó.
   */
  if (s.preguntasDirigidas >= 2 && s.respuestasPropias >= 2) {
    return {
      veredicto: 'mezcla_sin_separar',
      motivo: 'Un solo hablante que pregunta en segunda persona y responde en primera: la separación de voces no distinguió al paciente.',
      senales: s,
    }
  }

  /**
   * SEGUNDA VÍA — basta UNO.
   *
   * A diferencia de las otras señales, el vocativo no es cuestión de grado: si
   * el único hablante le dice «doctor» a alguien, ese alguien es el médico, y
   * por tanto quien habla en ese momento no lo es. Con eso ya hay dos personas
   * dentro de una sola voz.
   */
  if (s.vocativosAlMedico >= 1) {
    return {
      veredicto: 'mezcla_sin_separar',
      motivo: 'Un solo hablante que se dirige al médico («doctor»): hay dos personas y la separación de voces no las distinguió.',
      senales: s,
    }
  }
  return {
    veredicto: 'dictado_de_una_voz',
    motivo: 'Un solo hablante, sin marcas de diálogo mezclado.',
    senales: s,
  }
}

export const POR_QUE_MARCAR_Y_NO_CALLAR =
  'Equivocarse marcando cuesta que el rol quede sin asignar y la pantalla enseñe ' +
  '«Hablante A» — lo que ya ocurre hoy cuando el modelo no sabe, y el médico lo ' +
  'corrige en un clic. Equivocarse callando cuesta una negación del paciente ' +
  'archivada como afirmación del médico, en un expediente que se firma.'
