/**
 * INTEGRIDAD REFERENCIAL DE UN RESPALDO — que las piezas encajen entre sí.
 *
 * ── POR QUÉ NO BASTA CON QUE LOS CONTEOS CUADREN ─────────────────────────────
 *
 * Un respaldo puede traer 10 000 documentos, conciliar perfectamente y estar
 * roto: una cita que apunta a un paciente que no viajó, una adenda cuya nota se
 * quedó fuera, una versión colgando de otra nota. Los conteos dicen «volvió
 * todo»; el expediente dice otra cosa.
 *
 * Y el orden de gravedad no es opinable:
 *
 *  · una **adenda huérfana** es una corrección legal sobre un documento que ya
 *    no está. Es el único mecanismo de corrección que existe sobre una nota
 *    firmada (NOM-004): perderla o dejarla suelta es perder la corrección;
 *  · una **versión bajo la nota equivocada** convierte el historial de un
 *    borrador en el historial de otro paciente;
 *  · una **cita a un paciente inexistente** deja la agenda con huecos que la
 *    pantalla no sabe explicar.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No arregla nada. Detecta y clasifica. Reparar una referencia rota sería
 * inventarle un padre a un documento, que es exactamente el defecto contra el
 * que existe `restaurar.ts` («una línea que no se entiende NO se escribe»).
 *
 * Módulo PURO: trabaja sobre documentos ya interpretados, sin Firestore.
 */
import { coleccionDeLaRuta } from '@/lib/clinica/restaurar'

/** Un documento del respaldo, ya interpretado por `leerLinea`. */
export interface DocumentoDelRespaldo {
  ruta: string
  coleccion: string
  datos: Record<string, unknown>
}

export type Severidad = 'P0' | 'P1' | 'P2'

export type CodigoReferencial =
  | 'cita-sin-paciente'
  | 'encuentro-sin-paciente'
  | 'nota-de-otro-paciente'
  | 'adenda-sin-nota'
  | 'version-de-otra-nota'
  | 'laboratorio-sin-paciente'
  | 'foto-sin-paciente'
  | 'cobro-sin-paciente'
  | 'paquete-sin-paciente'
  | 'referencia-a-otro-consultorio'
  | 'ruta-ilegible'

export interface HallazgoReferencial {
  codigo: CodigoReferencial
  severidad: Severidad
  /** Documento donde está el problema. */
  ruta: string
  /** A qué apuntaba y no se encontró. */
  apuntaA: string
  porQue: string
}

/** Segmentos de una ruta de documento: `clinics/{c}/patients/{p}/notas/{n}`. */
interface Partes {
  clinicId: string
  /** Pares colección/id, en orden. */
  pares: { coleccion: string; id: string }[]
}

export function partirRuta(ruta: string): Partes | null {
  const p = ruta.split('/')
  if (p[0] !== 'clinics' || p.length < 4 || p.length % 2 !== 0) return null
  const pares: Partes['pares'] = []
  for (let i = 2; i < p.length; i += 2) {
    if (!p[i] || !p[i + 1]) return null
    pares.push({ coleccion: p[i], id: p[i + 1] })
  }
  return { clinicId: p[1], pares }
}

/** El `patientId` de una ruta que cuelga de un paciente, si cuelga de uno. */
function pacienteDeLaRuta(partes: Partes): string | null {
  return partes.pares[0]?.coleccion === 'patients' ? partes.pares[0].id : null
}

/** Los campos donde un documento nombra a un paciente, en orden de preferencia. */
const CAMPOS_DE_PACIENTE = ['patientId', 'pacienteId', 'paciente_id'] as const

/**
 * El paciente que un documento DECLARA en su contenido.
 *
 * Se exporta porque la compuerta de supresión ARCO (`supresion-arco.ts`) tiene
 * que atribuir exactamente los mismos documentos a exactamente los mismos
 * pacientes que esta comprobación. Dos lecturas distintas de «¿de quién es este
 * documento?» son dos respuestas que pueden divergir, y la que divergiera sería
 * la que deja pasar un expediente suprimido.
 */
