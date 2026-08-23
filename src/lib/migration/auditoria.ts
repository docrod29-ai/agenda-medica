/**
 * LA BITÁCORA DE UNA IMPORTACIÓN — sin PHI, y aun así útil.
 *
 * ── LAS DOS FORMAS DE QUE UNA BITÁCORA NO SIRVA ──────────────────────────────
 *
 *  · **Que lleve PHI.** Entonces no se puede mandar a soporte, no se puede sacar
 *    del país, no se puede conservar años y no se puede enseñar en una
 *    auditoría sin destapar expedientes. Una bitácora que no se puede leer no
 *    acredita nada.
 *  · **Que no lleve nada.** «Importación completada» sin huella del archivo, sin
 *    conteos y sin versión de mapeo no permite reconstruir qué pasó. Ya pasó en
 *    este repositorio: la bitácora de restauración guarda conteos precisamente
 *    porque «se restauró» a secas no contestaba ninguna pregunta.
 *
 * Lo que se guarda aquí es todo NÚMEROS, CÓDIGOS Y HUELLAS. Ni un nombre, ni un
 * teléfono, ni una celda del archivo. Y con eso alcanza para contestar «quién
 * importó qué, cuándo, con qué reglas y cómo acabó».
 *
 * ── EL NOMBRE DEL ARCHIVO SÍ ES PHI ──────────────────────────────────────────
 *
 * Suena a metadato inocente y no lo es: los médicos llaman a sus archivos
 * `pacientes_dr_luna_marzo.csv`, pero también `expediente_ramirez.csv`. Se
 * guarda la HUELLA del contenido y el nombre pasado por un saneador que se queda
 * con la extensión y el tamaño. La huella basta para atar el asiento a un
 * archivo concreto cuando el médico lo vuelve a tener delante.
 *
 * Módulo PURO. La escritura la hace quien llama, por `logAudit`.
 */
import type { AuditEvento } from '@/lib/expediente/audit-eventos'
import type { Etapa } from './contrato'
import type { InformeJson } from './reconciliacion'

/**
 * El evento con el que se registran las importaciones.
 *
 * Se reutiliza `export_datos`, que ya existe en `audit-eventos.ts` y que ya usa
 * `clinic/importar` para las restauraciones. Añadir un evento nuevo obliga a
 * tocar el tipo, la tabla de etiquetas y la validación del servidor —tres sitios
 * de un dominio que no es éste— y el asiento ya se distingue por `meta.accion`.
 *
 * Si el dueño quiere un evento propio para la migración, está en el HANDOFF: es
 * un renglón en cada uno de esos tres sitios y ninguna decisión de este carril.
 */
export const EVENTO_MIGRACION: AuditEvento = 'export_datos'

/** Lo que un asiento de migración lleva dentro. Todo esto es seguro de guardar. */
export interface AsientoMigracion {
  readonly accion: 'migracion'
  readonly etapa: Etapa
  readonly importJobId: string
  /** Huella SHA-256 del archivo. Ata el asiento sin guardar el archivo. */
  readonly sourceFileHash: string
  /** Extensión y tamaño. NUNCA el nombre: los nombres de archivo llevan PHI. */
  readonly archivo: { readonly extension: string; readonly bytes: number }
  readonly mappingVersion: string
  readonly adaptador: string
  /** ISO. */
  readonly iniciadoEn: string
  readonly aprobadoEn?: string
  readonly completadoEn?: string
  /** uid de quien aprobó. No el correo. */
  readonly aprobadoPor?: string
  readonly conteos?: {
    readonly sourceRecords: number
    readonly accepted: number
    readonly rejected: number
    readonly duplicate: number
    readonly ambiguous: number
    readonly quarantined: number
  }
  readonly lotes?: { readonly totales: number; readonly confirmados: number }
  /** Código de razón → cuántas veces. Los códigos no son PHI; los valores sí. */
  readonly errores?: Readonly<Record<string, number>>
  readonly estado?: 'COMPLETED' | 'PARTIAL'
}

