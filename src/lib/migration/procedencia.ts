/**
 * DE DÓNDE SALIÓ CADA DATO IMPORTADO.
 *
 * ── LA REGLA QUE ESTE MÓDULO NO PUEDE ROMPER ─────────────────────────────────
 *
 * «UN PACIENTE · UNA IDENTIDAD · UN EXPEDIENTE LONGITUDINAL». La migración es la
 * tentación más grande que tiene ese invariante: es facilísimo escribir un
 * `hechoImportado` paralelo al `ClinicalFact` de siempre «porque el importado es
 * distinto». No lo es. Un diagnóstico que vino de un CSV es un diagnóstico; lo
 * que cambia es su PROCEDENCIA, no su naturaleza.
 *
 * Por eso aquí no hay un modelo nuevo de hecho clínico. Hay un modelo de
 * **origen** que se PROYECTA sobre la variante `externo` de
 * `ProcedenciaHechoSchema`, que ya existe en `clinical-fact/schema.ts` y ya
 * lleva `sistema` y `mensajeId`. El hecho importado es un hecho normal con la
 * procedencia bien puesta.
 *
 * ── LO QUE SE CONSERVA, Y POR QUÉ CADA COSA ──────────────────────────────────
 *
 * El día que un médico pregunte «¿de dónde salió esta alergia?», la respuesta
 * tiene que ser «de la fila 4 812 del archivo que subiste el 3 de marzo, columna
 * “ALERGIAS”, tal cual venía» — y no «de una importación». La diferencia entre
 * las dos respuestas es la diferencia entre poder ir a mirar y no poder.
 *
 * Se guarda también `normalizacionAplicada`: qué le hicimos al dato entre el
 * archivo y el expediente. Es la regla 3 de seguridad clínica dicha en datos —
 * «nada cambia en silencio»—. Un `ano-2-digitos-pivote-30` en esa lista es la
 * constancia de que ahí hubo una SUPOSICIÓN, no una lectura.
 *
 * Módulo PURO.
 */
import type { Normalizado } from './normalizacion'

/** Qué clase de sistema soltó el archivo. Provider-neutral a propósito. */
export type SistemaOrigen =
  /** Un CSV/XLSX exportado a mano de cualquier sitio. El caso mayoritario. */
  | 'csv-generico'
  /** Un respaldo NDJSON de la propia Ausculta. */
  | 'ausculta-respaldo'
  /** Export estructurado de un sistema nombrado. El nombre va en `sistemaNombre`. */
  | 'export-estructurado'
  /** Capturado a mano durante la migración. */
  | 'captura-manual'

/**
 * La procedencia de origen de un dato importado.
 *
 * Todos los campos son obligatorios salvo los que un archivo puede legítimamente
 * no tener. Opcional aquí significa «este archivo no lo traía», nunca «no nos
 * molestamos en guardarlo».
 */
export interface ProcedenciaImportacion {
  readonly sourceSystem: SistemaOrigen
  /** El nombre que dijo el médico: «Doctoralia», «Nimbo», «mi Excel». Sin verificar. */
  readonly sistemaNombre?: string
  /** Nombre del archivo tal cual se subió. */
  readonly sourceFile: string
  /** Huella SHA-256 del archivo. Ata el dato a un archivo concreto sin guardarlo. */
  readonly sourceFileHash: string
  /** Número de fila en el archivo, 1 = primera fila de datos (no el encabezado). */
  readonly sourceRow: number
  /** El id que traía el propio archivo, si traía alguno. */
  readonly sourceRecordId?: string
  readonly importJobId: string
  /** ISO. Cuándo se escribió. */
  readonly importedAt: string
  /** uid de quien aprobó la importación. NO el correo: la bitácora no es sitio para PHI. */
  readonly importedBy: string
  /** Versión del mapeo con que se leyó. Sin esto el informe no se puede reproducir. */
  readonly mappingVersion: string
}

/** La procedencia de UN campo concreto dentro de esa fila. */
export interface ProcedenciaCampo {
  /** El encabezado tal cual venía en el archivo: «F. NAC.», no «fechaNacimiento». */
  readonly originalFieldName: string
  /** El texto original, sin tocar. Es lo que se enseña cuando alguien pregunta. */
  readonly valorOriginal: string
  /** Qué se le hizo. Vacío = nada, y eso también se dice. */
  readonly normalizationApplied: readonly string[]
  /**
   * Cuando el dato no se pudo resolver del todo. `undefined` = se resolvió.
   *
   * Un campo con `incertidumbre` NUNCA se usa como si fuera un dato firme: es la
   * diferencia entre «no sabemos la fecha» y «no tiene fecha».
   */
  readonly incertidumbre?: {
    readonly clase: 'ambiguo' | 'invalido'
    readonly razon: string
    /** Las lecturas posibles, cuando había más de una. */
    readonly lecturas?: readonly string[]
  }
}