export function pacienteDeclarado(datos: Record<string, unknown>): string | null {
  for (const c of CAMPOS_DE_PACIENTE) {
    const v = datos[c]
    if (typeof v === 'string' && v) return v
  }
  const meta = datos.metadata
  if (meta && typeof meta === 'object') {
    for (const c of CAMPOS_DE_PACIENTE) {
      const v = (meta as Record<string, unknown>)[c]
      if (typeof v === 'string' && v) return v
    }
  }
  return null
}

/**
 * Índice de lo que el respaldo contiene, para poder preguntar «¿está ese padre?».
 *
 * `existentes` puede sembrarse además con lo que YA hay en el destino: una
 * adenda cuya nota no viaja en el archivo pero sí existe en el consultorio no
 * es huérfana. Esa distinción es la diferencia entre un aviso útil y ruido.
 */
export interface IndiceDeExistencia {
  /** Rutas completas de documentos presentes (en el archivo o en el destino). */
  rutas: Set<string>
  /** Identificadores de paciente presentes. */
  pacientes: Set<string>
}

export function indexar(docs: readonly DocumentoDelRespaldo[], destino?: IndiceDeExistencia): IndiceDeExistencia {
  const rutas = new Set<string>(destino?.rutas ?? [])
  const pacientes = new Set<string>(destino?.pacientes ?? [])
  for (const d of docs) {
    rutas.add(d.ruta)
    const partes = partirRuta(d.ruta)
    if (partes && partes.pares.length === 1 && partes.pares[0].coleccion === 'patients') {
      pacientes.add(partes.pares[0].id)
    }
  }
  return { rutas, pacientes }
}

/** La ruta del documento padre: se le quitan los dos últimos segmentos. */
export function rutaDelPadre(ruta: string): string | null {
  const p = ruta.split('/')
  return p.length >= 6 ? p.slice(0, -2).join('/') : null
}

/**
 * Comprueba las referencias de un conjunto de documentos.
 *
 * @param docs los documentos del respaldo, ya re-enraizados al destino.
 * @param indice qué existe (archivo + destino).
 * @param clinicIdDestino para detectar referencias a otro consultorio.
 */
