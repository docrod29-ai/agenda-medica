/**
 * MOTOR DE ULTRASONIDO CRÍTICO (POCUS) — ICU (iteración nexusmed-icu-009).
 *
 * Reglas DETERMINISTAS con umbrales VERIFICADOS de las guías provistas (Soliman
 * 2026, Rowe 2026, Kok 2022 — ver evidencia.ts). Cada función BLOQUEA si la
 * CONDICIÓN QUE INVALIDA la medición está presente (p.ej. distensibilidad de VCI
 * solo vale en ventilación mecánica). Ninguna medición aislada decide conducta.
 *
 * HUECOS HONESTOS (no estaban en los PDFs → NO se inventan): la tabla de GRADOS
 * VExUS 0–3 y sus cortes Doppler, el Lung Ultrasound Score numérico por zonas, y
 * el % de cambio de VTI con PLR que define respuesta. Se exponen como "requiere
 * fuente externa" hasta que el Dr aporte el consenso correspondiente.
 */

export const POCUS_ENGINE_VERSION = '1.0.0'

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

export interface HallazgoPOCUS {
  ok: boolean
  hallazgo: string | null
  valor: number | null
  bloqueado: boolean
  motivoBloqueo: string | null
  interpretacion: string
  limitaciones: string[]
  fuenteId: string
  requiereFuente?: boolean   // true = umbral no disponible en las guías provistas
}

const bloq = (motivo: string, fuenteId: string, limitaciones: string[] = []): HallazgoPOCUS =>
  ({ ok: false, hallazgo: null, valor: null, bloqueado: true, motivoBloqueo: motivo, interpretacion: '', limitaciones, fuenteId })

/** Disfunción sistólica del VD por TAPSE (< 16 mm). */
export function disfuncionVD_TAPSE(tapseMm?: number | string): HallazgoPOCUS {
  const t = num(tapseMm)
  if (t === null) return bloq('TAPSE no medido', 'pocusSoliman2026')
  const anormal = t < 16
  return {
    ok: true, valor: t, hallazgo: anormal ? 'disfunción sistólica del VD' : 'TAPSE normal',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: anormal ? `TAPSE ${t} mm < 16: disfunción sistólica del VD` : `TAPSE ${t} mm: normal`,
    limitaciones: ['Ángulo-dependiente; se altera tras cirugía cardiaca/pericardiotomía (no especificado en la fuente)'],
    fuenteId: 'pocusSoliman2026',
  }
}

/** Sobrecarga/dilatación del VD por relación de diámetros basales VD/VI (> 1.0). */
export function sobrecargaVD_VDVI(relacion?: number | string): HallazgoPOCUS {
  const r = num(relacion)
  if (r === null) return bloq('Relación VD/VI no medida', 'pocusSoliman2026')
  const anormal = r > 1.0
  return {
    ok: true, valor: r, hallazgo: anormal ? 'dilatación/sobrecarga del VD' : 'VD/VI normal',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: anormal ? `VD/VI ${r} > 1.0: dilatación/sobrecarga del VD` : `VD/VI ${r}: normal`,
    limitaciones: [], fuenteId: 'pocusSoliman2026',
  }
}

/** Signo 60/60: distingue HTP aguda (TEP) de crónica. */
export function signo6060(patMs?: number | string, gradienteITmmHg?: number | string): HallazgoPOCUS {
  const pat = num(patMs), it = num(gradienteITmmHg)
  if (pat === null || it === null) return bloq('Faltan PAT o gradiente de IT', 'pocusSoliman2026')
  if (pat >= 60) return { ok: true, valor: pat, hallazgo: 'PAT normal', bloqueado: false, motivoBloqueo: null, interpretacion: `PAT ${pat} ms ≥ 60: no sugiere HTP aguda`, limitaciones: [], fuenteId: 'pocusSoliman2026' }
  const agudo = it < 60
  return {
    ok: true, valor: pat, hallazgo: agudo ? 'HTP aguda (patrón TEP)' : 'HTP crónica',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: agudo ? `PAT < 60 ms + IT < 60 mmHg: HTP aguda, típica de TEP` : `PAT < 60 ms pero IT > 60 mmHg: sugiere HTP crónica`,
    limitaciones: [], fuenteId: 'pocusSoliman2026',
  }
}

/**
 * Respuesta a líquidos por distensibilidad de VCI. BLOQUEA si NO hay ventilación
 * mecánica (el umbral > 18% solo está validado en VM). = (max−min)/min × 100.
 */
