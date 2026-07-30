/**
 * La infusión como REGISTRO — charter §13 y §19.
 *
 *   §13: «No almacenar únicamente "Norepinefrina 0.1". Almacenar: medicamento,
 *         cantidad total, unidad, volumen final, concentración, velocidad,
 *         peso, tipo de peso, dosis calculada, inicio, canal de bomba, fuente,
 *         verificado.»
 *
 *   §19: «Cada cambio debe registrarse: 08:00 0.18 · 09:15 0.14 · 10:30 0.10 …
 *         y graficarse junto a MAP, lactato, CRT, VTI y diuresis.»
 *
 * ── POR QUÉ «NOREPINEFRINA 0.1» NO ES UN DATO CLÍNICO ────────────────────────
 *
 * Ese texto no dice a qué concentración corre, con qué peso se dosificó ni quién
 * lo verificó. Dos hospitales con preparaciones distintas escriben lo MISMO para
 * infusiones que entregan cantidades diferentes de fármaco. Y al día siguiente,
 * nadie puede reconstruir por qué la dosis era esa.
 *
 * Un registro completo permite recalcular, auditar y comparar. Un texto suelto,
 * no.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * **No calcula la dosis**: eso es `infusiones.ts`, que ya lo hace con
 * `ClinicalQuantity` en las dos direcciones. **No elige la preparación**: eso es
 * `infusion-library.ts`, con la jerarquía PATIENT > HOSPITAL > REFERENCE. Aquí
 * sólo vive la FORMA del registro y la línea de titulación.
 *
 * Y **no controla la bomba**. El charter §18 es explícito: «Nunca controlar la
 * bomba automáticamente». Este registro describe lo que ya está corriendo.
 *
 * Módulo PURO.
 */

import type { CapaPreparacion } from '@/lib/clinical/infusion-library'

/** Qué peso se usó para dosificar (charter §16: NO se cambia automáticamente). */
export type TipoPeso = 'actual' | 'ingreso' | 'seco' | 'configurado'

/** De dónde salió el registro. Procedencia del §50. */
export type FuenteInfusion = 'dictado' | 'teclado' | 'bomba' | 'importacion'

/**
 * Una infusión tal como corre en el paciente. Todos los campos del §13.
 *
 * `dosisCalculada` es OPCIONAL a propósito: si falta la concentración o el peso,
 * la infusión **existe igual** y se registra sin dosis
 * (`CANNOT_CALCULATE`, decisión ICU-Q4.3). Descartar el registro por no poder
 * calcular perdería lo que el médico dijo.
 */
export interface RegistroInfusion {
  id: string
  medicamento: string

  // ── Preparación ──
  cantidadFarmaco?: number
  unidadFarmaco?: string
  volumenFinal?: number
  unidadVolumen?: string
  /** Derivada de cantidad/volumen. NUNCA se teclea: no puede contradecir sus partes. */
  concentracion?: number
  unidadConcentracion?: string
  /** De qué capa salió la preparación. Sin esto no se puede auditar la dosis. */
  capaPreparacion?: CapaPreparacion

  // ── Lo que corre ──
  velocidad: number
  unidadVelocidad: 'mL/h'

  // ── Peso usado para dosificar ──
  pesoKg?: number
  tipoPeso?: TipoPeso

  // ── Resultado ──
  dosisCalculada?: number
  unidadDosis?: string
  /** Por qué no hay dosis, si no la hay. */
  motivoSinDosis?: string

  // ── Trazabilidad ──
  iniciadaEn: string
  canalBomba?: string
  fuente: FuenteInfusion
  /** §12/§Q4.4: lo que viene sólo de voz se confirma ANTES de volverse orden. */
  verificada: boolean
  verificadaPor?: string
  verificadaEn?: string
}

/** Un cambio de velocidad o dosis. La línea de titulación del §19. */
export interface CambioTitulacion {
  en: string
  velocidad: number
  dosisCalculada?: number
  unidadDosis?: string
  por: string
  motivo?: string
}

export type SeveridadInfusion = 'ERROR' | 'WARNING' | 'INFORMATION'

export interface HallazgoInfusion {
  severidad: SeveridadInfusion
  codigo: string
  mensaje: string
}

/**
 * Revisión ESTRUCTURAL de un registro — charter §20.
 *
 * ⚠️ **Deliberadamente NO incluye los chequeos de MAGNITUD** que pide el §20
 * («velocidad absurda», «error de decimal», «concentración diferente a la
 * habitual del hospital»). Todos necesitan un umbral clínico o la biblioteca del
 * hospital, y ninguno de los dos existe todavía. Inventar un «rate máximo
 * razonable» sería exactamente lo que la carta operativa prohíbe.
 *
 * Lo que sí se revisa aquí es estructura pura: contradicciones internas del
 * registro que se pueden afirmar sin saber medicina.
 */
