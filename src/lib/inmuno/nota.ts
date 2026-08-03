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
import { separarPorFuente, avisoDeRetenidas, paraSalidaClinica } from './sin-fuente'

type V = Record<string, string>

const MOTIVOS_TIT: Record<string, string> = {
  aptitud_pretx: 'Aptitud pretrasplante',
  fiebre: 'Fiebre / foco infeccioso',
  profilaxis: 'Profilaxis antiinfecciosa',
  aptitud_biologico: 'Aptitud para biológico / IS',
  vacunacion: 'Vacunación',
  otro: 'Otro',
}

/**
 * Fármacos NOMBRADOS en el texto de una recomendación.
 *
 * ── POR QUÉ ESTO YA NO ENTRA SOLO A LA RECETA ────────────────────────────────
 *
 * Esta tabla busca nombres de fármaco por expresión regular dentro de la prosa
 * de cada recomendación. Nombrar no es indicar, y la prosa dice las dos cosas:
 *
 *   · «Anti-TNF: descartar tuberculosis latente antes de iniciar» → es un
 *     TAMIZAJE, y disparaba /tuberculosis latente/ → entraba Isoniazida.
 *   · «usar atovacuona SI hay déficit de G6PD» → condicional NO cumplida, y
 *     entraba Atovacuona igual.
 *   · «si no se administra profilaxis (entecavir o tenofovir), vigilancia
 *     estrecha» → entraban los dos.
 *
 * Y de ahí pasaban a `medicamentos`, o sea a la receta, sin la marca de
 * sugerencia y por tanto SIN pasar por la compuerta de firma. Un tamizaje se
 * convertía en prescripción con un clic.
 *
 * Ahora son CANDIDATOS: se enseñan con la frase exacta que los nombró y el
 * médico marca cuáles quiere. Ninguno entra a la receta sin ese clic. La
 * decisión de indicar un fármaco es suya, y esto deja de tomarla por él.
 *
 * dosis/frecuencia/duración siguen vacías A PROPÓSITO (validación clínica).
 */
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

/** Un fármaco NOMBRADO por una recomendación, con la frase que lo nombró. */
export interface FarmacoCandidato {
  nombre: string
  via: Medicamento['via']
  indicacion: string
  /**
   * La recomendación de donde salió, literal. Se enseña junto al fármaco para
   * que se vea si la frase lo INDICA o sólo lo menciona: es justo la diferencia
   * que la búsqueda por expresión regular no puede hacer.
   */
  porQue: string
}

/** Los fármacos que nombran estas recomendaciones. Dedup por nombre. */
export function candidatosDeRecs(recs: readonly { titulo: string; detalle: string }[]): FarmacoCandidato[] {
  const out: FarmacoCandidato[] = []
  const vistos = new Set<string>()
  for (const r of recs) {
    const texto = r.titulo + ' ' + r.detalle
    for (const f of PROFILAXIS_FARMACOS) {
      if (f.re.test(texto) && !vistos.has(f.nombre)) {
        vistos.add(f.nombre)
        out.push({ nombre: f.nombre, via: f.via, indicacion: f.indicacion, porQue: r.titulo + ': ' + r.detalle })
      }
    }
  }
  return out
}

/**
 * Los candidatos de una valoración, para que la pantalla los ofrezca.
 *
 * FILTRADO IGUAL QUE LA NOTA (decisión 10 del Dr.). Un fármaco derivado de una
 * recomendación sin fuente es la salida clínica MÁS comprometida de todas —es
 * sugerir un medicamento—, así que no puede escaparse por esta puerta.
 *
 * Y tienen que ser el MISMO conjunto: si la pantalla ofreciera un fármaco que la
 * nota luego descarta, el médico lo marcaría y desaparecería sin explicación.
 */
export function farmacosCandidatos(v: V, nowMs?: number): FarmacoCandidato[] {
  return candidatosDeRecs(paraSalidaClinica(recomendaciones({ v, nowMs })))
}

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

/** Construye las secciones/estudios/medicamentos de la nota desde los chips.
 *  opts.iaTexto: redacción profesional por IA → se usa como impresión y plan. */
export function construirNotaInmuno(v: V, opts?: { nowMs?: number; iaTexto?: string; farmacosElegidos?: string[] }): NotaInmuno {
  const g = (id: string) => (v[id] || '').trim()
  const filas = compose(v)                       // [titulo, valor][]
  /**
   * DECISIÓN 10 DEL DR. (3-ago-2026): a la NOTA sólo van las recomendaciones con
   * fuente declarada. De las 42 del módulo, 39 no la tienen — y en
   * inmunocomprometidos una recomendación sin respaldo puede tocar profilaxis,
   * vacunación, antimicrobianos o la suspensión de la inmunosupresión.
   *
   * Las retenidas NO se borran: quedan en `UNSOURCED / NOT_FOR_CLINICAL_DISPLAY`
   * y se pueden exportar para asignarles fuente.
   */
  const { clinicas: recs, sinFuente: retenidas } = separarPorFuente(recomendaciones({ v, nowMs: opts?.nowMs }))
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

  // ── Plan de profilaxis: recomendaciones deterministas (SIN citas — la nota debe
  //    leerse como escrita por el médico, no como un documento con referencias) ──
  const lineas = recs.map((r) => '• ' + r.titulo + ': ' + r.detalle)
  /**
   * Se DICE lo que se retuvo. Una lista que encoge en silencio se lee como «no
   * hay más que recomendar», y eso convierte una omisión administrativa en una
   * afirmación clínica.
   */
  const aviso = avisoDeRetenidas(retenidas)
  if (aviso) lineas.push('', aviso)
  const plan = lineas.join('\n')

  // ── Medicamentos: SÓLO los que el médico marcó (ver la nota de arriba) ──
  const elegidos = new Set((opts?.farmacosElegidos ?? []).map(n => n.trim().toLowerCase()))
  const meds: Medicamento[] = candidatosDeRecs(recs)
    .filter(c => elegidos.has(c.nombre.trim().toLowerCase()))
    .map(c => ({ nombre: c.nombre, dosis: '', via: c.via, frecuencia: '', duracion: '', indicacion: c.indicacion }))

  return {
    secciones: {
      motivoHuesped: mh.join(' · '),
      historiaInfectologica: historia,
      estudiosSolicitados: estudios.join('; '),
      planProfilaxis: plan,
      impresionPlan: (opts?.iaTexto && opts.iaTexto.trim())
        ? opts.iaTexto.trim()
        : (recs.length
          ? 'Valoración infectológica completada. Ver profilaxis y estudios indicados. Reevaluar según evolución, resultados de estudios y cambios en la inmunosupresión.'
          : ''),
    },
    estudios,
    medicamentos: meds,
  }
}
