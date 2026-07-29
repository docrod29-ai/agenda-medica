/**
 * E0-09 — Proyección de eventos hospitalarios APPEND-ONLY (núcleo PURO).
 *
 * Sin Firestore, sin red, sin `Date.now()`, sin aleatoriedad: entra un arreglo,
 * sale una proyección. Todo lo que aquí se decide es DETERMINISTA y verificable
 * con fixtures sintéticos.
 *
 * ═══ La regla del módulo ═══
 * Un hecho registrado NO se edita ni se borra. Un error se corrige ANEXANDO otro
 * registro que apunta al erróneo. Por eso estas funciones **nunca eliminan** un
 * registro de la salida: sólo lo MARCAN como corregido. Si algo debe además
 * desaparecer de un cálculo clínico, eso es política del expediente y NO se
 * decide aquí (ver `POLITICA_SIGNOS_EN_CALCULO`).
 *
 * ═══ Lo que este archivo NO hace, y por qué ═══
 * No filtra signos corregidos de NEWS2 ni del export FHIR, no declara quién
 * puede corregir, no impone ventana de tiempo y no exige motivo. Las cuatro son
 * decisiones del médico dueño del expediente (E0-09 · Q1-Q4), están marcadas
 * `NEEDS_CLINICAL_REVIEW` más abajo y su valor en producción es `null`.
 * `null` no es «desactivado»: las funciones que lo necesitan LANZAN si se las
 * llama sin política, para que nadie las cablee por accidente con un default
 * inventado.
 */
import type {
  EfectoCorreccion,
  EventoClinico,
  EventoClinicoConId,
  RegistroSignos,
  ValorDetalle,
} from '@/types/hospital'

// ══════════════════════════════════════════════════════════════
// 1 · Proyección de SIGNOS VITALES (marca, no elimina)
// ══════════════════════════════════════════════════════════════

export interface SignoProyectado {
  registro: RegistroSignos
  /** 'corregido' = otro registro posterior lo corrige. Sigue estando presente. */
  estado: 'vigente' | 'corregido'
  /** ids de los registros que corrigen a éste, en el orden en que llegaron. */
  corregidoPor: string[]
  /** id del registro que ESTE corrige (si es una corrección). */
  corrigeA?: string
  /** Es una corrección cuyo original NO está en la ventana cargada (tope 200). */
  huerfana: boolean
}

export interface ProyeccionSignos {
  /** TODOS los registros de entrada, en el mismo orden. Nunca se descarta uno. */
  registros: SignoProyectado[]
  /** id del original → correcciones que lo apuntan. */
  correccionesDe: Map<string, RegistroSignos[]>
  /** ids de registros que quedaron corregidos. */
  corregidos: Set<string>
  /** Correcciones sin original en la ventana: se muestran como registro autónomo. */
  huerfanas: RegistroSignos[]
  /** ids con `corrigeA` malformado (a sí mismo o en ciclo). El enlace se IGNORA. */
  enlacesIgnorados: string[]
}

/**
 * Proyecta una serie de signos aplicando las correcciones anexadas.
 *
 * Invariantes (probados):
 *  · `registros.length === raw.length` — no se pierde ni un registro.
 *  · No muta la entrada ni sus elementos.
 *  · Un `corrigeA` que apunta a sí mismo o cierra un ciclo se IGNORA como enlace
 *    (el registro sigue presente): un dato malformado no debe colgar la ficha.
 */
/**
 * Traduce el campo `conciencia` guardado al selector ACVPU del formulario.
 *
 * El tipo admite dos valores HEREDADOS además de ACVPU:
 *  · `'alerta'`   → sinónimo exacto de `'A'` (Alert). Se traduce sin preguntar.
 *  · `'alterada'` → NO equivale a un solo nivel: puede ser C, V, P o U. Elegir
 *    uno sería inventar un dato clínico, así que cae al default y el formulario
 *    AVISA para que la persona lo vuelva a seleccionar (`concienciaSinMapeo`).
 *
 * Devolver `'A'` para `'alterada'` sin avisar sería lo peligroso: convertiría en
 * silencio a un paciente con estado alterado en uno alerta.
 */
export function acvpu(v: RegistroSignos['conciencia']): 'A' | 'C' | 'V' | 'P' | 'U' {
  if (v === 'alerta' || v === 'A') return 'A'
  if (v === 'C' || v === 'V' || v === 'P' || v === 'U') return v
  return 'A'   // sin dato o 'alterada': default del formulario, con aviso arriba
}

