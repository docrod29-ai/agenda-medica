/**
 * Verificación DETERMINISTA de dosis — capa de seguridad del paciente.
 *
 * Objetivo (hallazgo de auditoría de seguridad del paciente): detectar de forma
 * determinista errores graves de dosificación —sobre todo el clásico error de
 * decimal 50 mg → 500 mg— que un LLM puede pasar por alto. NO reemplaza el juicio
 * clínico ni una base farmacológica licenciada.
 *
 * ⚠️ HONESTIDAD DE SEGURIDAD (leer antes de usar en producción):
 *  - La tabla `CATALOGO` es una SEMILLA con valores de referencia comunes. DEBE ser
 *    revisada y ampliada por un médico/farmacéutico antes de confiar en ella.
 *  - AUSENCIA de alerta ≠ dosis segura: si el fármaco no está en el catálogo, el
 *    motor lo dice explícitamente (revision='sin_referencia'), no calla asumiendo OK.
 *  - Todo PURO (sin red/DB) → testeable y auditable.
 */

import type { ClinicalQuantity } from '@/types/clinical-quantity'
import { valorEn } from '@/types/clinical-quantity'

export type Severidad = 'critica' | 'alta' | 'info'

export interface AlertaDosis {
  severidad: Severidad
  codigo: 'sobre_maximo_dosis' | 'sobre_maximo_diario' | 'posible_error_decimal'
    | 'pediatrico_sobre_mgkg' | 'sin_referencia' | 'dosis_extrema' | 'via_edad_no_aprobada'
    /** Zona AMARILLA: por encima del máximo habitual pero dentro del absoluto. */
    | 'dosis_alta_verificar'
    /** La cifra va sin unidad: «Levotiroxina 100» son 100 mcg o 100 mg. */
    | 'dosis_sin_unidad'
    /** No hay cifra: «Paracetamol, cada 8 horas» no se puede dispensar. */
    | 'dosis_sin_cifra'
    /** La misma sustancia en dos renglones, o ya vigente en el expediente (REG-528). */
    | 'terapia_duplicada'
    /**
     * Un VOLUMEN sin la concentración: «Amoxicilina 5 mL» no dice cuánto
     * fármaco lleva. Panel de Lujo MP-005 (P0).
     */
    | 'volumen_sin_concentracion'
    /**
     * Producto COMBINADO con dos cifras («325/37.5 mg»): el motor no puede
     * repartirlas entre componentes. Panel de Lujo MI-006.
     */
    | 'dosis_combinada_no_repartible'
    /**
     * La unidad escrita es IMPOSIBLE para ese fármaco: «digoxina 250 mg» donde
     * la presentación real es 0.25 mg. Panel de Lujo RT-003.
     */
    | 'unidad_improbable_para_el_farmaco'
  mensaje: string
}

export interface FarmacoRef {
  nombre: string
  alias: string[]
  /**
   * Máximo HABITUAL por toma (mg). Rebasarlo NO es toxicidad: es salir del
   * esquema de uso común. Si además hay `hardMaxTomaMg`, la zona entre ambos es
   * AMARILLA (dosis alta: verificar indicación), no crítica.
   */
  maxTomaMg?: number
  /** Máximo HABITUAL diario (mg). Misma lógica que `maxTomaMg`. */
  maxDiaMg?: number
  /**
   * Máximo ABSOLUTO por toma (mg) — hard stop. Por encima de esto la alerta es
   * crítica aunque exista un régimen de dosis alta.
   */
  hardMaxTomaMg?: number
  /** Máximo ABSOLUTO diario (mg) — hard stop. */
  hardMaxDiaMg?: number
  /** Máx mg/kg por toma (pediátrico). */
  pedMaxMgKgToma?: number
  /** Máx mg/kg/día (pediátrico). */
  pedMaxMgKgDia?: number
  /** Máx DIARIO específico por vía ORAL (mg). Ketorolaco: 40 mg/día VO. */
  maxDiaOralMg?: number
  /** Edad mínima (años) por vía ORAL. Ketorolaco: no aprobado VO en <17 años. */
  edadMinimaOralAnios?: number
  nota?: string
}

/**
 * SEMILLA de referencia (valores comunes de referencia adulto; pediátrico donde es
 * ampliamente establecido). Conservador y ACOTADO a propósito. Ampliar/validar.
 */
