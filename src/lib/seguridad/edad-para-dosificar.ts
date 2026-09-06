/**
 * LA EDAD CON LA QUE SE DOSIFICA — Y SI NO HAY, SE DICE. REG-524.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * La receta decidía «¿es pediátrico?» con `patient.edad`, un número CONGELADO
 * en el expediente: se escribe al capturar la fecha de nacimiento y no se
 * recalcula solo. Un paciente dado de alta desde la reserva pública nace SIN
 * `edad` y sin `fechaNacimiento`; otro que se registró hace tres años sigue
 * teniendo la edad de hace tres años.
 *
 * Con `edad === undefined`:
 *   · `esPediatrico` es `false` → no se pasa el peso → la comprobación mg/kg
 *     —la red de seguridad más importante en niños— no corre, y se aplican
 *     los TECHOS DE ADULTO a un niño;
 *   · `revisarDosis` no recibe `edadAnios` → la restricción de ketorolaco
 *     oral en menores no se evalúa;
 *   · el ajuste renal devuelve `null` sin más.
 *
 * Y la pantalla no lo decía. Había un aviso pequeño para la TFG; para la
 * dosis pediátrica, ninguno. «Ausencia de dato no es dato de ausencia»
 * (regla 4 de seguridad clínica): que no haya edad no significa que sea
 * adulto.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * 1. Si hay fecha de nacimiento, la edad se CALCULA de ella, hoy. Es la
 *    fuente que no envejece.
 * 2. Si no, se usa la `edad` congelada, que es lo único que hay.
 * 3. Si no hay ninguna, `edad: null` y `origen: 'desconocida'` — y quien
 *    pinta la receta tiene que decirlo, en ámbar, junto a las dosis.
 *
 * NO inventa una edad, no asume adulto, no bloquea imprimir: eso último es
 * política del dueño (D-A en el readiness). Módulo puro.
 */
import { edadEnAnios } from '@/lib/expediente/pediatria'

export type OrigenDeLaEdad = 'fecha_nacimiento' | 'expediente' | 'desconocida'

export interface EdadParaDosificar {
  /** Años cumplidos, o `null` si no se puede saber. Nunca se inventa. */
  edad: number | null
  origen: OrigenDeLaEdad
}

export function edadParaDosificar(
  p: { edad?: number | null; fechaNacimiento?: string | null } | null | undefined,
  hoyISO?: string,
): EdadParaDosificar {
  const calculada = edadEnAnios(p?.fechaNacimiento, hoyISO)
  if (calculada != null) return { edad: calculada, origen: 'fecha_nacimiento' }
  const congelada = p?.edad
  if (typeof congelada === 'number' && Number.isFinite(congelada) && congelada >= 0 && congelada < 130) {
    return { edad: congelada, origen: 'expediente' }
  }
  return { edad: null, origen: 'desconocida' }
}

/** Lo que se le dice al médico cuando no hay edad. Sin adivinar, sin bloquear. */
export const AVISO_SIN_EDAD_PARA_DOSIFICAR =
  'Sin edad en el expediente: NO se aplican los topes pediátricos (mg/kg) ni el ajuste renal. ' +
  'Si es un niño, captura su fecha de nacimiento antes de imprimir.'