/** `true` si el valor guardado NO se puede mapear y exige re-seleccionar. */
export function concienciaExigeReSeleccion(v: RegistroSignos['conciencia']): boolean {
  return v === 'alterada'
}

export function proyectarSignos(raw: readonly RegistroSignos[]): ProyeccionSignos {
  const porId = new Map<string, RegistroSignos>()
  for (const r of raw) if (r?.id) porId.set(r.id, r)

  const correccionesDe = new Map<string, RegistroSignos[]>()
  const corregidos = new Set<string>()
  const huerfanas: RegistroSignos[] = []
  const enlacesIgnorados: string[] = []
  const enlaceValido = new Map<string, string>()   // id corrección → id original

  for (const r of raw) {
    const destino = r?.corrigeA
    if (!destino) continue
    if (destino === r.id || cierraCiclo(r.id, destino, porId)) {
      enlacesIgnorados.push(r.id)
      continue
    }
    enlaceValido.set(r.id, destino)
    if (!porId.has(destino)) {
      // El original quedó fuera de la ventana cargada: la corrección NO se
      // descarta, se muestra sola. Descartarla escondería el dato bueno.
      huerfanas.push(r)
      continue
    }
    corregidos.add(destino)
    const lista = correccionesDe.get(destino)
    if (lista) lista.push(r)
    else correccionesDe.set(destino, [r])
  }

  const registros: SignoProyectado[] = raw.map(r => {
    const corrigeA = enlaceValido.get(r.id)
    const proyectado: SignoProyectado = {
      registro: r,
      estado: corregidos.has(r.id) ? 'corregido' : 'vigente',
      corregidoPor: (correccionesDe.get(r.id) ?? []).map(c => c.id),
      huerfana: corrigeA !== undefined && !porId.has(corrigeA),
    }
    if (corrigeA !== undefined) proyectado.corrigeA = corrigeA
    return proyectado
  })

  return { registros, correccionesDe, corregidos, huerfanas, enlacesIgnorados }
}

/** ¿Seguir la cadena `desde → corrigeA → …` vuelve a `desde`? */
function cierraCiclo(desde: string, primero: string, porId: Map<string, RegistroSignos>): boolean {
  const vistos = new Set<string>([desde])
  let actual: string | undefined = primero
  while (actual !== undefined) {
    if (vistos.has(actual)) return true
    vistos.add(actual)
    actual = porId.get(actual)?.corrigeA
  }
  return false
}

// ══════════════════════════════════════════════════════════════
// 2 · Proyección del LIBRO de eventos (`registros`)
// ══════════════════════════════════════════════════════════════

export interface EventoProyectado {
  evento: EventoClinicoConId
  estado: 'vigente' | 'corregido' | 'anulado'
  /** Correcciones que apuntan a este evento, en orden de llegada. */
  correcciones: EventoClinicoConId[]
}

export interface ProyeccionEventos {
  /** TODOS los eventos de entrada, en el mismo orden. Nunca se descarta uno. */
  eventos: EventoProyectado[]
  /** id del evento original → correcciones que lo apuntan. */
  correcciones: Map<string, EventoClinicoConId[]>
  /** Correcciones cuyo evento original no está en el lote cargado. */
  huerfanas: EventoClinicoConId[]
}

/**
 * `anulado` es el ÚNICO estado derivado, y es definicional, no clínico: una
 * corrección con `efecto: 'anula'` afirma literalmente que el hecho no ocurrió.
 * `sustituye` y `aclara` dejan el evento en `corregido` — ocurrió, con matices.
 */
export function proyectarEventos(raw: readonly EventoClinicoConId[]): ProyeccionEventos {
  const ids = new Set<string>()
  for (const e of raw) if (e?.id) ids.add(e.id)

  const correcciones = new Map<string, EventoClinicoConId[]>()
  const huerfanas: EventoClinicoConId[] = []

  for (const e of raw) {
    if (e?.tipo !== 'correccion') continue
    const destino = e.corrigeEventoId
    if (!destino || destino === e.id) continue      // enlace malformado: se ignora
    if (!ids.has(destino)) { huerfanas.push(e); continue }
    const lista = correcciones.get(destino)
    if (lista) lista.push(e)
    else correcciones.set(destino, [e])
  }

  const eventos: EventoProyectado[] = raw.map(e => {
    const propias = correcciones.get(e.id) ?? []
    const anulado = propias.some(c => c.efecto === 'anula')
    return {
      evento: e,
      estado: anulado ? 'anulado' : propias.length > 0 ? 'corregido' : 'vigente',
      correcciones: propias,
    }
  })

  return { eventos, correcciones, huerfanas }
}

