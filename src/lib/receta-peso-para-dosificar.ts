/**
 * EL PESO QUE FALTA SE DICE — MP-007.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La pantalla de receta avisa en ámbar cuando falta la EDAD (REG-524) porque sin
 * edad no hay red pediátrica. Pero con la edad presente y el PESO ausente la red
 * pediátrica también se apaga —`revisarDosis` sólo comprueba mg/kg si le llega
 * un peso— y ahí la receta callaba: ni recuadro, ni renglón, nada. Un niño de
 * cuatro años con «Ibuprofeno 400 mg» salía impreso sin una sola señal, porque
 * 400 mg cabe de sobra en los topes de adulto.
 *
 * Mismo modo de fallo que REG-524, por el otro dato: la ausencia de alerta se
 * lee como «la dosis ya se revisó».
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Decide, sin adivinar, qué peso se usa para dosificar y si hay que decirlo:
 *   · sólo aplica a menores (la comprobación mg/kg es la pediátrica);
 *   · manda el peso de los signos vitales de la nota; si no hay, el que el
 *     médico teclee en el bloque renal de la misma pantalla;
 *   · si no hay ninguno, `falta: true` y el aviso se pinta.
 *
 * NO inventa un peso, no estima por edad y no bloquea la firma: dice qué red de
 * seguridad no está corriendo y dónde se captura el dato. Ninguna cifra clínica
 * nueva vive aquí.
 *
 * Módulo PURO.
 */

export interface PesoParaDosificar {
  /** El peso en kg que se le pasa al motor de dosis, o `undefined`. */
  peso?: number
  /** ¿Es un menor sin peso? Entonces la comprobación mg/kg NO está corriendo. */
  falta: boolean
  /** De dónde salió el peso que se está usando. */
  origen: 'nota' | 'tecleado' | 'ninguno' | 'no_aplica'
}

/**
 * @param esPediatrico ¿el paciente es menor de 18 años? (lo decide la edad, que
 *   a su vez viene de `edadParaDosificar`: sin edad hay otro aviso, el de
 *   REG-524, y éste no se pinta para no apilar dos avisos por lo mismo).
 * @param pesoNota peso de los signos vitales de la nota (kg).
 * @param pesoTecleado peso que el médico escribió en el bloque renal (kg).
 */
export function pesoParaDosificar(
  esPediatrico: boolean,
  pesoNota: unknown,
  pesoTecleado: unknown,
): PesoParaDosificar {
  if (!esPediatrico) return { falta: false, origen: 'no_aplica' }
  const nota = Number(pesoNota ?? 0)
  if (Number.isFinite(nota) && nota > 0) return { peso: nota, falta: false, origen: 'nota' }
  const tecleado = typeof pesoTecleado === 'string' ? parseFloat(pesoTecleado) : Number(pesoTecleado ?? 0)
  if (Number.isFinite(tecleado) && tecleado > 0) return { peso: tecleado, falta: false, origen: 'tecleado' }
  return { falta: true, origen: 'ninguno' }
}

/** Lo que se le dice al médico cuando el niño no tiene peso. Sin adivinar, sin bloquear. */
export const AVISO_SIN_PESO_PARA_DOSIFICAR =
  'Sin peso del paciente: NO se comprueban las dosis por kilo (mg/kg). ' +
  'Captúralo en «Peso (kg)» aquí abajo o en los signos vitales de la nota antes de imprimir.'

export const POR_QUE_NO_SE_ESTIMA_EL_PESO =
  'Porque estimar el peso por la edad es inventar una cifra clínica, y de esa ' +
  'cifra saldría una dosis impresa con cédula profesional. Se dice que falta.'
