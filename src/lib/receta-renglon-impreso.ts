/**
 * LO QUE EL PAPEL DICE CUANDO AL RENGLÓN LE FALTA UN DATO — MP-005.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * «Amoxicilina 5 mL cada 8 horas» se firmaba, se imprimía y llegaba al cuidador
 * sin decir de qué presentación. Con 125 mg/5 mL y con 500 mg/5 mL es la misma
 * receta y cuatro veces la dosis: la farmacia elige, y el cuidador no puede
 * detectar el error porque el papel es internamente consistente.
 *
 * El motor de dosis ya lo caza en pantalla (`revisarUnidadDosis` →
 * `volumen_sin_concentracion`, y sus hermanos `dosis_sin_cifra` y
 * `dosis_sin_unidad`). Pero el aviso vivía SÓLO en la pantalla del médico: en
 * cuanto pulsaba Imprimir, el renglón salía limpio y quien dispensa no veía
 * nada. El papel es el que viaja.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Traduce el aviso del motor a una marca corta que cabe en el renglón impreso.
 * NO decide nada clínico y NO inventa una concentración: dice que falta y pone
 * un ejemplo de la FORMA («250 mg/5 mL»), no una cifra para ese fármaco.
 *
 * La fuente es el mismo motor que la pantalla: si el motor deja de avisar, el
 * papel deja de marcar, y no hay dos criterios sobre lo mismo.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No bloquea la impresión. Un volumen sin concentración es legítimo cuando la
 * presentación va escrita en las indicaciones, y bloquear el papel dejaría al
 * paciente sin receta; lo que no puede pasar es que salga sin que nadie lo
 * sepa. `NEEDS_CLINICAL_REVIEW` sigue abierto para la tabla de presentaciones
 * comerciales (la aporta el médico, no se deduce).
 *
 * Módulo PURO.
 */
import { revisarUnidadDosis } from '@/lib/seguridad/dosis'

/** Cómo se dice en el PAPEL cada hueco que el motor encuentra en la dosis. */
const MARCA_POR_CODIGO: Record<string, string> = {
  volumen_sin_concentracion: 'FALTA LA CONCENTRACIÓN (p. ej. 250 mg/5 mL)',
  dosis_sin_unidad: 'FALTA LA UNIDAD (mg / mcg / mL)',
  dosis_sin_cifra: 'FALTA LA CANTIDAD',
}

/**
 * La marca que se imprime junto al renglón, o `null` si el renglón está
 * completo. Se le pasa el medicamento tal cual lo lleva la receta.
 */
export function marcaDelRenglonImpreso(
  m: { nombre?: string; dosis?: string } | null | undefined,
): string | null {
  const nombre = (m?.nombre ?? '').trim()
  if (!nombre) return null
  const alerta = revisarUnidadDosis(nombre, m?.dosis)
  if (!alerta) return null
  return MARCA_POR_CODIGO[alerta.codigo] ?? null
}

export const POR_QUE_LA_MARCA_VA_EN_EL_PAPEL =
  'Porque el aviso que sólo ve el médico no acompaña al medicamento hasta el ' +
  'mostrador. Quien surte y quien administra leen el papel, y con un volumen ' +
  'sin concentración los mismos mililitros son dosis distintas.'
