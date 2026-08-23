/**
 * INVENTARIO DE CLASES DE DATO — qué se guarda, quién manda sobre ello, y qué
 * pasa con ello el día que hay que restaurar.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `src/lib/clinica/respaldo.ts` ya declara QUÉ COLECCIONES viaja el respaldo.
 * Es la lista correcta y ésta NO la sustituye: la lee.
 *
 * Lo que el manifiesto no dice —y sin lo cual no se puede decidir nada el día
 * malo— es lo OTRO de cada clase de dato:
 *
 *  · quién es el sistema de registro (¿Firestore? ¿Cloud Storage? ¿Stripe?);
 *  · si es mutable o si está firmada y por tanto es inmutable;
 *  · si se puede volver a escribir en una restauración, o si escribirla encima
 *    es exactamente el defecto que hay que impedir;
 *  · de qué depende referencialmente (una adenda sin su nota es basura legal);
 *  · qué invariante tiene que seguir cierta después de restaurar.
 *
 * Sin esto, «restauramos todo» es una frase: no distingue entre devolver una
 * cita perdida —inofensivo— y sobrescribir una nota firmada con la versión que
 * traía un archivo, que es una alteración de documento medicolegal.
 *
 * ── LO QUE ESTE INVENTARIO NO ES ─────────────────────────────────────────────
 *
 * No es una segunda fuente de verdad sobre qué se respalda. `backupIncluido` se
 * DERIVA del manifiesto de `respaldo.ts` (ver `derivarBackupIncluido`), y el
 * guardián comprueba que no haya clase de dato de Firestore que el manifiesto
 * conozca y este inventario ignore, ni al revés.
 *
 * Módulo PURO. Sin PHI, sin datos reales, sin cifras clínicas.
 */
import { COLECCIONES, EXCLUIDAS, rutasDelArbol } from '@/lib/clinica/respaldo'

/** Dónde vive de verdad el dato. */
export type SistemaDeRegistro =
  | 'firestore'
  /** Objeto en Cloud Storage; en Firestore sólo vive su metadato. */
  | 'cloud-storage'
  /** Lo manda un tercero (Stripe); lo nuestro es una copia o un recibo. */
  | 'externo'
  /** Sólo en el dispositivo del médico hasta que sincroniza. */
  | 'cliente'

/**
 * Qué se puede hacer con esta clase de dato durante una restauración.
 *
 * `nunca` no es pereza: es la mitad del contrato. Una clase marcada `nunca` que
 * aparece en un archivo de restauración es una línea que se rechaza, no un
 * documento que se escribe con cuidado.
 */
export type PermisoRestauracion =
  /** Se escribe sin más ceremonia que el re-enraizado. */
  | 'libre'
  /** Se escribe SÓLO si no existe ya; si existe y difiere → revisión humana. */
  | 'solo-si-falta'
  /** Nunca se escribe desde un archivo: se vuelve a teclear o se re-deriva. */
  | 'nunca'

/** A qué régimen de conservación pertenece. Ver `archivado.ts`. */
export type ClaseDeRetencion =
  /** Expediente. NOM-004: lo fija la ley y el abogado, nunca un cron. */
  | 'clinica'
  /** Contabilidad y recibos: se archiva, no se purga. */
  | 'contable'
  /** Bitácora medicolegal: append-only, no se purga. */
  | 'auditoria'
  /** Configuración viva: se sobrescribe, no crece. */
  | 'configuracion'
  /** Telemetría y estado efímero: sí tiene barrido (`ops/retencion.ts`). */
  | 'operativa'

export interface ClaseDeDato {
  /** Nombre estable de la clase. Es la llave: no se renombra a la ligera. */
  dataClass: string
  /**
   * Ruta canónica en punto, tal y como la derivan `rutasDelArbol` y
   * `coleccionDeLaRuta`. Para Storage, el prefijo del bucket.
   */
  sourcePath: string
  systemOfRecord: SistemaDeRegistro
  /** ¿El médico puede cambiarlo después de crearlo? */
  mutable: boolean
  /** ¿Está firmado o es append-only? Si lo es, restaurar encima es alterar. */
  signedOrImmutable: boolean
  /** DERIVADO del manifiesto de `respaldo.ts`. No se escribe a mano. */
  backupIncluded: boolean
  restoreAllowed: PermisoRestauracion
  retentionClass: ClaseDeRetencion
  containsPHI: boolean
  /**
   * De qué otras clases depende para significar algo. Una adenda sin su nota no
   * es una corrección: es un párrafo suelto.
   */
  referenceDependencies: string[]
  /**
   * Qué tiene que seguir siendo cierto DESPUÉS de restaurar. Se escribe como
   * afirmación comprobable, no como intención.
   */
  integrityInvariant: string
}

