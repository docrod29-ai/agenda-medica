/**
 * EL RESPALDO DEL CONSULTORIO — qué se lleva, qué NO, y por qué.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * «Respaldo COMPLETO» (`pacientes/page.tsx`) hacía esto **en el navegador**:
 *
 *     for (const p of patients) { const historial = await getNotas(clinicId, p.id) }
 *
 * Una lectura por paciente, **en serie**, con el médico esperando y sin barra de
 * progreso ni forma de reanudar. Con cientos de pacientes son cientos de idas y
 * vueltas antes del primer byte; en un móvil, la pestaña se queda sin memoria.
 *
 * Y lo que bajaba eran **pacientes + notas**. Nada más. Fuera quedaban las
 * adendas, los laboratorios, la fotografía clínica, los antecedentes, las citas,
 * los cobros, la configuración —membrete, formato de receta, firma—, los
 * bloqueos de agenda, la farmacia, los internamientos y la bitácora.
 *
 * Un archivo llamado «respaldo» que no respalda es peor que no tenerlo: se
 * guarda, se duerme tranquilo, y el día que hace falta no está lo que se creía.
 *
 * ── LO QUE NO SE LLEVA, Y ES UNA DECISIÓN ────────────────────────────────────
 *
 * `secretos/` guarda las **llaves de API del consultorio**. Meterlas en un
 * archivo que el médico descarga, manda por correo y deja en su escritorio sería
 * convertir un respaldo en una filtración de credenciales. Se excluye, y se
 * declara — porque un respaldo del que no se sabe qué falta tampoco sirve.
 *
 * Módulo PURO: quien lea Firestore es la ruta.
 */

/**
 * Una rama del árbol: una subcolección que puede tener las suyas.
 *
 * ── POR QUÉ TIENE QUE SER UN ÁRBOL Y NO UNA LISTA (4-ago-2026) ──────────────
 *
 * `hijas` era `string[]`, así que el respaldo bajaba **un solo nivel**. Y hay
 * cosas dos niveles abajo:
 *
 *     patients/{p}/notas/{n}/adendas/{a}
 *     patients/{p}/notas/{n}/versions/{v}
 *
 * La **adenda es el único mecanismo de corrección** que existe sobre una nota
 * firmada, que es inmutable por la NOM-024. Nunca se exportaba — y el pie del
 * archivo decía `completo: true`. Restaurar ese respaldo devolvía la nota y
 * **borraba la corrección legal**, sin que nadie se enterara.
 */
export interface RamaRespaldo {
  ruta: string
  hijas?: RamaRespaldo[]
}

export interface ColeccionRespaldo {
  /** Nombre bajo `clinics/{clinicId}`. */
  ruta: string
  /** Qué es, para quien abra el archivo. */
  descripcion: string
  /** Subcolecciones que cuelgan de cada documento, y las suyas. */
  hijas?: (string | RamaRespaldo)[]
}

/** Normaliza una rama escrita como cadena. */
export function rama(h: string | RamaRespaldo): RamaRespaldo {
  return typeof h === 'string' ? { ruta: h } : h
}

/** Todas las rutas del árbol, en punto, para poder declararlas y comprobarlas. */
export function rutasDelArbol(c: ColeccionRespaldo): string[] {
  const out: string[] = [c.ruta]
  const anda = (base: string, hs: (string | RamaRespaldo)[] | undefined) => {
    for (const h of hs ?? []) {
      const r = rama(h)
      out.push(`${base}.${r.ruta}`)
      anda(`${base}.${r.ruta}`, r.hijas)
    }
  }
  anda(c.ruta, c.hijas)
  return out
}

/**
 * Todo lo que se respalda del consultorio.
 *
 * Una entrada por `match /` de las reglas bajo `clinics/{clinicId}`, salvo lo
 * declarado en `EXCLUIDAS`. El guardián lo comprueba.
 */
