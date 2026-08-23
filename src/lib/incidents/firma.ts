/**
 * LA FIRMA — un mismo fallo, un mismo nombre, mil veces.
 *
 * ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────
 *
 * Una llave muerta falla en CADA llamada. Sin firma, una tarde de caída son diez
 * mil documentos idénticos, diez mil avisos y una consola ilegible justo cuando
 * más falta hace. `src/lib/ia/incidentes-servidor.ts` ya resolvió esto para la
 * IA agrupando por `proveedor_clase_HORA`; aquí se generaliza a cualquier
 * categoría **sin cambiar aquella clave**, que sigue siendo la suya.
 *
 * ── QUÉ ENTRA Y QUÉ NO ───────────────────────────────────────────────────────
 *
 * Entra: categoría · subtipo · función · plantilla de ruta · proveedor · código
 * normalizado · versión de la app. Todo etiqueta, todo vocabulario cerrado.
 *
 * NO entra: paciente, transcripción, nota, diagnóstico, texto del usuario, ni el
 * cuerpo crudo del error. Y no por convención: `verificarFirmaLibreDePHI()` lo
 * comprueba, y `firmaDe()` **lanza** si algún componente no tiene forma de
 * etiqueta. Un incidente que no se puede firmar sin PHI es un incidente que no
 * se firma.
 *
 * ── POR QUÉ LA VERSIÓN ENTRA EN LA FIRMA ─────────────────────────────────────
 *
 * Porque «lo mismo que ayer» y «lo mismo que ayer pero desde el despliegue de
 * esta mañana» son dos incidentes distintos y el segundo es una regresión. Si la
 * versión no estuviera, la regresión nueva se sumaría al contador del incidente
 * viejo y desaparecería dentro de él. `familiaDe()` da la vista sin versión para
 * cuando lo que se quiere es justo lo contrario: ver el fallo a través de los
 * despliegues.
 *
 * Módulo PURO.
 */
import { redactarString } from '@/lib/security/sanitize'
import { esEtiqueta, type EventoIncidente } from './taxonomia'

/**
 * Convierte una ruta real en PLANTILLA.
 *
 * `/consulta/8f2a-…/nota` → `/consulta/[id]/nota`. Un identificador de paciente
 * en la firma sería un identificador de paciente en cada alerta, en cada
 * agrupación y en la consola de soporte: es exactamente el fallo que este módulo
 * existe para no cometer.
 *
 * Se sustituye por LONGITUD y por FORMA, no por una lista de rutas conocidas:
 * una lista se queda atrás en cuanto alguien añade una ruta y entonces el
 * identificador pasa entero.
 */
export function plantillaDeRuta(ruta: string | null | undefined): string {
  const r = String(ruta ?? '').split('?')[0].split('#')[0]
  if (!r) return ''
  const partes = r.split('/').map(seg => {
    if (!seg) return seg
    if (/^\[.+\]$/.test(seg)) return seg                  // ya es plantilla
    if (/^\d+$/.test(seg)) return '[id]'                  // ordinal o folio
    if (/[0-9]/.test(seg) && seg.length >= 8) return '[id]' // firestore id, uuid, token
    if (seg.length > 24) return '[id]'                    // nada legítimo es tan largo
    return seg.toLowerCase()
  })
  return partes.join('/')
}

/** El componente vacío se escribe así y no como cadena vacía: la firma es legible. */
const VACIO = '-'

/** Los componentes de la firma, en orden y ya normalizados. */
export interface ComponentesFirma {
  readonly categoria: string
  readonly subtipo: string
  readonly feature: string
  readonly ruta: string
  readonly proveedor: string
  readonly codigo: string
  readonly appVersion: string
}

/**
 * Extrae los componentes y COMPRUEBA que cada uno tenga forma de etiqueta.
 *
 * @throws si alguno no la tiene. Es deliberado: devolver una firma degradada
 * dejaría pasar el texto libre disfrazado de identidad, y quien la recibe no
 * tendría forma de saber que la firma que está leyendo no es de fiar.
 */