/**
 * Todas las rutas que el manifiesto del respaldo se lleva, aplanadas.
 * Es la fuente; `backupIncluded` no se declara, se consulta aquí.
 */
export function rutasRespaldadas(): Set<string> {
  const out = new Set<string>()
  for (const c of COLECCIONES) for (const r of rutasDelArbol(c)) out.add(r)
  return out
}

/** `true` si el manifiesto del respaldo se lleva esa ruta. */
export function derivarBackupIncluido(sourcePath: string): boolean {
  return rutasRespaldadas().has(sourcePath)
}

/**
 * Las clases de dato de la ruta de lanzamiento (Consultorio).
 *
 * Hospital/UCI aparece marcado como tal donde el manifiesto ya lo respalda —no
 * se añade nada nuevo suyo—, porque un inventario que omite lo que el archivo
 * SÍ contiene miente sobre el tamaño del respaldo.
 */
const CRUDO: Omit<ClaseDeDato, 'backupIncluded'>[] = [
  {
    dataClass: 'patient-demographics',
    sourcePath: 'patients',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: [],
    integrityInvariant: 'Todo `patientId` referido por citas, encuentros, notas, laboratorios y fotos existe como documento en esta clase y en el MISMO consultorio.',
  },
  {
    dataClass: 'appointments',
    sourcePath: 'appointments',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Ninguna cita se duplica por reintento de restauración: el identificador del documento es la identidad, y dos restauraciones del mismo archivo dejan el mismo número de citas.',
  },
  {
    dataClass: 'encounter-draft-note',
    sourcePath: 'patients.notas',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Un borrador restaurado no pisa un borrador más reciente creado después por el médico: si el destino tiene `updatedAt` posterior, se escala en vez de escribir.',
  },
  {
    dataClass: 'encounter-signed-note',
    sourcePath: 'patients.notas',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Si el destino ya tiene la nota firmada y su `metadata.hashIntegridad` difiere del que trae el archivo, NO se escribe: revisión humana. Restaurar nunca es una vía para editar un documento firmado.',
  },
  {
    dataClass: 'note-amendment',
    sourcePath: 'patients.notas.adendas',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['encounter-signed-note'],
    integrityInvariant: 'Toda adenda restaurada tiene su nota padre en el archivo o en el destino, y esa nota pertenece al MISMO paciente que la ruta de la adenda. Una adenda huérfana no se escribe.',
  },
  {
    dataClass: 'note-version-lineage',
    sourcePath: 'patients.notas.versions',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['encounter-draft-note'],
    integrityInvariant: 'El linaje de versiones cuelga de la nota a la que pertenece: ninguna versión aparece bajo una nota distinta de aquella de la que salió, ni bajo otro paciente.',
  },
  {
    dataClass: 'medication-history-and-plan',
    sourcePath: 'patients.notas',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['encounter-signed-note', 'encounter-draft-note'],
    integrityInvariant: 'El estado de intención del medicamento (`reported`/`unknown` frente a `start`/`change`/`continue`/`stop`) sobrevive la ida y vuelta SIN cambiar: restaurar no promueve un antecedente a prescripción.',
  },
  {
    dataClass: 'prescription-document',
    sourcePath: 'patients.notas',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['encounter-signed-note'],
    integrityInvariant: 'La receta no es un documento aparte: es la proyección impresa de los medicamentos de una nota FIRMADA. Restaurar una receta sin su nota firmada es imposible por construcción, y así debe seguir.',
  },
  {
    dataClass: 'diagnoses',
    sourcePath: 'patients.notas',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['encounter-draft-note'],
    integrityInvariant: 'Un diagnóstico SUGERIDO por la IA no se restaura como diagnóstico confirmado: la marca de quién lo confirmó viaja con él o no viaja el diagnóstico.',
  },
  {
    dataClass: 'labs',
    sourcePath: 'patients.laboratorios',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Todo laboratorio restaurado cuelga de un paciente existente del consultorio destino.',
  },
  {
    dataClass: 'clinical-photo-metadata',
    sourcePath: 'patients.fotos',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics', 'clinical-photo-object'],
    integrityInvariant: 'La `url` de la foto restaurada NO apunta a un objeto de otro consultorio. Si tras el re-enraizado sigue apuntando al origen, el metadato queda marcado como referencia forastera y NO se da por restaurado.',
  },
  {
    dataClass: 'clinical-photo-object',
    /** `key` se sanea a `[a-z0-9_-]` y se corta a 40, así que la ruta REAL no lleva barras. */
    sourcePath: 'storage:receta-diseno/{uid}/',
    systemOfRecord: 'cloud-storage', mutable: false, signedOrImmutable: false,
    restoreAllowed: 'nunca', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['clinical-photo-metadata'],
    integrityInvariant: 'El respaldo NDJSON no contiene ni un byte de este objeto. La restauración deja el metadato apuntando a un objeto que puede no existir en el destino: eso se DECLARA como pérdida conocida, no se presenta como restaurado.',
  },
  {
    dataClass: 'consultation-audio-object',
    sourcePath: 'storage:consultas-audio/{uid}/',
    systemOfRecord: 'cloud-storage', mutable: false, signedOrImmutable: false,
    restoreAllowed: 'nunca', retentionClass: 'operativa', containsPHI: true,
    referenceDependencies: [],
    integrityInvariant: 'Es efímero POR DISEÑO: el hook lo borra y el cron `limpiar-audio` es la red debajo. Su ausencia en el respaldo es correcta, y lo que sí tiene que sobrevivir —`transcripcionMotor` y `transcripcionCruda`— viaja dentro de la nota.',
  },
  {
    dataClass: 'transcription-artifacts',
    sourcePath: 'patients.notas',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['encounter-draft-note'],
    integrityInvariant: '`transcripcionMotor` (lo que oyó el reconocedor) y `transcripcionCruda` (lo que el médico editó) sobreviven AMBAS. De esa pareja cuelga cualquier discusión medicolegal; perder una es perder el careo.',
  },
  {
    dataClass: 'audit-log',
    sourcePath: 'audit_log',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'auditoria', containsPHI: true,
    referenceDependencies: [],
    integrityInvariant: 'Append-only: una restauración añade asientos que faltaban y NUNCA pisa uno existente. La propia restauración deja su asiento.',
  },
  {
    dataClass: 'payments-and-charges',
    sourcePath: 'cobros',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'contable', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Restaurar no duplica un cobro: dos pasadas del mismo archivo dejan el mismo total. La conciliación con el tercero (Stripe) es de la contabilidad, no de este archivo.',
  },
  {
    dataClass: 'clinic-settings',
    sourcePath: 'config',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'configuracion', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'Membrete, formato de receta y firma vuelven; las imágenes que referencian viven en Storage y pueden no volver — se declara.',
  },
  {
    dataClass: 'clinic-secrets',
    sourcePath: 'secretos',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'nunca', retentionClass: 'configuracion', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'No sale en el respaldo y no entra por uno. Un archivo editado a mano que las traiga se rechaza línea a línea, y el rechazo aparece en el informe.',
  },
  {
    dataClass: 'clinician-learning-preferences',
    sourcePath: 'learning',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'operativa', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'Preferencias aprendidas del médico. Sin datos de paciente por construcción; si alguna vez los llevara, cambia su `containsPHI` y su régimen.',
  },
  {
    dataClass: 'asr-learned-vocabulary',
    sourcePath: 'asr_aprendizaje',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'operativa', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'Se comparte por consultorio y NUNCA contiene partes del nombre del paciente. Restaurarlo en otro consultorio movería vocabulario entre consultorios: por eso el re-enraizado se declara en el informe.',
  },
  {
    dataClass: 'schedule-blocks',
    sourcePath: 'time_blocks',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'configuracion', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'Bloqueos de agenda; sin ellos la agenda restaurada ofrece huecos que no existen.',
  },
  {
    dataClass: 'arco-requests',
    sourcePath: 'arco_requests',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'auditoria', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Una supresión ARCO ya ejecutada NO se deshace restaurando un respaldo anterior sin decírselo a nadie: si el archivo trae un paciente cuya supresión consta en el destino, es revisión humana.',
  },
  {
    dataClass: 'patient-intake-history',
    sourcePath: 'patients.clinico',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Antecedentes y alergias del paciente. Ausencia de dato NO es dato de ausencia: una restauración parcial que deje esta clase vacía tiene que decirlo, porque una lista de alergias vacía se lee como «sin alergias».',
  },
  {
    dataClass: 'patient-prefill-forms',
    sourcePath: 'patients.formularios_previos',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Lo que el paciente llenó desde su enlace del portal. Cuelga de su paciente y de nadie más.',
  },
  {
    dataClass: 'patient-visit-package',
    sourcePath: 'patients.paquetes_visita',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'solo-si-falta', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics', 'encounter-signed-note'],
    integrityInvariant: 'Un paquete que estaba en DRAFT vuelve en DRAFT. Restaurar NUNCA es una vía para liberarle al paciente un paquete que su médico no aprobó: el estado, `approvedAt`, `approvedBy` y `version` viajan juntos o el paquete queda para revisión.',
  },
  {
    dataClass: 'physicians',
    sourcePath: 'doctors',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'configuracion', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'Todo `medicoId` citado por una nota firmada existe en esta clase, o la nota queda con un autor que el consultorio destino no puede nombrar en el papel.',
  },
  {
    dataClass: 'waitlist',
    sourcePath: 'waitlist',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'libre', retentionClass: 'clinica', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Lista de espera. Restaurarla dos veces no duplica a nadie.',
  },
  {
    dataClass: 'notification-log',
    sourcePath: 'notification_logs',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'auditoria', containsPHI: true,
    referenceDependencies: ['patient-demographics'],
    integrityInvariant: 'Registro de lo que se le mandó al paciente. Append-only: restaurar no puede reescribir un acuse de entrega.',
  },
  {
    dataClass: 'dosing-validations',
    sourcePath: 'dosing_validations',
    systemOfRecord: 'firestore', mutable: false, signedOrImmutable: true,
    restoreAllowed: 'solo-si-falta', retentionClass: 'auditoria', containsPHI: false,
    referenceDependencies: ['physicians'],
    integrityInvariant: 'Firma del médico sobre una regla de dosificación. Es una declaración fechada: se conserva, no se sobrescribe.',
  },
  {
    dataClass: 'operational-telemetry',
    sourcePath: 'platform:errores|rate_limits|platform_csp',
    systemOfRecord: 'firestore', mutable: true, signedOrImmutable: false,
    restoreAllowed: 'nunca', retentionClass: 'operativa', containsPHI: false,
    referenceDependencies: [],
    integrityInvariant: 'Vive FUERA de `clinics/{id}` y tiene su propio barrido en `src/lib/ops/retencion.ts`. Ni entra al respaldo del consultorio ni se restaura con él.',
  },
]

