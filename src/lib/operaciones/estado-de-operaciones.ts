/**
 * QUÉ PIDE ATENCIÓN EN EL CONSULTORIO — el motor, sin pantalla.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * `/operaciones` contestaba UNA pregunta: «¿a dónde puedo ir?». Ocho grupos de
 * enlaces con su `para`, ordenados por cadencia. Es un índice honesto, y el
 * §29 lo dejó en 2.0 por eso mismo: un índice no dice nada del consultorio que
 * lo abre. La misma pantalla, con los mismos ocho grupos, se pinta idéntica en
 * un consultorio al día y en uno con cinco citas sin responder desde el jueves.
 *
 * Lo que falta no es adorno: es **estado**. §8 del encargo lo dice en siete
 * preguntas —qué pide atención · qué bloquea · quién responde · qué exige una
 * acción · qué está sano · qué se puede ignorar · dónde se actúa— y las siete
 * se contestan con datos que esta aplicación YA guarda.
 *
 * ── LAS TRES REGLAS QUE ESTE MÓDULO NO CRUZA ───────────────────────────────
 *
 * 1. **No se inventa una alerta, un incidente ni un indicador.** Cada línea
 *    sale de contar documentos que ya existen. Si un consultorio nuevo no tiene
 *    nada, la pantalla dice que no tiene nada — no se rellena con un panel de
 *    métricas vacías ni con «todo va bien» decorativo.
 *
 * 2. **No poder leer NO es estar sano.** Es la regla 4 de seguridad clínica
 *    («ausencia de dato no es dato de ausencia») aplicada a lo operativo: si la
 *    lectura de farmacia falla, la respuesta es `no-se-pudo-leer`, nunca
 *    `sin-novedad`. Un tablero que pinta verde cuando la consulta reventó es
 *    peor que no tener tablero, porque enseña a confiar en él.
 *
 * 3. **Aquí no se cierra nada.** Cada excepción dice DÓNDE se actúa y manda a
 *    la pantalla que tiene la autoridad —`/citas`, `/lista-espera`,
 *    `/farmacia`—, con su detalle delante. Es la misma línea que el diagnóstico
 *    §29 trazó para `/pacientes`: inspeccionar en el sitio, mutar donde manda.
 *
 * ── POR QUÉ ES UNA FUNCIÓN PURA ────────────────────────────────────────────
 *
 * Recibe lo ya leído y devuelve la lectura. Así los seis estados —excepción,
 * sin novedad, no aplica, no se pudo leer, y sus mezclas— se prueban sin
 * emuladores y sin navegador, y el guardián puede meterle el defecto y
 * comprobar que falla. Un motor de excepciones que sólo se puede probar
 * levantando Firestore acaba sin probarse.
 *
 * NO cubre: nada clínico. Los pendientes del paciente son de `/pendientes` y
 * de `tareas-clinicas/`, que ya los ordena y ya los sabe escalar; duplicarlos
 * aquí sería una segunda fuente de verdad de la misma entidad.
 */

/** Estados en los que puede quedar una comprobación. El orden importa. */
export type EstadoComprobacion =
  /** Hay algo esperando una decisión humana. */
  | 'excepcion'
  /** Se leyó, y no hay nada que atender. */
  | 'sin-novedad'
  /** Se leyó, y este consultorio no usa esto todavía. */
  | 'no-aplica'
  /** No se pudo leer. NUNCA se cuenta como sano. */
  | 'no-se-pudo-leer'

export interface Comprobacion {
  id: string
  /** Qué se comprobó, dicho como lo diría el médico. */
  titulo: string
  estado: EstadoComprobacion
  /** Cuántos elementos la disparan. 0 si no es una excepción. */
  cuantos: number
  /** La frase que explica la lectura. Nunca vacía. */
  detalle: string
  /** Quién responde. Sale del dato, no de una tabla de roles inventada. */
  quien: string
  /** La ruta con autoridad para actuar. Existe desde antes de este módulo. */
  destino: string
  destinoLabel: string
}

