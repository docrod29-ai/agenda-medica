/**
 * QUÉ ES CAMINO CALIENTE Y QUÉ NO — la frontera que decide si algo puede
 * congelar una consulta.
 *
 * ── POR QUÉ ESTE MÓDULO EXISTE ───────────────────────────────────────────────
 *
 * El contrato de lanzamiento (#310, #320 Gate 3) dice que «trabajo secundario
 * pesado nunca debe congelar la escritura de la nota». Esa frase sólo se puede
 * hacer cumplir si existe UNA lista, en un solo sitio, de qué trabajo es de qué
 * clase. Sin ella cada módulo decide por su cuenta y la regla se cumple en cinco
 * sitios de seis — que es exactamente como se pierde una consulta.
 *
 * Aquí no se ejecuta nada. Se DECLARA:
 *
 *   · qué operaciones son interactivas (el médico está esperando delante del
 *     paciente) y por tanto no pueden depender de un proveedor externo;
 *   · qué operaciones son asíncronas (pueden tardar, encolarse y reintentarse);
 *   · el presupuesto de cada una: tiempo máximo, reintentos máximos y si su
 *     fallo puede bloquear el camino clínico.
 *
 * ── LO QUE ESTE MÓDULO **NO** HACE ───────────────────────────────────────────
 *
 * No mide, no promete y no demuestra capacidad. Los números de `tiempoMaximoMs`
 * son PRESUPUESTOS DE DISEÑO —el techo que la operación no debe cruzar— y NO
 * son SLO medidos ni umbrales aprobados. El contrato SLO/SLI vive aparte, en
 * `docs/reliability/SLO-SLI-CONTRACT.md`, con su separación explícita entre
 * TARGET y OBSERVED. Confundir un presupuesto con una medición sería declarar
 * capacidad sin evidencia, que es justo lo que #310 prohíbe.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore.
 */

/**
 * Las operaciones del camino caliente: el médico (o la asistente) está delante
 * de la pantalla esperando el resultado.
 *
 * El prefijo no es decorativo — `esCaminoCaliente()` lo usa, y así una clase
 * nueva no puede olvidarse de declarar de qué lado está.
 */
export type ClaseCaliente =
  | 'hot:abrir-paciente'
  | 'hot:abrir-encuentro'
  | 'hot:guardar-borrador'
  | 'hot:reanudar-borrador'
  | 'hot:editar-nota'
  | 'hot:buscar-paciente'
  | 'hot:agendar-cita'
  | 'hot:firmar-nota'

/**
 * El trabajo que puede esperar. Puede encolarse, reintentarse y llegar tarde
 * sin que la consulta se entere.
 */
export type ClaseAsincrona =
  | 'async:transcripcion'
  | 'async:razonamiento'
  | 'async:evidencia'
  | 'async:documento'
  | 'async:notificacion'
  | 'async:whatsapp'
  | 'async:analitica'

export type ClaseDeTrabajo = ClaseCaliente | ClaseAsincrona

/** Presupuesto de diseño de una clase de trabajo. NO es un SLO medido. */
export interface PresupuestoDeClase {
  clase: ClaseDeTrabajo
  /**
   * Techo de diseño en milisegundos. Cruzarlo es un defecto de arquitectura,
   * no un caso raro: significa que alguien metió una espera larga donde el
   * médico está mirando.
   */
  tiempoMaximoMs: number
  /**
   * Cuántos reintentos como MÁXIMO. Cero significa «no se reintenta»: en el
   * camino caliente un reintento silencioso es tiempo de pantalla parada, y
   * además duplica el riesgo de una acción consecuencial repetida.
   */
  reintentosMaximos: number
  /**
   * ¿El fallo de esta operación puede bloquear legítimamente al médico?
   *
   * Sólo puede ser `true` cuando seguir sin ella sería inseguro (firmar una
   * nota, por ejemplo). Para todo lo demás la respuesta es `false` y el
   * producto debe degradar, no bloquear.
   */
  puedeBloquearAlMedico: boolean
  /** Por qué está en esta clase. Se lee en las revisiones; no es adorno. */
  porQue: string
}

/**
 * EL CATÁLOGO. Una clase que no esté aquí no tiene presupuesto, y
 * `presupuestoDe()` lo dice en voz alta en vez de inventar un número.
 */
