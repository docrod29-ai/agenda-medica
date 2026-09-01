/**
 * AISLAMIENTO ENTRE CONSULTORIOS DURANTE LA RESTAURACIÓN.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `restaurar.ts` re-enraíza la RUTA: `clinics/A/patients/P` → `clinics/B/…`.
 * Eso impide que el documento aterrice en el consultorio equivocado.
 *
 * No toca el CONTENIDO. Y el contenido lleva la clínica de origen por dentro:
 *
 *     { clinicId: 'A', metadata: { clinicId: 'A', … }, pacienteId: 'P', … }
 *
 * Así que tras re-enraizar queda un documento **guardado en el consultorio B
 * que declara pertenecer al A**. Nada falla. Nadie se entera. Y la próxima
 * consulta que filtre por `clinicId` verá —o dejará de ver— lo que no debe.
 *
 * ── LA TENSIÓN QUE NO TIENE SALIDA LIMPIA, Y HAY QUE DECIRLA ─────────────────
 *
 * `clinicId` y `metadata.clinicId` están **dentro del sello v3** de una nota
 * firmada (`CAMPOS_SELLADOS_V3`). Entonces, al restaurar una nota FIRMADA en un
 * consultorio distinto del suyo:
 *
 *   · si NO se reescribe el campo → contaminación entre consultorios;
 *   · si SÍ se reescribe → el hash deja de cuadrar, o sea: se ha alterado un
 *     documento firmado e inmutable por la NOM-024.
 *
 * No hay tercera opción y ninguna de las dos es aceptable en silencio. Por eso
 * este módulo NO elige: marca el caso como `revision-humana` y para. Restaurar
 * el expediente firmado de un consultorio DENTRO DE OTRO es una decisión
 * medicolegal (¿es una migración de titularidad? ¿una cesión? ¿un error?), no
 * un parámetro de una llamada HTTP.
 *
 * La restauración de desastre —el caso real: el mismo consultorio vuelve a su
 * propio `clinicId`— no toca esta tensión, y es la que tiene que salir limpia.
 *
 * Módulo PURO.
 */

/**
 * Nombres de campo que declaran a qué consultorio pertenece un documento.
 *
 * Se buscan a CUALQUIER profundidad. `metadata.clinicId` era el que se escapaba
 * de una comprobación de primer nivel, y es justo el que va sellado.
 */
export const CAMPOS_DE_INQUILINO = ['clinicId', 'clinicid', 'clinic_id', 'tenantId'] as const

/** Una ruta absoluta de Firestore incrustada en un valor de texto. */
const RUTA_DE_CLINICA = /(?:^|["'\s(/])clinics\/([A-Za-z0-9_-]{1,128})\//g

/**
 * Rutas de objeto de Cloud Storage. NO llevan `clinicId`: se enraízan por el
 * `uid` del médico (`receta-diseno/{uid}/…`), así que desde el documento es
 * IMPOSIBLE decir a qué consultorio pertenece el objeto.
 */
const RUTA_DE_STORAGE = /receta-diseno\/([A-Za-z0-9_-]{1,128})\//

export type ClaseDeHallazgo =
  /** El documento declara pertenecer a otro consultorio. */
  | 'campo-de-inquilino-forastero'
  /** Un valor lleva incrustada una ruta de otro consultorio. */
  | 'ruta-forastera'
  /**
   * Referencia a un objeto de Storage cuyo dueño NO se puede determinar desde
   * el documento. No es una acusación: es la declaración de que aquí el
   * aislamiento no se puede verificar por este camino.
   */
  | 'referencia-no-verificable'

export interface HallazgoDeAislamiento {
  clase: ClaseDeHallazgo
  /** Documento donde aparece, ya re-enraizado. */
  ruta: string
  /** Camino del campo dentro del documento, en punto. */
  campo: string
  /** El valor, recortado: nunca se vuelca un documento entero (PHI). */
  valor: string
  /** El consultorio que el valor delata, cuando se puede saber. */
  clinicIdVisto: string | null
  porQue: string
}

/** Recorta un valor para poder enseñarlo sin volcar PHI. */
function recorte(v: string): string {
  return v.length > 96 ? `${v.slice(0, 96)}…` : v
}

/**
 * Recorre el documento entero buscando referencias que no correspondan al
 * consultorio destino.
 *
 * @param ruta ruta del documento YA re-enraizada (para poder señalarlo).
 * @param datos el documento sin `_ruta`/`_coleccion`.
 * @param destino el `clinicId` al que se está restaurando.
 */
export function referenciasForasteras(
  ruta: string, datos: Record<string, unknown>, destino: string,
): HallazgoDeAislamiento[] {
  const out: HallazgoDeAislamiento[] = []

  const anda = (valor: unknown, campo: string): void => {
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => anda(v, `${campo}[${i}]`))
      return
    }
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
        const hijo = campo ? `${campo}.${k}` : k
        if ((CAMPOS_DE_INQUILINO as readonly string[]).includes(k) && typeof v === 'string' && v && v !== destino) {
          out.push({
            clase: 'campo-de-inquilino-forastero',
            ruta, campo: hijo, valor: recorte(v), clinicIdVisto: v,
            porQue: `el documento se escribiría en «${destino}» declarando pertenecer a «${v}». Re-enraizar la ruta no reescribe el contenido.`,
          })
        }
        anda(v, hijo)
      }
      return
    }
    if (typeof valor !== 'string' || !valor) return

    RUTA_DE_CLINICA.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RUTA_DE_CLINICA.exec(valor))) {
      const visto = m[1]
      if (visto === destino) continue
      out.push({
        clase: 'ruta-forastera',
        ruta, campo, valor: recorte(valor), clinicIdVisto: visto,
        porQue: `el valor lleva incrustada una ruta del consultorio «${visto}»: una referencia cruzada que sobrevive al re-enraizado de la ruta del documento.`,
      })
    }
    const st = RUTA_DE_STORAGE.exec(valor)
    if (st) {
      out.push({
        clase: 'referencia-no-verificable',
        ruta, campo, valor: recorte(valor), clinicIdVisto: null,
        porQue: 'apunta a un objeto de Cloud Storage enraizado por `uid` de médico, no por consultorio: desde el documento NO se puede comprobar a qué consultorio pertenece el objeto, ni si existe en el destino.',
      })
    }
  }

  anda(datos, '')
  return out
}

