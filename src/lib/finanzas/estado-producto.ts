/**
 * ESTADO DE CADA PRODUCTO — qué se puede vender y qué todavía no.
 *
 * Master Loop V3 §BJ. Y el P1-3 de la auditoría: hoy **nada distingue un módulo
 * terminado de uno experimental**, así que UCI y Hospital son vendibles en
 * cuanto alguien cambie un plan — justo lo que §BH prohíbe.
 *
 * ── POR QUÉ ESTO NO ES UNA BANDERA MÁS ───────────────────────────────────────
 *
 * La diferencia entre «el fundador puede usar UCI» y «un cliente puede comprar
 * UCI» no es de permisos: es de **promesa**. Cuando alguien paga por un módulo,
 * la aplicación afirma que ese módulo está terminado. Vender UCI hoy sería
 * cobrar por algo que se está construyendo, y ninguna cantidad de letra pequeña
 * arregla eso.
 *
 * Por eso el estado y el permiso son dos cosas separadas (§BM):
 *
 *   · `estado` — qué tan terminado está el producto. Decide si se VENDE.
 *   · `entitlement` — qué puede USAR esta cuenta. Decide si se MUESTRA.
 *
 * El fundador tiene lo segundo sin lo primero: usa UCI todos los días
 * precisamente para terminarlo (§CC, dogfooding), y eso no lo pone a la venta.
 *
 * Módulo PURO.
 */

/** Estados de §BJ, del menos al más maduro. */
export const ESTADOS = [
  'INTERNAL', 'ALPHA', 'BETA', 'EARLY_ACCESS', 'PUBLIC', 'PAUSED', 'DEPRECATED',
] as const
export type EstadoProducto = (typeof ESTADOS)[number]

export interface Producto {
  clave: string
  nombre: string
  estado: EstadoProducto
  /**
   * ¿Se puede comprar públicamente?
   *
   * Es un campo APARTE del estado a propósito: §CF exige aprobación explícita
   * (clinical_go · technical_go · security_go · financial_go · product_go), y un
   * producto puede estar en EARLY_ACCESS sin estar a la venta todavía.
   */
  compraPublica: boolean
  /** Por qué está donde está. Se lee en el tablero de producto (§CE). */
  porQue: string
}

/**
 * Estado actual, 30-jul-2026.
 *
 * Agenda y Consulta llevan meses en manos del Dr. UCI y Hospital se están
 * construyendo esta misma semana: hoy se le arreglaron cuatro fallos de captura,
 * la nota se rediseñó tres veces y el Copilot no daba síntesis con el panel
 * lleno. Eso es ALPHA, se mire como se mire.
 */
export const PRODUCTOS: readonly Producto[] = [
  { clave: 'free', nombre: 'Free', estado: 'PUBLIC', compraPublica: true,
    porQue: 'Entrada controlada. No genera COGS significativo.' },
  { clave: 'agenda', nombre: 'Agenda', estado: 'PUBLIC', compraPublica: true,
    porQue: 'En uso real y estable.' },
  { clave: 'consulta', nombre: 'Consulta', estado: 'PUBLIC', compraPublica: true,
    porQue: 'En uso real. Es el producto que tiene que sostener la primera etapa.' },
  { clave: 'hospital', nombre: 'Hospital', estado: 'ALPHA', compraPublica: false,
    porQue: 'Los flujos de ingreso, conciliación, handoff y egreso no están validados (§BP).' },
  { clave: 'uci', nombre: 'UCI', estado: 'ALPHA', compraPublica: false,
    porQue: 'Se está construyendo. El 30-jul se repararon cuatro fallos de captura del pase, '
      + 'la nota se rediseñó y el Copilot no sintetizaba con el panel lleno. §BQ pide un umbral mayor.' },
  { clave: 'acute', nombre: 'Acute Care', estado: 'INTERNAL', compraPublica: false,
    porQue: 'Depende de Hospital y UCI (§BW).' },
  { clave: 'complete', nombre: 'Complete', estado: 'INTERNAL', compraPublica: false,
    porQue: 'No se vende Agenda + Consulta + Hospital + UCI mientras dos de los cuatro estén en desarrollo (§BV).' },
  { clave: 'enterprise', nombre: 'Enterprise', estado: 'INTERNAL', compraPublica: false,
    porQue: 'Sin modelo de contrato ni SLA definidos.' },
]

const porClave = new Map(PRODUCTOS.map(p => [p.clave, p]))

export function productoDe(clave: string): Producto | null {
  return porClave.get(clave.trim().toLowerCase()) ?? null
}

/**
 * ¿Se puede vender este producto AHORA MISMO?
 *
 * Se exigen las dos cosas: estado suficiente Y aprobación explícita de compra.
 * Un solo campo permitiría poner a la venta algo por descuido al madurar su
 * estado, y ésta es una decisión comercial que alguien toma, no un efecto
 * secundario.
 */
