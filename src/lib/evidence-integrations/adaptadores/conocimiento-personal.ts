/**
 * ADAPTADOR DE CONOCIMIENTO PERSONAL — Obsidian y equivalentes (punto 8 de #314).
 *
 * ── QUÉ ES Y POR QUÉ VALE LA PENA ───────────────────────────────────────────
 *
 * Es donde vive lo que el médico sabe y no está en PubMed: sus esquemas
 * preferidos, la resistencia bacteriana de SU hospital, la nota de la sesión
 * clínica del año pasado. A menudo es lo más útil que tiene delante.
 *
 * ── Y POR QUÉ ES EL ADAPTADOR MÁS PELIGROSO DE TODOS ────────────────────────
 *
 * Por dos razones que se suman:
 *
 *  1. UNA NOTA VIEJA NO SE VE VIEJA. Un resumen de PubMed lleva su año encima.
 *     Una nota de Obsidian con una dosis que cambió en 2023 es, en texto plano,
 *     indistinguible de una escrita ayer. Por eso `fechaDeAutoria` es
 *     OBLIGATORIA aquí —una nota sin fecha se RECHAZA, no se importa con la
 *     fecha de importación— y `frescura.ts` la juzga con un umbral más estricto
 *     que el de la literatura.
 *
 *  2. ES EL ÚNICO PROVEEDOR QUE PUEDE CONTENER PHI. Una bóveda personal está
 *     llena de casos reales. Hay que asumir que SÍ los contiene
 *     (.claude/rules/data-privacy.md), nunca que no. De ahí que este adaptador
 *     no salga a la red jamás: recibe las notas ya en memoria, de quien las
 *     importó dentro del inquilino, y no las manda a ningún sitio.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ──────────────────────────────────────────────
 *
 *   ╔══════════════════════════════════════════════════════════════════════╗
 *   ║  UNA NOTA PERSONAL NUNCA ASCIENDE A EVIDENCIA DE NIVEL GUÍA.          ║
 *   ║  NI POR ANTIGÜEDAD, NI POR REPETICIÓN, NI POR SER DEL PROPIO MÉDICO. ║
 *   ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Se hace cumplir por CONTRATO, no por prompt: el rol de este proveedor en el
 * catálogo es `conocimiento_personal`, y `sobreConMaterial()` RECHAZA con
 * `ROL_NO_PUEDE_APORTAR_FUENTES` cualquier intento de meter un `Source` por
 * aquí. Su material viaja en `NotaPersonal`, un tipo aparte que la interfaz
 * pinta aparte.
 *
 * Que el médico lo escribiera no lo hace comprobable: es su criterio, y el
 * criterio se muestra atribuido y fechado, no citado como si fuera una fuente.
 */

import {
  sobreConMaterial,
  sobreSinMaterial as sobreSinMaterialRef,
  type AdaptadorDeEvidencia, type ConsultaDeEvidencia, type ContextoDeRecuperacion,
  type SobreDeRecuperacion, type DisponibilidadDeclarada,
} from '../contrato'

/**
 * Una nota del médico con su procedencia. Los tres campos de procedencia que
 * exige #314 —autor, fuente, fecha— son OBLIGATORIOS: sin ellos la nota no se
 * puede mostrar de forma responsable y por tanto no se importa.
 */
export interface NotaPersonal {
  readonly id: string
  readonly titulo: string
  readonly texto: string
  /** Quién la escribió. No es "el consultorio": es una persona. */
  readonly autor: string
  /** De dónde salió: ruta del archivo, nombre de la bóveda, sesión clínica… */
  readonly origen: string
  /** ISO. Cuándo se escribió — NO cuándo se importó. */
  readonly fechaDeAutoria: string
  /** Consultorio dueño. El aislamiento se aplica aquí, no en la pantalla. */
  readonly clinicId: string
}

export type MotivoRechazoNota =
  | 'SIN_TEXTO' | 'SIN_AUTOR' | 'SIN_ORIGEN' | 'FECHA_DE_AUTORIA_INVALIDA' | 'SIN_CLINICA'

/**
 * Valida una nota antes de dejarla entrar. Devuelve motivo; no lanza.
 *
 * La fecha se exige de verdad: rellenar `fechaDeAutoria` con "hoy" al importar
 * convertiría una nota de 2019 en una nota de hoy, que es exactamente el fallo
 * que este adaptador existe para evitar.
 */
export function validarNota(n: unknown): { ok: true; valor: NotaPersonal } | { ok: false; motivo: MotivoRechazoNota; detalle: string } {
  const o = (typeof n === 'object' && n !== null ? n : {}) as Record<string, unknown>
  const cad = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
  if (!cad('texto')) return { ok: false, motivo: 'SIN_TEXTO', detalle: 'una nota sin texto no aporta contexto' }
  if (!cad('autor')) return { ok: false, motivo: 'SIN_AUTOR', detalle: 'la procedencia de autor es obligatoria (#314 punto 8): sin autor no se puede atribuir' }
  if (!cad('origen')) return { ok: false, motivo: 'SIN_ORIGEN', detalle: 'la procedencia de fuente es obligatoria: sin origen no se puede volver al material' }
  if (!cad('clinicId')) return { ok: false, motivo: 'SIN_CLINICA', detalle: 'sin consultorio no se puede aplicar el aislamiento entre inquilinos' }
  const fecha = cad('fechaDeAutoria')
  if (!fecha || Number.isNaN(Date.parse(fecha))) {
    return { ok: false, motivo: 'FECHA_DE_AUTORIA_INVALIDA', detalle: 'la fecha de AUTORÍA es obligatoria y no se sustituye por la de importación: una nota de hace cuatro años no puede parecer de hoy' }
  }
  return {
    ok: true,
    valor: {
      id: cad('id') || `nota:${cad('origen')}`,
      titulo: cad('titulo') || cad('origen'),
      texto: cad('texto'), autor: cad('autor'), origen: cad('origen'),
      fechaDeAutoria: fecha, clinicId: cad('clinicId'),
    },
  }
}

