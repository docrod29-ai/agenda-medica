/**
 * Núcleo VERIFICABLE de la Iteración 4 (CLINICAL_WORKFLOW).
 *
 * Dos funciones PURAS (sin React/DOM, testeables) que codifican reglas no
 * negociables del programa móvil:
 *   §4.2 Resumen fijo: qué datos críticos mostrar arriba (alergia, función renal,
 *        embarazo) sin ocupar espacio de más.
 *   §4.6 + §5.2 Cierre seguro: antes de cerrar, mostrar qué falta y ADVERTIR
 *        riesgos reales (datos no confirmados en servidor) sin bloquear de más.
 *
 * El ensamblado de la pantalla "Consulta actual" que las consume queda para una
 * iteración con verificación en dispositivo (no se puede probar el dashboard aquí).
 */

export type Tono = 'normal' | 'critico'

export interface ChipResumen {
  clave: string
  label: string
  tono: Tono
}

export interface EntradaResumen {
  edad?: number | null
  sexo?: 'M' | 'F' | string
  /** Texto libre de alergias del paciente (vacío = sin alergias registradas). */
  alergias?: string | null
  /** Embarazo confirmado (solo aplica si corresponde). */
  embarazo?: boolean
  /** TFG estimada (mL/min/1.73m²). null/undefined = no calculada. */
  tfg?: number | null
}

/** Chips del resumen fijo, ordenados por criticidad (críticos primero). */
export function resumenFijo(e: EntradaResumen): ChipResumen[] {
  const chips: ChipResumen[] = []

  const alergia = (e.alergias ?? '').trim()
  if (alergia) {
    const corto = alergia.length > 40 ? alergia.slice(0, 40) + '…' : alergia
    chips.push({ clave: 'alergia', label: `Alergias: ${corto}`, tono: 'critico' })
  }

  if (e.embarazo === true) {
    chips.push({ clave: 'embarazo', label: 'Embarazo', tono: 'critico' })
  }

  if (typeof e.tfg === 'number' && Number.isFinite(e.tfg) && e.tfg < 60) {
    // <30 es enfermedad renal avanzada → crítico; 30–59 relevante para dosis.
    chips.push({
      clave: 'tfg',
      label: `TFG ${Math.round(e.tfg)} · ajustar dosis`,
      tono: e.tfg < 30 ? 'critico' : 'normal',
    })
  }

  if (typeof e.edad === 'number' && e.edad >= 0) {
    const sx = e.sexo === 'F' ? 'F' : e.sexo === 'M' ? 'M' : ''
    chips.push({ clave: 'edad', label: `${e.edad} años${sx ? ' · ' + sx : ''}`, tono: 'normal' })
  }

  // Críticos primero, conservando el orden relativo dentro de cada grupo.
  return [...chips.filter(c => c.tono === 'critico'), ...chips.filter(c => c.tono === 'normal')]
}

/** Estado de guardado — se DIFERENCIA a propósito (§5.2). */
export type EstadoGuardado = 'local' | 'sincronizando' | 'servidor' | 'firmado' | 'error'

export interface EntradaCierre {
  /** ¿La nota tiene contenido real (alguna sección con texto o resumen)? */
  tieneContenidoNota: boolean
  diagnosticos: number
  medicamentos: number
  seguimientoProgramado: boolean
  guardado: EstadoGuardado
  /** Cambios locales que aún no llegaron al servidor. */
  hayCambiosSinSincronizar: boolean
}

export type EstadoItem = 'ok' | 'pendiente' | 'advertencia'

export interface ItemCierre {
  clave: string
  label: string
  estado: EstadoItem
}

export interface ResultadoCierre {
  items: ItemCierre[]
  advertencias: string[]
  /** Solo true ante RIESGO REAL de pérdida (no bloquear innecesariamente). */
  bloqueaCierre: boolean
}

const GUARDADO_LABEL: Record<EstadoGuardado, string> = {
  local: 'Guardado solo en este dispositivo',
  sincronizando: 'Sincronizando…',
  servidor: 'Guardado en el servidor',
  firmado: 'Firmada',
  error: 'Error de sincronización',
}

/**
 * Checklist de cierre. NUNCA afirma "guardado en servidor" si el estado es local
 * o sincronizando (§5.2). Bloquea el cierre solo ante error de guardado (riesgo
 * real de pérdida), no por datos clínicos incompletos (§4.6: advertir, no estorbar).
 */
export function checklistCierre(e: EntradaCierre): ResultadoCierre {
  const items: ItemCierre[] = []
  const advertencias: string[] = []

  items.push({
    clave: 'nota',
    label: e.tieneContenidoNota ? 'Nota con contenido' : 'Nota vacía',
    estado: e.tieneContenidoNota ? 'ok' : 'pendiente',
  })
  items.push({
    clave: 'diagnosticos',
    label: e.diagnosticos > 0 ? `${e.diagnosticos} diagnóstico(s)` : 'Sin diagnóstico documentado',
    estado: e.diagnosticos > 0 ? 'ok' : 'pendiente',
  })
  items.push({
    clave: 'receta',
    label: e.medicamentos > 0 ? `Receta con ${e.medicamentos} medicamento(s)` : 'Sin receta',
    estado: e.medicamentos > 0 ? 'ok' : 'pendiente',
  })
  items.push({
    clave: 'seguimiento',
    label: e.seguimientoProgramado ? 'Seguimiento programado' : 'Sin seguimiento',
    estado: e.seguimientoProgramado ? 'ok' : 'pendiente',
  })

  const guardadoConfirmado = e.guardado === 'servidor' || e.guardado === 'firmado'
  items.push({
    clave: 'guardado',
    label: GUARDADO_LABEL[e.guardado],
    estado: guardadoConfirmado ? 'ok' : e.guardado === 'error' ? 'advertencia' : 'advertencia',
  })

  if (e.guardado === 'local' || e.guardado === 'sincronizando') {
    advertencias.push('La nota aún no está confirmada en el servidor. No cierres sin conexión estable.')
  }
  if (e.guardado === 'error') {
    advertencias.push('Hubo un error al sincronizar: la nota podría no estar guardada en el servidor.')
  }
  if (e.hayCambiosSinSincronizar && e.guardado !== 'error') {
    advertencias.push('Tienes cambios recientes que aún no se sincronizan.')
  }

  return { items, advertencias, bloqueaCierre: e.guardado === 'error' }
}