export const COLECCIONES: ColeccionRespaldo[] = [
  {
    ruta: 'patients',
    descripcion: 'Pacientes y todo su expediente, incluidas las adendas y el versionado de cada nota.',
    hijas: [
      // La nota lleva DEBAJO su corrección legal (adenda) y su historial.
      { ruta: 'notas', hijas: [{ ruta: 'adendas' }, { ruta: 'versions' }] },
      'laboratorios', 'fotos', 'clinico', 'formularios_previos', 'paquetes_visita',
    ],
  },
  { ruta: 'appointments', descripcion: 'Citas: fecha, tipo, estado, médico y paciente.' },
  { ruta: 'internamientos', descripcion: 'Episodios hospitalarios.', hijas: ['signos', 'icu_stays', 'icu_observations', 'handoff_revisiones', 'bed_assignments'] },
  { ruta: 'waitlist', descripcion: 'Lista de espera.' },
  { ruta: 'config', descripcion: 'Configuración del consultorio: horario, membrete, formato de receta, firma.' },
  { ruta: 'doctors', descripcion: 'Médicos del consultorio.' },
  { ruta: 'asr_aprendizaje', descripcion: 'Palabras que el dictado aprendió de las correcciones del médico. Sin datos de pacientes: sólo vocabulario, cuántas veces se corrigió y cómo se oía mal.' },
  { ruta: 'time_blocks', descripcion: 'Bloqueos de agenda: vacaciones, cirugías, congresos.' },
  { ruta: 'cobros', descripcion: 'Cobros a pacientes.' },
  { ruta: 'farmacia', descripcion: 'Inventario de farmacia.' },
  { ruta: 'farmacia_movimientos', descripcion: 'Movimientos de farmacia.' },
  { ruta: 'camas', descripcion: 'Camas del hospital.' },
  { ruta: 'unidades', descripcion: 'Unidades y servicios.' },
  { ruta: 'laboratorio', descripcion: 'Órdenes de laboratorio del hospital.' },
  { ruta: 'hospital_roles', descripcion: 'Roles hospitalarios del personal.' },
  { ruta: 'hospital_alertas', descripcion: 'Alertas clínicas del hospital.' },
  { ruta: 'tareas_clinicas', descripcion: 'Tareas clínicas pendientes.' },
  { ruta: 'membership_plans', descripcion: 'Planes de membresía del consultorio.' },
  { ruta: 'memberships', descripcion: 'Membresías de pacientes.' },
  { ruta: 'branches', descripcion: 'Sucursales declaradas.' },
  { ruta: 'reviews', descripcion: 'Reseñas de pacientes.' },
  { ruta: 'arco_requests', descripcion: 'Solicitudes ARCO y su resolución.' },
  { ruta: 'audit_log', descripcion: 'Bitácora de accesos y cambios (NOM-024).' },
  { ruta: 'dosing_validations', descripcion: 'Firmas del médico sobre las reglas de dosificación.' },
  { ruta: 'antimicrobial_limits', descripcion: 'Topes de antimicrobianos configurados.' },
  { ruta: 'notification_logs', descripcion: 'Registro de notificaciones enviadas.' },
  { ruta: 'whatsapp_no_entregados', descripcion: 'Mensajes de WhatsApp que no se pudieron entregar.' },
  { ruta: 'alertas_no_entregadas', descripcion: 'Alertas clínicas que no se pudieron entregar.' },
  { ruta: 'whatsapp_optout', descripcion: 'Bajas de WhatsApp: quién pidió no recibir mensajes.' },
  { ruta: 'learning', descripcion: 'Preferencias aprendidas del médico.' },
  { ruta: 'chat', descripcion: 'Mensajes internos del equipo.' },
  { ruta: 'chat_reads', descripcion: 'Marcas de lectura del chat interno.' },
]

/**
 * Lo que NO se respalda, con su razón.
 *
 * Cada exclusión es una decisión, no un olvido — y por eso el guardián exige que
 * esté escrita aquí en vez de simplemente ausente.
 */
export const EXCLUIDAS: Record<string, string> = {
  secretos: 'Las llaves de API del consultorio. Meterlas en un archivo que el médico descarga, manda por correo y deja en su escritorio convertiría un respaldo en una filtración de credenciales. Se vuelven a pegar en Configuración.',
  bot_sessions: 'Estado efímero de las conversaciones del bot de WhatsApp: se reconstruye solo con el siguiente mensaje y no describe nada del consultorio.',
}

export interface LineaRespaldo {
  /** Ruta completa del documento, para poder volver a escribirlo donde estaba. */
  _ruta: string
  /** Colección de primer nivel, para agrupar al leer. */
  _coleccion: string
  [k: string]: unknown
}

/**
 * Arma la línea de un documento.
 *
 * Vive aquí y no en la ruta para que la prueba de IDA Y VUELTA pueda ejercitarla
 * sin Firestore: es la única forma de responder «sí, sabemos reconstruirlo» sin
 * depender de que alguien levante un emulador.
 */
export function lineaDeDocumento(
  rutaBase: string, coleccion: string, id: string, datos: Record<string, unknown>,
): LineaRespaldo {
  return { _ruta: `${rutaBase}/${id}`, _coleccion: coleccion, ...datos }
}

/** El índice legible que encabeza el archivo. */
export function indiceRespaldo(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of COLECCIONES) out[c.ruta] = c.descripcion
  return out
}

export const POR_QUE_NDJSON =
  'Una línea por documento, con su ruta completa. Se puede escribir mientras se ' +
  'lee —sin cargar el consultorio entero en memoria—, se puede reanudar por ' +
  'donde se quedó, y una línea corrupta no invalida el archivo entero como sí ' +
  'haría un único JSON gigante.'

export const POR_QUE_SE_EXCLUYEN_LOS_SECRETOS =
  'Un respaldo se descarga, se manda por correo y se deja en un escritorio. Las ' +
  'llaves de API que viven en `secretos/` convertirían ese archivo en una ' +
  'filtración de credenciales, y se vuelven a pegar en Configuración en un ' +
  'minuto. Lo que no se puede volver a teclear es el expediente.'