/**
 * Administraciones que siguen contando como ocurridas.
 *
 * Derivado directo de la semántica de `anula` (§2). NO decide qué pasa con un
 * signo vital corregido: eso es Q1 y vive en `signosParaCalculoClinico`.
 */
export function contarAdministracionesVigentes(raw: readonly EventoClinicoConId[]): number {
  return proyectarEventos(raw).eventos
    .filter(p => p.evento.tipo === 'administracion' && p.estado !== 'anulado')
    .length
}

// ══════════════════════════════════════════════════════════════
// 3 · NEEDS_CLINICAL_REVIEW — los huecos que NO se rellenan aquí
// ══════════════════════════════════════════════════════════════

/**
 * E0-09 · Q1 — ¿un signo corregido/anulado sigue alimentando NEWS2 y FHIR?
 *
 * Hoy NEWS2 toma `signos[signos.length - 1]` sin filtrar
 * (`hospitalizacion/[internamientoId]/page.tsx`) y el export FHIR recorre el
 * arreglo completo (`src/lib/fhir-export.ts`). Las dos salidas fallan en
 * direcciones OPUESTAS:
 *   · si una SpO₂ mal capturada de 80 % permanece → alerta falsa;
 *   · si se oculta un valor que en realidad era correcto → se esconde un
 *     deterioro real.
 * No se deduce del código. Mientras valga `null`, `signosParaCalculoClinico`
 * LANZA: fail-closed, para que nadie la cablee con un default inventado.
 */
export type PoliticaSignoCorregido = 'incluye_corregidos' | 'excluye_corregidos'
export const POLITICA_SIGNOS_EN_CALCULO: PoliticaSignoCorregido | null = null

/** Mensaje único: si alguien lo ve en un log, sabe exactamente qué falta. */
export const FALTA_POLITICA_Q1 =
  'NEEDS_CLINICAL_REVIEW E0-09/Q1: no está definido si un signo vital corregido ' +
  'sigue alimentando NEWS2 y el export FHIR. No se asume un default.'

/**
 * Serie de signos lista para un cálculo clínico, según la política elegida.
 *
 * @param politica DEBE venir explícita. `null` lanza a propósito.
 */
export function signosParaCalculoClinico(
  raw: readonly RegistroSignos[],
  politica: PoliticaSignoCorregido | null,
): RegistroSignos[] {
  if (politica === null) throw new Error(FALTA_POLITICA_Q1)
  const { registros } = proyectarSignos(raw)
  if (politica === 'incluye_corregidos') return registros.map(p => p.registro)
  return registros.filter(p => p.estado !== 'corregido').map(p => p.registro)
}

/**
 * E0-09 · Q2, Q3, Q4 — política de CORRECCIÓN.
 *
 * Q2 ¿quién puede corregir? ¿puede enfermería ANULAR una administración de
 *    medicamento o eso queda reservado al médico? (hoy `administrar` lo puede
 *    hacer enfermería — `api/hospital/mutar/route.ts`).
 * Q3 ¿hay ventana de tiempo? ¿se corrige un evento de hace 5 días, o de un
 *    episodio ya egresado? (`administrar` exige episodio activo; `corregir` no
 *    tiene precedente en el repo).
 * Q4 ¿el motivo escrito es obligatorio? (propuesto por NOM-004, pero encarece
 *    cada corrección; si estorba, se deja de corregir y el registro se degrada).
 *
 * NINGÚN valor por defecto. `null` = la decisión no se ha tomado.
 */
export interface PoliticaCorreccion {
  /** Roles que pueden anexar una corrección (Q2). */
  rolesQueCorrigen: readonly string[]
  /** Roles que pueden ANULAR una administración de medicamento (Q2-bis). */
  rolesQueAnulanAdministracion: readonly string[]
  /** Horas desde el evento dentro de las que se admite corregir (Q3). */
  ventanaHoras: number | null
  /** ¿Se admite corregir en un episodio ya egresado? (Q3). */
  permiteEpisodioEgresado: boolean
  /** ¿El motivo escrito es obligatorio? (Q4). */
  motivoObligatorio: boolean
}

