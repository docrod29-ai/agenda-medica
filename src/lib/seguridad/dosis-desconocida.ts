/**
 * «EL PACIENTE NO SABE LA DOSIS» — DICHO, NO CALLADO.
 *
 * ── DE DÓNDE SALE ESTO ───────────────────────────────────────────────────────
 *
 * El médico dueño pidió que sin dosis no se firme (REG-174) y que sin unidad
 * tampoco (REG-175). Al medir el impacto sobre sus notas reales apareció que
 * **la mitad no se habrían podido firmar** — y lo que las bloqueaba no eran
 * descuidos:
 *
 *     Pregabalina .................... «No especificada»
 *     Antibiótico no especificado .... «No especificada»
 *     Antihipertensivo no especificado «No especificada»
 *     Telmisartán .................... (vacío)
 *
 * Son medicamentos que **el paciente refiere que toma y cuya dosis no sabe**.
 * «Toma algo para la presión» es un hecho clínico legítimo, no un hueco del
 * médico. Con la compuerta cerrada, para poder firmar habría que **inventarse
 * una dosis que el paciente no dijo** — peor que el problema que se quería
 * evitar.
 *
 * ── LA DECISIÓN (5-ago-2026) ─────────────────────────────────────────────────
 *
 * Se le plantearon tres caminos y eligió éste: **permitir «dosis desconocida»
 * como respuesta explícita**. No se firma con un hueco callado, pero sí con un
 * «no la sabe» dicho a propósito.
 *
 * ── LO QUE HACE QUE ESTO NO SEA UN PARCHE ────────────────────────────────────
 *
 * La declaración tiene que ser **un acto del médico**, distinguible de lo que
 * rellena la IA. Si se aceptara «No especificada» —el texto que el modelo escribe
 * cuando no captó la dosis— la compuerta quedaría desactivada de vuelta y no se
 * habría arreglado nada: exactamente el hueco silencioso de partida.
 *
 * Por eso el marcador es una frase canónica que **sólo pone el botón**, y se
 * compara literal. Lo que escribe la IA sigue bloqueando.
 *
 * ── Y SE IMPRIME ─────────────────────────────────────────────────────────────
 *
 * El texto va al campo `dosis`, así que sale en la receta y en la nota tal cual.
 * Eso es deseable: quien lea el documento tiene que ver que la dosis se
 * desconoce, no un renglón en blanco que parezca un olvido.
 *
 * Módulo PURO.
 */

/**
 * La frase exacta. Se guarda en `dosis` y se imprime.
 *
 * Dice **quién** no la sabe, porque «desconocida» a secas se leería como un
 * fallo del sistema. Aquí el hecho clínico es que el paciente no la conoce.
 */
export const DOSIS_DESCONOCIDA = 'desconocida (el paciente no la refiere)'

/**
 * ¿El médico declaró que la dosis se desconoce?
 *
 * Comparación literal contra la frase canónica. **A propósito**: si esto
 * aceptara variantes como «no especificada» —lo que escribe la IA cuando no
 * captó nada— la compuerta se desactivaría sola y volveríamos al hueco
 * silencioso que la motivó.
 */
export function esDosisDeclaradaDesconocida(dosis: string | undefined | null): boolean {
  return String(dosis ?? '').trim().toLowerCase() === DOSIS_DESCONOCIDA
}

export const POR_QUE_NO_VALE_LO_QUE_ESCRIBE_LA_IA =
  'El modelo pone «No especificada» cuando no captó la dosis, y eso es un hueco, ' +
  'no una declaración. Si la compuerta lo aceptara quedaría desactivada de vuelta ' +
  'y no se habría arreglado nada. La declaración es un acto del médico: la pone ' +
  'un botón, con una frase canónica que se compara literal.'

export const POR_QUE_SE_IMPRIME =
  'El texto va al campo `dosis`, así que sale en la receta y en la nota. Quien ' +
  'lea el documento tiene que ver que la dosis se desconoce — un renglón en ' +
  'blanco parecería un olvido, y esto no lo es: es lo que el paciente pudo decir.'
