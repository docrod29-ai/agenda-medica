/**
 * ══════════════════════════════════════════════════════════════════════════
 * FRESCURA — cuándo una fuente está vieja, y qué significa eso (#314)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── LAS TRES FECHAS QUE TODO EL MUNDO CONFUNDE ──────────────────────────────
 *
 *   recuperadoEn   cuándo la bajamos nosotros        → siempre existe
 *   publicado      cuándo se publicó el documento     → casi siempre existe
 *   revisadoEn     cuándo la fuente se revisó         → casi NUNCA existe
 *
 * Un documento de 2016 recuperado hace un minuto es material FRESCO de
 * contenido VIEJO, y `recuperadoEn` no dice absolutamente nada sobre eso. Es la
 * confusión que hace que un sistema presuma de «evidencia actualizada» cuando
 * lo único actualizado es la hora de la descarga.
 *
 * ── POR QUÉ NO HAY UN UMBRAL CLÍNICO AQUÍ ───────────────────────────────────
 *
 * No existe una respuesta general a «¿cuántos años tiene que tener un artículo
 * para estar obsoleto?». Depende del campo: un ensayo de antibioticoterapia
 * envejece con la resistencia local, uno de anatomía no envejece casi. Fijar
 * «5 años» aquí sería INVENTAR UN CRITERIO CLÍNICO, que es exactamente lo que
 * prohíbe la regla 1 de `.claude/rules/clinical-safety.md`.
 *
 * Lo que este módulo hace es lo único que puede hacer con honestidad: CALCULAR
 * LA EDAD y comparar contra un umbral que le PASA quien llama, marcando el
 * resultado como una señal de software, no como un veredicto clínico. Los
 * umbrales por defecto son operativos y están declarados como tales.
 *
 * ── LA ASIMETRÍA DELIBERADA CON EL CONOCIMIENTO PERSONAL ────────────────────
 *
 * Una nota del médico se marca vieja ANTES que un artículo (18 meses frente a
 * 5 años). No es que valga menos: es que un artículo lleva su año impreso y
 * pasa por revisión por pares, y una nota personal no tiene ninguna de las dos
 * cosas. Una dosis apuntada en 2019 se lee hoy exactamente igual que una de
 * ayer, y ése es el riesgo que el umbral compensa.
 */

import type { FechaPublicacion, Source } from '@/types/evidence'
import type { FrescuraDeclarada, SobreDeRecuperacion } from './contrato'
import { tieneMaterial } from './contrato'
import { entradaDeCatalogo, type ProveedorDeEvidencia } from './catalogo'

/**
 * Umbrales OPERATIVOS, no clínicos. Son ajustables por parámetro y no llevan
 * ADR clínico porque no deciden nada médico: sólo deciden cuándo la interfaz
 * pone un aviso de antigüedad.
 */
export const UMBRAL_DIAS = {
  /** ~5 años. Señal de «conviene mirar si hay algo más nuevo», no de descarte. */
  literatura: 1825,
  /** ~18 meses. Más estricto por lo dicho en el encabezado. */
  conocimientoPersonal: 548,
} as const

export type VeredictoDeFrescura =
  /** Dentro del umbral. */
  | { readonly clase: 'reciente'; readonly diasDeEdad: number; readonly base: BaseDeLaEdad }
  /** Fuera del umbral. NO significa «falso»: significa «compruébalo». */
  | { readonly clase: 'antigua'; readonly diasDeEdad: number; readonly base: BaseDeLaEdad; readonly aviso: string }
  /**
   * NO SE PUEDE SABER. Es un veredicto de pleno derecho, no un fallo.
   * Regla 4 de seguridad clínica: ausencia de dato no es dato de ausencia —
   * una fuente sin fecha NO es una fuente reciente.
   */
  | { readonly clase: 'indeterminada'; readonly porQue: string }

/** Sobre qué fecha se calculó la edad. Sin esto el número no es interpretable. */
export type BaseDeLaEdad = 'revision_declarada' | 'publicacion' | 'autoria'

const DIA_MS = 86_400_000

/** Días entre dos instantes ISO. `null` si alguno no es fecha. */
export function diasEntre(desdeIso: string, hastaIso: string): number | null {
  const a = Date.parse(desdeIso), b = Date.parse(hastaIso)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.floor((b - a) / DIA_MS)
}

/**
 * Instante ISO comparable a partir de una `FechaPublicacion`.
 *
 * ── EL DETALLE QUE PARECE UN ATAJO Y NO LO ES ───────────────────────────────
 * Para precisión 'anio' se toma el 31 de diciembre, no el 1 de enero. Con el
 * 1 de enero, un artículo de 2024 parecería hasta doce meses MÁS VIEJO de lo
 * que es y podría cruzar el umbral sin merecerlo. Se elige el extremo que
 * favorece a la fuente: si aun así sale «antigua», lo es con seguridad.
 * Esto NO rellena el dato —`Source.publicado` conserva su precisión intacta—;
 * es sólo el criterio de comparación, y por eso vive aquí y no en el modelo.
 */
