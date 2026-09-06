/**
 * LA MISMA SUSTANCIA, DOS VECES — REG-524.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * «Paracetamol 500 mg cada 8 horas» y, tres renglones más abajo, «Tempra 1 g
 * cada 8 horas». Cada renglón, por separado, pasa `revisarDosis`: 1 500 mg/día
 * y 3 000 mg/día, los dos debajo del techo de 4 000. Sumados son 4 500. El
 * propio catálogo lo advierte en la nota del paracetamol —«vigilar dosis
 * acumulada»— y nada acumulaba: cada renglón se revisaba solo.
 *
 * Y la variante con el expediente: el paciente ya toma Tempra según su última
 * nota firmada, y hoy se le receta paracetamol. Ni la receta ni la consulta lo
 * decían.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Agrupa los renglones por SUSTANCIA usando el catálogo que ya existe
 * (`buscarFarmaco`: nombre y alias, «Tempra» y «Tylenol» son paracetamol). Si
 * el fármaco no está en el catálogo, agrupa por nombre normalizado: dos
 * renglones que dicen lo mismo son duplicado en cualquier catálogo.
 *
 *   1. Dos o más renglones de hoy con la misma sustancia → aviso `terapia_duplicada`.
 *   2. Si TODOS los renglones del grupo traen mg absolutos y tomas al día, se
 *      suma el total diario y se compara con el techo **que ya está en el
 *      catálogo** (`maxDiaMg`, `hardMaxDiaMg`, o el oral cuando todos son
 *      orales). Los mismos tres niveles que `revisarDosis`. No se inventa
 *      ninguna cifra: si el catálogo no tiene techo diario, no hay suma.
 *   3. Un renglón de hoy con la misma sustancia que algo VIGENTE del
 *      expediente → aviso `terapia_duplicada` que lo dice. Sin suma: lo que
 *      el expediente dice que toma puede ser justo lo que hoy se está cambiando.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * - No conoce clases terapéuticas: ibuprofeno + naproxeno (dos AINE) no es
 *   «la misma sustancia» aquí. Eso es vocabulario que no existe en el catálogo,
 *   y se declara: `NOT_IMPLEMENTED`, no se aproxima.
 * - No suma dosis por kilo ni renglones sin frecuencia legible: el aviso de
 *   duplicado sale igual, sin la cifra.
 * - No bloquea. Es un aviso de nivel «revisa», como el resto de la revisión de
 *   dosis (decisión del dueño del 5-ago; D-032 lo confirma para las alertas).
 *
 * Módulo PURO.
 */
import {
  buscarFarmaco, extraerMg, extraerTomasDia, esDosisPorKg, peorSeveridad,
  type AlertaDosis, type FarmacoRef,
} from './dosis'

export interface RenglonDuplicable {
  nombre?: string
  dosis?: string
  frecuencia?: string
  via?: string
}

export interface TerapiaDuplicada {
  /** Nombre canónico de la sustancia (el del catálogo, o el escrito). */
  med: string
  alertas: AlertaDosis[]
  severidad: ReturnType<typeof peorSeveridad>
}

const normaliza = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Con qué identidad se agrupa un renglón: la del catálogo si la hay. */
function identidad(nombre: string): { clave: string; canonico: string; ref: FarmacoRef | null } {
  const ref = buscarFarmaco(nombre)
  if (ref) return { clave: `cat:${normaliza(ref.nombre)}`, canonico: ref.nombre, ref }
  return { clave: `txt:${normaliza(nombre)}`, canonico: nombre.trim(), ref: null }
}

const comoSeEscribio = (r: RenglonDuplicable) =>
  `«${[r.nombre?.trim(), r.dosis?.trim(), r.frecuencia?.trim()].filter(Boolean).join(' ')}»`

const esOral = (via: unknown) => /oral|\bvo\b|\bpo\b|via oral|boca/.test(normaliza(via))

/** mg por día de un renglón, o `null` si no se puede saber sin adivinar. */
function mgPorDia(r: RenglonDuplicable): number | null {
  const dosis = r.dosis?.trim()
  if (!dosis || esDosisPorKg(dosis)) return null
  const mg = extraerMg(dosis)
  const tomas = extraerTomasDia(r.frecuencia ?? '')
  if (mg == null || tomas == null || tomas <= 0) return null
  return mg * tomas
}