export const INVENTARIO: ClaseDeDato[] = CRUDO.map(c => ({
  ...c,
  backupIncluded: derivarBackupIncluido(c.sourcePath),
}))

/** Índice por nombre de clase, para no recorrer la lista en cada consulta. */
export function claseDeDato(nombre: string): ClaseDeDato | undefined {
  return INVENTARIO.find(c => c.dataClass === nombre)
}

/** Las clases que caen sobre una ruta del respaldo (varias pueden compartirla). */
export function clasesDeLaRuta(sourcePath: string): ClaseDeDato[] {
  return INVENTARIO.filter(c => c.sourcePath === sourcePath)
}


/**
 * Rutas del respaldo que NO reciben clase de dato de lanzamiento, con su razón.
 *
 * Existe para que el guardián distinga «se me olvidó» de «se decidió». Casi
 * todas son Hospital/UCI, que está en ALPHA y fuera del alcance de #312: el
 * respaldo SÍ se las lleva —y por eso figuran aquí— pero su régimen de
 * restauración no se fija en esta ronda.
 *
 * Una ruta que salga de esta lista tiene que entrar en `INVENTARIO`. Al revés
 * también: si el manifiesto deja de respaldarla, esta entrada queda mintiendo y
 * el guardián lo dice.
 */
export const FUERA_DE_LA_RUTA_DE_LANZAMIENTO: Record<string, string> = {
  internamientos: 'Hospital/UCI en ALPHA (#320: se usa, no se vende). El respaldo se lo lleva; su régimen de restauración se fija cuando Hospital entre a la ruta de lanzamiento.',
  'internamientos.signos': 'Hospital/UCI en ALPHA. Serie de signos vitales del episodio hospitalario.',
  'internamientos.icu_stays': 'Hospital/UCI en ALPHA. Estancias de terapia intensiva.',
  'internamientos.icu_observations': 'Hospital/UCI en ALPHA. Observaciones de terapia intensiva.',
  'internamientos.handoff_revisiones': 'Hospital/UCI en ALPHA. Revisiones del pase de guardia.',
  'internamientos.bed_assignments': 'Hospital/UCI en ALPHA. Asignaciones de cama.',
  camas: 'Hospital/UCI en ALPHA. Censo de camas.',
  unidades: 'Hospital/UCI en ALPHA. Unidades y servicios del hospital.',
  laboratorio: 'Hospital/UCI en ALPHA. Órdenes de laboratorio del hospital (las del consultorio son `patients.laboratorios`).',
  hospital_roles: 'Hospital/UCI en ALPHA. Roles del personal hospitalario.',
  hospital_alertas: 'Hospital/UCI en ALPHA. Alertas clínicas del hospital.',
  tareas_clinicas: 'Hospital/UCI en ALPHA. Tareas clínicas pendientes del pase de guardia.',
  antimicrobial_limits: 'Hospital/UCI en ALPHA. Topes de antimicrobianos configurados para el PROA hospitalario.',
  farmacia: 'Módulo de farmacia, fuera de los dos caminos dorados de #320 (agenda y encuentro clínico). Se respalda; su régimen se fija cuando entre a la ruta de lanzamiento.',
  farmacia_movimientos: 'Ídem: movimientos de inventario de farmacia.',
  membership_plans: 'Planes de membresía del consultorio. Comercial, no clínico: su régimen se fija con el bloque de suscripciones.',
  memberships: 'Membresías de pacientes. Mismo bloque comercial.',
  branches: 'Multi-sucursal: el modelo existe y la API no acepta `branchId` todavía (ver `modulos-sin-conectar`). Clasificarlo ahora sería inventarle un régimen a algo que no está conectado.',
  reviews: 'Reseñas de pacientes. Contenido público del consultorio, no expediente.',
  whatsapp_no_entregados: 'Mensajes de WhatsApp que no se pudieron entregar. Operativo del canal, no expediente.',
  alertas_no_entregadas: 'Alertas clínicas que no se pudieron entregar. Operativo del canal.',
  whatsapp_optout: 'Bajas de WhatsApp. Es una preferencia del paciente con consecuencia legal (no volver a escribirle) y merece su clase; se declara aquí hasta que el bloque de mensajería la fije, porque restaurar un respaldo VIEJO encima podría resucitar un consentimiento retirado. Riesgo registrado en `docs/recovery/REGISTRO-DE-RIESGOS.md`.',
  chat: 'Mensajes internos del equipo del consultorio. No es expediente.',
  chat_reads: 'Marcas de lectura del chat interno.',
}

