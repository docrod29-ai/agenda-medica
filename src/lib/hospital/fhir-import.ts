// ══════════════════════════════════════════════════════════════
// Import de resultados de laboratorio desde HL7 FHIR R4.
// Recibe un Bundle (o un arreglo de Observations) y extrae los resultados.
// Un LIS que hable FHIR (o HL7 v2 → FHIR vía un conversor) puede empujar aquí.
// ══════════════════════════════════════════════════════════════
import type { ResultadoLab } from '@/types/hospital'
import { esCriticoLab } from './lab-criticos'

interface FhirObs {
  resourceType?: string
  /**
   * A QUIÉN pertenece la observación. Este campo NO se leía.
   *
   * El guardado tomaba el paciente del episodio abierto en la pantalla, así que
   * pegar el Bundle del paciente A estando en la ficha del paciente B archivaba
   * los resultados de A bajo B — con mensaje verde de éxito y sin un solo aviso.
   * Es el peor error posible en este módulo: decisiones de transfusión, insulina
   * o diálisis tomadas sobre el paciente equivocado, a partir de una pestaña mal
   * escogida.
   */
  subject?: { reference?: string; display?: string; identifier?: { value?: string } }
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

/** Cómo viene identificado el paciente dentro del Bundle. */
export interface SujetoFhir {
  /** Referencia cruda, p. ej. "Patient/abc123". */
  referencia?: string
  /** Nombre legible que trae el propio Bundle, si lo trae. */
  nombre?: string
}

/** Nombre de un recurso Patient de FHIR (HumanName), en texto. */
function nombreDePatient(p: { name?: { text?: string; given?: string[]; family?: string }[] }): string | undefined {
  const n = p.name?.[0]
  if (!n) return undefined
  if (n.text) return n.text
  const partes = [...(n.given ?? []), n.family].filter(Boolean)
  return partes.length ? partes.join(' ') : undefined
}

/**
 * Todos los pacientes distintos que menciona el Bundle.
 *
 * Devuelve lista vacía cuando el Bundle no identifica a nadie — que NO es lo
 * mismo que "coincide". Quien llama debe tratar los dos casos por separado: uno
 * es "va a otro paciente" y el otro es "no se puede verificar".
 */
export function sujetosDelBundle(json: string): SujetoFhir[] {
  let data: unknown
  try { data = JSON.parse(json) } catch { return [] }
  const d = data as { resourceType?: string; entry?: { resource?: (FhirObs & { id?: string; name?: { text?: string; given?: string[]; family?: string }[] }) }[] } | FhirObs[]

  const porRef = new Map<string, SujetoFhir>()
  const anota = (referencia?: string, nombre?: string) => {
    const clave = (referencia ?? nombre ?? '').trim()
    if (!clave) return
    const prev = porRef.get(clave) ?? {}
    porRef.set(clave, { referencia: referencia ?? prev.referencia, nombre: nombre ?? prev.nombre })
  }

  const recursos = Array.isArray(d) ? d : (d?.resourceType === 'Bundle' ? (d.entry ?? []).map(e => e.resource).filter(Boolean) : [d as FhirObs])
  // Nombre declarado por los recursos Patient que venga incluidos en el Bundle.
  const nombrePorId = new Map<string, string>()
  for (const r of recursos) {
    const rr = r as (FhirObs & { id?: string; name?: { text?: string; given?: string[]; family?: string }[] })
    if (rr?.resourceType === 'Patient' && rr.id) {
      const n = nombreDePatient(rr)
      if (n) nombrePorId.set(`Patient/${rr.id}`, n)
    }
  }
  for (const r of recursos) {
    const sub = (r as FhirObs)?.subject
    if (!sub) continue
    const ref = sub.reference ?? (sub.identifier?.value ? `identifier:${sub.identifier.value}` : undefined)
    anota(ref, sub.display ?? (ref ? nombrePorId.get(ref) : undefined))
  }
  return [...porRef.values()]
}

/**
 * ¿Los resultados de este Bundle son de este paciente?
 *
 * `sin-identificar` NO es aprobación: significa que el Bundle no dice de quién
 * son y hace falta que una persona lo confirme viendo a quién se van a archivar.
 */
export function verificaSujeto(
  sujetos: SujetoFhir[],
  paciente: { id: string; nombre: string },
): { veredicto: 'coincide' | 'no-coincide' | 'sin-identificar'; detalle?: string } {
  if (sujetos.length === 0) return { veredicto: 'sin-identificar' }
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
  const idPaciente = norm(paciente.id)
  const nombrePaciente = norm(paciente.nombre)
  const casa = (s: SujetoFhir) => {
    const ref = norm((s.referencia ?? '').replace(/^Patient\//i, '').replace(/^identifier:/i, ''))
    if (ref && ref === idPaciente) return true
    return !!s.nombre && norm(s.nombre) === nombrePaciente
  }
  if (sujetos.length === 1 && casa(sujetos[0])) return { veredicto: 'coincide' }
  /**
   * Un Bundle con VARIOS pacientes tampoco se acepta aunque uno de ellos sea el
   * de la pantalla: no hay forma de saber qué resultado es de quién sin partirlo.
   */
  const quien = sujetos.map(s => s.nombre ?? s.referencia ?? '?').join(', ')
  return { veredicto: 'no-coincide', detalle: quien }
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
  /**
   * La unidad SÍ llega del LIS (`valueQuantity.unit`) y sí se guardaba, pero no
   * se le pasaba al motor: los umbrales se comparaban a ciegas contra un valor
   * que podía venir en mmol/L o µmol/L. Ver `evaluarCriticoLab`.
   */
  const critOf = (o: FhirObs, est: string, val: string, unidad?: string) => esCriticoFlag(o) || esCriticoLab(est, val, unidad)
  const out: ResultadoLab[] = []
  for (const o of obs) {
    if (o.valueQuantity) { const est = nombre(o), val = String(o.valueQuantity.value ?? ''); out.push({ estudio: est, valor: val, unidad: o.valueQuantity.unit, referencia: rango(o), critico: critOf(o, est, val, o.valueQuantity.unit) }) }
    else if (o.valueString) out.push({ estudio: nombre(o), valor: o.valueString, referencia: rango(o), critico: esCriticoFlag(o) })
    for (const c of o.component ?? []) {
      if (c.valueQuantity) { const est = nombre(c, nombre(o)), val = String(c.valueQuantity.value ?? ''); out.push({ estudio: est, valor: val, unidad: c.valueQuantity.unit, referencia: rango(c), critico: critOf(c, est, val, c.valueQuantity.unit) }) }
    }
  }
  return out
}
