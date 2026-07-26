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
export function presionesLlenado_Ee(ee?: number | string): HallazgoPOCUS {
  const v = num(ee)
  if (v === null) return bloq('E/e′ no medido', 'pocusSoliman2026')
  const interp = v < 8 ? 'presiones de llenado normales' : v > 14 ? 'presiones de llenado elevadas' : 'indeterminado (8–14): no clasificar solo con esto'
  return {
    ok: true, valor: v, hallazgo: interp, bloqueado: false, motivoBloqueo: null,
    interpretacion: `E/e′ ${v}: ${interp}`,
    limitaciones: ['Invalidantes (valvulopatía mitral, prótesis, marcapasos, FA) no enumerados por la fuente: validar con guía ASE'],
    fuenteId: 'pocusSoliman2026',
  }
}

/** Síndrome intersticial por líneas B (> 3 por espacio intercostal). */
export function lineasB(porEspacio?: number | string): HallazgoPOCUS {
  const b = num(porEspacio)
  if (b === null) return bloq('Nº de líneas B no reportado', 'pocusRowe2026')
  const anormal = b > 3
  return {
    ok: true, valor: b, hallazgo: anormal ? 'síndrome intersticial' : 'sin síndrome intersticial',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: anormal ? `${b} líneas B/espacio > 3: síndrome intersticial (edema)` : `${b} líneas B/espacio: dentro de lo normal`,
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
  const obstruccion = g > 30
  return {
    ok: true, valor: g, hallazgo: obstruccion ? 'obstrucción dinámica del TSVI' : 'sin obstrucción significativa',
    bloqueado: false, motivoBloqueo: null,
    interpretacion: obstruccion ? `Gradiente TSVI ${g} > 30 mmHg: obstrucción dinámica — NO escalar inotrópicos (los empeora)` : `Gradiente TSVI ${g} mmHg: sin obstrucción significativa`,
    limitaciones: [], fuenteId: 'pocusSoliman2026',
  }
}

/* ── HUECOS DECLARADOS: no están en las guías provistas, no se inventan ── */

/** VExUS: NO implementado (los grados 0–3 y cortes Doppler no están en los PDFs). */
export function vexus(): HallazgoPOCUS {
  return {
    ok: false, valor: null, hallazgo: null, bloqueado: true,
    motivoBloqueo: 'La tabla de grados VExUS 0–3 y sus cortes Doppler (vena hepática/porta/renal) NO están en las guías provistas',
    interpretacion: 'Requiere el consenso EACVI / Beaubien-Souligny para codificarse; no se estima con las fuentes actuales.',
    limitaciones: [], fuenteId: 'esicm2025', requiereFuente: true,
  }
}

/** % de VTI con PLR: NO implementado (el corte no está en los PDFs provistos). */
export function respuestaPLR_VTI(): HallazgoPOCUS {
  return {
    ok: false, valor: null, hallazgo: null, bloqueado: true,
    motivoBloqueo: 'El % de cambio del VTI con PLR que define respuesta (~10–15%) no aparece en las fuentes provistas',
    interpretacion: 'Requiere Monnet/Teboul; PLR es válido en FA y respiración espontánea, pero el corte numérico falta en estas guías.',
    limitaciones: [], fuenteId: 'esicm2025', requiereFuente: true,
  }
}