export function distensibilidadVCI(vciMaxMm?: number | string, vciMinMm?: number | string, ventilacionMecanica?: boolean): HallazgoPOCUS {
  const lim = ['Solo válido en ventilación mecánica', 'Afectado por presión intraabdominal y posición; no clasificar volumen solo con VCI']
  if (ventilacionMecanica !== true) return bloq('Distensibilidad de VCI solo válida en ventilación mecánica (presión positiva)', 'pocusSoliman2026', lim)
  const mx = num(vciMaxMm), mn = num(vciMinMm)
  if (mx === null || mn === null || mn <= 0) return bloq('Faltan diámetros máximo/mínimo de VCI', 'pocusSoliman2026', lim)
  const idx = Math.round(((mx - mn) / mn) * 100)
  const respondedor = idx > 18
  return {
    ok: true, valor: idx, hallazgo: respondedor ? 'probable respondedor a líquidos' : 'probable no respondedor',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: `Distensibilidad VCI ${idx}% ${respondedor ? '> 18: sugiere respuesta a líquidos' : '≤ 18: no sugiere respuesta'} (en VM)`,
    limitaciones: lim, fuenteId: 'pocusSoliman2026',
  }
}

/** Presiones de llenado del VI por E/e′ (< 8 normal, > 14 elevado). */
export function presionesLlenado_Ee(ee?: number | string, opts?: { fa?: boolean; valvulopatiaMitral?: boolean; protesisMitral?: boolean; marcapasos?: boolean }): HallazgoPOCUS {
  const v = num(ee)
  if (v === null) return bloq('E/e′ no medido', 'pocusSoliman2026')
  // BLOQUEO por condición que invalida la estimación (contrato del módulo): en FA,
  // valvulopatía/prótesis mitral o ritmo de marcapasos, E/e′ NO estima de forma
  // fiable las presiones de llenado (ASE) → no se emite interpretación.
  const invalidantes = [
    opts?.fa && 'fibrilación auricular',
    opts?.valvulopatiaMitral && 'valvulopatía mitral',
    opts?.protesisMitral && 'prótesis mitral',
    opts?.marcapasos && 'ritmo de marcapasos',
  ].filter(Boolean) as string[]
  if (invalidantes.length) {
    return bloq(`E/e′ no es fiable con ${invalidantes.join(', ')} (validar con guía ASE)`, 'pocusSoliman2026', ['E/e′ inválido en FA, valvulopatía/prótesis mitral o marcapasos'])
  }
  const interp = v < 8 ? 'presiones de llenado normales' : v > 14 ? 'presiones de llenado elevadas' : 'indeterminado (8–14): no clasificar solo con esto'
  return {
    ok: true, valor: v, hallazgo: interp, bloqueado: false, motivoBloqueo: null,
    interpretacion: `E/e′ ${v}: ${interp}`,
    limitaciones: ['Invalidantes (valvulopatía mitral, prótesis, marcapasos, FA): confirmar que no estén presentes'],
    fuenteId: 'pocusSoliman2026',
  }
}

/** Síndrome intersticial por líneas B (> 3 por espacio intercostal). */
export function lineasB(porEspacio?: number | string): HallazgoPOCUS {
  const b = num(porEspacio)
  if (b === null) return bloq('Nº de líneas B no reportado', 'pocusRowe2026')
  // Consenso: ≥3 líneas B/espacio = región POSITIVA (síndrome intersticial). Antes
  // usaba > 3, dejando pasar el caso frontera de 3 y contradiciendo scoreRegionLUS.
  const anormal = b >= 3
  return {
    ok: true, valor: b, hallazgo: anormal ? 'síndrome intersticial' : 'sin síndrome intersticial',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: anormal ? `${b} líneas B/espacio ≥ 3: síndrome intersticial (edema)` : `${b} líneas B/espacio: dentro de lo normal`,
    limitaciones: ['El "Lung Ultrasound Score" numérico por zonas no está en las fuentes provistas'],
    fuenteId: 'pocusRowe2026',
  }
}

/**
 * Neumotórax: la ausencia de deslizamiento pleural NO es diagnóstica por sí sola;
 * requiere PUNTO PULMONAR (lung point) para confirmar.
 */
export function neumotorax(deslizamientoPresente?: boolean, puntoPulmonar?: boolean): HallazgoPOCUS {
  if (deslizamientoPresente === undefined) return bloq('No se reportó el deslizamiento pleural', 'pocusRowe2026')
  if (deslizamientoPresente === true) {
    return { ok: true, valor: null, hallazgo: 'deslizamiento presente', bloqueado: false, motivoBloqueo: null, interpretacion: 'Deslizamiento pleural presente: neumotórax poco probable en ese punto', limitaciones: [], fuenteId: 'pocusRowe2026' }
  }
  // Ausencia de deslizamiento
  if (puntoPulmonar === true) {
    return { ok: true, valor: null, hallazgo: 'neumotórax confirmado', bloqueado: false, motivoBloqueo: null, interpretacion: 'Ausencia de deslizamiento + punto pulmonar: neumotórax (S~91%/E~98%)', limitaciones: [], fuenteId: 'pocusRowe2026' }
  }
  return {
    ok: true, valor: null, hallazgo: 'indeterminado', bloqueado: false, motivoBloqueo: null,
    interpretacion: 'Ausencia de deslizamiento SIN punto pulmonar: NO diagnóstica de neumotórax (falsos positivos por enfisema subcutáneo/obesidad/apósitos, SDRA, intubación selectiva)',
    limitaciones: ['Buscar el punto pulmonar para confirmar'], fuenteId: 'pocusRowe2026',
  }
}

