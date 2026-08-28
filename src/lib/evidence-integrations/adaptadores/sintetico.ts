/**
 * ADAPTADOR SINTÉTICO — el que hace posible probar y medir #314 sin red.
 *
 * PORQUÉ EXISTE. El benchmark de #314 tiene que medir latencia, corrección de
 * cita, tasa de afirmación sin respaldo y comportamiento ante caída. Medir eso
 * contra PubMed real haría el resultado irreproducible (la red cambia), lento
 * (throttle de 3 req/s) y dependiente de una clave. Peor: una prueba que
 * depende de la red se marca `skip` el primer día que falla y deja de proteger.
 *
 * Este adaptador da un corpus DETERMINISTA y, sobre todo, permite INYECTAR EL
 * FALLO: caída, rechazo, límite de tasa y recorte se piden a voluntad. Un
 * guardián que no se puede poner en rojo a propósito no es un guardián
 * (.claude/rules/testing-gates.md: «todo guardián nuevo se prueba al revés»).
 *
 * ── EL CORPUS ES SINTÉTICO, NO ANONIMIZADO ──────────────────────────────────
 *
 * Cero pacientes reales, cero resúmenes copiados de artículos reales
 * (.claude/rules/data-privacy.md). Los textos de abajo están inventados para
 * este arnés. Sus cifras NO son cifras clínicas y no deben citarse: existen
 * para que un pasaje literal se pueda comprobar, no para informar una decisión.
 */

import { fuente, fechaPublicacionDesde, type Source } from '@/types/evidence'
import {
  sobreConMaterial, sobreSinMaterial,
  type AdaptadorDeEvidencia, type ConsultaDeEvidencia, type ContextoDeRecuperacion,
  type SobreDeRecuperacion, type DisponibilidadDeclarada, type ClaseDeFallo,
  type EstadoDeRecuperacion,
} from '../contrato'

/**
 * Documento del corpus. `anio` es texto porque `fechaPublicacionDesde` conserva
 * la precisión que de verdad había, y aquí sólo hay año.
 */
export interface DocumentoSintetico {
  readonly id: string
  readonly titulo: string
  readonly revista: string
  readonly anio: string
  readonly texto: string
  /** Palabras que hacen que este documento responda a una consulta. */
  readonly etiquetas: readonly string[]
}

/**
 * CORPUS SINTÉTICO. Los textos son inventados. Las cifras son inventadas.
 * NO SON DATOS CLÍNICOS y ninguna decisión médica puede apoyarse en ellos.
 *
 * Están redactados con estructura de resumen real (objetivo, método, resultado)
 * para que el modelo de pasajes se ejercite de verdad: un pasaje tiene que
 * poder ser subcadena literal de ≥40 caracteres, y con textos de juguete de
 * cinco palabras esa comprobación no probaría nada.
 */
export const CORPUS_SINTETICO: readonly DocumentoSintetico[] = [
  {
    id: 'SYN-0001',
    titulo: 'Duración corta frente a prolongada de antimicrobiano en el ensayo sintético ALFA',
    revista: 'Revista Sintética de Medicina Interna',
    anio: '2024',
    texto: 'Objetivo: comparar dos duraciones de tratamiento en una cohorte simulada. Método: asignación aleatoria de participantes sintéticos a siete o a catorce días de tratamiento. Resultado: la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales, con un intervalo que cruza el nulo. Conclusión de los autores sintéticos: no se demostró superioridad de la pauta prolongada en esta cohorte simulada.',
    etiquetas: ['duracion', 'antimicrobiano', 'tratamiento', 'ensayo'],
  },
  {
    id: 'SYN-0002',
    titulo: 'Revisión sintética sobre marcadores de seguimiento en cohortes simuladas',
    revista: 'Anales Sintéticos de Infectología',
    anio: '2023',
    texto: 'Objetivo: resumir la evidencia simulada disponible sobre marcadores de seguimiento. Método: búsqueda estructurada en un corpus sintético con criterios preespecificados. Resultado: se identificaron doce estudios simulados con heterogeneidad alta entre ellos. Conclusión: la certeza del conjunto se calificó como baja por los autores sintéticos y no se emite recomendación.',
    etiquetas: ['marcadores', 'seguimiento', 'revision'],
  },
  {
    id: 'SYN-0003',
    titulo: 'Estudio sintético de cohorte sobre adherencia y desenlaces simulados',
    revista: 'Boletín Sintético de Salud Pública',
    anio: '2019',
    texto: 'Objetivo: describir la relación entre adherencia declarada y desenlace en una cohorte enteramente simulada. Método: seguimiento sintético durante veinticuatro meses con medición trimestral. Resultado: la adherencia declarada se asoció con el desenlace en el modelo ajustado, sin que pueda inferirse causalidad de un diseño observacional simulado.',
    etiquetas: ['adherencia', 'cohorte', 'seguimiento'],
  },
  {
    id: 'SYN-0004',
    // Documento SIN texto: existe para ejercitar el camino de descarte, que es
    // el que produce `partial`. Sin un caso así, ese camino nunca se prueba.
    titulo: 'Resumen sintético no disponible',
    revista: 'Actas Sintéticas',
    anio: '2022',
    texto: '',
    etiquetas: ['duracion', 'sin-resumen'],
  },
]

