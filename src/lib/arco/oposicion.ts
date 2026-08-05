/**
 * LA «O» DE ARCO — QUÉ SE PUEDE CESAR DE VERDAD, Y QUÉ NO.
 *
 * ── EL HUECO, ENCONTRADO EL 4-AGO-2026 ───────────────────────────────────────
 *
 * La «A» y la «C» ya se ejecutan: el Acceso arma y entrega el expediente con
 * acuse (v946) y la Cancelación suprime o bloquea (v9xx). La **Oposición**
 * seguía resolviéndose con un `prompt()`: se guardaba un texto, la solicitud
 * pasaba a «resuelta», y **no se apagaba nada**.
 *
 * El paciente que ejercía su derecho por la vía formal —el portal, por escrito,
 * con su plazo de 20 días hábiles— seguía recibiendo recordatorios. El que
 * escribía «BAJA» por WhatsApp sí dejaba de recibirlos, porque ese camino sí
 * llama a `registrarBaja`. La vía legal correcta era la que no servía.
 *
 * ── POR QUÉ ESTE MÓDULO EXISTE APARTE DE LA RUTA ─────────────────────────────
 *
 * Porque la decisión de QUÉ se puede cesar automáticamente es la parte que hay
 * que poder discutir y probar sin levantar un servidor. La ruta ejecuta; aquí
 * se decide.
 *
 * ── LA DISTINCIÓN QUE IMPORTA ────────────────────────────────────────────────
 *
 * La oposición no es la cancelación. La cancelación pregunta «¿puedo borrar el
 * expediente?». La oposición pregunta «¿puedo dejar de usarlo PARA ESTO?» — y
 * el expediente sigue existiendo, porque la NOM-004 obliga a conservarlo.
 *
 * De todos los fines a los que un paciente puede oponerse, **sólo algunos están
 * automatizados en este sistema**. Los demás dependen de que una persona deje de
 * hacer algo, y prometer que el software los apagó sería mentir.
 *
 * Por eso cada fin declara si el sistema puede ejecutarlo o sólo registrarlo.
 * Un derecho ejercido a medias hay que declararlo — es la misma lección de la
 * Cancelación, donde tragar el fallo de la baja hacía que el médico leyera
 * «listo» mientras el paciente seguía recibiendo mensajes.
 *
 * NEEDS_LEGAL_REVIEW: qué fines son separables entre sí, y si la atención médica
 * puede oponerse sin darse de baja del consultorio, lo fija el abogado. Aquí
 * sólo se decide lo técnico: qué apaga el software y qué no.
 *
 * Módulo PURO.
 */

/** Los fines a los que un titular puede oponerse en un consultorio. */
export type FinOposicion =
  | 'contacto_proactivo'
  | 'mercadotecnia'
  | 'reactivacion'
  | 'encuestas'
  | 'compartir_terceros'

export interface DescripcionFin {
  /** Cómo se le nombra al médico y al titular. */
  etiqueta: string
  /**
   * ¿El sistema puede CESARLO, o sólo dejar constancia?
   *
   * `true` sólo cuando existe un candado real que el envío consulta. No basta
   * con guardar un campo que nadie mira: eso es registrar, no ejecutar.
   */
  ejecutable: boolean
  /** Qué ocurre exactamente al aceptarlo. Se le enseña al médico. */
  queOcurre: string
}

/**
 * EL CATÁLOGO. Lo que dice `ejecutable` es una afirmación sobre el código.
 *
 * `contacto_proactivo` es el único `true` hoy y no por comodidad: la baja de
 * WhatsApp se consulta POR TELÉFONO en cada envío proactivo
 * (`whatsapp-send.ts`), así que registrarla apaga los recordatorios, la
 * reactivación y las campañas de inmediato, sin esperar a que cada barrido
 * aprenda a mirar un campo nuevo.
 *
 * `reactivacion` y `encuestas` viajan por ese mismo canal, así que la baja los
 * cubre — se marcan ejecutables porque el mismo candado los detiene.
 *
 * `mercadotecnia` y `compartir_terceros` quedan en `false` a propósito: no hay
 * hoy un motor de campañas ni una salida a terceros que el software pueda
 * cerrar. Marcarlos `true` sería declarar apagado algo que ni siquiera existe;
 * si mañana existe, este archivo es el que hay que cambiar.
 */
