/**
 * QUÉ SE DESACOPLA Y QUÉ NO — la política, escrita para poder vigilarla.
 *
 * ── LA PREGUNTA QUE HAY QUE CONTESTAR ANTES DE CONSTRUIR UNA COLA ───────────
 *
 * «Colas y contrapresión» es un requisito del programa, y la forma barata de
 * cumplirlo sería meter una cola en medio del camino clínico. Sería un error
 * caro: la nota es lo que el médico está esperando con el paciente enfrente.
 *
 * Así que primero se decide **qué operación puede desacoplarse y cuál no**, y se
 * escribe aquí para que la decisión se pueda discutir y vigilar en vez de
 * deducirse leyendo veinte archivos.
 *
 * ── LA REGLA DURA ───────────────────────────────────────────────────────────
 *
 * **Una operación clínica nunca puede aparecer como completada si sólo quedó
 * encolada.**
 *
 * De ahí sale todo lo demás. Si el médico tiene que saber que algo quedó hecho
 * para seguir trabajando —o para dejar de trabajar—, esa operación es
 * **síncrona** y su éxito es su persistencia. Si nadie la está mirando, puede ser
 * durable y diferida, y entonces la cola es lo correcto porque protege contra la
 * pérdida en vez de disimular una espera.
 *
 * ── LO QUE YA EXISTÍA, Y ESTE ARCHIVO NO REINVENTA ──────────────────────────
 *
 * El censo del programa decía «ninguna cola, contrapresión ni dead-letter». Era
 * inexacto y conviene decirlo: hay **dos colas** y están bien hechas.
 *
 *  · `whatsapp/outbox.ts` — reintento con retroceso y **dead-letter**; la drena
 *    el cron de recordatorios. Nadie espera un mensaje proactivo delante de una
 *    pantalla, así que diferirlo es correcto y perderlo no lo sería.
 *  · `expediente/audit-log.ts` — cola durable en el navegador, **acotada** a 50
 *    asientos, con tope de reintentos, **por uid** (un asiento de otro no se
 *    manda con el nombre equivocado), drenada antes de cerrar sesión y **contada
 *    en pantalla**. La bitácora nunca frena la operación clínica y tampoco se
 *    pierde en silencio.
 *
 * Lo que de verdad faltaba era **contrapresión** (`ia/contrapresion.ts`), que es
 * un problema distinto del interruptor: éste cubre un proveedor caído; aquélla,
 * uno lento.
 */

/** Por qué una operación está donde está. */
export type Modo =
  /** El médico necesita saber que quedó hecho. Éxito = persistido. */
  | 'sincrona'
  /** Nadie la espera delante de una pantalla. Cola durable y reintento. */
  | 'encolada_durable'
  /** Se intenta y si no se puede se DICE, sin cola: nada que perder después. */
  | 'mejor_esfuerzo_declarado'

export interface OperacionClasificada {
  readonly nombre: string
  readonly modo: Modo
  readonly porQue: string
  /** Dónde vive, para que la clasificación se pueda comprobar. */
  readonly donde?: string
}

export const OPERACIONES: readonly OperacionClasificada[] = Object.freeze([
  /* ── Síncronas: Clinical Truth y la autoridad del médico ────────────────── */
  {
    nombre: 'Guardar la nota (borrador)', modo: 'sincrona',
    porQue: 'Es el trabajo del médico. Si no quedó escrito y la pantalla dice que sí, se pierde una consulta entera y nadie se entera hasta la siguiente.',
    donde: 'src/lib/expediente/firestore.ts',
  },
  {
    nombre: 'Firmar la nota', modo: 'sincrona',
    porQue: 'Acto medicolegal e IRREVERSIBLE. Encolarla dejaría al médico creyendo que firmó algo que todavía no existe, y la firma no se puede repetir «por si acaso».',
    donde: 'firestore.rules (el cliente firma; la regla exige que el autor sea quien firma)',
  },
  {
    nombre: 'Crear o modificar una receta', modo: 'sincrona',
    porQue: 'El paciente se va con ella. Una receta encolada es una receta que no existe cuando el paciente sale por la puerta.',
  },
  {
    nombre: 'Crear una orden clínica', modo: 'sincrona',
    porQue: 'Igual que la receta: la orden se entrega o se manda, y su existencia no puede depender de que un trabajo de fondo prospere.',
  },
  {
    nombre: 'Confirmar un aviso clínico antes de firmar', modo: 'sincrona',
    porQue: 'Es la constancia de que el médico REVISÓ. Va sellada dentro de la nota (REG-366): fuera del hash no probaría nada.',
    donde: 'src/lib/expediente/lo-que-se-aviso-al-firmar.ts',
  },
  {
    nombre: 'Reservar y descontar créditos de IA', modo: 'sincrona',
    porQue: 'Entre preguntar «¿le quedan?» y descontar caben treinta segundos, y en ese hueco dos notas pasan con el saldo de una. Decidir y descontar ocurren en el mismo paso.',
    donde: 'src/lib/ia/gateway.ts',
  },

  /* ── Encoladas y durables: nadie las mira ───────────────────────────────── */
  {
    nombre: 'Aviso proactivo de WhatsApp', modo: 'encolada_durable',
    porQue: 'Nadie lo espera delante de una pantalla, y perderlo sí importaría: el hueco de la lista de espera se lo queda nadie. Reintento con retroceso y dead-letter.',
    donde: 'src/lib/whatsapp/outbox.ts',
  },
  {
    nombre: 'Asiento de la bitácora NOM-004', modo: 'encolada_durable',
    porQue: 'La bitácora NUNCA puede frenar una operación clínica, y tampoco puede perderse. Cola acotada, por uid, drenada antes de cerrar sesión y contada en pantalla.',
    donde: 'src/lib/expediente/audit-log.ts',
  },

  /* ── Mejor esfuerzo, pero DECLARADO ─────────────────────────────────────── */
  {
    nombre: 'Llamada de IA para redactar o analizar', modo: 'mejor_esfuerzo_declarado',
    porQue: 'El médico la espera, así que NO se encola: bajo saturación se rechaza al momento y se le dice, para que decida si reintenta o escribe a mano. Encolarla sería la espera sin fondo que esta política prohíbe.',
    donde: 'src/lib/ia/contrapresion.ts',
  },
  {
    nombre: 'Asiento del libro de costos', modo: 'mejor_esfuerzo_declarado',
    porQue: 'Contabilidad interna. No puede meterse en el camino de una nota, y perder un asiento no le quita nada al médico ni al paciente.',
    donde: 'src/lib/finanzas/cost-ledger.ts',
  },
])

export const REGLA =
  'Una operación clínica nunca puede aparecer como completada si sólo quedó ' +
  'encolada. Si el médico necesita saber que quedó hecho, la operación es ' +
  'SÍNCRONA y su éxito es su persistencia. Si nadie la mira, puede ser durable y ' +
  'diferida — y ahí la cola protege contra la pérdida en vez de disimular una espera.'

export const POR_QUE_NO_SE_ENCOLA_LA_NOTA =
  'Porque el médico la está esperando con el paciente enfrente. Una nota metida ' +
  'en una cola haría que la pantalla dijera «procesando» sin que nada se estuviera ' +
  'procesando, y esa es exactamente la mentira que esta política existe para ' +
  'impedir. Bajo saturación se contesta ahora y con la verdad.'

/** Las que no pueden diferirse por ningún motivo. */
export function sincronas(): readonly OperacionClasificada[] {
  return OPERACIONES.filter(o => o.modo === 'sincrona')
}
