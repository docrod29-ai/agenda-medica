/**
 * LAS CUENTAS. Sin esto, «importación completa» es una opinión.
 *
 * ── POR QUÉ ES EL MÓDULO MÁS IMPORTANTE DE LA MIGRACIÓN ──────────────────────
 *
 * El importador anterior terminaba diciendo `{ creados, duplicados, errores }` y
 * el médico leía «listo». Ninguno de esos tres números se comparaba con cuántas
 * filas traía el archivo. Si el parser se comía 300 filas por una comilla mal
 * cerrada, el informe decía «1 700 creados» con la misma cara de éxito que si
 * hubieran entrado las 2 000.
 *
 * Un dato perdido en silencio es el peor fallo posible aquí, porque **se lee
 * como un trabajo bien hecho**. Nadie va a contar cincuenta mil filas a mano
 * para descubrirlo; se descubre meses después, cuando falta un paciente.
 *
 * ── LA IDENTIDAD QUE TIENE QUE CUADRAR ───────────────────────────────────────
 *
 *     sourceRecords = accepted + rejected + duplicates + ambiguous + quarantined
 *
 * Los cinco cubos de `DESTINOS` son mutuamente excluyentes y exhaustivos: toda
 * fila del archivo cae en uno y sólo en uno. Si la suma no da, **la importación
 * NO está completa** — y eso no es un aviso, es un estado (`PARTIAL`).
 *
 * ── LOS ADJUNTOS SE CUENTAN APARTE ───────────────────────────────────────────
 *
 * Y a propósito. Un paciente puede traer cero documentos o quince, así que
 * meterlos en la misma cuenta que las filas hace que ninguna de las dos cuadre
 * nunca y que la comprobación deje de servir. Dos contabilidades separadas, cada
 * una con su propia identidad.
 *
 * Módulo PURO.
 */
import { DESTINOS, type Destino, type Razon, type Veredicto } from './contrato'

/* ═══════════════════════ EL CONTEO ═══════════════════════ */

export type ConteoPorDestino = Readonly<Record<Destino, number>>

export interface Cuentas {
  /** Filas de datos que traía el archivo. NO incluye el encabezado. */
  readonly sourceRecords: number
  readonly porDestino: ConteoPorDestino
  /** Cuántas veces salió cada razón. Una fila puede tener varias. */
  readonly porRazon: Readonly<Record<string, number>>
}

const CERO: ConteoPorDestino = {
  accepted: 0, rejected: 0, duplicate: 0, ambiguous: 0, quarantined: 0,
}

/**
 * LA CONTABILIDAD, VEREDICTO A VEREDICTO.
 *
 * ── POR QUÉ UN ACUMULADOR Y NO UN ARREGLO DE VEREDICTOS ──────────────────────
 *
 * Un `Veredicto` por fila son cincuenta mil objetos vivos a la vez sólo para
 * sumarlos al final. El ensayo lee el archivo por trozos justamente para no
 * sostener nada de tamaño N; guardar la lista de veredictos para contarla
 * después volvería a hacerlo, y encima en el módulo que existe para vigilar que
 * no se pierda nada.
 *
 * Aquí sólo viven cinco contadores y un contador por razón: estado ACOTADO, del
 * tamaño del vocabulario del contrato y no del tamaño del archivo.
 *
 * `contar()` se construye encima para que haya una sola definición de la suma.
 */
export class ContadorDeVeredictos {
  private readonly porDestino: Record<Destino, number> = { ...CERO }
  private readonly porRazon: Record<string, number> = {}

  sumar(v: Veredicto): void {
    this.porDestino[v.destino]++
    for (const r of v.razones) this.porRazon[r] = (this.porRazon[r] ?? 0) + 1
  }

  /**
   * Cierra la cuenta contra el total de filas del archivo.
   *
   * `sourceRecords` entra AQUÍ y no se deduce de cuántos veredictos se sumaron:
   * si se dedujera, la cuenta cuadraría siempre por construcción y no
   * comprobaría nada. Tiene que venir de quien contó las filas del archivo, para
   * que las dos fuentes puedan discrepar y se note.
   */
  cerrar(sourceRecords: number): Cuentas {
    return { sourceRecords, porDestino: { ...this.porDestino }, porRazon: { ...this.porRazon } }
  }
}

/** Suma los veredictos de golpe. Para quien ya los tiene todos delante. */
export function contar(sourceRecords: number, veredictos: readonly Veredicto[]): Cuentas {
  const c = new ContadorDeVeredictos()
  for (const v of veredictos) c.sumar(v)
  return c.cerrar(sourceRecords)
}

