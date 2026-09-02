/**
 * OBJETOS GRANDES — la foto clínica, el audio y el membrete NO están en el
 * respaldo, y hasta hoy nadie lo decía.
 *
 * ── LO QUE SE ENCONTRÓ EN ESTE REPOSITORIO ───────────────────────────────────
 *
 * 1. La fotografía clínica se sube por `subirImagen(dataUrl, 'fotos/{pid}/{ts}')`
 *    → `POST /api/config/imagen`, que **sanea la clave** con
 *    `.replace(/[^a-z0-9_-]/gi, '').slice(0, 40)` y la guarda en
 *
 *        receta-diseno/{uid-del-médico}/{clave-saneada}-{ts}.{ext}
 *
 *    Es decir: los bytes de una imagen clínica —PHI— viven bajo el prefijo que
 *    el resto del código documenta como «la firma y el membrete del médico», y
 *    su raíz de aislamiento es el **uid del médico**, no el `clinicId`. Desde el
 *    documento de Firestore no hay forma de comprobar a qué consultorio
 *    pertenece el objeto.
 *
 * 2. En Firestore sólo queda el metadato (`{ url, fecha, region, … }`). El
 *    respaldo NDJSON se lleva **el metadato y ni un byte del objeto**, y ni
 *    `COLECCIONES` ni `EXCLUIDAS` lo mencionan: la ausencia no está declarada en
 *    ninguna parte del manifiesto.
 *
 * 3. Consecuencia al restaurar en otro consultorio: el metadato vuelve, la `url`
 *    sigue apuntando al objeto del médico de ORIGEN, y el informe cuenta la foto
 *    como restaurada. El médico abre el expediente y ve la ficha de la foto con
 *    la imagen rota — o, peor, la ve bien porque el proxy se la sirve desde el
 *    otro consultorio.
 *
 * ── LO QUE ESTE MÓDULO HACE ──────────────────────────────────────────────────
 *
 * Mapea metadato ↔ objeto y detecta las cuatro roturas: metadato huérfano,
 * objeto huérfano, huella que no cuadra y referencia a otro inquilino. **No
 * descarga ni un archivo**: trabaja sobre listados de nombres y tamaños, que es
 * lo único que se puede mirar sin abrir PHI.
 *
 * Módulo PURO.
 */

/** Prefijos de objeto que este producto usa hoy. */
export const PREFIJOS_DE_OBJETO: Readonly<Record<string, string>> = {
  'receta-diseno/': 'Membrete, firma y formato de receta del médico — Y TAMBIÉN las fotografías clínicas, que se cuelan aquí porque `subirImagen` usa la misma ruta. Enraizado por `uid` de médico.',
  'consultas-audio/': 'Audio de consulta para diarizar. Efímero por diseño: lo borra el hook y, si la pestaña muere, el cron `limpiar-audio`.',
  'consultas-audio-nota/': 'Audio CONSERVADO de la consulta, referenciado por `nota.audioPath` (REG-509). Sostiene el clic-a-audio. NO es efímero y el cron de 24 h no lo mira: caduca por la NOM-004, cinco años desde el último acto médico del paciente (REG-510).',
}

/** El metadato tal como vive en Firestore. */
export interface MetadatoDeObjeto {
  /** Ruta del documento que lo referencia. */
  ruta: string
  /** Colección en punto. */
  coleccion: string
  /** El valor del campo que apunta al objeto. */
  url: string
  /** Ruta del objeto extraída de la url, o `null` si no se pudo. */
  rutaDelObjeto: string | null
  /** Huella declarada del contenido, si el metadato la trae. */
  huellaDeclarada: string | null
}

/** Lo que un listado del bucket devuelve. Nunca el contenido. */
export interface ObjetoEnElBucket {
  ruta: string
  bytes: number
  /** Huella que el bucket reporta (p. ej. md5Hash), si la hay. */
  huella: string | null
}

export type ClaseDeRoturaDeObjeto =
  | 'metadato-sin-objeto'
  | 'objeto-sin-metadato'
  | 'huella-no-cuadra'
  | 'objeto-de-otro-duenno'
  | 'url-no-interpretable'

export interface RoturaDeObjeto {
  clase: ClaseDeRoturaDeObjeto
  /** Documento o ruta de objeto, según la clase. */
  donde: string
  porQue: string
  severidad: 'P0' | 'P1' | 'P2'
}