export const POLITICA_CORRECCION: PoliticaCorreccion | null = null

export const FALTA_POLITICA_Q2_Q4 =
  'NEEDS_CLINICAL_REVIEW E0-09/Q2-Q4: no está definido quién puede corregir, ' +
  'con qué ventana de tiempo ni si el motivo es obligatorio. No se asume un default.'

// ══════════════════════════════════════════════════════════════
// 4 · Validación y construcción de una corrección (determinista)
// ══════════════════════════════════════════════════════════════

export interface BorradorCorreccion {
  corrigeEventoId: string
  efecto: EfectoCorreccion
  motivo?: string
  indicacionId?: string
  detalle?: Record<string, ValorDetalle>
}

export interface ContextoCorreccion {
  /** Rol del usuario que intenta corregir (según `clinic_members`). */
  rol: string
  /** ISO del evento que se corrige. */
  fechaEvento: string
  /** ISO del momento de la corrección — reloj del SERVIDOR. */
  ahora: string
  /** ¿El evento corregido es una administración de medicamento? */
  esAdministracion: boolean
  /** ¿El episodio sigue activo? */
  episodioActivo: boolean
}

export type MotivoRechazo =
  | 'rol_no_autorizado'
  | 'anulacion_no_autorizada'
  | 'fuera_de_ventana'
  | 'episodio_egresado'
  | 'motivo_requerido'
  | 'evento_invalido'

export interface ResultadoValidacion {
  ok: boolean
  rechazos: MotivoRechazo[]
}

/**
 * ¿Se admite esta corrección? PURO y determinista **dada** una política.
 *
 * La política es un parámetro OBLIGATORIO y no admite `null`: la única forma de
 * usar esta función es que alguien haya decidido Q2-Q4 y lo haya escrito.
 */
export function validarCorreccion(
  borrador: BorradorCorreccion,
  ctx: ContextoCorreccion,
  politica: PoliticaCorreccion,
): ResultadoValidacion {
  const rechazos: MotivoRechazo[] = []

  if (!borrador.corrigeEventoId) rechazos.push('evento_invalido')
  if (!politica.rolesQueCorrigen.includes(ctx.rol)) rechazos.push('rol_no_autorizado')
  if (borrador.efecto === 'anula' && ctx.esAdministracion &&
      !politica.rolesQueAnulanAdministracion.includes(ctx.rol)) {
    rechazos.push('anulacion_no_autorizada')
  }
  if (politica.motivoObligatorio && !(borrador.motivo ?? '').trim()) {
    rechazos.push('motivo_requerido')
  }
  if (!ctx.episodioActivo && !politica.permiteEpisodioEgresado) {
    rechazos.push('episodio_egresado')
  }
  if (politica.ventanaHoras !== null) {
    const horas = horasEntre(ctx.fechaEvento, ctx.ahora)
    if (horas === null || horas > politica.ventanaHoras) rechazos.push('fuera_de_ventana')
  }

  return { ok: rechazos.length === 0, rechazos }
}

/** Horas transcurridas entre dos ISO, o null si alguna fecha es inválida. */
export function horasEntre(desdeIso: string, hastaIso: string): number | null {
  const a = Date.parse(desdeIso)
  const b = Date.parse(hastaIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return (b - a) / 3_600_000
}

/**
 * Construye el evento de corrección que se ANEXA al libro.
 *
 * NO toca el evento original — no existe camino en este módulo que lo mute.
 * `fecha` y `por` los pone quien llama desde el SERVIDOR; cualquier `fecha`/`por`
 * que venga del cliente se descarta por construcción (no hay parámetro para eso).
 */
export function construirCorreccion(
  borrador: BorradorCorreccion,
  sello: { ahora: string; por: string; porUid?: string },
): EventoClinico {
  const ev: EventoClinico = {
    tipo: 'correccion',
    fecha: sello.ahora,
    por: sello.por,
    corrigeEventoId: borrador.corrigeEventoId,
    efecto: borrador.efecto,
  }
  if (sello.porUid !== undefined) ev.porUid = sello.porUid
  if (borrador.indicacionId !== undefined) ev.indicacionId = borrador.indicacionId
  const motivo = (borrador.motivo ?? '').trim()
  if (motivo) ev.motivo = motivo
  if (borrador.detalle && Object.keys(borrador.detalle).length > 0) ev.detalle = borrador.detalle
  return ev
}