export const FINES: Readonly<Record<FinOposicion, DescripcionFin>> = {
  contacto_proactivo: {
    etiqueta: 'Recordatorios y mensajes del consultorio',
    ejecutable: true,
    queOcurre: 'Se registra la baja del teléfono. Los recordatorios de cita, la reactivación y cualquier mensaje que inicie el consultorio dejan de salir de inmediato.',
  },
  reactivacion: {
    etiqueta: 'Invitaciones para volver a consulta',
    ejecutable: true,
    queOcurre: 'Viajan por el mismo canal que los recordatorios, así que la baja del teléfono también las detiene.',
  },
  encuestas: {
    etiqueta: 'Encuestas de satisfacción',
    ejecutable: true,
    queOcurre: 'Viajan por el mismo canal, así que la baja del teléfono también las detiene.',
  },
  mercadotecnia: {
    etiqueta: 'Promociones y publicidad',
    ejecutable: false,
    queOcurre: 'Queda registrado en el expediente y en la bitácora. No hay hoy un motor de campañas que el sistema pueda apagar: si el consultorio usa uno aparte, hay que darlo de baja ahí.',
  },
  compartir_terceros: {
    etiqueta: 'Compartir mis datos con terceros',
    ejecutable: false,
    queOcurre: 'Queda registrado en el expediente y en la bitácora. No hay hoy una salida automática de datos a terceros que el sistema pueda cerrar; cualquier envío es una acción de una persona.',
  },
} as const

export const TODOS_LOS_FINES = Object.keys(FINES) as FinOposicion[]

export interface PlanDeOposicion {
  /** Los fines pedidos, ya limpios y sin repetir. */
  fines: FinOposicion[]
  /** ¿Hay que registrar la baja del teléfono? */
  requiereBajaContacto: boolean
  /** Fines que el sistema apaga de verdad. */
  ejecutables: FinOposicion[]
  /** Fines que sólo quedan registrados. Se le DICEN al médico. */
  soloRegistrados: FinOposicion[]
  /** Frases listas para enseñar, una por fin no ejecutable. */
  avisos: string[]
}

/**
 * Decide qué hacer con una solicitud de oposición.
 *
 * Sin fines declarados se asume el contacto proactivo: es lo que pide el
 * paciente en la inmensa mayoría de los casos («que ya no me manden mensajes»),
 * y el formulario público es texto libre. Asumir el más protector para el
 * titular es la lectura correcta cuando la solicitud no distingue — y, a
 * diferencia de la cancelación, aquí ningún camino es irreversible: una
 * oposición se puede revertir dando de alta otra vez.
 */
export function planDeOposicion(finesPedidos: readonly string[] | undefined): PlanDeOposicion {
  const limpios = (finesPedidos ?? [])
    .map(f => String(f ?? '').trim())
    .filter((f): f is FinOposicion => (TODOS_LOS_FINES as string[]).includes(f))

  const fines = limpios.length ? [...new Set(limpios)] : (['contacto_proactivo'] as FinOposicion[])
  const ejecutables = fines.filter(f => FINES[f].ejecutable)
  const soloRegistrados = fines.filter(f => !FINES[f].ejecutable)

  return {
    fines,
    requiereBajaContacto: ejecutables.length > 0,
    ejecutables,
    soloRegistrados,
    avisos: soloRegistrados.map(f => `«${FINES[f].etiqueta}»: ${FINES[f].queOcurre}`),
  }
}

/** La marca que queda en el expediente. Acumula: oponerse a X no borra la Y previa. */
export function marcaDeOposicion(args: {
  ahoraMs: number
  uid: string
  solicitudId?: string
  fines: readonly FinOposicion[]
  previos?: readonly string[]
}): { fines: FinOposicion[]; fecha: string; porUid: string; solicitudId: string } {
  const previos = (args.previos ?? []).filter((f): f is FinOposicion =>
    (TODOS_LOS_FINES as string[]).includes(String(f)))
  return {
    fines: [...new Set([...previos, ...args.fines])],
    fecha: new Date(args.ahoraMs).toISOString(),
    porUid: args.uid,
    solicitudId: args.solicitudId ?? '',
  }
}

export const POR_QUE_NO_TODO_ES_EJECUTABLE =
  'De los fines a los que un titular puede oponerse, sólo se marcan ejecutables ' +
  'los que tienen un candado real que el envío consulta. Declarar apagado un fin ' +
  'que ningún código apaga le haría leer «listo» al médico mientras el paciente ' +
  'sigue recibiendo lo mismo. Es la lección de la Cancelación, donde tragar el ' +
  'fallo de la baja producía exactamente ese engaño.'