/** Suma de los cinco cubos. */
export function totalClasificado(c: Cuentas): number {
  return DESTINOS.reduce((s, d) => s + c.porDestino[d], 0)
}

/* ═══════════════════════ ADJUNTOS ═══════════════════════ */

export interface CuentasAdjuntos {
  /** Documentos que el manifiesto del archivo declaraba. */
  readonly declarados: number
  readonly subidos: number
  readonly fallidos: number
  /** Declarados pero que no venían en el paquete. */
  readonly ausentes: number
  /** Vinieron, pero su checksum no coincide con el declarado. */
  readonly corruptos: number
}

export const SIN_ADJUNTOS: CuentasAdjuntos = {
  declarados: 0, subidos: 0, fallidos: 0, ausentes: 0, corruptos: 0,
}

export function adjuntosCuadran(a: CuentasAdjuntos): boolean {
  return a.declarados === a.subidos + a.fallidos + a.ausentes + a.corruptos
}

/* ═══════════════════════ EL VEREDICTO ═══════════════════════ */

export type EstadoReconciliacion = 'COMPLETED' | 'PARTIAL'

export interface Reconciliacion {
  readonly estado: EstadoReconciliacion
  readonly cuentas: Cuentas
  readonly adjuntos: CuentasAdjuntos
  /** `sourceRecords - totalClasificado`. Positivo = filas perdidas. */
  readonly descuadre: number
  readonly descuadreAdjuntos: number
  /**
   * Por qué no está completa. Vacío si lo está.
   *
   * En español y explícito: «faltan 37 filas por clasificar» le dice a alguien
   * qué buscar; «reconciliación fallida» no.
   */
  readonly problemas: readonly string[]
}

/**
 * ¿Terminó bien esta importación?
 *
 * `COMPLETED` exige las DOS contabilidades cuadradas. Que las filas cuadren y
 * los documentos no es una importación a medias, y llamarla completa es
 * exactamente la mentira que este módulo existe para impedir.
 *
 * Fíjate en lo que NO impide estar completa: filas rechazadas, duplicadas o en
 * cuarentena. Una importación con 300 filas en cuarentena está COMPLETA — se
 * procesaron las 2 000 y se sabe dónde está cada una. Lo que rompe la
 * completitud es que una fila no esté en ninguna parte.
 */
export function reconciliar(
  cuentas: Cuentas,
  adjuntos: CuentasAdjuntos = SIN_ADJUNTOS,
): Reconciliacion {
  const descuadre = cuentas.sourceRecords - totalClasificado(cuentas)
  const descuadreAdjuntos =
    adjuntos.declarados - (adjuntos.subidos + adjuntos.fallidos + adjuntos.ausentes + adjuntos.corruptos)
  const problemas: string[] = []

  if (descuadre > 0) {
    problemas.push(
      `Faltan ${descuadre} filas por clasificar: el archivo traía ${cuentas.sourceRecords} y sólo se sabe dónde acabaron ${totalClasificado(cuentas)}.`,
    )
  } else if (descuadre < 0) {
    /**
     * Sobran clasificaciones. Suena imposible y no lo es: pasa cuando una fila
     * se procesa dos veces por un reintento que no respetó la llave idempotente.
     * Es más grave que faltar, porque significa que algo se escribió dos veces.
     */
    problemas.push(
      `Sobran ${-descuadre} clasificaciones sobre ${cuentas.sourceRecords} filas de origen: alguna fila se procesó más de una vez.`,
    )
  }

  if (descuadreAdjuntos !== 0) {
    problemas.push(
      `Los documentos no cuadran: ${adjuntos.declarados} declarados contra ${adjuntos.declarados - descuadreAdjuntos} con desenlace conocido.`,
    )
  }
  if (adjuntos.corruptos > 0) {
    problemas.push(`${adjuntos.corruptos} documentos llegaron con un checksum distinto al declarado.`)
  }

  return {
    estado: problemas.length === 0 ? 'COMPLETED' : 'PARTIAL',
    cuentas, adjuntos, descuadre, descuadreAdjuntos, problemas,
  }
}

/* ═══════════════════════ LOS DOS INFORMES ═══════════════════════ */

/**
 * El informe para MÁQUINAS. Se guarda, se compara y se vuelve a leer.
 *
 * Sin PHI: sólo conteos, códigos y huellas. Es lo que permite que este informe
 * viva en la bitácora y se pueda mandar a soporte sin mandar el expediente de
 * nadie.
 */
