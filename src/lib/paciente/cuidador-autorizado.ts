/**
 * EL CUIDADOR AUTORIZADO — la persona que ayuda, con nombre y con fecha.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * `.claude/rules/patient-facing-ai.md` §8 lo pedía con todas las letras y no
 * existía:
 *
 *     «Un cuidador autorizado es una autorización explícita y revocable, con
 *      bitácora — no un segundo dueño del expediente.»
 *
 * Hasta hoy había UN enlace por paciente y nada más. Lo que eso producía, dicho
 * por cinco auditores del Panel de Lujo el mismo día:
 *
 *  · **PP-008** — el padre y la madre separados son indistinguibles: el
 *    formulario previo que llena el segundo borraba el del primero, en silencio.
 *  · **PI-013** — «soy la hija y cuido a mi papá»: no hay forma de que la
 *    autoricen, ni de saber qué vio.
 *  · **PG-011** — adolescente embarazada y su madre: el sistema no sabe quién es
 *    quién y el enlace va al teléfono que se haya tecleado.
 *  · **PO-014 · PC-010 · MP-014** — la Ayuda del producto PROMETE un cuidador
 *    autorizado que no está construido.
 *  · **PC-018** — el paciente no puede cerrar su enlace ni enterarse de que
 *    alguien más entró.
 *
 * ── QUIÉN AUTORIZA, Y POR QUÉ ES EL PACIENTE ────────────────────────────────
 *
 * El propio paciente, desde su portal. No es una comodidad: es de quién son los
 * datos. Ponerlo detrás del mostrador significaría que la hija que cuida a su
 * padre depende de que el consultorio esté abierto un martes a las nueve de la
 * noche — y ese es justo el momento en que hace falta.
 *
 * Lo que el paciente NO puede hacer es darle a nadie más de lo que él mismo
 * tiene: el alcance del cuidador se recorta contra el del enlace con el que
 * autoriza (`alcanceQuePuedeDar`). Un enlace de agenda no puede engendrar uno
 * clínico, o sería una escalada de privilegios con buenos modales.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * · **No decide por un menor.** Desde qué edad autoriza el adolescente y no su
 *   tutor es una decisión del dueño que sigue abierta (PL-P1, MP-014). Aquí no
 *   se asume ninguna: el módulo describe a quien tenga el enlace, sea el
 *   paciente o su tutor, y lo dice en `LO_QUE_NO_RESUELVE`.
 * · **No verifica identidad.** Nadie comprueba que «Ana, mi hija» sea Ana. Lo
 *   que garantiza es que la autorización sea EXPLÍCITA, esté FECHADA, se pueda
 *   REVOCAR y deje RASTRO — que es lo que §8 pide y lo que no había.
 * · **No escribe en Firestore.** Módulo puro: quien persiste es el servidor.
 */

/** El parentesco lo escribe el paciente. No se valida contra un catálogo: lo dice él. */
export interface CuidadorAutorizado {
  /** Id estable, para poder revocar a UNO sin tocar a los demás. */
  id: string
  /** Como lo escribió el paciente. */
  nombre: string
  /** «mi hija», «mi esposo», «la enfermera que me cuida». Texto libre a propósito. */
  parentesco: string
  /** Qué puede ver. Nunca más que quien lo autorizó. */
  alcance: 'agenda' | 'clinico'
  /** ISO. Una autorización sin fecha no se puede auditar. */
  autorizadoEn: string
  /** ISO, cuando se revoca. `null` mientras está vigente. */
  revocadoEn: string | null
  /** Última vez que este cuidador abrió el portal. `null` si no lo ha abierto. */
  ultimoAccesoEn: string | null
}

export const MAX_CUIDADORES = 5
export const MAX_LARGO_NOMBRE = 80
export const MAX_LARGO_PARENTESCO = 40

const texto = (v: unknown, tope: number): string =>
  (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, tope)

export type MotivoRechazo =
  | 'sin-nombre'
  | 'sin-parentesco'
  | 'demasiados'
  | 'alcance-no-permitido'

export const MOTIVO_RECHAZO_LABEL: Record<MotivoRechazo, string> = {
  'sin-nombre': 'Escribe el nombre de la persona a la que le vas a dar acceso.',
  'sin-parentesco': 'Escribe quién es esa persona para ti (por ejemplo: «mi hija»).',
  demasiados: `Ya tienes ${MAX_CUIDADORES} personas con acceso. Quítale el acceso a alguna antes de agregar otra.`,
  'alcance-no-permitido': 'Este enlace no puede dar acceso a tus documentos. Pídeselo a tu consultorio.',
}