export function componentesDe(e: EventoIncidente): ComponentesFirma {
  const ruta = plantillaDeRuta(e.ruta)
  // La plantilla lleva `/` y `[]`, que no son forma de etiqueta: se valida aparte.
  if (ruta && !/^[a-z0-9/[\]_.-]{1,120}$/.test(ruta)) {
    throw new Error(`[incidents/firma] ruta no normalizable: no puede entrar en una firma`)
  }
  const c: ComponentesFirma = {
    categoria: e.categoria,
    subtipo: e.subtipo,
    feature: e.feature,
    ruta: ruta || VACIO,
    proveedor: e.proveedor ?? VACIO,
    codigo: e.codigoNormalizado ?? VACIO,
    appVersion: e.appVersion,
  }
  for (const [campo, valor] of Object.entries(c)) {
    if (campo === 'ruta') continue
    /**
     * El centinela de «no aplica» no es una etiqueta y no tiene por qué serlo:
     * es la ausencia del componente, escrita de forma legible. Validarlo contra
     * la forma de etiqueta rechazaría todo incidente sin proveedor — que es la
     * mayoría de ellos.
     */
    if (valor === VACIO) continue
    if (!esEtiqueta(valor)) {
      throw new Error(
        `[incidents/firma] «${campo}» no es una etiqueta admisible. ` +
        'La identidad de un incidente es vocabulario cerrado: un mensaje de ' +
        'error, un nombre o una frase no pueden entrar aquí.',
      )
    }
  }
  return c
}

/**
 * La firma determinista de un evento.
 *
 * Legible a propósito: quien la lee en la consola de soporte tiene que poder
 * decir qué es sin consultar una tabla. Un hash sería más corto y obligaría a
 * guardar los componentes al lado para poder leerlo — dos fuentes de verdad para
 * lo mismo, que es la cosa que este repositorio no hace.
 */
export function firmaDe(e: EventoIncidente): string {
  const c = componentesDe(e)
  return [c.categoria, c.subtipo, c.feature, c.ruta, c.proveedor, c.codigo, c.appVersion].join('|')
}

/**
 * La FAMILIA: la misma firma sin la versión.
 *
 * Sirve para la pregunta contraria a la de la firma: «¿esto ya pasaba antes del
 * despliegue?». Un incidente cuya familia tiene historia y cuya firma es nueva
 * es una regresión con fecha.
 */
export function familiaDe(e: EventoIncidente): string {
  const c = componentesDe(e)
  return [c.categoria, c.subtipo, c.feature, c.ruta, c.proveedor, c.codigo].join('|')
}

export interface VerificacionPHI {
  limpia: boolean
  /** Qué componente falló y por qué. Vacío cuando está limpia. */
  motivos: string[]
}

/**
 * ¿Esta firma podría llevar PHI dentro?
 *
 * Dos barreras, en este orden:
 *
 *  1. **Forma.** Ya la impone `componentesDe()`. Aquí se repite sobre la firma
 *     YA construida, porque una firma puede llegar de un documento guardado, de
 *     un JSON de la consola o de otro proceso — sitios donde nadie la construyó
 *     con esta función.
 *  2. **Contenido.** Se pasa por `redactarString` de `security/sanitize.ts`, que
 *     ya sabe de CURP, RFC, correos, teléfonos, tarjetas y tokens. Si redactar
 *     CAMBIA la cadena, es que había algo que redactar.
 *
 * La segunda barrera no sustituye a la primera y hay que decirlo: `redactarString`
 * no detecta nombres —ningún regex los distingue de «monoterapia»—, así que la
 * defensa real es la forma. La redacción es el cinturón.
 */
export function verificarFirmaLibreDePHI(firma: string): VerificacionPHI {
  const motivos: string[] = []
  const partes = firma.split('|')
  if (partes.length !== 7) motivos.push(`la firma tiene ${partes.length} componentes y debe tener 7`)
  for (const p of partes) {
    if (p === VACIO) continue
    if (/\s/.test(p)) motivos.push(`«${p.slice(0, 24)}» lleva espacios: es texto, no etiqueta`)
    if (/[A-ZÁÉÍÓÚÑ]/.test(p)) motivos.push(`«${p.slice(0, 24)}» lleva mayúsculas o acentos: es texto, no etiqueta`)
    if (p.length > 120) motivos.push('un componente pasa de 120 caracteres: no es una etiqueta')
  }
  if (redactarString(firma) !== firma) {
    motivos.push('el redactor de logs encontró un identificador dentro de la firma')
  }
  return { limpia: motivos.length === 0, motivos }
}

export const POR_QUE_LA_VERSION_ENTRA_EN_LA_FIRMA =
  'Porque sin ella la regresión que trajo el despliegue de esta mañana se suma ' +
  'al contador del incidente de la semana pasada y desaparece dentro de él. ' +
  'Con ella, la firma es nueva y la familia tiene historia: eso es exactamente ' +
  'lo que significa «regresión», dicho en datos.'