export const PRESUPUESTOS: Readonly<Record<ClaseDeTrabajo, PresupuestoDeClase>> = {
  'hot:abrir-paciente': {
    clase: 'hot:abrir-paciente',
    tiempoMaximoMs: 1_500,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: false,
    porQue: 'Abrir el expediente es lectura acotada; si tarda, la consulta ya empezó mal.',
  },
  'hot:abrir-encuentro': {
    clase: 'hot:abrir-encuentro',
    tiempoMaximoMs: 1_500,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: false,
    porQue: 'El encuentro se abre con lo que ya está en el expediente; nada de IA aquí.',
  },
  'hot:guardar-borrador': {
    clase: 'hot:guardar-borrador',
    tiempoMaximoMs: 3_000,
    reintentosMaximos: 2,
    puedeBloquearAlMedico: false,
    porQue: 'Durabilidad por encima de latencia, pero nunca bloqueando la escritura: el respaldo local es la red debajo.',
  },
  'hot:reanudar-borrador': {
    clase: 'hot:reanudar-borrador',
    tiempoMaximoMs: 2_000,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: false,
    porQue: 'Recuperar tras recarga o reconexión; el estado de recuperación debe ser visible, no instantáneo.',
  },
  'hot:editar-nota': {
    clase: 'hot:editar-nota',
    tiempoMaximoMs: 100,
    reintentosMaximos: 0,
    puedeBloquearAlMedico: false,
    porQue: 'Es teclado. Cualquier espera de red en esta clase es un defecto por definición.',
  },
  'hot:buscar-paciente': {
    clase: 'hot:buscar-paciente',
    tiempoMaximoMs: 1_000,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: false,
    porQue: 'La asistente busca con el paciente al teléfono; la búsqueda debe ser indexada y acotada.',
  },
  'hot:agendar-cita': {
    clase: 'hot:agendar-cita',
    tiempoMaximoMs: 3_000,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: false,
    porQue: 'Escritura consecuencial y transaccional: un reintento sin llave de idempotencia duplicaría una cita.',
  },
  'hot:firmar-nota': {
    clase: 'hot:firmar-nota',
    tiempoMaximoMs: 5_000,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: true,
    porQue: 'Firmar es un acto medicolegal: si no se puede sellar, NO se dice que se firmó. Éste es el único bloqueo legítimo del camino caliente.',
  },
  'async:transcripcion': {
    clase: 'async:transcripcion',
    tiempoMaximoMs: 120_000,
    reintentosMaximos: 3,
    puedeBloquearAlMedico: false,
    porQue: 'Lo ya capturado se conserva; el texto puede llegar tarde. La entrada escrita sigue disponible mientras tanto.',
  },
  'async:razonamiento': {
    clase: 'async:razonamiento',
    tiempoMaximoMs: 120_000,
    reintentosMaximos: 2,
    puedeBloquearAlMedico: false,
    porQue: 'Sugerir no es decidir. Si el razonamiento no llega, la nota se escribe igual.',
  },
  'async:evidencia': {
    clase: 'async:evidencia',
    tiempoMaximoMs: 60_000,
    reintentosMaximos: 2,
    puedeBloquearAlMedico: false,
    porQue: 'Sin evidencia se dice «evidencia no disponible». Nunca se inventa una cita bibliográfica para rellenar.',
  },
  'async:documento': {
    clase: 'async:documento',
    tiempoMaximoMs: 60_000,
    reintentosMaximos: 3,
    puedeBloquearAlMedico: false,
    porQue: 'Generar el PDF puede reintentarse; la nota firmada ya es la fuente de verdad.',
  },
  'async:notificacion': {
    clase: 'async:notificacion',
    tiempoMaximoMs: 30_000,
    reintentosMaximos: 5,
    puedeBloquearAlMedico: false,
    porQue: 'Un aviso que no sale NO revierte la cita que sí quedó bien agendada.',
  },
  'async:whatsapp': {
    clase: 'async:whatsapp',
    tiempoMaximoMs: 10_000,
    reintentosMaximos: 5,
    puedeBloquearAlMedico: false,
    porQue: 'La cita canónica vive en Firestore, no en el mensaje. WhatsApp caído no cambia la agenda.',
  },
  'async:analitica': {
    clase: 'async:analitica',
    tiempoMaximoMs: 30_000,
    reintentosMaximos: 1,
    puedeBloquearAlMedico: false,
    porQue: 'Medir es útil; perder una métrica no es un incidente clínico. Nunca se reintenta agresivamente.',
  },
}

/** ¿Es una operación con el médico esperando delante? */
export function esCaminoCaliente(clase: ClaseDeTrabajo): clase is ClaseCaliente {
  return clase.startsWith('hot:')
}

/**
 * El presupuesto de una clase.
 *
 * @throws si la clase no está declarada. Es deliberado: devolver un valor por
 *   defecto convertiría un olvido en un techo inventado, y un techo inventado
 *   es exactamente la clase de cifra que #310 prohíbe.
 */
export function presupuestoDe(clase: ClaseDeTrabajo): PresupuestoDeClase {
  const p = PRESUPUESTOS[clase]
  if (!p) throw new Error(`Clase de trabajo sin presupuesto declarado: ${clase}`)
  return p
}

/**
 * INVARIANTE DE ARQUITECTURA: ninguna clase asíncrona puede bloquear al médico.
 *
 * Se expone como función —y no sólo como comentario— para que una prueba pueda
 * recorrer el catálogo entero y fallar el día que alguien marque
 * `puedeBloquearAlMedico: true` en una cola de notificaciones.
 */
export function clasesQueViolanLaFrontera(): ClaseDeTrabajo[] {
  return (Object.keys(PRESUPUESTOS) as ClaseDeTrabajo[])
    .filter(c => !esCaminoCaliente(c) && PRESUPUESTOS[c].puedeBloquearAlMedico)
}