export const CATALOGO: FarmacoRef[] = [
  { nombre: 'Paracetamol', alias: ['acetaminofen', 'acetaminofén', 'tylenol', 'tempra'], maxTomaMg: 1000, maxDiaMg: 4000, pedMaxMgKgToma: 15, pedMaxMgKgDia: 75, nota: 'Hepatotóxico por sobredosis; vigilar dosis acumulada.' },
  { nombre: 'Ibuprofeno', alias: ['advil', 'motrin'], maxTomaMg: 800, maxDiaMg: 3200, pedMaxMgKgToma: 10, pedMaxMgKgDia: 40 },
  { nombre: 'Naproxeno', alias: ['flanax', 'aleve'], maxTomaMg: 750, maxDiaMg: 1500 },
  { nombre: 'Ketorolaco', alias: ['dolac', 'toradol'], maxTomaMg: 30, maxDiaMg: 120, maxDiaOralMg: 40, edadMinimaOralAnios: 17, nota: 'Máx 5 días (sumando IV/IM/oral); oral máx 40 mg/día; VO no aprobado en <17 años.' },
  { nombre: 'Metamizol', alias: ['dipirona', 'neomelubrina'], maxTomaMg: 1000, maxDiaMg: 4000 },
  /**
   * AMOXICILINA — tres niveles, decisión clínica del médico dueño (REG-041).
   *
   * 1000 mg/toma y 3000 mg/día son el máximo HABITUAL, no una frontera de
   * toxicidad: el adulto recibe 1 g c/8 h en infecciones seleccionadas, y en
   * pediatría los esquemas de dosis alta (80–90 mg/kg/día) producen dosis por
   * toma mayores de forma legítima. Los ABSOLUTOS son 2000 mg/toma y 4000
   * mg/día. Entre ambos la alerta es "dosis alta: verificar indicación y
   * formulación", NO "sobredosis".
   *
   * Caso que esto arregla: niño de 35 kg a 90 mg/kg/día ÷ 2 = 1575 mg c/12 h
   * (3150 mg/día). Antes salía marcado como CRÍTICO por pasar de 1000.
   *
   * Amoxicilina-clavulanato entra por alias y hereda estos límites del
   * componente amoxicilina. Vigilar el CLAVULANATO por separado (proporción
   * 14:1, formulación ES 600/42.9) es una unidad aparte: requiere la tabla de
   * formulaciones y NO se deduce de aquí.
   */
  {
    nombre: 'Amoxicilina',
    alias: ['amoxil', 'amoxicilina-clavulanato', 'amoxicilina/clavulanato', 'amoxiclav', 'clavulin', 'augmentin'],
    maxTomaMg: 1000, hardMaxTomaMg: 2000,
    maxDiaMg: 3000, hardMaxDiaMg: 4000,
    pedMaxMgKgDia: 90,
    nota: 'Máx habitual 1 g/toma y 3 g/día; los esquemas de dosis alta llegan a 2 g/toma y 4 g/día. En amoxicilina-clavulanato la dosis se cuenta por el componente amoxicilina y la formulación debe ser 14:1.',
  },
  { nombre: 'Tramadol', alias: [], maxTomaMg: 100, maxDiaMg: 400 },
  { nombre: 'Metformina', alias: ['glucophage'], maxTomaMg: 1000, maxDiaMg: 2550 },
  { nombre: 'Omeprazol', alias: ['losec'], maxTomaMg: 40, maxDiaMg: 80 },
  { nombre: 'Losartán', alias: ['losartan'], maxTomaMg: 100, maxDiaMg: 100 },
]