export interface EstadoDeOperaciones {
  comprobaciones: Comprobacion[]
  /** Las que piden atención, en el orden en que se pintan. */
  excepciones: Comprobacion[]
  /** Las que se leyeron y salieron limpias. */
  sanas: Comprobacion[]
  /** Las que no se pudieron leer. Se dicen aparte: no son ni una cosa ni otra. */
  ciegas: Comprobacion[]
  /** Las que no aplican a este consultorio. */
  noAplican: Comprobacion[]
}

/** Citas que siguen esperando una respuesta del consultorio. */
const ESTADOS_SIN_RESPONDER = new Set(['solicitada', 'pendiente-datos', 'pendiente-confirmar'])

export interface CitaLeida { estado: string; fechaHora: string }
export interface EsperaLeida { id: string }
export interface ItemFarmaciaLeido {
  nombre: string
  cantidad: number
  cantidadMinima?: number
  caducidad?: string
}

export interface EntradaOperaciones {
  /** `null` = la lectura falló. `[]` = se leyó y está vacío. La diferencia es el módulo entero. */
  citas: CitaLeida[] | null
  listaEspera: EsperaLeida[] | null
  farmacia: ItemFarmaciaLeido[] | null
  /** Hoy en `YYYY-MM-DD`, del reloj del CONSULTORIO. Se recibe: aquí no se lee ningún reloj. */
  hoyISO: string
}

/** Días dentro de los cuales una caducidad ya es cosa de esta semana. */
export const DIAS_CADUCIDAD_PROXIMA = 60

function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = Date.parse(desdeISO + 'T00:00:00Z')
  const b = Date.parse(hastaISO + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  return Math.round((b - a) / 86400000)
}

function ciega(id: string, titulo: string, destino: string, destinoLabel: string): Comprobacion {
  return {
    id, titulo, estado: 'no-se-pudo-leer', cuantos: 0,
    detalle: 'No se pudo leer. No quiere decir que esté todo bien: quiere decir que no se sabe.',
    quien: '—', destino, destinoLabel,
  }
}

function comprobarCitas(citas: CitaLeida[] | null, hoyISO: string): Comprobacion {
  const base = { id: 'citas', titulo: 'Citas sin responder', destino: '/citas', destinoLabel: 'Citas' }
  if (!citas) return ciega(base.id, base.titulo, base.destino, base.destinoLabel)

  // Sólo las de hoy en adelante: una cita de hace tres semanas que nadie
  // confirmó ya no es una decisión pendiente, es historia. Contarla haría que
  // el aviso creciera solo para siempre — y un contador que sólo sube se
  // aprende a ignorar, que es la forma más cara de no tener aviso.
  const abiertas = citas.filter(c =>
    ESTADOS_SIN_RESPONDER.has(c.estado) && (c.fechaHora ?? '').slice(0, 10) >= hoyISO)

  if (abiertas.length === 0) {
    return { ...base, estado: 'sin-novedad', cuantos: 0, quien: 'el consultorio',
      detalle: citas.length === 0
        ? 'No hay citas registradas de hoy en adelante.'
        : 'Todas las citas de hoy en adelante están respondidas.' }
  }
  const solicitadas = abiertas.filter(c => c.estado === 'solicitada').length
  const porConfirmar = abiertas.length - solicitadas
  const partes = [
    solicitadas ? `${solicitadas} pedida${solicitadas > 1 ? 's' : ''} por el paciente y sin responder` : '',
    porConfirmar ? `${porConfirmar} sin confirmar` : '',
  ].filter(Boolean)
  return {
    ...base, estado: 'excepcion', cuantos: abiertas.length, quien: 'el consultorio',
    detalle: `${partes.join(' · ')}. Cada una es una persona esperando respuesta.`,
  }
}