export function instanteComparable(f: FechaPublicacion): string | null {
  switch (f.precision) {
    case 'anio': return `${f.iso}-12-31T23:59:59.999Z`
    case 'mes': return `${f.iso}-28T23:59:59.999Z`   // día seguro en todo mes
    case 'dia': return `${f.iso}T23:59:59.999Z`
    case 'desconocida': return null
  }
}

/**
 * Frescura de una fuente citable.
 *
 * PRIORIDAD: la revisión declarada por la fuente gana a la fecha de
 * publicación. Una guía publicada en 2016 y revisada en 2025 es material
 * vigente, y juzgarla por 2016 la marcaría vieja sin razón.
 */
export function frescuraDeFuente(
  s: Source,
  ahoraIso: string,
  declarada?: FrescuraDeclarada,
  umbralDias: number = UMBRAL_DIAS.literatura,
): VeredictoDeFrescura {
  const revisado = declarada?.revisadoEn
  if (revisado && !Number.isNaN(Date.parse(revisado))) {
    return juzgar(diasEntre(revisado, ahoraIso), 'revision_declarada', umbralDias, s.titulo)
  }
  const iso = instanteComparable(s.publicado)
  if (!iso) {
    return {
      clase: 'indeterminada',
      porQue: `"${s.titulo}" no trae fecha de publicación utilizable y su proveedor no declara revisión: no se puede afirmar que sea reciente.`,
    }
  }
  return juzgar(diasEntre(iso, ahoraIso), 'publicacion', umbralDias, s.titulo)
}

/**
 * Frescura de una nota personal. Firma aparte porque la base es la fecha de
 * AUTORÍA y el umbral por defecto es el estricto.
 */
export function frescuraDeNota(
  n: { readonly titulo: string; readonly fechaDeAutoria: string },
  ahoraIso: string,
  umbralDias: number = UMBRAL_DIAS.conocimientoPersonal,
): VeredictoDeFrescura {
  return juzgar(diasEntre(n.fechaDeAutoria, ahoraIso), 'autoria', umbralDias, n.titulo, true)
}

function juzgar(
  dias: number | null,
  base: BaseDeLaEdad,
  umbral: number,
  titulo: string,
  esPersonal = false,
): VeredictoDeFrescura {
  if (dias === null) {
    return { clase: 'indeterminada', porQue: `"${titulo}" no tiene una fecha interpretable para calcular su antigüedad.` }
  }
  // Una fecha en el futuro NO se trata como "muy reciente": es un dato
  // corrupto, y darlo por bueno dejaría pasar cualquier fuente con la fecha mal.
  if (dias < 0) {
    return { clase: 'indeterminada', porQue: `"${titulo}" declara una fecha posterior a la de consulta: el dato está mal y no se puede juzgar su antigüedad.` }
  }
  if (dias <= umbral) return { clase: 'reciente', diasDeEdad: dias, base }
  const anios = (dias / 365).toFixed(1)
  return {
    clase: 'antigua', diasDeEdad: dias, base,
    aviso: esPersonal
      ? `Nota personal de hace ${anios} año(s). El criterio del médico puede haber cambiado y las dosis o esquemas pueden estar desactualizados; conviene revisarla antes de apoyarse en ella.`
      : `Fuente de hace ${anios} año(s) (según ${base === 'revision_declarada' ? 'su última revisión declarada' : 'su fecha de publicación'}). Puede existir material más reciente.`,
  }
}

/** Frescura de todo lo citable de un sobre, en el mismo orden que las fuentes. */
export function frescuraDeSobre(
  s: SobreDeRecuperacion,
  ahoraIso: string,
  umbralDias?: number,
): readonly { readonly sourceId: string; readonly veredicto: VeredictoDeFrescura }[] {
  if (!tieneMaterial(s)) return []
  return s.fuentes.map(f => ({
    sourceId: f.id,
    veredicto: frescuraDeFuente(f, ahoraIso, s.frescura, umbralDias ?? umbralPara(s.proveedor)),
  }))
}

/** Umbral por defecto según el rol del proveedor. */
export function umbralPara(p: ProveedorDeEvidencia): number {
  return entradaDeCatalogo(p).rol === 'conocimiento_personal'
    ? UMBRAL_DIAS.conocimientoPersonal
    : UMBRAL_DIAS.literatura
}

/**
 * Proporción de fuentes con veredicto `reciente`.
 *
 * OJO CON CÓMO SE LEE: las `indeterminada` cuentan en el denominador y NO en el
 * numerador. Un lote entero sin fechas da 0, no 1. Es a propósito: «no sé si es
 * reciente» nunca debe sumar a favor de la frescura.
 */
export function tasaDeFrescura(
  veredictos: readonly { readonly veredicto: VeredictoDeFrescura }[],
): number {
  if (veredictos.length === 0) return 0
  return veredictos.filter(v => v.veredicto.clase === 'reciente').length / veredictos.length
}