/**
 * Rutas que el manifiesto del respaldo conoce y este inventario NO clasifica
 * NI declara fuera de la ruta de lanzamiento.
 *
 * Es la mitad que se pudre sola: se añade una colección al respaldo, nadie
 * decide su régimen de restauración, y el día malo se escribe «libre» por
 * omisión sobre algo que era inmutable.
 */
export function rutasSinClasificar(): string[] {
  const clasificadas = new Set(INVENTARIO.map(c => c.sourcePath))
  return [...rutasRespaldadas()]
    .filter(r => !clasificadas.has(r) && !(r in FUERA_DE_LA_RUTA_DE_LANZAMIENTO))
    .sort()
}

/** Al revés: clases que dicen venir de una ruta que el respaldo no conoce. */
export function clasesConRutaFantasma(): string[] {
  const reales = rutasRespaldadas()
  return INVENTARIO
    .filter(c => c.systemOfRecord === 'firestore'
      && !c.sourcePath.includes(':')
      && !(c.sourcePath in EXCLUIDAS)
      && !reales.has(c.sourcePath))
    .map(c => c.dataClass)
    .sort()
}

export const POR_QUE_NO_TODO_ES_RESTAURABLE =
  'Una restauración que puede escribir sobre cualquier cosa es una herramienta ' +
  'de edición de documentos firmados con otro nombre. El SDK admin no evalúa ' +
  'las reglas de Firestore, así que la regla que hace inmutable una nota ' +
  'firmada NO se aplica por este camino: si el permiso no vive en este ' +
  'inventario y en el código que lo consulta, no vive en ninguna parte.'

/**
 * Entradas de `FUERA_DE_LA_RUTA_DE_LANZAMIENTO` que ya no corresponden a
 * ninguna ruta del respaldo. Una declaración que sobrevive a su ruta convierte
 * la lista en folclore.
 */
export function declaracionesFantasma(): string[] {
  const reales = rutasRespaldadas()
  return Object.keys(FUERA_DE_LA_RUTA_DE_LANZAMIENTO).filter(r => !reales.has(r)).sort()
}