function comprobarEspera(espera: EsperaLeida[] | null): Comprobacion {
  const base = { id: 'lista-espera', titulo: 'Lista de espera', destino: '/lista-espera', destinoLabel: 'Lista de espera' }
  if (!espera) return ciega(base.id, base.titulo, base.destino, base.destinoLabel)
  if (espera.length === 0) {
    return { ...base, estado: 'sin-novedad', cuantos: 0, quien: 'el consultorio',
      detalle: 'Nadie está esperando un hueco.' }
  }
  return {
    ...base, estado: 'excepcion', cuantos: espera.length, quien: 'el consultorio',
    detalle: `${espera.length} ${espera.length > 1 ? 'personas esperan' : 'persona espera'} un hueco. Nadie les ha dado cita todavía.`,
  }
}

function comprobarFarmacia(items: ItemFarmaciaLeido[] | null, hoyISO: string): Comprobacion {
  const base = { id: 'farmacia', titulo: 'Existencias del consultorio', destino: '/farmacia', destinoLabel: 'Farmacia' }
  if (!items) return ciega(base.id, base.titulo, base.destino, base.destinoLabel)
  if (items.length === 0) {
    // Cero ítems NO es un inventario sano: es un inventario que nadie lleva.
    // Decirlo «sin novedad» afirmaría algo que no se comprobó.
    return { ...base, estado: 'no-aplica', cuantos: 0, quien: '—',
      detalle: 'No hay inventario registrado, así que no hay nada que vigilar.' }
  }

  const caducados = items.filter(i => i.caducidad && diasEntre(hoyISO, i.caducidad) < 0)
  const porCaducar = items.filter(i => {
    if (!i.caducidad) return false
    const d = diasEntre(hoyISO, i.caducidad)
    return d >= 0 && d <= DIAS_CADUCIDAD_PROXIMA
  })
  const bajos = items.filter(i =>
    typeof i.cantidadMinima === 'number' && i.cantidadMinima > 0 && i.cantidad <= i.cantidadMinima)

  const total = caducados.length + porCaducar.length + bajos.length
  if (total === 0) {
    return { ...base, estado: 'sin-novedad', cuantos: 0, quien: 'el consultorio',
      detalle: `${items.length} ${items.length > 1 ? 'insumos' : 'insumo'} en inventario: ninguno caducado, por caducar ni bajo mínimo.` }
  }

  const partes: string[] = []
  if (caducados.length) partes.push(`${caducados.length} caducado${caducados.length > 1 ? 's' : ''}`)
  if (porCaducar.length) partes.push(`${porCaducar.length} caduca${porCaducar.length > 1 ? 'n' : ''} en menos de ${DIAS_CADUCIDAD_PROXIMA} días`)
  if (bajos.length) partes.push(`${bajos.length} bajo mínimo`)
  // Se nombran hasta tres: un aviso que no dice CUÁL obliga a abrir la
  // pantalla para saber si importa, y entonces el aviso no ahorró nada.
  const nombres = [...caducados, ...porCaducar, ...bajos].slice(0, 3).map(i => i.nombre)
  return {
    ...base, estado: 'excepcion', cuantos: total, quien: 'el consultorio',
    detalle: `${partes.join(' · ')} — ${nombres.join(', ')}${total > nombres.length ? ` y ${total - nombres.length} más` : ''}.`,
  }
}

/**
 * Lee el estado operativo del consultorio a partir de lo ya leído.
 *
 * El orden de `excepciones` es el orden en que se pintan, y no es alfabético:
 * primero lo que tiene a una persona esperando (citas, lista de espera) y
 * después lo que tiene a un insumo esperando (farmacia).
 */
export function estadoDeOperaciones(e: EntradaOperaciones): EstadoDeOperaciones {
  const comprobaciones = [
    comprobarCitas(e.citas, e.hoyISO),
    comprobarEspera(e.listaEspera),
    comprobarFarmacia(e.farmacia, e.hoyISO),
  ]
  return {
    comprobaciones,
    excepciones: comprobaciones.filter(c => c.estado === 'excepcion'),
    sanas: comprobaciones.filter(c => c.estado === 'sin-novedad'),
    ciegas: comprobaciones.filter(c => c.estado === 'no-se-pudo-leer'),
    noAplican: comprobaciones.filter(c => c.estado === 'no-aplica'),
  }
}
