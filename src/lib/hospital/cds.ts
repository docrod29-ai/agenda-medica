// ══════════════════════════════════════════════════════════════
// CDS de medicamentos en el PUNTO DE ORDEN (soporte a la decisión clínica).
// Alta especificidad, POCAS alertas accionables — para EVITAR la fatiga de
// alertas (los clínicos ignoran 49-96% de las alertas genéricas; solo el CDS
// de alta especificidad reduce errores). Reutiliza los motores ya probados.
// ══════════════════════════════════════════════════════════════
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'
import { alergiasDe } from '@/lib/seguridad/alergias'
import type { AlergiaEstructurada } from '@/types'

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
  /** Alergias ya capturadas en estructura. Si vienen, mandan sobre el texto libre. */
  alergiasEstructuradas?: AlergiaEstructurada[]
  medsActivos?: string[]   // nombres de otras indicaciones de medicamento activas
  tfg?: number | null      // ml/min si se conoce
}

/** Corre alergias + interacciones + controlados + ajuste renal. Devuelve pocas alertas útiles. */
export function cdsMedicamento(opts: CdsInput): AlertaCDS[] {
  const nombre = (opts.nombre || '').trim()
  if (!nombre) return []
  const out: AlertaCDS[] = []

  /**
   * 1) Alergias (crítico) — CON EL PARSER CANÓNICO, no con uno propio.
   *
   * ── EL QUINTO PARSER (6-ago-2026, SAFE-001) ────────────────────────────────
   *
   * Aquí vivía un `split(/[,;.\n]/)` con su propia lista de negadores. REG-171
   * unificó la consulta, la UCI y el extractor de entidades sobre `alergiasDe`;
   * este camino —el del punto de ORDEN hospitalario, donde la alerta llega antes
   * de firmar— se quedó fuera. Perdía dos cosas:
   *
   * 1. **La «y» y la barra no separaban.** «Niega penicilina y alérgica a
   *    sulfas» era UN fragmento; el negador de delante lo tumbaba entero y la
   *    alergia a sulfas **desaparecía**. Al ordenar sulfametoxazol/trimetoprima
   *    no salía ninguna alerta crítica. Es el mismo modo de fallo que el punto
   *    ya había enseñado, un conector más tarde.
   * 2. **`alergiasEstructuradas` no se miraba.** El paciente mejor documentado
   *    —alergias capturadas en estructura, texto libre vacío— corría sin
   *    compuerta.
   *
   * El canónico también parte «TMP/SMX» sólo cuando la barra lleva espacio, así
   * que los combinados que el Dr. ordena a diario siguen enteros.
   *
   * Se pasan las alergias COMPLETAS (con su reacción), no sólo el nombre: el
   * cruce betalactámico↔carbapenémico busca reacción cutánea grave en ese texto
   * para decidir si la alerta es crítica o precaución.
   */
  const alergias = alergiasDe({
    alergias: opts.alergias,
    alergiasEstructuradas: opts.alergiasEstructuradas,
  })
  if (alergias.length) {
    for (const a of validarAlergiasVsMedicamentos(alergias, [{ nombre }])) {
      /**
       * La severidad del motor se RESPETA, no se aplana a «crítica».
       *
       * El cruce ya distingue: con alergia a penicilina aislada, el carbapenémico
       * baja a `advertencia` por decisión del médico dueño (E0-15d) —la
       * reactividad cruzada es <1% y una alerta roja ahí bloquea la primera línea
       * justo en sepsis y meningitis—. Este bucle marcaba las tres severidades
       * como críticas, así que la franja salía ROJA sobre un texto que dice «NO
       * es contraindicación»: la pantalla contradecía al motor y devolvía la
       * fatiga de alerta que la decisión existía para evitar.
       */
      out.push({ nivel: a.severidad === 'critica' ? 'critica' : 'alta', texto: a.mensaje })
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