export function sePuedeVender(clave: string): boolean {
  const p = productoDe(clave)
  if (!p) return false
  return p.compraPublica && (p.estado === 'PUBLIC' || p.estado === 'EARLY_ACCESS')
}

/** Lo que se muestra en la página de precios (§BT). */
export function productosALaVenta(): Producto[] {
  return PRODUCTOS.filter(p => sePuedeVender(p.clave))
}

/**
 * Motivo por el que un producto no se vende. Para el tablero interno, no para
 * el cliente: al cliente sencillamente no se le enseña (§D, «no llenar la
 * interfaz de candados»).
 */
export function porQueNoSeVende(clave: string): string | null {
  const p = productoDe(clave)
  if (!p) return 'No existe ese producto.'
  if (sePuedeVender(clave)) return null
  // El estado va SIEMPRE en el motivo: saber que la compra está desactivada no
  // dice nada útil sin saber qué tan terminado está el producto.
  return p.compraPublica
    ? `Estado ${p.estado}. ${p.porQue}`
    : `Estado ${p.estado}, compra pública desactivada. ${p.porQue}`
}

/* ════════════════════════════════════════════════════════════════════════
   Del plan comercial al producto (§BT)
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Qué módulos entrega cada plan de `planes-ia.ts`.
 *
 * Sin este puente el estado de producto sería un adorno: los estados viven aquí
 * pero lo que se cobra son PLANES, y hoy el plan «Hospital + UCI» ($3,499)
 * entrega dos módulos en ALPHA. La página de precios ya no lo enseña, pero
 * `/api/stripe/checkout` acepta cualquier `PlanKey` que le manden — esconder una
 * tarjeta no cierra una ruta HTTP.
 */
export const PRODUCTOS_DEL_PLAN: Record<string, readonly string[]> = {
  agenda: ['agenda'],
  clinica: ['agenda', 'consulta'],
  premium: ['agenda', 'consulta'],
  hospital: ['agenda', 'consulta', 'hospital', 'uci'],
}

/**
 * ¿Se puede cobrar este plan?
 *
 * Basta con que UN módulo del paquete no esté listo. Un plan es una promesa
 * única: quien paga «Hospital + UCI» no está comprando cuatro cosas por
 * separado, y no se le puede entregar tres terminadas y una en obra.
 */
export function planSeVende(plan: string): boolean {
  const ps = PRODUCTOS_DEL_PLAN[plan.trim().toLowerCase()]
  if (!ps || ps.length === 0) return false
  return ps.every(sePuedeVender)
}

/** Qué módulos del plan son los que lo frenan. Para el mensaje de error y el tablero. */
export function loQueFrena(plan: string): string[] {
  const ps = PRODUCTOS_DEL_PLAN[plan.trim().toLowerCase()] ?? []
  return ps.filter(c => !sePuedeVender(c))
}

/* ════════════════════════════════════════════════════════════════════════
   Acceso del fundador (§BK–BN)
   ════════════════════════════════════════════════════════════════════════ */

/**
 * El fundador ve TODO, esté o no lanzado — y sin suscripción de por medio.
 *
 * §BK es explícito: «el acceso del fundador NO debe depender de una suscripción
 * de pago. No crear suscripciones falsas para habilitar módulos al fundador».
 *
 * Hoy eso se resuelve con `paseLibre: boolean` en el documento de la clínica,
 * que funciona pero dice la cosa equivocada: describe a un cliente con todo
 * desbloqueado, no al dueño del sistema. Esta función nombra la diferencia; el
 * cableado con `modulos.ts` es la unidad siguiente.
 */
export function accesoDeFundador(): string[] {
  return PRODUCTOS.map(p => p.clave)
}

/**
 * ¿Qué le toca ver a esta cuenta?
 *
 * @param comprados los productos de su suscripción.
 * @param esFundador si es el dueño del sistema.
 */
export function visiblesPara(comprados: readonly string[], esFundador: boolean): Producto[] {
  if (esFundador) return [...PRODUCTOS]
  // Al cliente NO se le enseñan los módulos que no compró: §D pide que la
  // interfaz no se llene de candados. El upsell se muestra cuando viene a
  // cuento, no como decorado permanente.
  return PRODUCTOS.filter(p => comprados.includes(p.clave))
}

/** Etiqueta para el fundador, que sí necesita ver en qué estado anda cada cosa. */
export function etiquetaInterna(p: Producto): string {
  return p.estado === 'PUBLIC' ? '' : p.estado
}

export const POR_QUE_ESTADO_Y_PERMISO_SON_DISTINTOS =
  'Que el fundador pueda usar UCI y que un cliente pueda comprarla no es la misma ' +
  'pregunta. Cuando alguien paga por un módulo, la aplicación afirma que ese ' +
  'módulo está terminado; vender UCI hoy sería cobrar por algo que se está ' +
  'construyendo. El estado decide si se VENDE; el entitlement decide si se ' +
  'MUESTRA. El fundador tiene lo segundo sin lo primero, y lo usa a diario ' +
  'precisamente para terminarlo.'