/** Obstrucción dinámica del TSVI (> 30 mmHg): BANDERA — empeora con inotrópicos. */
export function obstruccionTSVI(gradienteMmHg?: number | string): HallazgoPOCUS {
  const g = num(gradienteMmHg)
  if (g === null) return bloq('Gradiente del TSVI no medido', 'pocusSoliman2026')
  // ≥30 mmHg en reposo YA define obstrucción dinámica (antes usaba > 30, dejando
  // pasar el corte exacto).
  const obstruccion = g >= 30
  return {
    ok: true, valor: g, hallazgo: obstruccion ? 'obstrucción dinámica del TSVI' : 'sin obstrucción significativa',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: obstruccion ? `Gradiente TSVI ${g} ≥ 30 mmHg: obstrucción dinámica — NO escalar inotrópicos (los empeora)` : `Gradiente TSVI ${g} mmHg: sin obstrucción significativa`,
    limitaciones: [], fuenteId: 'pocusSoliman2026',
  }
}

/* ── VExUS-C (Beaubien-Souligny, Ultrasound J 2020;12:16) ── */

export type PatronVena = 'normal' | 'leve' | 'grave'

/** Pulsatilidad de vena porta = (Vmax − Vmin)/Vmax × 100. Clasifica el patrón. */
export function pulsatilidadPorta(vmax?: number | string, vmin?: number | string): { pf: number | null; patron: PatronVena | null } {
  const mx = num(vmax), mn = num(vmin)
  if (mx === null || mn === null || mx === 0) return { pf: null, patron: null }
  const pf = Math.round((Math.abs(mx - mn) / Math.abs(mx)) * 100)
  const patron: PatronVena = pf >= 50 ? 'grave' : pf >= 30 ? 'leve' : 'normal'
  return { pf, patron }
}

/**
 * VExUS-C (grado de congestión venosa sistémica). Beaubien-Souligny 2020.
 *   0 = VCI < 2.0 cm
 *   1 = VCI ≥ 2.0 cm + 0 patrones graves
 *   2 = VCI ≥ 2.0 cm + 1 patrón grave
 *   3 = VCI ≥ 2.0 cm + ≥2 patrones graves
 * Patrones graves: hepática = inversión de S; porta = pulsatilidad ≥ 50%;
 * renal = flujo venoso discontinuo SOLO diastólico.
 */
export function vexus(entrada?: { vciCm?: number | string; hepatica?: PatronVena; porta?: PatronVena; renal?: PatronVena }): HallazgoPOCUS {
  const e = entrada ?? {}
  const vci = num(e.vciCm)
  if (vci === null) return bloq('Diámetro de VCI no medido', 'vexus2020', ['Requiere subcostal longitudinal'])
  if (vci < 2.0) {
    return { ok: true, valor: 0, hallazgo: 'VExUS grado 0', bloqueado: false, motivoBloqueo: null, interpretacion: `VCI ${vci} cm < 2.0: sin congestión (grado 0)`, limitaciones: [], fuenteId: 'vexus2020' }
  }
  // VCI ≥ 2.0 → contar patrones GRAVES entre las tres venas evaluadas.
  const patrones = [e.hepatica, e.porta, e.renal]
  const evaluadas = patrones.filter(p => p !== undefined).length
  if (evaluadas === 0) return bloq('VCI dilatada pero no se evaluó ninguna vena (hepática/porta/renal)', 'vexus2020', ['El grado 1–3 requiere el Doppler venoso'])
  const graves = patrones.filter(p => p === 'grave').length
  const grado = graves >= 2 ? 3 : graves === 1 ? 2 : 1
  return {
    ok: true, valor: grado, hallazgo: `VExUS grado ${grado}`, bloqueado: false, motivoBloqueo: null,
    interpretacion: `VCI ${vci} cm ≥ 2.0 + ${graves} patrón(es) grave(s) → VExUS grado ${grado}. Grado 3 = congestión venosa grave (riesgo de LRA).`,
    limitaciones: evaluadas < 3 ? [`Solo ${evaluadas}/3 venas evaluadas: el grado puede subestimarse`] : [],
    fuenteId: 'vexus2020',
  }
}

