// ══════════════════════════════════════════════════════════════
// Import de resultados de laboratorio desde HL7 FHIR R4.
// Recibe un Bundle (o un arreglo de Observations) y extrae los resultados.
// Un LIS que hable FHIR (o HL7 v2 → FHIR vía un conversor) puede empujar aquí.
// ══════════════════════════════════════════════════════════════
import type { ResultadoLab } from '@/types/hospital'
import { esCriticoLab } from './lab-criticos'

interface FhirObs {
  resourceType?: string
  code?: { text?: string; coding?: { display?: string }[] }
  valueQuantity?: { value?: number; unit?: string }
  valueString?: string
  referenceRange?: { low?: { value?: number }; high?: { value?: number }; text?: string }[]
  interpretation?: { coding?: { code?: string }[]; text?: string }[]
  component?: FhirObs[]
}

function nombre(o: FhirObs, fallback = 'Observación'): string {
  return o.code?.text || o.code?.coding?.[0]?.display || fallback
}
function esCriticoFlag(o: FhirObs): boolean {
  // Marca de interpretación crítica del LIS: HH/LL/AA (crítico alto/bajo/anormal),
  // o texto tipo "critical"/"panic". H/L simples NO son crítico (solo alto/bajo).
  const codes = (o.interpretation ?? []).flatMap(i => (i.coding ?? []).map(c => c.code ?? '').concat(i.text ?? ''))
  return codes.some(c => /^(HH|LL|AA)$/i.test(c.trim()) || /crit|panic|pánico/i.test(c))
}
function rango(o: FhirObs): string | undefined {
  const rr = o.referenceRange?.[0]
  if (!rr) return undefined
  if (rr.text) return rr.text
  if (rr.low?.value != null && rr.high?.value != null) return `${rr.low.value}–${rr.high.value}`
  return undefined
}

/** Extrae ResultadoLab[] de un Bundle FHIR o de un JSON de Observations. */
export function parsearLabsFhir(json: string): ResultadoLab[] {
  let data: unknown
  try { data = JSON.parse(json) } catch { return [] }
  const obs: FhirObs[] = []
  const d = data as { resourceType?: string; entry?: { resource?: FhirObs }[] } | FhirObs[]
  if (Array.isArray(d)) obs.push(...d)
  else if (d?.resourceType === 'Bundle') for (const e of d.entry ?? []) { if (e.resource?.resourceType === 'Observation') obs.push(e.resource) }
  else if ((d as FhirObs)?.resourceType === 'Observation') obs.push(d as FhirObs)

  // crítico = flag del LIS (HH/LL/AA/panic) O rango numérico crítico (respaldo determinista)
  const critOf = (o: FhirObs, est: string, val: string) => esCriticoFlag(o) || esCriticoLab(est, val)
  const out: ResultadoLab[] = []
  for (const o of obs) {
    if (o.valueQuantity) { const est = nombre(o), val = String(o.valueQuantity.value ?? ''); out.push({ estudio: est, valor: val, unidad: o.valueQuantity.unit, referencia: rango(o), critico: critOf(o, est, val) }) }
    else if (o.valueString) out.push({ estudio: nombre(o), valor: o.valueString, referencia: rango(o), critico: esCriticoFlag(o) })
    for (const c of o.component ?? []) {
      if (c.valueQuantity) { const est = nombre(c, nombre(o)), val = String(c.valueQuantity.value ?? ''); out.push({ estudio: est, valor: val, unidad: c.valueQuantity.unit, referencia: rango(c), critico: critOf(c, est, val) }) }
    }
  }
  return out
}
