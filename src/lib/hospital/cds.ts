// ══════════════════════════════════════════════════════════════
// CDS de medicamentos en el PUNTO DE ORDEN (soporte a la decisión clínica).
// Alta especificidad, POCAS alertas accionables — para EVITAR la fatiga de
// alertas (los clínicos ignoran 49-96% de las alertas genéricas; solo el CDS
// de alta especificidad reduce errores). Reutiliza los motores ya probados.
// ══════════════════════════════════════════════════════════════
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { alergenosDe } from '@/lib/seguridad/alergias'
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
  /** Texto libre del expediente, o la lista ya resuelta por `alergenosDe`. */
  alergias?: string | readonly unknown[]
  medsActivos?: string[]   // nombres de otras indicaciones de medicamento activas
  tfg?: number | null      // ml/min si se conoce
}

/** Corre alergias + interacciones + controlados + ajuste renal. Devuelve pocas alertas útiles. */
export function cdsMedicamento(opts: CdsInput): AlertaCDS[] {
  const nombre = (opts.nombre || '').trim()
  if (!nombre) return []
  const out: AlertaCDS[] = []

  /**
   * 1) Alergias (crítico) — con EL MISMO parser que la consulta y la receta.
   *
   * Aquí vivía la quinta copia del partidor del campo de alergias (`/[,;.\n]/`
   * con su propia lista de negadores). REG-144 unificó tres; ésta se quedó fuera
   * porque el guardián sólo miraba `consulta` y `uci`. Traía enteros los dos
   * modos de fallo del canónico: no partía por «/» ni por « y » —así que
   * «Penicilina / Sulfas» viajaba como un término— y **su negador tampoco
   * alcanzaba al segundo fragmento** («niega penicilina, sulfas» dejaba «sulfas»
   * como alergia y disparaba la crítica en el punto de orden). Los negadores que
   * este archivo tenía de más —«nunca», «ausente»— se subieron al canónico para
   * no perderlos.
   */
  const alergias = alergenosDe({ alergias: opts.alergias }).map(alergeno => ({ alergeno }))
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