export function revisarInfusion(r: RegistroInfusion): HallazgoInfusion[] {
  const hs: HallazgoInfusion[] = []

  // ── ERROR: el registro se contradice o no puede sostener su propia dosis ──
  if (r.dosisCalculada !== undefined && r.concentracion === undefined) {
    hs.push({
      severidad: 'ERROR', codigo: 'DOSIS_SIN_CONCENTRACION',
      mensaje: 'Hay una dosis calculada pero no se registró la concentración: no se puede reconstruir de dónde salió.',
    })
  }
  if (r.dosisCalculada !== undefined && r.unidadDosis?.includes('/kg') && r.pesoKg === undefined) {
    hs.push({
      severidad: 'ERROR', codigo: 'DOSIS_POR_PESO_SIN_PESO',
      mensaje: 'La unidad de dosis es por kilo pero no se registró el peso usado.',
    })
  }
  if (
    r.concentracion !== undefined &&
    r.cantidadFarmaco !== undefined && r.volumenFinal !== undefined &&
    r.volumenFinal > 0
  ) {
    // La concentración se DERIVA: si no cuadra con sus partes, algo se tecleó.
    const esperada = r.cantidadFarmaco / r.volumenFinal
    const relativa = Math.abs(r.concentracion - esperada) / (esperada || 1)
    if (relativa > 0.01) {
      hs.push({
        severidad: 'ERROR', codigo: 'CONCENTRACION_NO_CUADRA',
        mensaje: `La concentración registrada no corresponde a ${r.cantidadFarmaco} en ${r.volumenFinal}: debería derivarse, no capturarse.`,
      })
    }
  }
  if (!Number.isFinite(r.velocidad) || r.velocidad < 0) {
    hs.push({
      severidad: 'ERROR', codigo: 'VELOCIDAD_INVALIDA',
      mensaje: 'La velocidad de infusión no es un número válido.',
    })
  }
  if (r.medicamento.trim() === '') {
    hs.push({
      severidad: 'ERROR', codigo: 'BOMBA_SIN_MEDICAMENTO',
      mensaje: 'Hay una velocidad de bomba sin medicamento asociado.',
    })
  }

  // ── WARNING: falta algo para poder auditar o dosificar ──
  if (r.concentracion === undefined) {
    hs.push({
      severidad: 'WARNING', codigo: 'SIN_CONCENTRACION',
      mensaje: 'Falta la concentración: no se puede calcular la dosis (decisión ICU-Q4.3).',
    })
  }
  if (r.pesoKg !== undefined && r.tipoPeso === undefined) {
    hs.push({
      severidad: 'WARNING', codigo: 'PESO_SIN_TIPO',
      mensaje: 'Se registró un peso pero no cuál es (actual, de ingreso, seco o configurado).',
    })
  }
  if (r.fuente === 'dictado' && !r.verificada) {
    // §Q4.4 nivel 1: lo que viene sólo de voz se confirma antes de ser orden.
    hs.push({
      severidad: 'WARNING', codigo: 'DICTADA_SIN_VERIFICAR',
      mensaje: 'Viene de dictado y no se ha verificado: confirmar antes de tratarla como orden activa.',
    })
  }
  if (r.capaPreparacion === undefined && r.concentracion !== undefined) {
    hs.push({
      severidad: 'WARNING', codigo: 'PREPARACION_SIN_ORIGEN',
      mensaje: 'No consta de qué biblioteca salió la preparación: la dosis no es auditable.',
    })
  }

  // ── INFORMATION: se usó una referencia, no el estándar local ──
  if (r.capaPreparacion === 'REFERENCE_LIBRARY') {
    hs.push({
      severidad: 'INFORMATION', codigo: 'PREPARACION_DE_REFERENCIA',
      mensaje: 'La preparación viene de la biblioteca de REFERENCIA, no del estándar del hospital.',
    })
  }
  if (r.canalBomba === undefined) {
    hs.push({
      severidad: 'INFORMATION', codigo: 'SIN_CANAL',
      mensaje: 'Sin canal de bomba registrado.',
    })
  }

  return hs
}

/** ¿Hay algo que impida tratar esta infusión como orden activa? */
export function tieneErrores(hs: readonly HallazgoInfusion[]): boolean {
  return hs.some(h => h.severidad === 'ERROR')
}

/**
 * Línea de titulación ordenada — §19.
 *
 * Devuelve los cambios en orden cronológico. NO interpola ni rellena: si entre
 * dos cambios pasaron seis horas, pasaron seis horas. Rellenar inventaría dosis
 * que nadie indicó.
 */
export function lineaTitulacion(cambios: readonly CambioTitulacion[]): CambioTitulacion[] {
  return [...cambios]
    .filter(c => !Number.isNaN(Date.parse(c.en)))
    .sort((a, b) => Date.parse(a.en) - Date.parse(b.en))
}

/**
 * La dosis vigente en un instante, según la línea de titulación.
 *
 * Misma regla que las observaciones: el valor DISPONIBLE en ese momento, no el
 * último de la base de datos.
 */
export function dosisVigenteEn(
  cambios: readonly CambioTitulacion[],
  instanteIso: string,
): CambioTitulacion | null {
  const t = Date.parse(instanteIso)
  if (Number.isNaN(t)) throw new Error(`dosisVigenteEn: instante inválido «${instanteIso}»`)
  const previos = lineaTitulacion(cambios).filter(c => Date.parse(c.en) <= t)
  return previos.length > 0 ? previos[previos.length - 1] : null
}

/**
 * Dirección del último movimiento: sirve para el «NE 0.18 → 0.06» del Morning
 * Brief. Sin interpretación clínica: sólo si subió, bajó o quedó igual.
 */
export function tendenciaTitulacion(
  cambios: readonly CambioTitulacion[],
): 'subiendo' | 'bajando' | 'estable' | 'sin_datos' {
  const l = lineaTitulacion(cambios)
  if (l.length < 2) return 'sin_datos'
  const a = l[l.length - 2].velocidad
  const b = l[l.length - 1].velocidad
  return b > a ? 'subiendo' : b < a ? 'bajando' : 'estable'
}