/**
 * Construye la procedencia de un campo a partir de lo que dijo el normalizador.
 *
 * Es el único sitio donde `Normalizado` se convierte en algo que se guarda, y
 * por eso es el sitio donde se garantiza que la incertidumbre no se pierde por
 * el camino. Un `ambiguo` que llegue aquí sale con `incertidumbre` puesta,
 * siempre — no depende de que quien llama se acuerde.
 */
export function procedenciaDeCampo<T>(
  originalFieldName: string,
  n: Normalizado<T>,
): ProcedenciaCampo {
  const base = { originalFieldName, valorOriginal: n.crudo }
  switch (n.clase) {
    case 'valor':
      return { ...base, normalizationApplied: n.aplicado }
    case 'ambiguo':
      return {
        ...base,
        normalizationApplied: [],
        incertidumbre: { clase: 'ambiguo', razon: n.razon, lecturas: n.lecturas },
      }
    case 'invalido':
      return {
        ...base,
        normalizationApplied: [],
        incertidumbre: { clase: 'invalido', razon: n.razon },
      }
    case 'vacio':
      /**
       * Un campo vacío NO lleva incertidumbre, y tampoco es un dato.
       *
       * «Ausencia de dato no es dato de ausencia»: que la columna de alergias
       * viniera vacía no significa que el paciente no tenga alergias. Se guarda
       * la constancia de que la columna existía y vino vacía, que es distinto de
       * que la columna no existiera — y esa diferencia es la que un día evita
       * leer un expediente como «sin alergias conocidas» cuando nadie preguntó.
       */
      return { ...base, normalizationApplied: ['columna-presente-vacia'] }
  }
}

/**
 * PROYECCIÓN AL MODELO CANÓNICO.
 *
 * Devuelve exactamente la forma de la variante `externo` de
 * `ProcedenciaHechoSchema` (`clinical-fact/schema.ts`). No es una copia del
 * modelo: es el adaptador que permite que un hecho importado entre por la MISMA
 * puerta que cualquier otro hecho y valide con el MISMO esquema.
 *
 * `mensajeId` lleva la llave idempotente. Es el campo que ya existía para
 * «identificador del mensaje de origen» y aquí cumple la misma función: señala
 * inequívocamente de qué unidad de origen salió este hecho.
 */
export function comoProcedenciaCanonica(p: ProcedenciaImportacion, llaveIdempotente: string): {
  readonly origen: 'externo'
  readonly registradoEn: string
  readonly sistema: string
  readonly mensajeId: string
} {
  return {
    origen: 'externo',
    registradoEn: p.importedAt,
    sistema: p.sistemaNombre ? `${p.sourceSystem}:${p.sistemaNombre}` : p.sourceSystem,
    mensajeId: llaveIdempotente,
  }
}

/**
 * Lo que se guarda pegado al paciente importado.
 *
 * Va en el documento del paciente y no en una colección aparte porque la
 * pregunta que contesta —«¿de dónde salió este expediente?»— se hace mirando el
 * expediente. Una tabla separada obliga a saber que existe para poder
 * preguntarle, y nadie sabe que existe.
 */
export interface SelloDeImportacion {
  readonly procedencia: ProcedenciaImportacion
  /** Procedencia por campo, indexada por el campo del expediente. */
  readonly campos: Readonly<Record<string, ProcedenciaCampo>>
  /**
   * Las columnas que no se supieron mapear, tal cual venían.
   *
   * Esto es lo que impide que «Padecimiento actual» desaparezca. NO se
   * interpreta ni entra en ningún motor clínico: se conserva para que el médico
   * pueda mirarlo y para que la exportación pueda devolverlo. Un dato que no
   * entendemos sigue siendo suyo.
   */
  readonly camposNoMapeados: Readonly<Record<string, string>>
}

/**
 * ¿Este sello arrastra alguna duda sin resolver?
 *
 * Lo usa la pantalla para poner la marca de «revisar» en el expediente, y el
 * informe para contarlos. Un expediente importado con una fecha ambigua tiene
 * que verse distinto de uno limpio, o la ambigüedad se convierte en certeza al
 * cabo de una semana simplemente por estar ahí.
 */
export function tieneIncertidumbre(s: SelloDeImportacion): boolean {
  return Object.values(s.campos).some(c => c.incertidumbre !== undefined)
}

/** Los campos con duda, por nombre. Para pintarlos y para contarlos. */
export function camposInciertos(s: SelloDeImportacion): string[] {
  return Object.entries(s.campos)
    .filter(([, c]) => c.incertidumbre !== undefined)
    .map(([campo]) => campo)
    .sort()
}
