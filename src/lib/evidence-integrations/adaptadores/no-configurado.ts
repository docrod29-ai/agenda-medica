/**
 * ADAPTADOR NO CONFIGURADO — la pieza que hace imposible fingir una consulta.
 *
 * PORQUÉ EXISTE UNA FÁBRICA EN VEZ DE TRES ARCHIVOS COPIADOS. UpToDate,
 * OpenEvidence y Cochrane comparten hoy exactamente la misma verdad: no hay
 * credencial, no hay contrato y no hay endpoint que llamar. Escribir tres
 * adaptadores casi idénticos invita a que uno de ellos, algún día, "sólo para
 * probar", meta un fetch a una URL no documentada. Aquí eso NO SE PUEDE hacer:
 * este módulo no importa `fetch`, no conoce ninguna URL y su `recuperar`
 * devuelve `not_configured` sin haber salido a la red.
 *
 * ── LO QUE DEVUELVE, Y POR QUÉ IMPORTA ──────────────────────────────────────
 *
 * Devuelve un SOBRE, no `null` ni un array vacío. Un array vacío se pinta
 * igual que "no hay evidencia", y eso es precisamente la mentira que #314
 * prohíbe en su punto 9. El sobre dice, con todas las letras y con vocabulario
 * que el médico entiende, que la fuente NO SE CONSULTÓ y qué falta para poder
 * consultarla.
 *
 * ── ESTE ARCHIVO ES TAMBIÉN UNA DECLARACIÓN DE LO QUE NO HAY ────────────────
 *
 * Que UpToDate esté aquí y no en un adaptador con lógica real no es una tarea a
 * medias: es el estado correcto mientras no exista una licencia. Un adaptador
 * "casi funcionando" contra un proveedor propietario es exactamente la forma en
 * que un repo acaba con scraping dentro.
 */

import {
  sobreSinMaterial,
  type AdaptadorDeEvidencia,
  type ConsultaDeEvidencia,
  type ContextoDeRecuperacion,
  type SobreDeRecuperacion,
  type DisponibilidadDeclarada,
  type ClaseDeFallo,
  type EstadoDeRecuperacion,
} from '../contrato'
import { entradaDeCatalogo, type ProveedorDeEvidencia } from '../catalogo'

export interface OpcionesNoConfigurado {
  readonly proveedor: ProveedorDeEvidencia
  /** Qué falta, en una frase que el médico pueda leer. */
  readonly faltante: string
  readonly desbloqueaCon: NonNullable<DisponibilidadDeclarada['desbloqueaCon']>
  readonly estado?: Extract<EstadoDeRecuperacion, 'not_configured' | 'not_permitted'>
  readonly clase?: ClaseDeFallo
}

/**
 * Construye un adaptador que NUNCA sale a la red y siempre declara su ausencia.
 *
 * `recuperar` ignora la consulta a propósito: aceptar la pregunta y no usarla
 * deja claro que la firma es la del contrato y que no hay ninguna ruta oculta
 * por la que la pregunta pudiera escaparse a un tercero sin licencia.
 */
export function adaptadorNoConfigurado(o: OpcionesNoConfigurado): AdaptadorDeEvidencia {
  const cat = entradaDeCatalogo(o.proveedor)
  return {
    proveedor: o.proveedor,
    disponibilidad(): DisponibilidadDeclarada {
      return { operativo: false, faltante: o.faltante, desbloqueaCon: o.desbloqueaCon }
    },
    async recuperar(_c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion): Promise<SobreDeRecuperacion> {
      const r = sobreSinMaterial({
        proveedor: o.proveedor,
        estado: o.estado ?? 'not_configured',
        intentadoEn: ctx.ahora,
        correlacion: ctx.correlacion,
        // Latencia 0 y NO "sin medir": no se gastó ni un milisegundo porque no
        // se salió a la red. Es un dato verdadero, no un relleno.
        telemetria: { latenciaMs: 0, reintentos: 0 },
        motivo: `${cat.nombre} no se consultó: ${o.faltante}`,
        clase: o.clase ?? 'sin_contrato',
      })
      /* c8 ignore next 3 -- las entradas son literales de este archivo: la rama
         de rechazo sólo se alcanzaría si alguien rompiera el catálogo, y su
         prueba lo cubre con un proveedor inventado. */
      if (!r.ok) throw new Error(`adaptadorNoConfigurado mal declarado: ${r.motivo} — ${r.detalle}`)
      return r.valor
    },
  }
}

// ---------------------------------------------------------------------------
// Los tres proveedores propietarios de #314
// ---------------------------------------------------------------------------

/**
 * UpToDate. Integración institucional/EHR existe como programa comercial; sus
 * TÉRMINOS no se han verificado. Ver `catalogo.ts` y el bloque D1 de
 * docs/clinical-decisions/DECISIONES-ARQUITECTURA-2026-07-28.md.
 */
export const uptodate = (): AdaptadorDeEvidencia => adaptadorNoConfigurado({
  proveedor: 'uptodate',
  faltante: 'requiere acuerdo de licencia con Wolters Kluwer. No hay API de autoservicio y este repositorio NO hace scraping, no comparte credenciales ni automatiza el navegador alrededor del control de acceso.',
  desbloqueaCon: 'contrato_o_licencia',
})

/**
 * OpenEvidence. Además de no tener vía verificada, su salida es SINTETIZADA:
 * aunque hubiera contrato, el rol técnicamente correcto sería `descubrimiento`,
 * no `respaldo`. Ver la nota en `catalogo.ts`.
 */
export const openevidence = (): AdaptadorDeEvidencia => adaptadorNoConfigurado({
  proveedor: 'openevidence',
  faltante: 'no se ha verificado que exista una vía oficial de integración. Además su salida es texto generado: no puede anclar un pasaje literal, así que aunque hubiera acuerdo su rol correcto sería descubrimiento.',
  desbloqueaCon: 'contrato_o_licencia',
})

/**
 * Cochrane. El adaptador está apagado para los niveles (2) y (3) —revisión
 * completa y reuso generativo—. El nivel (1), el resumen indexado, YA llega
 * hoy por el adaptador de PubMed con su cita y bajo los términos de PubMed;
 * eso no es "integrar Cochrane" y este mensaje lo dice para que nadie lo
 * confunda con una integración que no existe.
 */
export const cochrane = (): AdaptadorDeEvidencia => adaptadorNoConfigurado({
  proveedor: 'cochrane',
  faltante: 'requiere acuerdo con Cochrane para acceso programático y, por separado, para reuso en un sistema generativo. Los resúmenes de revisiones Cochrane indexados en MEDLINE sí llegan hoy por PubMed, citados como resumen indexado — no como revisión completa.',
  desbloqueaCon: 'contrato_o_licencia',
})

/**
 * Perplexity. No está apagado por licencia sino por GASTO (su API es de pago) y
 * por rol: aunque se contratara, `contrato.ts` impide que su material entre
 * como `Source`. Se declara `not_configured`, no `not_permitted`, porque el
 * bloqueo es una decisión pendiente del dueño y no una prohibición del repo.
 */
export const perplexity = (): AdaptadorDeEvidencia => adaptadorNoConfigurado({
  proveedor: 'perplexity',
  faltante: 'su API es de pago y no se ha contratado. Aunque se contratara, su papel sería DESCUBRIR términos y artículos candidatos: una respuesta suya nunca respalda por sí sola una afirmación clínica, hay que recuperar la fuente y comprobarla.',
  desbloqueaCon: 'decision_del_dueno',
})