/* ── Lung Ultrasound Aeration Score (Mongodi/ESICM-ESPNIC, ICM 2025) ── */

/** Puntúa UNA región (0–3) del score de aireación. `consolidacionCm` para el 3. */
export function scoreRegionLUS(r: { patronA?: boolean; lineasB?: number | string; pctPleuraAnormal?: number | string; consolidacionCm?: number | string }): number {
  const cons = num(r.consolidacionCm)
  // 3 = consolidación grande (tissue-like). Umbral conservador > 2.5 cm; el
  // consenso lo expresa como > 2–2.5 cm (NO es un corte universal exacto).
  if (cons !== null && cons > 2.5) return 3
  const pct = num(r.pctPleuraAnormal)
  if (pct !== null && pct > 50) return 2
  const b = num(r.lineasB)
  if (r.patronA === true || (b !== null && b < 3)) return 0
  if ((b !== null && b >= 3) || (pct !== null && pct <= 50 && pct > 0)) return 1
  return 0
}

/** LUS total de aireación adulto: 12 regiones × 0–3 = 0–36 (Mongodi 2025). */
export function lusAeration(regiones: (number | string)[]): { total: number | null; regiones: number; bloqueado: boolean; motivo: string | null; interpretacion: string; fuenteId: string; limitaciones: string[] } {
  const vals = (regiones ?? []).map(num)
  const validas = vals.filter((x): x is number => x !== null && x >= 0 && x <= 3)
  const lim = ['Consolidación (score 3): consenso da > 2–2.5 cm; se usa > 2.5 cm como criterio conservador, no un corte universal']
  if (regiones.length !== 12) return { total: null, regiones: validas.length, bloqueado: true, motivo: `Se requieren 12 regiones (adulto), se recibieron ${regiones.length}`, interpretacion: '', fuenteId: 'lus2025', limitaciones: lim }
  if (validas.length !== 12) return { total: null, regiones: validas.length, bloqueado: true, motivo: 'Cada región debe ser 0–3', interpretacion: '', fuenteId: 'lus2025', limitaciones: lim }
  const total = validas.reduce((a, b) => a + b, 0)
  return { total, regiones: 12, bloqueado: false, motivo: null, interpretacion: `LUS ${total}/36 (mayor = más pérdida de aireación)`, fuenteId: 'lus2025', limitaciones: lim }
}

/* ── PLR (Monnet 2016 ΔCO/SV; Vignon 2017 ΔLVOT-VTI) ── */

export type ParametroPLR = 'CO' | 'SV' | 'LVOT_VTI' | 'PP'

/**
 * Respuesta a líquidos por PLR. El PARÁMETRO importa:
 *   ΔCO / ΔSV ≥ 10% (Monnet 2016) · ΔLVOT-VTI ≥ 10% (Vignon 2017) → positivo.
 *   Presión de pulso (PP): NO equivalente (sensibilidad mucho menor) → no se usa.
 * PLR es fiable en FA y respiración espontánea.
 */
export function respuestaPLR(deltaPct?: number | string, parametro?: ParametroPLR): HallazgoPOCUS {
  const d = num(deltaPct)
  const fuenteId = parametro === 'LVOT_VTI' ? 'plrVignon2017' : 'plrMonnet2016'
  if (parametro === 'PP') {
    return { ok: false, valor: null, hallazgo: null, bloqueado: true, motivoBloqueo: 'La presión de pulso durante PLR NO es criterio válido (sensibilidad baja); mide gasto/VS/LVOT-VTI', interpretacion: '', limitaciones: [], fuenteId: 'plrMonnet2016' }
  }
  if (parametro === undefined) return { ok: false, valor: null, hallazgo: null, bloqueado: true, motivoBloqueo: 'Especifica el parámetro medido (CO, SV o LVOT-VTI)', interpretacion: '', limitaciones: [], fuenteId }
  if (d === null) return { ok: false, valor: null, hallazgo: null, bloqueado: true, motivoBloqueo: 'Falta el % de cambio con PLR', interpretacion: '', limitaciones: [], fuenteId }
  const respondedor = d >= 10
  return {
    ok: true, valor: d, hallazgo: respondedor ? 'probable respondedor a líquidos' : 'probable no respondedor',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: `Δ${parametro} ${d}% con PLR ${respondedor ? '≥ 10%: sugiere respuesta a líquidos' : '< 10%: no sugiere respuesta'}. PLR es fiable en FA y respiración espontánea.`,
    limitaciones: ['Falsamente negativo en hipertensión intraabdominal'], fuenteId,
  }
}
/** Alias retrocompatible. */
export const respuestaPLR_VTI = () => respuestaPLR(undefined, 'LVOT_VTI')