/** Guion de fallo que el test le pide al adaptador. */
export interface GuionDeFallo {
  readonly estado: Exclude<EstadoDeRecuperacion, 'available' | 'partial'>
  readonly motivo: string
  readonly clase: ClaseDeFallo
  /** Latencia simulada. Un timeout que se reporta con 0 ms sería mentira. */
  readonly latenciaMs?: number
}

export interface OpcionesSintetico {
  readonly corpus?: readonly DocumentoSintetico[]
  /** Si está, el adaptador SIEMPRE falla así. Es el «probarlo al revés». */
  readonly fallo?: GuionDeFallo
  /** Latencia simulada del camino feliz, para que el benchmark tenga qué medir. */
  readonly latenciaMs?: number
  /** Reloj inyectable. Sin esto el sobre no sería determinista. */
  readonly ahoraMs?: () => number
}

/** Coincidencia por etiqueta o por palabra del título. Deliberadamente tonta. */
function coincide(d: DocumentoSintetico, c: ConsultaDeEvidencia): boolean {
  const agujas = [c.pregunta, ...(c.terminos ?? [])].join(' ').toLowerCase()
  if (!agujas.trim()) return false
  return d.etiquetas.some(e => agujas.includes(e))
    || d.titulo.toLowerCase().split(/\W+/).some(p => p.length > 4 && agujas.includes(p))
}

export function adaptadorSintetico(o: OpcionesSintetico = {}): AdaptadorDeEvidencia {
  const corpus = o.corpus ?? CORPUS_SINTETICO
  const latencia = o.latenciaMs ?? 12

  return {
    proveedor: 'sintetico',
    disponibilidad(): DisponibilidadDeclarada {
      return o.fallo
        ? { operativo: false, faltante: `fallo simulado: ${o.fallo.motivo}`, desbloqueaCon: 'bandera' }
        : { operativo: true }
    },
    async recuperar(c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion): Promise<SobreDeRecuperacion> {
      if (o.fallo) {
        return exigir(sobreSinMaterial({
          proveedor: 'sintetico', estado: o.fallo.estado, intentadoEn: ctx.ahora,
          correlacion: ctx.correlacion,
          telemetria: { latenciaMs: o.fallo.latenciaMs ?? latencia },
          motivo: o.fallo.motivo, clase: o.fallo.clase,
        }))
      }
      const elegidos = corpus.filter(d => coincide(d, c)).slice(0, c.maximo)
      const fuentes: Source[] = []
      let descartados = 0
      for (const d of elegidos) {
        const r = fuente({
          proveedor: 'pubmed',           // el canónico que declara el catálogo
          idExterno: d.id, titulo: d.titulo, contenedor: d.revista,
          publicado: fechaPublicacionDesde(d.anio),
          recuperadoEn: ctx.ahora, textoRecuperado: d.texto,
          url: `https://example.invalid/sintetico/${d.id}`,
        })
        if (r.ok) fuentes.push(r.valor); else descartados++
      }
      return exigir(sobreConMaterial({
        proveedor: 'sintetico',
        estado: descartados > 0 ? 'partial' : 'available',
        intentadoEn: ctx.ahora, correlacion: ctx.correlacion,
        telemetria: { latenciaMs: latencia, totalDeclarado: elegidos.length },
        fuentes,
        frescura: { version: 'corpus-sintetico-1', revisadoEn: '2026-08-22' },
        ...(descartados > 0
          ? { recorte: `${descartados} documento(s) sin texto recuperado: no son citables.` }
          : {}),
      }))
    },
  }
}

function exigir<T>(r: { ok: true; valor: T } | { ok: false; motivo: string; detalle: string }): T {
  if (!r.ok) throw new Error(`adaptadorSintetico construyó un sobre inválido: ${r.motivo} — ${r.detalle}`)
  return r.valor
}
