// ══════════════════════════════════════════════════════════════
// CDS de medicamentos en el PUNTO DE ORDEN (soporte a la decisión clínica).
// Alta especificidad, POCAS alertas accionables — para EVITAR la fatiga de
// alertas (los clínicos ignoran 49-96% de las alertas genéricas; solo el CDS
// de alta especificidad reduce errores). Reutiliza los motores ya probados.
// ══════════════════════════════════════════════════════════════
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'
import { alergiasDe } from '@/lib/seguridad/alergias'

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

  /**
   * ── LA QUINTA COPIA DEL PARTIDOR DE ALERGIAS — REG-277 ────────────────────
   *
   * Aquí vivía un partidor propio, con su propia idea de qué es una negación.
   * Medida la divergencia el 9-ago-2026 sobre los mismos textos, **9 de 11
   * discrepaban** con lo que ve la consulta:
   *
   *     «NKDA»                 → hospital: alérgeno «NKDA»   · consulta: ninguno
   *     «(-)», «Ninguna»       → hospital: alérgeno          · consulta: ninguno
   *     «Negadas», «n/a»       → hospital: alérgeno          · consulta: ninguno
   *     «Paracetamol 2.5 mg»   → hospital: «Paracetamol 2» + «5 mg»
   *     «Alérgico a penicilina»→ hospital: «Alérgico a penicilina»
   *
   * El punto sin espacio detrás partía las dosis; `NKDA`, `(-)`, `n/a` y
   * `ninguna` —lo que se dicta en planta todos los días— pasaban por alérgenos.
   * Ninguno casa con un fármaco del catálogo, así que **no disparan la alerta**
   * y en cambio se imprimen: un recuadro rojo que dice «NKDA».
   *
   * Peor que cada caso: el hospital y la consulta **decidían distinto sobre el
   * mismo campo del mismo paciente**. Una sola fuente, `seguridad/alergias.ts`,
   * que es donde viven la negación por oración, el alcance de la enumeración
   * (REG-276) y la barra que no parte TMP/SMX.
   */
  const alergias = alergiasDe({ alergias: opts.alergias })
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