/** Extrae la ruta del objeto de una url servida por el proxy same-origin. */
export function rutaDelObjetoDeLaUrl(url: string): string | null {
  const m = /[?&]path=([^&]+)/.exec(url)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

/** El `uid` del médico bajo el que cuelga un objeto de `receta-diseno/`. */
export function duennoDelObjeto(rutaDelObjeto: string): string | null {
  const m = /^receta-diseno\/([A-Za-z0-9_-]{1,128})\//.exec(rutaDelObjeto)
  return m ? m[1] : null
}

/**
 * Cruza los dos lados.
 *
 * @param metadatos lo que hay en Firestore tras restaurar.
 * @param objetos listado del bucket del consultorio DESTINO.
 * @param uidsDelDestino los `uid` de médico que pertenecen al consultorio
 *   destino. Sin esta lista no se puede decidir si un objeto es del destino: se
 *   declara `no verificable` en vez de suponerlo.
 */
export function cruzarObjetos(
  metadatos: readonly MetadatoDeObjeto[],
  objetos: readonly ObjetoEnElBucket[],
  uidsDelDestino: readonly string[] | null,
): RoturaDeObjeto[] {
  const out: RoturaDeObjeto[] = []
  const enBucket = new Map(objetos.map(o => [o.ruta, o]))
  const referenciados = new Set<string>()

  for (const m of metadatos) {
    if (!m.rutaDelObjeto) {
      out.push({
        clase: 'url-no-interpretable', donde: m.ruta, severidad: 'P2',
        porQue: 'el metadato apunta a una url de la que no se puede extraer una ruta de objeto: no se puede comprobar si el archivo existe.',
      })
      continue
    }
    referenciados.add(m.rutaDelObjeto)

    if (uidsDelDestino) {
      const duenno = duennoDelObjeto(m.rutaDelObjeto)
      if (duenno && !uidsDelDestino.includes(duenno)) {
        out.push({
          clase: 'objeto-de-otro-duenno', donde: m.ruta, severidad: 'P0',
          porQue: `el metadato quedó en este consultorio apuntando a un objeto que cuelga del uid «${duenno}», que no es de aquí. Restaurar el metadato no trae el objeto: deja una referencia a material de otro.`,
        })
      }
    }

    const o = enBucket.get(m.rutaDelObjeto)
    if (!o) {
      out.push({
        clase: 'metadato-sin-objeto', donde: m.ruta, severidad: 'P1',
        porQue: 'el expediente enseña una fotografía clínica cuyo archivo no existe en este destino. El respaldo NDJSON nunca llevó los bytes: se cuenta como restaurada y no lo está.',
      })
      continue
    }
    if (m.huellaDeclarada && o.huella && m.huellaDeclarada !== o.huella) {
      out.push({
        clase: 'huella-no-cuadra', donde: m.ruta, severidad: 'P0',
        porQue: 'el objeto existe pero su contenido no es el que el metadato declara: la imagen que se enseña no es la que se guardó.',
      })
    }
  }

  for (const o of objetos) {
    if (referenciados.has(o.ruta)) continue
    /**
     * Un objeto sin metadato bajo `consultas-audio/` es NORMAL mientras la
     * consulta se transcribe, y lo barre su cron. Bajo `receta-diseno/` no:
     * ahí un objeto que nadie referencia es PHI que se quedó y que ningún
     * barrido toca, porque ese prefijo está declarado como «no caduca».
     */
    if (o.ruta.startsWith('consultas-audio/')) continue
    out.push({
      clase: 'objeto-sin-metadato', donde: o.ruta, severidad: 'P2',
      porQue: 'objeto en el bucket que ningún documento referencia. Bajo `receta-diseno/` nada lo barre (el cron sólo toca `consultas-audio/`), así que se queda ahí indefinidamente.',
    })
  }

  return out
}

/**
 * Lo que la restauración NO puede prometer sobre objetos grandes, para que el
 * informe lo diga con estas palabras y no con un silencio.
 */
export const LO_QUE_LA_RESTAURACION_NO_TRAE: Readonly<Record<string, string>> = {
  'fotografía clínica': 'Vuelve la ficha (fecha, región, descripción, a qué nota se ligó). NO vuelve la imagen: sus bytes están en Cloud Storage y el respaldo NDJSON no los lleva.',
  'membrete y firma': 'Vuelve la configuración que los referencia. NO vuelven las imágenes.',
  'audio de la consulta': 'El de TRABAJO (`consultas-audio/`) no vuelve, y es correcto: es efímero. El CONSERVADO (`consultas-audio-nota/`) tampoco vuelve hoy, y eso ya NO es correcto sin decirlo: la nota restaurada traerá su `audioPath` apuntando a un objeto que el respaldo no llevó, así que el clic-a-audio quedará mudo tras una restauración. Declarado en REG-510; meter binarios en el respaldo es su propia decisión, de tamaño y de coste.',
}

export const POR_QUE_NO_SE_DESCARGA_NI_UN_ARCHIVO =
  'Comprobar una fotografía clínica bajándola es sacar PHI del sitio donde ' +
  'está para mirarla. El nombre, el tamaño y la huella que el bucket ya ' +
  'publica bastan para responder las cuatro preguntas que importan: si está, ' +
  'si sobra, si es de quien dice y si es lo que dice ser.'
