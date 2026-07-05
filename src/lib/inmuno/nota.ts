// ════════════════════════════════════════════════════════════════════
// Puente PURO: valoración del inmunocomprometido (chips hc_*) → nota clínica.
// Toma el estado de los chips y produce:
//   · secciones narrativas (motivo/huésped, historia, estudios, plan, impresión)
//   · estudios[] (etiquetas legibles → pre-pobla la Orden médica)
//   · medicamentos[] SUGERIDOS de profilaxis/tratamiento (SIN dosis: el motor
//     determinista NO inventa dosis; el médico las valida)
// Sin DOM, testeable. Reutiliza compose() + recomendaciones() + catálogos.
// ════════════════════════════════════════════════════════════════════
import type { Medicamento } from '@/types/expediente'
import { TX_EST_LABELS } from './catalogos'
import { compose } from './compose'
import { recomendaciones } from './recomendaciones'

type V = Record<string, string>

const MOTIVOS_TIT: Record<string, string> = {
  aptitud_pretx: 'Aptitud pretrasplante',
  fiebre: 'Fiebre / foco infeccioso',
  profilaxis: 'Profilaxis antiinfecciosa',
  aptitud_biologico: 'Aptitud para biológico / IS',
  vacunacion: 'Vacunación',
  otro: 'Otro',
}

// Fármacos reconocibles en las recomendaciones deterministas → sugerencia de
// receta. dosis/frecuencia/duración vacías A PROPÓSITO (validación clínica).
const PROFILAXIS_FARMACOS: { re: RegExp; nombre: string; via: Medicamento['via']; indicacion: string }[] = [
  { re: /trimetoprima|sulfametoxazol|pneumocystis|\bpjp\b/i, nombre: 'Trimetoprima/sulfametoxazol', via: 'oral', indicacion: 'Profilaxis de Pneumocystis jirovecii' },
  { re: /atovacuona/i, nombre: 'Atovacuona', via: 'oral', indicacion: 'Profilaxis de Pneumocystis (alternativa por déficit de G6PD)' },
  { re: /valganciclovir/i, nombre: 'Valganciclovir', via: 'oral', indicacion: 'Profilaxis / tratamiento anticipado de CMV' },
  { re: /letermovir/i, nombre: 'Letermovir', via: 'oral', indicacion: 'Profilaxis de CMV (trasplante hematopoyético)' },
  { re: /valaciclovir|aciclovir/i, nombre: 'Valaciclovir', via: 'oral', indicacion: 'Profilaxis de HSV / VZV' },
  { re: /entecavir/i, nombre: 'Entecavir', via: 'oral', indicacion: 'Profilaxis de reactivación de hepatitis B' },
  { re: /tenofovir/i, nombre: 'Tenofovir', via: 'oral', indicacion: 'Profilaxis de reactivación de hepatitis B' },
  { re: /isoniazida|tuberculosis latente/i, nombre: 'Isoniazida', via: 'oral', indicacion: 'Tratamiento de tuberculosis latente' },
]

export interface NotaInmuno {
  secciones: {
    motivoHuesped: string
    historiaInfectologica: string
    estudiosSolicitados: string
    planProfilaxis: string
    impresionPlan: string
  }
  estudios: string[]
  medicamentos: Medicamento[]
}

/** Etiquetas legibles de los estudios seleccionados (hc_est_<k> === '1'). */
export function estudiosDe(v: V): string[] {
  return Object.keys(v)
    .filter((k) => k.startsWith('hc_est_') && v[k] === '1')
    .map((k) => TX_EST_LABELS[k] || k.slice(7))
}

/** Construye las secciones/estudios/medicamentos de la nota desde los chips. */
export function construirNotaInmuno(v: V, opts?: { nowMs?: number }): NotaInmuno {
  const g = (id: string) => (v[id] || '').trim()
  const filas = compose(v)                       // [titulo, valor][]
  const recs = recomendaciones({ v, nowMs: opts?.nowMs })
  const estudios = estudiosDe(v)

  // ── Motivo + huésped ──
  const mh: string[] = []
  const motivo = MOTIVOS_TIT[g('hc_motivo')] || ''
  const huesped = g('hc_huesped')
  const is = g('hc_is_estado')
  if (motivo) mh.push('Motivo: ' + motivo)
  if (huesped && huesped !== '—') mh.push('Huésped: ' + huesped + (g('hc_fechatx') ? ' (desde ' + g('hc_fechatx') + ')' : ''))
  if (is && is !== '—') mh.push('Inmunosupresión: ' + is)
  if (g('hc_cd4')) mh.push('CD4: ' + g('hc_cd4'))

  // ── Historia: filas de compose (los resultados/evolución van a otras vistas) ──
  const excl = new Set(['Resultados', 'Evolución'])
  const historia = filas.filter(([t]) => !excl.has(t)).map(([t, val]) => t + ': ' + val).join('\n')

  // ── Plan de profilaxis: recomendaciones deterministas ──
  const plan = recs.map((r) => '• ' + r.titulo + ': ' + r.detalle).join('\n')

  // ── Medicamentos sugeridos (dedup por nombre) ──
  const meds: Medicamento[] = []
  const vistos = new Set<string>()
  for (const r of recs) {
    const texto = r.titulo + ' ' + r.detalle
    for (const f of PROFILAXIS_FARMACOS) {
      if (f.re.test(texto) && !vistos.has(f.nombre)) {
        vistos.add(f.nombre)
        meds.push({ nombre: f.nombre, dosis: '', via: f.via, frecuencia: '', duracion: '', indicacion: f.indicacion })
      }
    }
  }

  return {
    secciones: {
      motivoHuesped: mh.join(' · '),
      historiaInfectologica: historia,
      estudiosSolicitados: estudios.join('; '),
      planProfilaxis: plan,
      impresionPlan: recs.length
        ? 'Valoración infectológica completada. Ver profilaxis y estudios indicados. Reevaluar según evolución, resultados de estudios y cambios en la inmunosupresión.'
        : '',
    },
    estudios,
    medicamentos: meds,
  }
}
