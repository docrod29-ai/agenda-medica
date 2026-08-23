/**
 * LA PUERTA DE SALIDA — que Ausculta no sea una cárcel de datos.
 *
 * ── POR QUÉ ESTO VIVE EN EL CARRIL DE LA MIGRACIÓN ───────────────────────────
 *
 * Porque son la misma promesa dicha en las dos direcciones. Pedirle a un médico
 * que meta veinte años de expediente en un sistema del que después no podrá
 * sacarlos es pedirle que se juegue su ejercicio profesional a que la empresa
 * siga existiendo y siga portándose bien.
 *
 * El argumento comercial —«tu información es tuya»— sólo vale si es cierto el
 * día que quiera irse. Un export que se llevara los nombres y los teléfonos pero
 * no las notas ni la procedencia sería una agenda de contactos, no un expediente.
 *
 * ── LO QUE YA EXISTE, Y NO SE DUPLICA ────────────────────────────────────────
 *
 * El repositorio ya tiene tres salidas y ninguna se reemplaza:
 *
 *  · `clinic/exportar` — NDJSON completo, para RECONSTRUIR. Es el respaldo.
 *  · `clinic/exportar-csv` / `exportar-excel` — por dominio, para LEER.
 *  · `fhir-export.ts` — para hablar con otro sistema clínico.
 *
 * Lo que falta y define este contrato es la **portabilidad de la procedencia**:
 * que lo que salga siga sabiendo de dónde vino, incluida la parte que entró por
 * una migración. Un export que pierde la procedencia convierte un dato importado
 * con dudas en un dato del expediente sin dudas — inventa certeza al salir.
 *
 * Módulo PURO: define la forma y comprueba que se respete. No lee la base.
 */
import type { ProcedenciaImportacion, ProcedenciaCampo } from './procedencia'

/* ═══════════════════════ LAS DOS EXPORTACIONES ═══════════════════════ */

/**
 * Dos cosas distintas que la gente llama «exportar»:
 *
 *  · `estructurada` — para que OTRO SISTEMA la lea. Completa, con procedencia,
 *    reimportable. Fea de mirar y ésa no es su función.
 *  · `legible` — para que UNA PERSONA la lea. Un PDF o una hoja de cálculo.
 *    Pierde estructura a propósito y **no sirve para migrar de vuelta**.
 *
 * Confundirlas es cómo un médico cree que se llevó su expediente y se llevó un
 * PDF de 900 páginas del que no se puede recuperar nada. Se nombran distinto
 * para que la diferencia se vea antes de pulsar el botón.
 */
export type ClaseExportacion = 'estructurada' | 'legible'

/** Los dominios que un export completo tiene que traer. Ninguno es opcional. */
export const DOMINIOS_EXPORTABLES = [
  'demografia',
  'encuentros',
  'diagnosticos',
  'medicamentos',
  'documentos',
  'resultados',
  'adjuntos-metadatos',
  'procedencia',
  'auditoria-importacion',
] as const

export type DominioExportable = (typeof DOMINIOS_EXPORTABLES)[number]

/**
 * Un export que declara qué trae Y QUÉ NO.
 *
 * `ausentes` no es un detalle de cortesía: es la mitad del contrato. Un archivo
 * que se llama «expediente completo» y trae ocho de nueve dominios es peor que
 * uno que trae ocho y lo dice, porque el primero se descubre incompleto el día
 * que hace falta. Es la misma regla que ya sigue el respaldo NDJSON con su línea
 * de cierre, y la misma que exige ARCO: «lo que no se pudo leer se declara».
 */
export interface ManifiestoExportacion {
  readonly version: 1
  readonly clase: ClaseExportacion
  readonly clinicId: string
  readonly generadoEn: string
  readonly dominios: readonly DominioExportable[]
  /** Dominios que NO van, con el porqué. Vacío = va todo. */
  readonly ausentes: readonly { readonly dominio: DominioExportable; readonly porQue: string }[]
  readonly conteos: Readonly<Partial<Record<DominioExportable, number>>>
  /** `true` si esto se puede volver a importar sin pérdida. */
  readonly reimportable: boolean
}

/**
 * ¿Este manifiesto describe un export del que el médico puede fiarse?
 *
 * Un export `estructurada` que no traiga procedencia NO es reimportable, se diga
 * lo que se diga en el manifiesto: al volver a entrar, cada dato importado
 * perdería su origen y sus dudas, y un dato con dudas que pierde las dudas es un
 * dato inventado con un rodeo.
 */