export function comprobarReferencias(
  docs: readonly DocumentoDelRespaldo[],
  indice: IndiceDeExistencia,
  clinicIdDestino: string,
): HallazgoReferencial[] {
  const out: HallazgoReferencial[] = []
  const anota = (h: HallazgoReferencial) => out.push(h)

  for (const d of docs) {
    const partes = partirRuta(d.ruta)
    if (!partes) {
      anota({
        codigo: 'ruta-ilegible', severidad: 'P0', ruta: d.ruta, apuntaA: '',
        porQue: 'la ruta no tiene forma de documento de Firestore; sin ella no hay identidad ni padre que comprobar.',
      })
      continue
    }
    if (partes.clinicId !== clinicIdDestino) {
      anota({
        codigo: 'referencia-a-otro-consultorio', severidad: 'P0', ruta: d.ruta,
        apuntaA: partes.clinicId,
        porQue: `el documento llegó a la comprobación todavía enraizado en «${partes.clinicId}» y el destino es «${clinicIdDestino}»: el re-enraizado no se aplicó.`,
      })
    }

    const coleccion = coleccionDeLaRuta(d.ruta) ?? d.coleccion
    const padreEnRuta = pacienteDeLaRuta(partes)
    const declarado = pacienteDeclarado(d.datos)

    /** El paciente que el documento dice que le corresponde tiene que existir. */
    const exigirPaciente = (id: string | null, codigo: CodigoReferencial, sev: Severidad, quien: string) => {
      if (!id) return
      if (indice.pacientes.has(id)) return
      anota({
        codigo, severidad: sev, ruta: d.ruta, apuntaA: id,
        porQue: `${quien} apunta al paciente «${id}», que no está ni en el archivo ni en el consultorio destino.`,
      })
    }

    switch (coleccion) {
      case 'appointments':
        exigirPaciente(declarado, 'cita-sin-paciente', 'P1', 'la cita')
        break
      case 'cobros':
        exigirPaciente(declarado, 'cobro-sin-paciente', 'P2', 'el cobro')
        break
      case 'internamientos':
        exigirPaciente(declarado, 'encuentro-sin-paciente', 'P1', 'el internamiento')
        break
      case 'patients.laboratorios':
        exigirPaciente(padreEnRuta, 'laboratorio-sin-paciente', 'P1', 'el laboratorio')
        break
      case 'patients.fotos':
        exigirPaciente(padreEnRuta, 'foto-sin-paciente', 'P1', 'la fotografía clínica')
        break
      case 'patients.paquetes_visita':
        exigirPaciente(padreEnRuta, 'paquete-sin-paciente', 'P1', 'el paquete de visita')
        break
      case 'patients.notas': {
        exigirPaciente(padreEnRuta, 'encuentro-sin-paciente', 'P0', 'la nota')
        /**
         * ── LA NOTA TIENE QUE SER DEL PACIENTE BAJO EL QUE CUELGA ────────────
         *
         * La ruta dice un paciente y el campo `pacienteId` dice otro. Los dos
         * vienen del mismo archivo y nada obliga a que concuerden — es el mismo
         * modo de fallo que ya cazó `restaurar.ts` con `_ruta` vs `_coleccion`,
         * un nivel más adentro. Aquí la consecuencia es peor: una nota clínica
         * archivada bajo el expediente de otra persona.
         */
        if (padreEnRuta && declarado && declarado !== padreEnRuta) {
          anota({
            codigo: 'nota-de-otro-paciente', severidad: 'P0', ruta: d.ruta, apuntaA: declarado,
            porQue: `la nota cuelga del paciente «${padreEnRuta}» y declara ser del «${declarado}». Escribirla archivaría una nota clínica en el expediente de otra persona.`,
          })
        }
        break
      }
      case 'patients.notas.adendas': {
        const padre = rutaDelPadre(d.ruta)
        if (padre && !indice.rutas.has(padre)) {
          anota({
            codigo: 'adenda-sin-nota', severidad: 'P0', ruta: d.ruta, apuntaA: padre,
            porQue: 'la adenda es el ÚNICO mecanismo de corrección sobre una nota firmada e inmutable (NOM-004). Sin la nota a la que corrige, no corrige nada: es un párrafo suelto con firma.',
          })
        }
        break
      }
      case 'patients.notas.versions': {
        const padre = rutaDelPadre(d.ruta)
        if (padre && !indice.rutas.has(padre)) {
          anota({
            codigo: 'version-de-otra-nota', severidad: 'P1', ruta: d.ruta, apuntaA: padre,
            porQue: 'la versión histórica cuelga de una nota que no está: el linaje del borrador queda sin documento al que pertenecer.',
          })
        }
        /**
         * Y si la versión declara pertenecer a otro paciente, el linaje está
         * cruzado aunque la nota padre exista.
         */
        if (padreEnRuta && declarado && declarado !== padreEnRuta) {
          anota({
            codigo: 'version-de-otra-nota', severidad: 'P0', ruta: d.ruta, apuntaA: declarado,
            porQue: `la versión cuelga del paciente «${padreEnRuta}» y declara ser del «${declarado}»: el historial de un borrador acabaría bajo otro expediente.`,
          })
        }
        break
      }
      default:
        break
    }
  }
  return out
}

/** Resumen por código, para el acta del simulacro. */
export function resumirHallazgos(hs: readonly HallazgoReferencial[]): Record<CodigoReferencial, number> {
  const out = {} as Record<CodigoReferencial, number>
  for (const h of hs) out[h.codigo] = (out[h.codigo] ?? 0) + 1
  return out
}

/** ¿Hay algo que impida dar la restauración por buena? */
export function hayBloqueantes(hs: readonly HallazgoReferencial[]): boolean {
  return hs.some(h => h.severidad === 'P0')
}

export const POR_QUE_NO_SE_REPARA_UNA_REFERENCIA_ROTA =
  'Reconectar una adenda a «la nota que más se parece» es inventarle un padre a ' +
  'una corrección medicolegal. La misma regla que impide escribir una línea que ' +
  'no se entiende impide arreglar una referencia que no se puede resolver: se ' +
  'declara, se enseña, y decide una persona.'