export interface InformeJson {
  readonly version: 1
  readonly importJobId: string
  readonly clinicId: string
  readonly sourceFileHash: string
  readonly mappingVersion: string
  readonly estado: EstadoReconciliacion
  readonly cuentas: Cuentas
  readonly adjuntos: CuentasAdjuntos
  readonly descuadre: number
  readonly problemas: readonly string[]
  readonly generadoEn: string
}

export function informeJson(args: {
  readonly importJobId: string
  readonly clinicId: string
  readonly sourceFileHash: string
  readonly mappingVersion: string
  readonly reconciliacion: Reconciliacion
  readonly generadoEn: string
}): InformeJson {
  const r = args.reconciliacion
  return {
    version: 1,
    importJobId: args.importJobId,
    clinicId: args.clinicId,
    sourceFileHash: args.sourceFileHash,
    mappingVersion: args.mappingVersion,
    estado: r.estado,
    cuentas: r.cuentas,
    adjuntos: r.adjuntos,
    descuadre: r.descuadre,
    problemas: r.problemas,
    generadoEn: args.generadoEn,
  }
}

/** El español de cada cubo. Se pinta tal cual. */
const DESTINO_TEXTO: Readonly<Record<Destino, string>> = {
  accepted: 'Importados',
  rejected: 'Rechazados',
  duplicate: 'Ya los tenías',
  ambiguous: 'Se parecen a alguien (los tienes que mirar)',
  quarantined: 'En cuarentena (los tienes que mirar)',
}

/**
 * El informe para PERSONAS.
 *
 * Empieza por el veredicto y no por los números. Un informe que abre con una
 * tabla obliga a sumar mentalmente para saber si algo salió mal, y nadie suma:
 * se mira el primer renglón y se cierra. Si la importación no está completa, eso
 * tiene que ser lo primero que se lee.
 */
export function informeMarkdown(i: InformeJson, textoDeRazon: (r: Razon) => string): string {
  const l: string[] = []
  const c = i.cuentas

  l.push(`# Informe de importación`)
  l.push('')
  l.push(
    i.estado === 'COMPLETED'
      ? `**Importación completa.** Las ${c.sourceRecords} filas del archivo están todas contabilizadas.`
      : `**IMPORTACIÓN INCOMPLETA.** No se puede dar por buena todavía.`,
  )
  if (i.problemas.length) {
    l.push('')
    for (const p of i.problemas) l.push(`- ${p}`)
  }
  l.push('')
  l.push(`## Qué pasó con cada fila`)
  l.push('')
  l.push(`| Desenlace | Filas |`)
  l.push(`|---|---:|`)
  for (const d of DESTINOS) l.push(`| ${DESTINO_TEXTO[d]} | ${c.porDestino[d]} |`)
  l.push(`| **Filas en el archivo** | **${c.sourceRecords}** |`)

  const razones = Object.entries(c.porRazon).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (razones.length) {
    l.push('')
    l.push(`## Por qué`)
    l.push('')
    for (const [razon, n] of razones) {
      l.push(`- **${n}** — ${textoDeRazon(razon as Razon)}`)
    }
  }

  if (i.adjuntos.declarados > 0) {
    l.push('')
    l.push(`## Documentos`)
    l.push('')
    l.push(`| Desenlace | Documentos |`)
    l.push(`|---|---:|`)
    l.push(`| Subidos | ${i.adjuntos.subidos} |`)
    l.push(`| Fallidos | ${i.adjuntos.fallidos} |`)
    l.push(`| No venían en el paquete | ${i.adjuntos.ausentes} |`)
    l.push(`| Llegaron alterados | ${i.adjuntos.corruptos} |`)
    l.push(`| **Declarados** | **${i.adjuntos.declarados}** |`)
  }

  l.push('')
  l.push(`## Para poder volver aquí`)
  l.push('')
  l.push(`- Trabajo: \`${i.importJobId}\``)
  l.push(`- Huella del archivo: \`${i.sourceFileHash}\``)
  l.push(`- Versión del mapeo: \`${i.mappingVersion}\``)
  l.push(`- Generado: ${i.generadoEn}`)
  l.push('')
  /**
   * Esto va SIEMPRE, también cuando todo salió bien.
   *
   * Es lo que evita que «importados: 1 700» se lea como «tienes 1 700
   * pacientes»: los duplicados y los rechazados siguen siendo filas del archivo
   * que NO están en el expediente, y el médico tiene que saber que están ahí
   * esperándole.
   */
  const pendientes = c.porDestino.ambiguous + c.porDestino.quarantined
  if (pendientes > 0) {
    l.push(`> Quedan **${pendientes} filas esperando a que las mires**. No están en el expediente y no se van a importar solas.`)
  } else {
    l.push(`> No queda nada pendiente de revisión.`)
  }
  return l.join('\n')
}