export function coherente(m: ManifiestoExportacion): string[] {
  const problemas: string[] = []
  const trae = new Set(m.dominios)

  if (m.clase === 'estructurada') {
    if (!trae.has('procedencia')) {
      problemas.push('Un export estructurado sin procedencia no se puede reimportar sin perder de dónde vino cada dato.')
    }
    if (m.reimportable && m.ausentes.length > 0) {
      problemas.push('Se declara reimportable pero faltan dominios: al volver a entrar no quedaría igual.')
    }
  }
  if (m.clase === 'legible' && m.reimportable) {
    problemas.push('Una exportación legible no es reimportable: pierde estructura a propósito.')
  }
  for (const d of m.dominios) {
    if (m.conteos[d] === undefined) {
      /**
       * Un dominio sin conteo no se puede verificar del otro lado.
       *
       * Es la regla «el dato tiene que LLEGAR»: sin un número contra el que
       * comparar, quien reciba el archivo no puede saber si le llegó entero. Un
       * cero explícito es un dato; la ausencia de número no lo es.
       */
      problemas.push(`El dominio "${d}" va sin conteo: no se puede comprobar que llegó entero.`)
    }
  }
  return problemas
}

/* ═══════════════════════ LO QUE SALE DE CADA PACIENTE ═══════════════════════ */

/**
 * La procedencia, tal cual sale al export.
 *
 * Se exporta ENTERA, incluidos los campos con incertidumbre y las columnas que
 * nunca supimos mapear. Esas columnas son el caso que mejor mide si la promesa
 * es de verdad: son datos del médico que Ausculta no entendió, y devolverlos es
 * exactamente lo que distingue «guardamos tu información» de «guardamos la parte
 * que nos servía».
 */
export interface ProcedenciaExportada {
  readonly importacion?: ProcedenciaImportacion
  readonly campos?: Readonly<Record<string, ProcedenciaCampo>>
  readonly camposNoMapeados?: Readonly<Record<string, string>>
}

/**
 * ¿Sobrevivió la procedencia a la ida y vuelta?
 *
 * Ésta es la prueba de que la portabilidad es real y no una promesa. Compara lo
 * que entró con lo que salió y devuelve lo que se perdió por el camino.
 *
 * Deliberadamente NO compara los valores clínicos: eso lo hace el respaldo, que
 * ya tiene su simulacro de ida y vuelta. Lo que aquí se vigila es lo que ninguna
 * otra prueba mira — que las DUDAS sigan siendo dudas al otro lado.
 */
export function procedenciaSobrevive(
  entro: ProcedenciaExportada,
  salio: ProcedenciaExportada,
): string[] {
  const perdido: string[] = []

  if (entro.importacion && !salio.importacion) {
    perdido.push('Se perdió el sello de importación: el expediente ya no sabe de qué archivo salió.')
  }
  if (entro.importacion && salio.importacion) {
    for (const k of ['sourceSystem', 'sourceFile', 'sourceRow', 'importJobId', 'importedAt', 'mappingVersion'] as const) {
      if (entro.importacion[k] !== salio.importacion[k]) {
        perdido.push(`Cambió "${k}" en el sello de importación.`)
      }
    }
  }

  for (const [campo, c] of Object.entries(entro.campos ?? {})) {
    const s = salio.campos?.[campo]
    if (!s) { perdido.push(`Se perdió la procedencia del campo "${campo}".`); continue }
    if (s.valorOriginal !== c.valorOriginal) {
      perdido.push(`Cambió el valor original de "${campo}": ya no se puede volver al archivo.`)
    }
    if (!!c.incertidumbre !== !!s.incertidumbre) {
      /**
       * EL FALLO MÁS CARO DE TODA LA EXPORTACIÓN.
       *
       * Una fecha que entró como «puede ser el 3 de abril o el 4 de marzo» y
       * sale como una fecha a secas ya no se puede volver a discutir: quien la
       * lea después la tratará como un dato firme. La duda desaparece y la
       * certeza aparece de la nada, sin que nadie haya decidido nada.
       */
      perdido.push(`La incertidumbre de "${campo}" no sobrevivió: una duda se convirtió en certeza (o al revés).`)
    }
  }

  for (const [col, valor] of Object.entries(entro.camposNoMapeados ?? {})) {
    if (salio.camposNoMapeados?.[col] !== valor) {
      perdido.push(`Se perdió la columna sin mapear "${col}", que era un dato del médico.`)
    }
  }

  return perdido
}