export type VeredictoAislamiento = 'limpio' | 'contaminado' | 'revision-humana' | 'no-verificable'

export interface EvaluacionAislamiento {
  veredicto: VeredictoAislamiento
  hallazgos: HallazgoDeAislamiento[]
  porQue: string
}

/**
 * ¿Se puede escribir este documento en el consultorio destino?
 *
 * @param esInmutable el documento está firmado o es append-only. Si lo es, la
 *   contaminación NO se puede arreglar reescribiendo el campo: ese campo va
 *   sellado, y reescribirlo altera un documento firmado.
 */
export function evaluarAislamiento(
  hallazgos: HallazgoDeAislamiento[], esInmutable: boolean,
): EvaluacionAislamiento {
  const forasteros = hallazgos.filter(h => h.clase !== 'referencia-no-verificable')
  const noVerificables = hallazgos.filter(h => h.clase === 'referencia-no-verificable')

  if (forasteros.length === 0) {
    return noVerificables.length
      ? {
        veredicto: 'no-verificable', hallazgos,
        porQue: 'no hay referencia a otro consultorio, pero sí referencias a objetos de Storage cuyo dueño no se puede comprobar desde el documento. Se restaura el metadato y se DECLARA que el objeto puede no estar.',
      }
      : { veredicto: 'limpio', hallazgos, porQue: '' }
  }

  if (esInmutable) {
    return {
      veredicto: 'revision-humana', hallazgos,
      porQue:
        'documento FIRMADO o de sólo-añadir que declara pertenecer a otro consultorio. ' +
        'Dejar el campo contamina el destino; reescribirlo altera un documento inmutable ' +
        '(`clinicId` va dentro del sello v3). Ninguna de las dos se hace sola: es una ' +
        'decisión medicolegal sobre titularidad del expediente.',
    }
  }

  return {
    veredicto: 'contaminado', hallazgos,
    porQue:
      'el documento arrastra referencias al consultorio de origen. Al no ser inmutable, ' +
      'se PUEDE reescribir el campo de inquilino — pero eso es una corrección sobre el ' +
      'dato del médico y, como toda corrección automática, tiene que ser visible y ' +
      'reversible: se declara en el informe, nunca se aplica en silencio.',
  }
}

/**
 * Reescribe los campos de inquilino de un documento MUTABLE al destino.
 *
 * Devuelve el documento nuevo y la lista de campos tocados, para que el informe
 * pueda enseñarla. No muta la entrada. **No se llama sobre documentos
 * inmutables**: ahí la respuesta es `revision-humana`, no una reescritura.
 */
export function reenraizarContenido(
  datos: Record<string, unknown>, destino: string,
): { datos: Record<string, unknown>; camposTocados: string[] } {
  const tocados: string[] = []
  const anda = (v: unknown, campo: string): unknown => {
    if (Array.isArray(v)) return v.map((x, i) => anda(x, `${campo}[${i}]`))
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const hijo = campo ? `${campo}.${k}` : k
        if ((CAMPOS_DE_INQUILINO as readonly string[]).includes(k) && typeof val === 'string' && val && val !== destino) {
          tocados.push(hijo)
          out[k] = destino
          continue
        }
        out[k] = anda(val, hijo)
      }
      return out
    }
    return v
  }
  return { datos: anda(datos, '') as Record<string, unknown>, camposTocados: tocados }
}

export const POR_QUE_LA_RUTA_NO_BASTA =
  'Re-enraizar la ruta pone el documento en el consultorio correcto. No lo hace ' +
  'DEL consultorio correcto: por dentro sigue declarando el de origen, y la ' +
  'siguiente consulta que filtre por ese campo verá lo que no debe o dejará de ' +
  'ver lo que sí. El aislamiento entre consultorios no vive en la ruta: vive en ' +
  'los dos sitios a la vez, y el que no se comprueba es el que falla.'