export type Autorizacion =
  | { ok: true; cuidador: CuidadorAutorizado }
  | { ok: false; motivo: MotivoRechazo }

/**
 * NADIE PUEDE DAR MÁS DE LO QUE TIENE.
 *
 * Un enlace de `agenda` —el que emite el mostrador— sólo puede autorizar a
 * alguien para la agenda. Si pudiera dar `clinico`, cualquiera con el enlace
 * reenviado se autorizaría a sí mismo el expediente completo: la puerta que
 * E0-06 cerró, abierta de nuevo por dentro.
 *
 * Un enlace de `documento` no autoriza a nadie: ya es un enlace acotado a una
 * cosa, y encadenar accesos desde él sería multiplicar copias sin dueño.
 */
export function alcanceQuePuedeDar(
  alcanceDeQuienAutoriza: string,
  alcancePedido: string,
): CuidadorAutorizado['alcance'] | null {
  if (alcanceDeQuienAutoriza === 'clinico') return alcancePedido === 'clinico' ? 'clinico' : 'agenda'
  if (alcanceDeQuienAutoriza === 'agenda') return alcancePedido === 'clinico' ? null : 'agenda'
  return null
}

export function autorizarCuidador(
  actuales: readonly CuidadorAutorizado[],
  datos: { nombre: unknown; parentesco: unknown; alcance: unknown },
  alcanceDeQuienAutoriza: string,
  ahoraIso: string,
  id: string,
): Autorizacion {
  const nombre = texto(datos.nombre, MAX_LARGO_NOMBRE)
  if (!nombre) return { ok: false, motivo: 'sin-nombre' }
  const parentesco = texto(datos.parentesco, MAX_LARGO_PARENTESCO)
  if (!parentesco) return { ok: false, motivo: 'sin-parentesco' }
  if (vigentes(actuales).length >= MAX_CUIDADORES) return { ok: false, motivo: 'demasiados' }
  const alcance = alcanceQuePuedeDar(alcanceDeQuienAutoriza, String(datos.alcance ?? 'agenda'))
  if (!alcance) return { ok: false, motivo: 'alcance-no-permitido' }
  return {
    ok: true,
    cuidador: { id, nombre, parentesco, alcance, autorizadoEn: ahoraIso, revocadoEn: null, ultimoAccesoEn: null },
  }
}

/** Los que pueden entrar hoy. Un revocado se CONSERVA: borrarlo borra la bitácora. */
export function vigentes(cuidadores: readonly CuidadorAutorizado[] | undefined): CuidadorAutorizado[] {
  return (cuidadores ?? []).filter(c => !c.revocadoEn)
}

/**
 * REVOCAR NO BORRA.
 *
 * Un cuidador que desaparece de la lista es indistinguible de uno que nunca
 * existió, y entonces la pregunta «¿quién vio mi expediente en marzo?» no tiene
 * respuesta. Se marca con fecha y se queda: es la misma doctrina que `retirar`
 * en el paquete de la visita.
 */
export function revocarCuidador(
  cuidadores: readonly CuidadorAutorizado[],
  id: string,
  ahoraIso: string,
): CuidadorAutorizado[] | null {
  const i = cuidadores.findIndex(c => c.id === id && !c.revocadoEn)
  if (i < 0) return null
  const copia = cuidadores.map(c => ({ ...c }))
  copia[i].revocadoEn = ahoraIso
  return copia
}

/** ¿Puede este cuidador seguir entrando? Un id que no está no entra. */
export function cuidadorVigente(
  cuidadores: readonly CuidadorAutorizado[] | undefined,
  id: string | null,
): CuidadorAutorizado | null {
  if (!id) return null
  return vigentes(cuidadores).find(c => c.id === id) ?? null
}

/** Deja constancia de que este cuidador entró. Es la mitad «bitácora» del §8. */
export function marcarAcceso(
  cuidadores: readonly CuidadorAutorizado[],
  id: string,
  ahoraIso: string,
): CuidadorAutorizado[] {
  return cuidadores.map(c => (c.id === id ? { ...c, ultimoAccesoEn: ahoraIso } : { ...c }))
}

export const LO_QUE_NO_RESUELVE =
  'No verifica la identidad de nadie: garantiza que la autorización sea explícita, ' +
  'fechada, revocable y con rastro. Y no decide desde qué edad autoriza el ' +
  'adolescente en vez de su tutor — esa sigue siendo una decisión del dueño ' +
  '(PL-P1, MP-014), y aquí no se asume ninguna.'