function normaliza(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Busca el fármaco por nombre o alias (coincidencia de palabra contenida). */
export function buscarFarmaco(nombre: string): FarmacoRef | null {
  const n = normaliza(nombre)
  if (!n) return null
  for (const f of CATALOGO) {
    const claves = [f.nombre, ...f.alias].map(normaliza)
    if (claves.some(c => n === c || n.includes(c) || c.includes(n))) return f
  }
  return null
}

/**
 * Dosis prescrita: absoluta (mg) o POR KILO (mg/kg/dosis) — E0-05.
 *
 * ANTES la unidad viajaba en un BOOLEANO paralelo al número (`dosisMg` +
 * `dosisPorKg`), y si el booleano se perdía, "50 mg/kg" se leía como 50 mg. Ese
 * es el P0 de pediatría documentado en `esDosisPorKg`. Con esta unión el estado
 * NO ES REPRESENTABLE: el discriminante dejó de ser un flag que se puede olvidar
 * y pasó a ser la DIMENSIÓN, que el compilador exige.
 */
export type DosisPrescrita =
  | ClinicalQuantity<'masa'>            // mg — dosis absoluta por toma
  | ClinicalQuantity<'dosis_por_peso'>  // mg/kg/dosis — dosis por kilo

export interface EntradaDosis {
  farmaco: string
  /** Dosis por toma, CON su unidad (mg absolutos o mg/kg/dosis). */
  dosis: DosisPrescrita
  /** Tomas al día (para el máximo diario). Default 1. */
  tomasDia?: number
  /** Paciente pediátrico: peso (activa la verificación mg/kg). */
  peso?: ClinicalQuantity<'masa'>
  /** Vía de administración (para topes específicos por vía, p. ej. ketorolaco VO). */
  via?: string
  /** Edad del paciente en años (para restricciones por vía y edad). */
  edadAnios?: number
}

/**
 * ¿La dosis está escrita POR KILO? ("50 mg/kg", "10 mg/kg/día", "15 mg por kilo").
 *
 * EL BUG QUE ESTO CIERRA (auditoría 2026-07, P0): en pediatría lo NORMAL es
 * prescribir por kilo. `extraerMg("50 mg/kg")` devolvía 50, y `revisarDosis` lo
 * trataba como 50 mg ABSOLUTOS y los dividía entre el peso: 50/20 kg = 2.5 mg/kg,
 * muy por debajo de cualquier techo → NUNCA alertaba. Lo prescrito eran 50 mg/kg.
 * La red de seguridad quedaba invertida justo en el paciente más frágil.
 * Puro.
 */
export function esDosisPorKg(texto: string): boolean {
  const t = normaliza(texto)
  return /\/\s*kg|\bpor\s+kilo(gramo)?s?\b|\bx\s*kg\b|\bmg\s*kg\b/.test(t)
}

/**
 * Revisa una dosis y devuelve alertas (vacío = sin alertas conocidas, NO "seguro").
 * Determinista, sin efectos secundarios.
 */
export function revisarDosis(e: EntradaDosis): AlertaDosis[] {
  const alertas: AlertaDosis[] = []
  // E0-05: el booleano `dosisPorKg` desapareció — la dimensión de la cantidad ES
  // el discriminante. La aritmética de abajo no cambia: `dosis` sigue siendo el
  // mismo número que antes, y `porKg` el mismo booleano, pero DERIVADO del tipo.
  const porKg = e.dosis.dimension === 'dosis_por_peso'
  const dosis = porKg
    ? valorEn(e.dosis as ClinicalQuantity<'dosis_por_peso'>, 'mg/kg/dosis')
    : valorEn(e.dosis as ClinicalQuantity<'masa'>, 'mg')
  const pesoKg = e.peso ? valorEn(e.peso, 'kg') : undefined
  if (!Number.isFinite(dosis) || dosis <= 0) return alertas

  // Dosis absurda absoluta (oral): un solo medicamento > 10 g por toma casi siempre
  // es error de captura/unidad, sin importar el fármaco.
  if (dosis > 10000) {
    alertas.push({ severidad: 'critica', codigo: 'dosis_extrema', mensaje: `Dosis de ${dosis} mg por toma es extremadamente alta — verifica la unidad (¿mg vs mcg?) y la cifra.` })
  }

  const f = buscarFarmaco(e.farmaco)
  if (!f) {
    alertas.push({ severidad: 'info', codigo: 'sin_referencia', mensaje: `Sin referencia de dosis para "${e.farmaco}" en el catálogo. Verifica manualmente (ausencia de alerta ≠ dosis segura).` })
    return alertas
  }

  /**
   * Techo por toma (adulto) — TRES NIVELES cuando el fármaco declara un máximo
   * ABSOLUTO además del habitual (decisión clínica del Dr., REG-041):
   *   verde    ≤ maxTomaMg            → sin alerta
   *   amarillo (maxTomaMg, hardMax]   → "dosis alta: verificar indicación"
   *   rojo     > hardMaxTomaMg        → crítica (hard stop)
   * Sin `hardMaxTomaMg` se conserva el comportamiento previo (crítica al pasar
   * del habitual): fail-closed para los fármacos aún no revisados.
   */
  if (f.maxTomaMg && dosis > f.maxTomaMg) {
    // ¿Es exactamente ~10x el máximo? → probable error de decimal.
    const factor = dosis / f.maxTomaMg
    const dentroDelPerfilAlto = f.hardMaxTomaMg != null && dosis <= f.hardMaxTomaMg
    if (factor >= 9 && factor <= 11 && !dentroDelPerfilAlto) {
      alertas.push({ severidad: 'critica', codigo: 'posible_error_decimal', mensaje: `${f.nombre}: ${dosis} mg es ~10× el máximo por toma (${f.maxTomaMg} mg). ¿Error de decimal (p. ej. 500 en vez de 50)?` })
    } else if (dentroDelPerfilAlto) {
      alertas.push({ severidad: 'alta', codigo: 'dosis_alta_verificar', mensaje: `${f.nombre}: ${dosis} mg por toma supera el máximo HABITUAL (${f.maxTomaMg} mg) pero está dentro del perfil de dosis alta (máx ${f.hardMaxTomaMg} mg). Verifica la indicación y la formulación.` })
    } else {
      alertas.push({ severidad: 'critica', codigo: 'sobre_maximo_dosis', mensaje: `${f.nombre}: ${dosis} mg por toma supera el máximo${f.hardMaxTomaMg != null ? ' ABSOLUTO' : ' de referencia'} (${f.hardMaxTomaMg ?? f.maxTomaMg} mg).` })
    }
  }

  // Vía ORAL — auditoría 2026-07 (validado por el Dr). El verificador ignoraba la
  // vía: ketorolaco 30 mg VO c/8 h (90 mg/día) pasaba porque usaba el máximo
  // PARENTERAL (120). La vía oral tiene su propio techo y su restricción de edad.
  const via = normaliza(e.via ?? '')
  const esOral = /oral|\bvo\b|\bpo\b|via oral|boca/.test(via)

  // Techo diario (adulto). Si la vía es oral y hay un tope oral específico, ese manda.
  const tomas = Math.max(1, Math.floor(e.tomasDia ?? 1))
  const maxDia = (esOral && f.maxDiaOralMg != null) ? f.maxDiaOralMg : f.maxDiaMg
  const totalDia = dosis * tomas
  if (maxDia && totalDia > maxDia) {
    // Mismos tres niveles que el techo por toma. El tope ORAL específico (p. ej.
    // ketorolaco) no tiene perfil de dosis alta: ahí manda el comportamiento previo.
    const usaTopeOral = esOral && f.maxDiaOralMg != null
    const dentroDelPerfilAlto = !usaTopeOral && f.hardMaxDiaMg != null && totalDia <= f.hardMaxDiaMg
    if (dentroDelPerfilAlto) {
      alertas.push({ severidad: 'alta', codigo: 'dosis_alta_verificar', mensaje: `${f.nombre}: ${dosis} mg × ${tomas}/día = ${totalDia} mg supera el máximo diario HABITUAL (${maxDia} mg) pero está dentro del perfil de dosis alta (máx ${f.hardMaxDiaMg} mg). Verifica la indicación.` })
    } else {
      const techo = (!usaTopeOral && f.hardMaxDiaMg != null) ? f.hardMaxDiaMg : maxDia
      alertas.push({ severidad: !usaTopeOral && f.hardMaxDiaMg != null ? 'critica' : 'alta', codigo: 'sobre_maximo_diario', mensaje: `${f.nombre}: ${dosis} mg × ${tomas}/día = ${totalDia} mg supera el máximo diario${usaTopeOral ? ' POR VÍA ORAL' : f.hardMaxDiaMg != null ? ' ABSOLUTO' : ' de referencia'} (${techo} mg).` })
    }
  }

  // Restricción de edad por vía oral (ketorolaco: no aprobado VO en <17 años).
  if (esOral && f.edadMinimaOralAnios != null && e.edadAnios != null && e.edadAnios < f.edadMinimaOralAnios) {
    alertas.push({ severidad: 'critica', codigo: 'via_edad_no_aprobada', mensaje: `${f.nombre}: la vía oral no está aprobada en menores de ${f.edadMinimaOralAnios} años (paciente de ${e.edadAnios}).` })
  }

  /**
   * Pediátrico por peso. Si la dosis YA viene por kilo ("50 mg/kg"), el valor ES
   * los mg/kg y NO se divide entre el peso (dividir otra vez mataba la alerta).
   * Con dosis por kilo la verificación funciona incluso sin peso capturado.
   */
  if (porKg || (pesoKg && pesoKg > 0)) {
    const pesoOk = !!(pesoKg && pesoKg > 0)
    if (f.pedMaxMgKgToma && (porKg || pesoOk)) {
      const mgkg = porKg ? dosis : dosis / pesoKg!
      if (mgkg > f.pedMaxMgKgToma) {
        alertas.push({
          severidad: 'critica', codigo: 'pediatrico_sobre_mgkg',
          mensaje: porKg
            ? `${f.nombre}: ${mgkg.toFixed(1)} mg/kg por toma supera ${f.pedMaxMgKgToma} mg/kg.`
            : `${f.nombre}: ${dosis} mg en ${pesoKg} kg = ${mgkg.toFixed(1)} mg/kg por toma, supera ${f.pedMaxMgKgToma} mg/kg.`,
        })
      }
    }
    if (f.pedMaxMgKgDia && (porKg || pesoOk)) {
      const mgkgDia = porKg ? dosis * tomas : (dosis * tomas) / pesoKg!
      if (mgkgDia > f.pedMaxMgKgDia) {
        alertas.push({ severidad: 'alta', codigo: 'pediatrico_sobre_mgkg', mensaje: `${f.nombre}: ${(mgkgDia).toFixed(1)} mg/kg/día supera ${f.pedMaxMgKgDia} mg/kg/día.` })
      }
    }
  }

  return alertas
}

/**
 * Extrae la dosis en mg de un texto libre ("500 mg", "1 g", "250mcg"). Devuelve
 * null si no hay una cantidad clara. Convierte g→mg (×1000) y mcg/µg→mg (÷1000).
 * Puro.
 */
export function extraerMg(texto: string): number | null {
  const t = normaliza(texto)
  /**
   * ── 0) PRODUCTO COMBINADO: DOS CIFRAS, UNA UNIDAD — MI-006 ────────────────
   *
   * «Paracetamol/tramadol 325/37.5 mg» son 325 mg de paracetamol y 37.5 de
   * tramadol. El paso 1 casaba `37.5 mg` —la cifra que está pegada a la
   * unidad— y devolvía **la del otro componente**: el motor comparaba 37.5 mg
   * contra el techo del paracetamol y le decía al médico una cifra que él no
   * escribió.
   *
   * Repartir la cifra exige una tabla de formulaciones que este repositorio no
   * tiene, y adivinar cuál de las dos toca es exactamente lo que produjo el
   * defecto. Así que el motor **no opina**: devuelve `null`, como ya hace con
   * los mililitros, y `revisarUnidadDosis` lo dice en voz alta.
   *
   * El `/` con cifras a ambos lados es el patrón; se excluye la concentración
   * («250 mg/5 mL»), donde la barra separa masa de volumen y no dos principios.
   */
  if (esDosisCombinada(t)) return null
  // 1) Cantidad con unidad de MASA explícita (mg/g/mcg) — la que de verdad importa.
  /**
   * ── «500 MICROGRAMOS» SE LEÍA COMO 500 mg — REG-289 ────────────────────────
   *
   * La abreviatura `mcg` estaba; **la palabra escrita no**. Y el paso 3 —«número
   * sin unidad se asume mg»— la recogía:
   *
   *     extraerMg('500 mcg')          →  0.5   ✓
   *     extraerMg('500 microgramos')  →  500   ← MIL VECES la dosis
   *
   * Se dicta con la palabra entera todos los días. Y el mismo agujero se tragaba
   * cualquier unidad que la lista no conociera, convirtiéndola en miligramos en
   * silencio: `1000 UI` salía como 1000 mg.
   */
  const masa = t.match(/(\d+(?:[.,]\d+)?)\s*(mcg|microgramos?|µg|ug|miligramos?|mg|gramos?|gr|g)\b/)
  if (masa) {
    const val = parseFloat(masa[1].replace(',', '.'))
    if (!Number.isFinite(val)) return null
    const u = masa[2]
    if (u.startsWith('mcg') || u.startsWith('microgramo') || u === 'µg' || u === 'ug') return val / 1000
    if (u === 'g' || u === 'gr' || u.startsWith('gramo')) return val * 1000
    return val
  }
  // 2) Sin masa pero en VOLUMEN (mL/cc): NO se puede validar en mg sin la
  //    concentración → null. Antes "5 mL" se leía como 5 mg y silenciaba la red de
  //    seguridad (el clásico error de jarabes quedaba fuera).
  if (/\d+(?:[.,]\d+)?\s*(ml|mililitros?|c\.?\s?c\.?|cc)\b/.test(t)) return null
  /**
   * 2-bis) UNIDADES QUE NO SON MASA — REG-289.
   *
   * `1000 UI` de vitamina D, `2 U` de insulina, `10 mEq` de potasio, `20 gotas`.
   * Ninguna es miligramos, y el paso 3 las convertía en miligramos **en
   * silencio**. Es el mismo daño que ya costó el volumen: una red de seguridad
   * que compara peras con manzanas y no lo dice.
   *
   * `null` = «no se puede validar en mg», que es la respuesta honesta. El
   * llamador ya sabe tratarlo: es lo que hace con los mililitros.
   */
  if (/\d+(?:[.,]\d+)?\s*(ui|u|ud|uds|unidades?|meq|mmol|mol|%|gotas?|puff|inhalaciones?)\b/.test(t)) return null
  // 3) Número sin unidad: se asume mg (comportamiento previo para "500").
  const bare = t.match(/(\d+(?:[.,]\d+)?)/)
  if (!bare) return null
  const val = parseFloat(bare[1].replace(',', '.'))
  return Number.isFinite(val) ? val : null
}

/**
 * Estima cuántas TOMAS al día implica una frecuencia en texto libre ("cada 8
 * horas", "c/12h", "3 veces al día", "cada 24 h"). Devuelve null si no se entiende.
 * Puro.
 */
export function extraerTomasDia(frecuencia: string): number | null {
  const t = normaliza(frecuencia)
  if (!t) return null
  /**
   * RANGOS — auditoría 2026-07 (P2). «cada 4 a 6 horas» / «cada 6-8 h» no casaba
   * ningún patrón (el número no queda pegado a la unidad) → devolvía null → el
   * llamador asumía 1 toma/día y el TECHO DIARIO se apagaba en silencio:
   * paracetamol 1000 mg «cada 4 a 6 horas» son hasta 6000 mg/día (techo 4000) y
   * no alertaba. Se toma el intervalo MÁS CORTO = más tomas al día = peor caso,
   * que es la lectura segura para un techo.
   */
  let m = t.match(/cada\s*(\d+)\s*(?:a|hasta|o|u|y|-|–)\s*(\d+)\s*(?:h|hrs?|horas?)\b/)
  if (m) {
    const h = Math.min(parseInt(m[1], 10), parseInt(m[2], 10))
    return h > 0 ? Math.round(24 / h) : null
  }
  m = t.match(/cada\s*(\d+)\s*(h|hrs?|horas?)/) || t.match(/c\/?\s*(\d+)\s*h/)
  if (m) { const h = parseInt(m[1], 10); return h > 0 ? Math.round(24 / h) : null }
  m = t.match(/(\d+)\s*(veces|vez|x)\b/)
  if (m) return parseInt(m[1], 10)
  // Números ESCRITOS CON LETRA — muy común en dictado ("tres veces al día",
  // "cada ocho horas"). Antes no se parseaban → tomasDia caía a 1 y el techo DIARIO
  // no se comprobaba (ibuprofeno 800 mg "tres veces al día" = 2400 mg se leía 800).
  const NUM: Record<string, number> = {
    una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, ocho: 8, doce: 12, veinticuatro: 24,
  }
  const mp = t.match(/(una?|dos|tres|cuatro|cinco|seis)\s*(veces|vez)\b/)
  if (mp && NUM[mp[1]]) return NUM[mp[1]]
  const mh = t.match(/cada\s*(una?|dos|tres|cuatro|seis|ocho|doce|veinticuatro)\s*(h|hrs?|horas?)/)
  if (mh && NUM[mh[1]]) { const h = NUM[mh[1]]; return h > 0 ? Math.round(24 / h) : null }
  if (/una vez|1 vez|diaria|al dia|cada 24|cada veinticuatro/.test(t)) return 1

  /**
   * ── LAS ABREVIATURAS LATINAS — REG-289 ────────────────────────────────────
   *
   * `QID`, `TID`, `BID`, `QD`, `QHS`, `Q8H`. Se escriben en receta mexicana
   * todos los días y devolvían **`null`**.
   *
   * Y `null` no es inocuo aquí: el llamador hace
   * `Math.max(1, Math.floor(tomasDia ?? 1))`, así que **asume una toma al día y
   * el techo DIARIO se apaga en silencio**. Paracetamol 1000 mg `QID` son
   * 4 000 mg —el techo entero— y se comprobaban 1 000.
   *
   * Es exactamente el fallo que ya documentó el comentario de los números
   * escritos con letra, por otra puerta. La lista era corta; el modo de fallo,
   * el mismo.
   */
  const LATINAS: Record<string, number> = {
    qd: 1, qod: 1, hs: 1, qhs: 1, om: 1, on: 1,
    bid: 2, bd: 2,
    tid: 3, tds: 3,
    qid: 4, qds: 4,
  }
  const lat = t.match(/\b(qid|qds|tid|tds|bid|bd|qhs|qod|qd|hs|om|on)\b/)
  if (lat && LATINAS[lat[1]]) return LATINAS[lat[1]]
  /* `q6h`, `q 8 h`: la forma latina del intervalo. */
  const qh = t.match(/\bq\s*(\d+)\s*h\b/)
  if (qh) { const h = parseInt(qh[1], 10); return h > 0 ? Math.round(24 / h) : null }

  return null
}

/** Peor severidad de un conjunto de alertas (para el color del aviso). */
export function peorSeveridad(alertas: AlertaDosis[]): Severidad | null {
  if (alertas.some(a => a.severidad === 'critica')) return 'critica'
  if (alertas.some(a => a.severidad === 'alta')) return 'alta'
  if (alertas.some(a => a.severidad === 'info')) return 'info'
  return null
}

/* ════════════════════════════════════════════════════════════════════════════
   LA UNIDAD QUE FALTA — un hecho del TEXTO, no un juicio clínico
   ════════════════════════════════════════════════════════════════════════════

   `revisarDosis` recibe una cantidad con su unidad ya resuelta, así que nunca
   puede ver este problema: cuando llega, la ambigüedad ya se resolvió a la
   fuerza. Y se resolvía hacia un lado — `extraerMg` asume MILIGRAMOS cuando no
   encuentra unidad («500» → 500 mg).

   Para casi todo eso es razonable. Para lo que se dosifica en microgramos no lo
   es en absoluto: **«Levotiroxina 100» son 100 mcg en la vida real y 100 mg en
   el papel**. Mil veces. Lo mismo con fentanilo, digoxina, clonidina o
   levonorgestrel.

   Y esto se IMPRIME tal cual. El motor de dosis puede protestar internamente,
   pero lo que sale por la impresora, firmado, es el texto que escribió el
   médico. Quien lo lee en la farmacia tiene que adivinar.

   El módulo de antimicrobianos ya lo exigía —«una cifra sin unidad no se puede
   comparar con nada»— y la receta de todos los días, que es la que se usa cien
   veces más, no. Esto iguala las dos.

   NO es una decisión médica: no se propone una dosis, no se elige una unidad,
   no se corrige nada. Sólo se dice que falta un dato, que es un hecho
   comprobable del texto.
*/

/** Unidades de MASA: la cifra queda determinada. */
const RE_MASA = /\d\s*(mcg|µg|ug|mg|g|gr|gramos?|kg)\b/i
/** Unidades de VOLUMEN: otro problema (hace falta la concentración), no éste. */
const RE_VOLUMEN = /\d\s*(ml|mililitros?|l|litros?|c\.?\s?c\.?|cc|gotas?|gts)\b/i
/**
 * Formas farmacéuticas y unidades biológicas: «1 tableta» no es ambiguo — la
 * presentación lleva la dosis y quien dispensa sabe cuál es.
 */
const RE_FORMA = /\d\s*(tabletas?|tabs?|comprimidos?|caps?|c[áa]psulas?|grageas?|[áa]mpulas?|ampolletas?|frascos?|sobres?|sachets?|supositorios?|[óo]vulos?|parches?|puffs?|disparos?|inhalaci[óo]n(?:es)?|aplicaci[óo]n(?:es)?|nebulizaci[óo]n(?:es)?|u\.?i\.?|ui|unidades?|u|meq|mmol)\b/i
/**
 * ── LA «U» SUELTA: INSULINA Y HEPARINA (REG-247) ────────────────────────────
 *
 * La lista tenía `ui` y `u.i.` pero NO la `u` sola. Medido: «2 U/h» —una
 * infusión de insulina, exactamente como se dicta en terapia intensiva— salía
 * como **«dosis sin unidad»**.
 *
 * Un aviso falso sobre una insulina es de los peores que puede dar este sistema:
 * es un fármaco de alto riesgo, y enseñar a ignorar su aviso es enseñar a
 * ignorarlo el día que el aviso sea verdadero.
 *
 * `u` va DESPUÉS de `ui` y `unidades` a propósito: en una alternancia gana la
 * primera que casa, y si `u` fuera antes se comería la «u» de «ui».
 *
 * El porcentaje va aparte y SIN `\b`.
 *
 * `%` no es un carácter de palabra, así que un límite de palabra detrás de él
 * exige otra letra al lado: «1%» al final de la cadena no casaba y una crema al
 * 1% salía como «cantidad sin unidad». Lo cazó la prueba de no-avisar-de-más,
 * que es justo para lo que está.
 */
const RE_PORCENTAJE = /\d\s*%/
/** Un número, en cualquier forma («0.5», «1,5», «100»). */
const RE_CIFRA = /\d/

/**
 * ── LA CONCENTRACIÓN: «250 mg / 5 mL» ───────────────────────────────────────
 *
 * Es lo que convierte un volumen en una dosis. Sin ella, «5 mL» no dice cuánto
 * fármaco lleva: con amoxicilina de 125 mg/5 mL son 125 mg, y con la de
 * 500 mg/5 mL son cuatro veces más. Se acepta también la forma por 100 mL y el
 * porcentaje, que son las otras dos maneras de escribir lo mismo.
 */
const RE_CONCENTRACION =
  /\d+(?:[.,]\d+)?\s*(mcg|µg|ug|mg|g|gr|ui|u\.?i\.?|meq|mmol)\s*(?:\/|por|en)\s*\d*(?:[.,]\d+)?\s*(ml|mililitros?|l|litros?|cc|c\.?\s?c\.?|gotas?|dosis|aplicaci[óo]n(?:es)?|puffs?|disparos?)\b/i

/** ¿El texto dice de qué concentración es el volumen? Puro. */
export function tieneConcentracion(texto: string | null | undefined): boolean {
  const t = String(texto ?? '')
  return RE_CONCENTRACION.test(t) || RE_PORCENTAJE.test(t)
}

/**
 * ¿Es un producto COMBINADO escrito con dos cifras y una unidad? MI-006.
 *
 * «325/37.5 mg», «500/125 mg», «80/12.5 mg». Se excluye a propósito la
 * concentración («250 mg/5 mL»), donde la barra separa masa de volumen: ahí la
 * primera cifra SÍ es la dosis del principio y el motor puede leerla.
 */
export function esDosisCombinada(texto: string | null | undefined): boolean {
  const t = String(texto ?? '')
  if (tieneConcentracion(t)) return false
  return /\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(mcg|µg|ug|mg|g|gr)\b/i.test(t)
}

/**
 * ── FÁRMACOS QUE SE DOSIFICAN EN MICROGRAMOS — RT-003 ───────────────────────
 *
 * Esto NO es una tabla de dosis: es una tabla de DIMENSIÓN. No dice cuánto se
 * da, dice en qué unidad se escribe. Por eso puede vivir aquí sin la validación
 * clínica que sí exige un techo (REG-043): equivocarse de dimensión es un
 * factor de mil, y la alerta que genera es «verifica la unidad», nunca «la
 * dosis correcta es otra».
 *
 * FUENTE, dentro de este repositorio y no inventada:
 *   · el propio comentario de este módulo (más arriba) ya nombra levotiroxina,
 *     fentanilo, digoxina, clonidina y levonorgestrel como el caso que motivó
 *     la compuerta de unidad ausente;
 *   · `src/lib/hospital/medicamentos-catalogo.ts` guarda sus presentaciones
 *     reales — Digoxina «0.25 mg», Levotiroxina «50 mcg»/«100 mcg», Fentanilo
 *     «0.05 mg/mL» —, que es de donde sale la dimensión.
 *
 * AMPLIARLA es criterio clínico: `NEEDS_CLINICAL_REVIEW`. La lista corta no
 * declara que los demás fármacos estén vigilados — declara lo contrario, y por
 * eso el aviso dice «no verificada» y no «correcta» (regla 5 de seguridad
 * clínica: señalar de menos, nunca de más).
 */
const EN_MICROGRAMOS = [
  'levotiroxina', 'digoxina', 'fentanilo', 'clonidina', 'levonorgestrel',
  'desmopresina', 'misoprostol', 'buprenorfina', 'formoterol', 'salmeterol',
] as const

/**
 * Umbral de dimensión, en mg. Por encima de esto, una dosis escrita para un
 * fármaco de la lista de microgramos es casi con seguridad un factor de mil:
 * 1 mg de cualquiera de ellos ya es una dosis muy alta, y el aviso pide
 * verificar, no corrige.
 */
const MG_IMPROBABLE_EN_MICROGRAMOS = 1

/**
 * ── ENOXAPARINA Y LOS QUE NUNCA SE ESCRIBEN EN MICROGRAMOS ──────────────────
 *
 * El espejo del caso anterior: «enoxaparina 60 mcg» es la milésima parte de la
 * jeringa que existe. Aquí la dimensión también es un hecho de la
 * presentación, no un juicio: la enoxaparina se surte en miligramos.
 */
const NUNCA_EN_MICROGRAMOS = [
  'enoxaparina', 'metformina', 'paracetamol', 'amoxicilina', 'ibuprofeno',
  'ceftriaxona', 'azitromicina', 'omeprazol', 'prednisona', 'naproxeno',
] as const

/** mcg por debajo de los cuales la dimensión es improbable en esos fármacos. */
const MCG_IMPROBABLE_EN_MILIGRAMOS = 1000

export type ClaseUnidadDosis = 'masa' | 'volumen' | 'forma' | 'sin_unidad' | 'sin_cifra'

/**
 * Qué clase de dosis es este texto. Puro: sólo mira la cadena.
 *
 * El orden importa. La MASA se comprueba primero porque determina la cifra por
 * completo; la FORMA antes que el volumen porque «2 gotas» es una presentación
 * (y ya viene contemplada en el volumen por comodidad de lectura).
 */
export function claseDeUnidad(texto: string | null | undefined): ClaseUnidadDosis {
  const t = String(texto ?? '').trim()
  if (!t || !RE_CIFRA.test(t)) return 'sin_cifra'
  if (RE_MASA.test(t)) return 'masa'
  if (RE_FORMA.test(t) || RE_PORCENTAJE.test(t)) return 'forma'
  if (RE_VOLUMEN.test(t)) return 'volumen'
  return 'sin_unidad'
}

/**
 * La alerta por dosis incompleta, o `null` si el texto está completo.
 *
 * Severidad `alta` y no `critica`: se puede firmar igual, porque hay recetas
 * legítimas donde el médico escribe la posología en las indicaciones y el
 * sistema no puede saberlo. Bloquear la firma por esto convertiría la compuerta
 * de seguridad en un obstáculo que se aprende a saltar, y entonces tampoco
 * frenaría lo que sí importa.
 */
/**
 * Dónde se está escribiendo la dosis.
 *
 * Cambia **sólo el texto**, nunca el criterio: en una receta el riesgo es que
 * quien la surta no sepa cuánto dispensar; en una indicación de hospital, que
 * **enfermería administre** una cantidad que no dice de qué. Decirle a un
 * intensivista «quien la surta» es texto de otro sitio, y un aviso que no habla
 * de su trabajo se lee como ruido.
 */
export type DondeSeEscribe = 'receta' | 'indicacion_hospital'

/**
 * ── LA UNIDAD IMPOSIBLE PARA ESE FÁRMACO — RT-003 ───────────────────────────
 *
 * La compuerta de arriba vigila la unidad que FALTA. Esta vigila la que está
 * escrita y no puede ser: «digoxina 250 mg» (mil veces la presentación de
 * 0.25 mg) o «enoxaparina 60 mcg» (la milésima parte de la jeringa). El propio
 * comentario de este módulo nombra ese factor de mil como su motivo de existir,
 * y sin embargo sólo se miraba cuando la unidad no estaba.
 *
 * No propone una dosis ni corrige nada: dice que la DIMENSIÓN no cuadra con la
 * presentación del fármaco, que es comprobable. Severidad `alta`, como sus
 * hermanas: se puede firmar, pero queda dicho.
 *
 * Puro y exportado para poder probarlo solo.
 */
export function revisarDimensionUnidad(
  farmaco: string,
  dosis: string | null | undefined,
): AlertaDosis | null {
  const nombre = String(farmaco ?? '').trim()
  const n = normaliza(nombre)
  const t = normaliza(String(dosis ?? ''))
  if (!n || !t) return null
  // Un volumen o una forma farmacéutica no llevan la dimensión en la cifra.
  if (claseDeUnidad(dosis) !== 'masa') return null
  const mg = extraerMg(t)
  if (mg == null || !Number.isFinite(mg) || mg <= 0) return null
  const escritoEnMicrogramos = /\d\s*(mcg|µg|ug|microgramos?)\b/i.test(t)

  if (EN_MICROGRAMOS.some(f => n.includes(f)) && !escritoEnMicrogramos && mg > MG_IMPROBABLE_EN_MICROGRAMOS) {
    return {
      severidad: 'alta',
      codigo: 'unidad_improbable_para_el_farmaco',
      mensaje: `${nombre || 'el medicamento'}: se dosifica en microgramos y aquí van ${mg} mg. Verifica la unidad — la diferencia entre mg y mcg es de mil veces.`,
    }
  }
  if (NUNCA_EN_MICROGRAMOS.some(f => n.includes(f)) && escritoEnMicrogramos && mg * 1000 < MCG_IMPROBABLE_EN_MILIGRAMOS) {
    return {
      severidad: 'alta',
      codigo: 'unidad_improbable_para_el_farmaco',
      mensaje: `${nombre || 'el medicamento'}: se dosifica en miligramos y aquí van ${Math.round(mg * 1000)} mcg. Verifica la unidad — la diferencia entre mcg y mg es de mil veces.`,
    }
  }
  return null
}

export function revisarUnidadDosis(
  farmaco: string,
  dosis: string | null | undefined,
  donde: DondeSeEscribe = 'receta',
): AlertaDosis | null {
  const clase = claseDeUnidad(dosis)
  const nombre = String(farmaco ?? '').trim() || 'el medicamento'
  if (clase === 'sin_cifra') {
    return {
      severidad: 'alta',
      codigo: 'dosis_sin_cifra',
      mensaje: donde === 'indicacion_hospital'
        ? `${nombre}: la indicación no lleva cantidad. Enfermería no puede administrar lo que no dice cuánto.`
        : `${nombre}: la receta no lleva cantidad. Quien la surta no puede saber cuánto dispensar.`,
    }
  }
  /**
   * ── EL VOLUMEN SIN CONCENTRACIÓN — MP-005 (P0) ────────────────────────────
   *
   * «Amoxicilina 5 mL cada 8 horas» se firmaba, se imprimía y llegaba al
   * cuidador sin decir de qué presentación. Con 125 mg/5 mL y con 500 mg/5 mL
   * son la misma receta y cuatro veces la dosis. El verificador de dosis
   * tampoco protestaba: `extraerMg` devuelve `null` para un volumen y el
   * renglón se saltaba en silencio.
   *
   * Es el mismo hecho del texto que la unidad ausente —falta un dato, y se
   * puede comprobar leyendo— así que va con la misma severidad `alta`: se
   * puede firmar (hay recetas legítimas donde la presentación va escrita en las
   * indicaciones), pero nadie puede decir que no se avisó.
   */
  if (clase === 'volumen' && !tieneConcentracion(dosis)) {
    return {
      severidad: 'alta',
      codigo: 'volumen_sin_concentracion',
      mensaje: donde === 'indicacion_hospital'
        ? `${nombre}: la indicación dice el volumen pero no la concentración. Escribe la presentación (por ejemplo «250 mg/5 mL») — enfermería no puede saber cuánto fármaco lleva ese volumen.`
        : `${nombre}: dice el volumen pero no de qué concentración. Escribe la presentación (por ejemplo «250 mg/5 mL») — con dos jarabes distintos, los mismos mL son dosis distintas.`,
    }
  }
  /**
   * ── EL PRODUCTO COMBINADO — MI-006 ────────────────────────────────────────
   *
   * «Paracetamol/tramadol 325/37.5 mg». El motor leía 37.5 y se lo comparaba
   * al paracetamol. Decir «no puedo repartirla» es la respuesta honesta, y es
   * la que este módulo ya da para los mililitros y para las unidades
   * internacionales.
   */
  if (esDosisCombinada(dosis)) {
    return {
      severidad: 'info',
      codigo: 'dosis_combinada_no_repartible',
      mensaje: `${nombre}: es un producto combinado y el verificador de dosis no reparte la cifra entre sus componentes. Revísala tú (ausencia de alerta ≠ dosis segura).`,
    }
  }
  const improbable = revisarDimensionUnidad(nombre, dosis)
  if (improbable) return improbable
  if (clase === 'sin_unidad') {
    return {
      severidad: 'alta',
      codigo: 'dosis_sin_unidad',
      mensaje: `${nombre}: la cantidad va sin unidad. Escribe mg, mcg, g o mL — «100» se lee como 100 mg, y en lo que se dosifica en microgramos eso son mil veces la dosis.`,
    }
  }
  return null
}
