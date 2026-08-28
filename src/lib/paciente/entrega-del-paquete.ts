/**
 * LA ENTREGA — cómo llega al paciente lo que su médico liberó. POSTVISIT-001.
 *
 * ── LIBERAR Y ENTREGAR TAMBIÉN SON DOS ACTOS ────────────────────────────────
 *
 * Liberar es autorizar la lectura; entregar es abrirle el camino. Se hacen
 * seguidos y no son lo mismo: se puede liberar sin mandar nada —el paciente lo
 * encuentra al entrar a su portal— y **no se puede mandar sin haber liberado**.
 *
 * Este módulo sostiene esa segunda mitad, y es la razón por la que existe: el
 * único sitio del producto que compone un enlace o un mensaje hacia el paquete
 * es éste, y aquí la compuerta `visibleParaElPaciente` se vuelve a exigir. Que
 * la pantalla del médico esconda el botón mientras el paquete es `DRAFT` no es
 * una defensa: un botón escondido es un botón, y `POSTVISIT-ENTREGA-001` nació
 * precisamente de que el camino no existía en ningún sitio comprobable.
 *
 * ── POR QUÉ EL MENSAJE NO LLEVA CONTENIDO CLÍNICO ───────────────────────────
 *
 * WhatsApp es un canal externo, y un enlace de paciente se reenvía y acaba en
 * sitios que nadie controla (§8 de `.claude/rules/patient-facing-ai.md`). Va el
 * aviso y el enlace; el contenido se lee dentro del portal, detrás del token,
 * con su alcance y su revocación. Es la misma decisión que ya toma el aviso del
 * formulario previo: «llegó algo, ábrelo donde está protegido».
 *
 * Ni el diagnóstico, ni un nombre de fármaco, ni la fecha de la consulta: la
 * combinación «teléfono + diagnóstico» en un canal reenviable es identificable
 * aunque cada mitad por separado parezca inocua.
 *
 * Módulo PURO. No manda nada: compone lo que otro mandará.
 */
import { visibleParaElPaciente, type PaqueteDeVisita } from './paquete-de-visita'

/** Por qué no se puede entregar. Se le dice al médico, no se falla en silencio. */
export type MotivoSinEntrega = 'no-liberado' | 'sin-enlace'

export type Entrega =
  | { ok: true; mensaje: string }
  | { ok: false; motivo: MotivoSinEntrega }

export interface DatosDeEntrega {
  /** El paquete, tal como quedó en la base. Se vuelve a pasar por la compuerta. */
  paquete: Pick<PaqueteDeVisita, 'estado' | 'approvedAt' | 'approvedBy'>
  /** El magic-link del portal, con alcance clínico y su versión. */
  enlace: string
  /** Cómo se llama el consultorio. Sin él, el mensaje sigue siendo válido. */
  consultorio?: string
}

/**
 * El texto que el médico manda por WhatsApp — o la cadena vacía si no procede.
 *
 * Se niega en dos casos, y los dos importan:
 *  - el paquete no está liberado (o le falta aprobador o fecha: la compuerta
 *    exige las tres cosas). Mandar el enlace de un borrador es enseñarle al
 *    paciente como definitivo algo que su médico no ha aprobado;
 *  - no hay enlace. Un mensaje que dice «ya puedes verlo» sin decir dónde manda
 *    al paciente a llamar al consultorio, que es exactamente el trabajo que
 *    esto venía a ahorrar.
 */
export function mensajeDeEntrega(d: DatosDeEntrega): Entrega {
  if (!visibleParaElPaciente(d.paquete)) return { ok: false, motivo: 'no-liberado' }
  const enlace = String(d.enlace ?? '').trim()
  if (!enlace) return { ok: false, motivo: 'sin-enlace' }

  const de = String(d.consultorio ?? '').trim()
  return {
    ok: true,
    mensaje: [
      `📄 *El resumen de tu consulta ya está disponible*${de ? ` — ${de}` : ''}`,
      ``,
      `Ahí están tus medicamentos con las instrucciones en palabras sencillas,`,
      `los estudios que te pidió tu médico y cuándo volver.`,
      ``,
      enlace,
      ``,
      `Este enlace es personal: no lo compartas.`,
    ].join('\n'),
  }
}

export const POR_QUE_EL_MENSAJE_NO_LLEVA_CONTENIDO =
  'Un enlace de paciente se reenvía por WhatsApp y acaba donde nadie lo ' +
  'controla. El aviso viaja; el secreto médico se queda detrás del token, con ' +
  'su alcance y su revocación.'
