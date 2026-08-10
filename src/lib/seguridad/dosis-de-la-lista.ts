/**
 * LA REVISIÓN DE DOSIS, SOBRE LA LISTA ENTERA Y ANTES DE FIRMAR.
 *
 * ── EL DEFECTO (6-ago-2026, REG-190) ─────────────────────────────────────────
 *
 * `revisarDosis()` caza sobredosis, techos por vía y edad, y el **error de
 * decimal** —«500 mg donde iban 50»— que es de los errores de prescripción que
 * más daño hacen y que un LLM pasa por alto sin despeinarse.
 *
 * Tenía **un solo llamador**: la pantalla de la receta, que se abre desde una
 * nota **ya firmada**. Es decir, el motor corría cuando la nota ya estaba
 * sellada y el paciente ya se había ido con la receta en la mano.
 *
 * La lógica que arma la entrada —sacar los mg del texto, saber si son mg/kg,
 * contar las tomas al día— vivía dentro de un `useMemo` de esa pantalla, así
 * que traerla a la consulta no era llamar a una función: era copiarla. Por eso
 * se saca aquí.
 *
 * ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────
 *
 * **No cambia qué bloquea la firma.** Lo que bloquea lo decidió el médico dueño
 * el 5-ago (dosis sin cifra o sin unidad). Esto entra como aviso de nivel
 * `revisa`: le pide una mirada, no le impide firmar.
 *
 * **No inventa ningún umbral.** Todos salen del catálogo de `dosis.ts`, que ya
 * existía y él ya revisó.
 *
 * Módulo PURO.
 */
import {
  revisarDosis, extraerMg, extraerTomasDia, esDosisPorKg, peorSeveridad,
  type AlertaDosis,
} from '@/lib/seguridad/dosis'
import { cantidad, type ClinicalQuantity } from '@/types/clinical-quantity'

export interface MedicamentoRevisable {
  nombre?: string
  dosis?: string
  frecuencia?: string
  via?: string
}

export interface ContextoPaciente {
  edadAnios?: number
  /** Peso en kg. Sin él no se pueden comprobar las dosis pediátricas por kg. */
  pesoKg?: number
}

export interface DosisPeligrosa {
  med: string
  alertas: AlertaDosis[]
  severidad: ReturnType<typeof peorSeveridad>
}

/**
 * Revisa toda la lista y devuelve sólo lo que tiene algo que decir.
 *
 * `sin_referencia` se descarta EN ADULTOS: «este fármaco no está en el
 * catálogo» no es un hallazgo sobre el paciente, y en una lista de ocho
 * medicamentos llenaría la pantalla de avisos que no dicen nada. El propio
 * motor ya advierte que la ausencia de alerta no significa dosis segura.
 *
 * EN PEDIATRÍA (SAFE-003) no se descarta. La dosis pediátrica va por
 * kilogramo y el margen entre dosis terapéutica y tóxica es estrecho: que el
 * catálogo no tenga referencia para ese fármaco no es lo mismo que «sin
 * hallazgos», y callarlo se lee como «la dosis está comprobada» cuando nadie
 * la comprobó.
 */
export function dosisPeligrosasDeLaLista(
  medicamentos: readonly MedicamentoRevisable[],
  ctx: ContextoPaciente = {},
): DosisPeligrosa[] {
  const esPediatrico = ctx.edadAnios != null && ctx.edadAnios < 18
  const out: DosisPeligrosa[] = []
  for (const m of medicamentos) {
    const nombre = m.nombre?.trim()
    if (!nombre || !m.dosis?.trim()) continue
    const mg = extraerMg(m.dosis)
    if (mg == null) continue
    /**
     * «50 mg/kg» NO son 50 mg absolutos. Si no se distingue, el motor lo
     * dividiría otra vez entre el peso y la alerta pediátrica no dispararía.
     */
    const dosis = esDosisPorKg(m.dosis)
      ? cantidad(mg, 'mg/kg/dosis', 'dosis_por_peso')
      : cantidad(mg, 'mg', 'masa')
    const alertas = revisarDosis({
      farmaco: nombre,
      dosis,
      tomasDia: extraerTomasDia(m.frecuencia || '') ?? undefined,
      peso: ctx.pesoKg != null && ctx.pesoKg > 0
        ? (cantidad(ctx.pesoKg, 'kg', 'masa') as ClinicalQuantity<'masa'>)
        : undefined,
      via: m.via,
      edadAnios: ctx.edadAnios,
    }).filter(a => a.codigo !== 'sin_referencia' || esPediatrico)
    if (alertas.length) out.push({ med: nombre, alertas, severidad: peorSeveridad(alertas) })
  }
  return out
}

/** ¿Alguna es crítica? Las críticas no se pliegan. */
export function hayCritica(lista: readonly DosisPeligrosa[]): boolean {
  return lista.some(d => d.severidad === 'critica')
}

export const POR_QUE_ANTES_Y_NO_DESPUES =
  'El motor tenía un solo llamador: la pantalla de la receta, que se abre desde ' +
  'una nota YA FIRMADA. Cazaba el error de decimal cuando la nota estaba sellada ' +
  'y el paciente se había ido con la receta en la mano.'

export const POR_QUE_NO_BLOQUEA =
  'Lo que bloquea la firma lo decidió el médico dueño el 5-ago con el dato ' +
  'delante. Esto entra como aviso: le pide una mirada, no le impide firmar. ' +
  'Ampliar la compuerta por mi cuenta sería decidir por él.'

export const POR_QUE_SE_DESCARTA_SIN_REFERENCIA =
  '«Este fármaco no está en el catálogo» no es un hallazgo sobre el paciente, y ' +
  'en una lista de ocho llenaría la pantalla de avisos que no dicen nada. ' +
  'EXCEPTO en pediatría (SAFE-003): ahí la dosis va por kilo, el margen es ' +
  'estrecho, y callar que no hay referencia se lee como que la dosis está ' +
  'comprobada.'
