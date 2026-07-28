// ══════════════════════════════════════════════════════════════
// CDS de medicamentos en el PUNTO DE ORDEN (soporte a la decisión clínica).
// Alta especificidad, POCAS alertas accionables — para EVITAR la fatiga de
// alertas (los clínicos ignoran 49-96% de las alertas genéricas; solo el CDS
// de alta especificidad reduce errores). Reutiliza los motores ya probados.
// ══════════════════════════════════════════════════════════════
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'

export interface AlertaCDS {
  nivel: 'critica' | 'alta' | 'info'
  texto: string
}

/** Fármacos de eliminación renal o nefrotóxicos que suelen requerir ajuste por TFG. */
const RENAL_AJUSTE = [
  'vancomicina', 'gentamicina', 'amikacina', 'tobramicina', 'meropenem', 'imipenem',
  'ertapenem', 'piperacilina', 'tazobactam', 'cefepime', 'ceftazidima', 'aciclovir',
  'valaciclovir', 'valganciclovir', 'ganciclovir', 'levofloxacino', 'ciprofloxacino',
  'colistina', 'polimixina', 'fluconazol', 'trimetoprima', 'sulfametoxazol', 'daptomicina',
  'enoxaparina', 'metformina', 'gabapentina', 'pregabalina', 'litio', 'digoxina',
  'atenolol', 'alopurinol', 'rivaroxaban', 'dabigatran', 'apixaban', 'sitagliptina',
]

export interface CdsInput {
  nombre: string
  alergias?: string
  medsActivos?: string[]   // nombres de otras indicaciones de medicamento activas
  tfg?: number | null      // ml/min si se conoce
}

/** Corre alergias + interacciones + controlados + ajuste renal. Devuelve pocas alertas útiles. */
export function cdsMedicamento(opts: CdsInput): AlertaCDS[] {
  const nombre = (opts.nombre || '').trim()
  if (!nombre) return []
  const out: AlertaCDS[] = []

  // 1) Alergias (crítico) — DESCARTAR los segmentos NEGADOS (auditoría P1): un campo
  // "niega alergia a penicilina" / "sin alergias" NO debe disparar la alerta crítica
  // que bloquea. Se separa también por punto para no perder una alergia real que
  // venga después de una negada ("niega penicilina. alérgico a sulfas").
  const NEG_SEG = /^\s*(?:niega|nieg[ao]|sin\b|no\s+(?:tiene|refiere|presenta|hay)|nunca|ausente|descart)/i
  const alergias = (opts.alergias || '').split(/[,;.\n]/).map(s => s.trim()).filter(Boolean)
    .filter(s => !NEG_SEG.test(s))
    .map(a => ({ alergeno: a }))
  if (alergias.length) {
    for (const a of validarAlergiasVsMedicamentos(alergias, [{ nombre }])) {
      out.push({ nivel: 'critica', texto: a.mensaje })
    }
  }

  // 2) Interacciones fármaco-fármaco (contra los activos + el nuevo)
  const meds = [...(opts.medsActivos || []).filter(Boolean).map(n => ({ nombre: n })), { nombre }]
  if (meds.length > 1) {
    for (const i of detectarInteracciones(meds)) {
      out.push({ nivel: i.severidad === 'mayor' ? 'critica' : 'alta', texto: `${i.titulo}: ${i.detalle}` })
    }
  }

  // 3) Medicamento controlado (informativo, requisito legal)
  for (const c of detectarControlados([{ nombre }])) {
    out.push({ nivel: 'info', texto: `Controlado (fracción ${c.fraccion}): ${c.requisito}` })
  }

  // 4) Ajuste por función renal (alta especificidad: solo fármacos de la lista)
  const low = nombre.toLowerCase()
  if (RENAL_AJUSTE.some(d => low.includes(d))) {
    if (typeof opts.tfg === 'number' && opts.tfg < 60) {
      out.push({ nivel: 'alta', texto: `Ajustar dosis por función renal (TFG ${opts.tfg} ml/min).` })
    } else if (opts.tfg == null) {
      out.push({ nivel: 'info', texto: 'Fármaco de eliminación renal: verificar función renal y ajustar dosis si procede.' })
    }
  }

  // Dedup por texto
  const vistos = new Set<string>()
  return out.filter(a => (vistos.has(a.texto) ? false : (vistos.add(a.texto), true)))
}