/**
 * Sobre con notas personales. `fuentes` va SIEMPRE vacío —el rol lo impone— y
 * las notas viajan aparte para que ninguna capa de arriba pueda confundirlas
 * con material citable.
 */
export interface SobreDeNotas {
  readonly sobre: SobreDeRecuperacion
  readonly notas: readonly NotaPersonal[]
  /** Notas rechazadas y por qué. Se declara: descartar en silencio es el fallo. */
  readonly rechazadas: readonly { id: string; motivo: MotivoRechazoNota }[]
}

/** De dónde salen las notas. Inyectable: este adaptador NO lee disco ni red. */
export type LeerNotas = (c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion) => Promise<readonly unknown[]>

export interface OpcionesConocimientoPersonal {
  /** Ausente = el médico no ha importado ninguna bóveda. Estado legítimo. */
  readonly leer?: LeerNotas
}

/**
 * El adaptador. Cumple `AdaptadorDeEvidencia` para que el orquestador lo trate
 * como a los demás, y expone `recuperarNotas` para quien sí quiera el material
 * personal —que es una llamada DISTINTA y por eso se ve distinta.
 */
export function adaptadorConocimientoPersonal(o: OpcionesConocimientoPersonal = {}): AdaptadorDeEvidencia & {
  recuperarNotas(c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion): Promise<SobreDeNotas>
} {
  const disponibilidad = (): DisponibilidadDeclarada => o.leer
    ? { operativo: true }
    : { operativo: false, faltante: 'el médico no ha importado ninguna bóveda de notas personales.', desbloqueaCon: 'bandera' }

  async function recuperarNotas(c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion): Promise<SobreDeNotas> {
    const inicio = Date.now()
    if (!o.leer) {
      return {
        sobre: exigir(sobreSinMaterialLocal(ctx, 'no hay ninguna bóveda de notas personales importada.')),
        notas: [], rechazadas: [],
      }
    }
    let crudas: readonly unknown[]
    try {
      crudas = await o.leer(c, ctx)
    } catch (e) {
      return {
        sobre: exigir(sobreSinMaterialLocal(ctx, `no se pudieron leer las notas personales: ${claseCorta(e)}`)),
        notas: [], rechazadas: [],
      }
    }
    const notas: NotaPersonal[] = []
    const rechazadas: { id: string; motivo: MotivoRechazoNota }[] = []
    for (const cruda of crudas) {
      const r = validarNota(cruda)
      if (!r.ok) {
        const id = (typeof cruda === 'object' && cruda !== null && typeof (cruda as { id?: unknown }).id === 'string')
          ? (cruda as { id: string }).id : '(sin id)'
        rechazadas.push({ id, motivo: r.motivo })
        continue
      }
      // AISLAMIENTO ENTRE CONSULTORIOS, aplicado en el servidor y no en la
      // pantalla (.claude/rules/security-tenant.md). Si el contexto trae
      // consultorio, una nota de otro NO pasa.
      if (ctx.clinicId && r.valor.clinicId !== ctx.clinicId) continue
      notas.push(r.valor)
    }
    const sobre = sobreConMaterial({
      proveedor: 'conocimiento_personal',
      estado: rechazadas.length > 0 ? 'partial' : 'available',
      intentadoEn: ctx.ahora,
      correlacion: ctx.correlacion,
      telemetria: { latenciaMs: Date.now() - inicio, totalDeclarado: crudas.length },
      // VACÍO SIEMPRE, y no por olvido: el rol `conocimiento_personal` hace que
      // la fábrica RECHACE cualquier Source que se intente meter por aquí.
      fuentes: [],
      frescura: { ausenciaPorque: 'no_aplica' },
      ...(rechazadas.length > 0
        ? { recorte: `${rechazadas.length} nota(s) sin procedencia completa (${[...new Set(rechazadas.map(r => r.motivo))].sort().join(', ')}): no se muestran, porque una nota sin autor o sin fecha no se puede atribuir.` }
        : {}),
    })
    return { sobre: exigir(sobre), notas, rechazadas }
  }

  return {
    proveedor: 'conocimiento_personal',
    disponibilidad,
    async recuperar(c, ctx) { return (await recuperarNotas(c, ctx)).sobre },
    recuperarNotas,
  }
}

function claseCorta(e: unknown): string {
  const m = String((e as { message?: string } | null)?.message ?? e ?? 'error desconocido')
  return m.slice(0, 120)
}

/** Sobre de "no hay bóveda" / "no se pudo leer". Siempre con motivo legible. */
function sobreSinMaterialLocal(ctx: ContextoDeRecuperacion, motivo: string) {
  return sobreSinMaterialRef({
    proveedor: 'conocimiento_personal', estado: 'not_configured',
    intentadoEn: ctx.ahora, correlacion: ctx.correlacion,
    telemetria: { latenciaMs: 0 }, motivo, clase: 'credencial_ausente',
  })
}

function exigir<T>(r: { ok: true; valor: T } | { ok: false; motivo: string; detalle: string }): T {
  if (!r.ok) throw new Error(`adaptadorConocimientoPersonal construyó un sobre inválido: ${r.motivo} — ${r.detalle}`)
  return r.valor
}