/**
 * Saca la extensión de un nombre de archivo y tira el resto.
 *
 * Lista blanca y no lista negra: lo que no reconozca sale como `otro`. Un
 * `.csv` no puede llevar PHI dentro; `paciente_ramirez` sí, y un saneador que
 * recorte «lo que parece un nombre» acabaría dejando pasar el caso raro.
 */
const EXTENSIONES_CONOCIDAS = ['.csv', '.tsv', '.txt', '.xlsx', '.xlsm', '.json', '.ndjson', '.zip']

export function extensionSegura(nombreArchivo: string): string {
  const n = nombreArchivo.toLowerCase()
  return EXTENSIONES_CONOCIDAS.find(e => n.endsWith(e)) ?? 'otro'
}

/**
 * Construye el asiento del momento en que se APRUEBA una importación.
 *
 * Es el asiento que más importa de los tres: marca el instante en que dejó de
 * ser un ensayo. Si un día hay que reconstruir quién autorizó escribir 12 000
 * expedientes en un consultorio, se busca éste.
 */
export function asientoDeAprobacion(args: {
  readonly importJobId: string
  readonly sourceFileHash: string
  readonly nombreArchivo: string
  readonly bytes: number
  readonly mappingVersion: string
  readonly adaptador: string
  readonly iniciadoEn: string
  readonly aprobadoEn: string
  readonly aprobadoPor: string
  readonly informe: InformeJson
}): AsientoMigracion {
  const c = args.informe.cuentas
  return {
    accion: 'migracion',
    etapa: 'HUMAN_APPROVAL',
    importJobId: args.importJobId,
    sourceFileHash: args.sourceFileHash,
    archivo: { extension: extensionSegura(args.nombreArchivo), bytes: args.bytes },
    mappingVersion: args.mappingVersion,
    adaptador: args.adaptador,
    iniciadoEn: args.iniciadoEn,
    aprobadoEn: args.aprobadoEn,
    aprobadoPor: args.aprobadoPor,
    conteos: {
      sourceRecords: c.sourceRecords,
      accepted: c.porDestino.accepted,
      rejected: c.porDestino.rejected,
      duplicate: c.porDestino.duplicate,
      ambiguous: c.porDestino.ambiguous,
      quarantined: c.porDestino.quarantined,
    },
    errores: c.porRazon,
  }
}

/** El asiento del cierre. Lleva el desenlace y cuántos lotes entraron de verdad. */
export function asientoDeCierre(args: {
  readonly aprobacion: AsientoMigracion
  readonly completadoEn: string
  readonly informe: InformeJson
  readonly lotesTotales: number
  readonly lotesConfirmados: number
}): AsientoMigracion {
  const c = args.informe.cuentas
  return {
    ...args.aprobacion,
    etapa: args.informe.estado === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL',
    completadoEn: args.completadoEn,
    estado: args.informe.estado,
    lotes: { totales: args.lotesTotales, confirmados: args.lotesConfirmados },
    conteos: {
      sourceRecords: c.sourceRecords,
      accepted: c.porDestino.accepted,
      rejected: c.porDestino.rejected,
      duplicate: c.porDestino.duplicate,
      ambiguous: c.porDestino.ambiguous,
      quarantined: c.porDestino.quarantined,
    },
    errores: c.porRazon,
  }
}

/**
 * GUARDIÁN: ¿este asiento lleva algo que no debería?
 *
 * Se ejecuta en las pruebas sobre asientos construidos a partir de fixtures que
 * SÍ llevan datos personales sintéticos. Si un campo del archivo se colara al
 * asiento por un cambio futuro, esta función lo encuentra.
 *
 * Es tosca —busca las cadenas prohibidas dentro del JSON serializado— y esa
 * tosquedad es la gracia: no depende de saber por qué ruta se coló.
 */
export function llevaPhi(asiento: AsientoMigracion, prohibidas: readonly string[]): string[] {
  const texto = JSON.stringify(asiento).toLowerCase()
  return prohibidas
    .map(p => p.trim().toLowerCase())
    // Menos de 4 caracteres da falsos positivos contra códigos y claves («Ana»
    // aparece dentro de cualquier palabra); el guardián dejaría de servir por
    // ruidoso y alguien lo apagaría.
    .filter(p => p.length >= 4 && texto.includes(p))
}