/**
 * Los renglones de hoy que repiten sustancia entre sí, y los que repiten algo
 * que el paciente ya toma según el expediente.
 */
export function terapiaDuplicadaDeLaLista(
  hoy: readonly RenglonDuplicable[],
  yaToma: readonly RenglonDuplicable[] = [],
): TerapiaDuplicada[] {
  const grupos = new Map<string, { canonico: string; ref: FarmacoRef | null; renglones: RenglonDuplicable[] }>()
  for (const r of hoy) {
    const nombre = r.nombre?.trim()
    if (!nombre) continue
    const { clave, canonico, ref } = identidad(nombre)
    const g = grupos.get(clave) ?? { canonico, ref, renglones: [] }
    g.renglones.push(r)
    grupos.set(clave, g)
  }

  const previos = new Map<string, RenglonDuplicable[]>()
  for (const r of yaToma) {
    const nombre = r.nombre?.trim()
    if (!nombre) continue
    const { clave } = identidad(nombre)
    previos.set(clave, [...(previos.get(clave) ?? []), r])
  }

  const out: TerapiaDuplicada[] = []
  for (const [clave, g] of grupos) {
    const alertas: AlertaDosis[] = []

    if (g.renglones.length >= 2) {
      alertas.push({
        severidad: 'alta', codigo: 'terapia_duplicada',
        mensaje: `${g.canonico} aparece ${g.renglones.length} veces en la receta de hoy: ` +
          `${g.renglones.map(comoSeEscribio).join(' y ')} — es la misma sustancia. Revisa la dosis acumulada.`,
      })
      const porDia = g.renglones.map(mgPorDia)
      if (g.ref && porDia.every((x): x is number => x != null)) {
        const total = porDia.reduce((a, b) => a + b, 0)
        const todosOrales = g.renglones.every(r => esOral(r.via))
        const usaTopeOral = todosOrales && g.ref.maxDiaOralMg != null
        const maxDia = usaTopeOral ? g.ref.maxDiaOralMg : g.ref.maxDiaMg
        if (maxDia && total > maxDia) {
          const hard = !usaTopeOral ? g.ref.hardMaxDiaMg : undefined
          const suma = porDia.map(x => `${x} mg`).join(' + ')
          if (hard != null && total <= hard) {
            alertas.push({
              severidad: 'alta', codigo: 'dosis_alta_verificar',
              mensaje: `${g.canonico}: ${suma} = ${total} mg/día sumando los renglones supera el máximo diario HABITUAL (${maxDia} mg) pero está dentro del perfil de dosis alta (máx ${hard} mg). Verifica la indicación.`,
            })
          } else {
            const techo = hard ?? maxDia
            alertas.push({
              severidad: hard != null ? 'critica' : 'alta', codigo: 'sobre_maximo_diario',
              mensaje: `${g.canonico}: ${suma} = ${total} mg/día sumando los renglones supera el máximo diario${usaTopeOral ? ' POR VÍA ORAL' : hard != null ? ' ABSOLUTO' : ' de referencia'} (${techo} mg).`,
            })
          }
        }
      }
    }

    const ya = previos.get(clave)
    if (ya?.length) {
      alertas.push({
        severidad: 'alta', codigo: 'terapia_duplicada',
        mensaje: `${g.canonico} ya figura como vigente en el expediente (${ya.map(comoSeEscribio).join(', ')}) y hoy se receta ${g.renglones.map(comoSeEscribio).join(' y ')}. Si lo sustituye, que quede dicho; si se suma, revisa la dosis acumulada.`,
      })
    }

    if (alertas.length) out.push({ med: g.canonico, alertas, severidad: peorSeveridad(alertas) })
  }
  return out
}

export const QUE_NO_CUBRE =
  'Sólo «la misma sustancia»: el catálogo de dosis.ts sabe que Tempra es paracetamol, ' +
  'pero no sabe que ibuprofeno y naproxeno son dos AINE. Clases terapéuticas: NOT_IMPLEMENTED.'
