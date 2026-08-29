/**
 * RESTAURAR EL RESPALDO — el camino de vuelta que no existía.
 *
 * ── POR QUÉ ESTE ARCHIVO ES LA MITAD QUE FALTABA ─────────────────────────────
 *
 * v947 dejó el respaldo del consultorio bien: servidor, NDJSON, paginado, con
 * cabecera y pie. Pero **no había importador**. Y un respaldo que no se puede
 * volver a meter no es un respaldo: es un archivo del que nadie sabe si sirve.
 *
 * «Tenemos respaldos» sin una restauración probada es una hipótesis, no un
 * hecho. El propio `scripts/respaldos-verificar.mjs` lo dice al terminar: «falta
 * una cosa que esto no puede comprobar: haber RESTAURADO alguna vez».
 *
 * ── LAS TRES REGLAS QUE ORDENAN LA RESTAURACIÓN ──────────────────────────────
 *
 * 1. **Una línea que no se entiende NO se escribe.** Adivinar dónde va un
 *    documento es peor que dejarlo fuera: lo deja mal puesto y nadie se entera.
 * 2. **Se re-enraíza al consultorio destino, y se DICE.** Un respaldo trae rutas
 *    con el `clinicId` de origen; escribirlas tal cual metería los pacientes de
 *    un consultorio en otro. Se reescribe la raíz y el informe lo declara.
 * 3. **Las llaves de API no entran nunca.** El respaldo las excluye, pero un
 *    archivo editado a mano podría traerlas — y escribir credenciales desde un
 *    archivo subido es exactamente la puerta que no se deja abierta.
 *
 * ── LA CUARTA REGLA, QUE LLEGÓ DESPUÉS (REG-348) ─────────────────────────────
 *
 * 4. **Lo que pertenece al consultorio por un CAMPO también vuelve.** Tres
 *    colecciones son del consultorio sin colgar de él (`clinic_members`,
 *    `clinic_invitations`, `clinic_review_requests`): llevan el `clinicId` en un
 *    campo, no en la ruta. El respaldo aprendió a llevárselas (REG-343) y el
 *    camino de vuelta seguía escrito sólo para el árbol, así que las rechazaba
 *    todas por «ruta con forma inesperada».
 *
 *    Y el re-enraizado de éstas **no es de ruta, es de campo**: se fuerza el
 *    campo al consultorio destino, por el mismo motivo por el que se reescribe
 *    la raíz — el destino lo decide quien restaura, no el archivo.
 *
 * Módulo PURO: quien escriba en Firestore es la ruta.
 */
import { COLECCIONES_RAIZ, EXCLUIDAS, RAIZ_EXCLUIDAS, type ColeccionRaiz } from '@/lib/clinica/respaldo'

/** Una línea del NDJSON, ya interpretada. */
export type LineaLeida =
  | { clase: 'cabecera'; datos: Record<string, unknown> }
  | { clase: 'pie'; datos: Record<string, unknown> }
  | {
      clase: 'documento'; nivel: 'clinica'
      ruta: string; coleccion: string; datos: Record<string, unknown>
    }
  | {
      clase: 'documento'; nivel: 'raiz'
      ruta: string; coleccion: string; datos: Record<string, unknown>
      /** Campo por el que este documento declara a qué consultorio pertenece. */
      campoClinica: string
    }
  | { clase: 'rechazada'; porQue: string; crudo: string }

/**
 * LA COLECCIÓN QUE UNA RUTA REPRESENTA DE VERDAD.
 *
 * `clinics/X/patients/P`                       → `patients`
 * `clinics/X/patients/P/notas/N`               → `patients.notas`
 * `clinics/X/patients/P/notas/N/adendas/A`     → `patients.notas.adendas`
 *
 * Se salta `clinics/{id}` y se queda con los segmentos IMPARES, que en Firestore
 * son los nombres de colección. Devuelve `null` si la forma no cuadra, para que
 * el llamador la rechace en vez de inventarse un destino.
 */
export function coleccionDeLaRuta(ruta: string): string | null {
  const partes = String(ruta ?? '').split('/')
  if (partes[0] !== 'clinics' || partes.length < 4 || partes.length % 2 !== 0) return null
  const nombres: string[] = []
  for (let i = 2; i < partes.length; i += 2) {
    if (!partes[i]) return null
    nombres.push(partes[i])
  }
  return nombres.join('.')
}

/**
 * LA COLECCIÓN DE NIVEL RAÍZ QUE UNA RUTA REPRESENTA — si es una de las que se
 * respaldan con el consultorio.
 *
 *     `clinic_members/UID`   → la entrada de `COLECCIONES_RAIZ`
 *     `patients/P`           → null (no es de nivel raíz: cuelga del árbol)
 *     `platform_planes/X`    → null (declarada FUERA del respaldo)
 *
 * La lista blanca es el MISMO manifiesto que usa el exportador. Aquí no hay
 * ruta que reescribir —el identificador es global— así que lo único que impide
 * que un archivo editado a mano escriba en cualquier colección de la base con
 * el SDK admin, que se salta las reglas de Firestore, es esta comprobación.
 */
export function coleccionRaizDeLaRuta(ruta: string): ColeccionRaiz | null {
  const partes = String(ruta ?? '').split('/')
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null
  return COLECCIONES_RAIZ.find(c => c.ruta === partes[0]) ?? null
}

/**
 * Por qué NO entra una ruta de dos segmentos que no está en el manifiesto.
 *
 * Cuando la colección está declarada fuera del respaldo con su motivo, se
 * devuelve ese motivo: quien lea el informe tiene que poder distinguir «esto no
 * se restaura a propósito» de «esto no se entendió».
 */
function porQueNoEsRaizRestaurable(nombre: string): string {
  const familia = nombre.startsWith('platform_') ? 'platform_*' : nombre
  const motivo = RAIZ_EXCLUIDAS[familia]
  if (motivo) return `«${nombre}» no se respalda y tampoco se restaura: ${motivo}`
  return `colección de nivel raíz no declarada en el respaldo: ${nombre}`
}

/**
 * Interpreta una línea del archivo.
 *
 * @returns `rechazada` con su razón cuando no se entiende. Nunca lanza: una
 *   línea rota no puede abortar la restauración de las otras diez mil.
 */
export function leerLinea(crudo: string): LineaLeida | null {
  const t = crudo.trim()
  if (!t) return null
  let o: Record<string, unknown>
  try {
    o = JSON.parse(t) as Record<string, unknown>
  } catch {
    return { clase: 'rechazada', porQue: 'no es JSON válido', crudo: t.slice(0, 120) }
  }
  if (o._tipo === 'cabecera') return { clase: 'cabecera', datos: o }
  if (o._tipo === 'pie') return { clase: 'pie', datos: o }

  const ruta = String(o._ruta ?? '')
  const coleccion = String(o._coleccion ?? '')
  if (!ruta || !coleccion) {
    return { clase: 'rechazada', porQue: 'sin `_ruta` o `_coleccion`: no se sabe dónde va', crudo: t.slice(0, 120) }
  }
  /**
   * La ruta tiene que ser un DOCUMENTO: número par de segmentos, empezando por
   * `clinics/{id}`. Una ruta impar apunta a una colección, y escribir un
   * documento en una colección es inventarle un identificador.
   */
  const partes = ruta.split('/')
  /**
   * ── NIVEL RAÍZ (REG-348) ─────────────────────────────────────────────────
   *
   * Dos segmentos y no cuelga de `clinics/{id}`: es una de las colecciones que
   * pertenecen al consultorio por un CAMPO. El exportador las escribe así desde
   * REG-343 (`clinic_members/UID`), y aquí se rechazaban todas —«ruta con forma
   * inesperada»—, así que el respaldo se llevaba lo que ata una cuenta a un
   * consultorio y la restauración no sabía devolverlo.
   *
   * Sólo las tres del manifiesto. Cualquier otra cae por la lista blanca, con
   * su motivo cuando está declarada fuera.
   */
  if (partes.length === 2) {
    const raiz = coleccionRaizDeLaRuta(ruta)
    if (!raiz) {
      return { clase: 'rechazada', porQue: porQueNoEsRaizRestaurable(partes[0]), crudo: t.slice(0, 120) }
    }
    const { _ruta: _r2, _coleccion: _c2, ...datosRaiz } = o
    void _r2; void _c2
    return {
      clase: 'documento', nivel: 'raiz', ruta,
      coleccion: raiz.ruta, campoClinica: raiz.campoClinica, datos: datosRaiz,
    }
  }
  if (partes[0] !== 'clinics' || partes.length < 4 || partes.length % 2 !== 0) {
    return { clase: 'rechazada', porQue: `ruta con forma inesperada: ${ruta}`, crudo: t.slice(0, 120) }
  }
  /**
   * ── LA COLECCIÓN SE DERIVA DE LA RUTA, NO SE CREE LO QUE DECLARA ──────────
   *
   * Aquí se devolvía el `_coleccion` del archivo, y el importador validaba ESE
   * campo mientras escribía en `_ruta`. Los dos vienen del mismo archivo y nada
   * obligaba a que concordaran: un respaldo manipulado podía declarar
   * `_coleccion: "patients"` —inocua y admitida— y apuntar `_ruta` a
   * `clinics/X/patients/P/notas/N`, una **nota firmada**.
   *
   * El importador usa el SDK admin, que **ignora las reglas de Firestore**: la
   * regla que hace inmutable una nota firmada (NOM-024) no se evalúa por este
   * camino. La validación era, literalmente, sobre un campo distinto del que
   * decidía el destino.
   *
   * Derivándola de la ruta, declarar una cosa y escribir en otra deja de ser
   * posible: lo que se valida y lo que se escribe son el mismo dato.
   */
  const derivada = coleccionDeLaRuta(ruta)
  if (!derivada) {
    return { clase: 'rechazada', porQue: `no se pudo derivar la colección de: ${ruta}`, crudo: t.slice(0, 120) }
  }
  const { _ruta, _coleccion, ...datos } = o
  void _ruta; void _coleccion
  return { clase: 'documento', nivel: 'clinica', ruta, coleccion: derivada, datos }
}

/**
 * Reescribe la raíz de la ruta al consultorio destino.
 *
 * Un respaldo trae `clinics/<origen>/patients/…`. Escribirlo tal cual metería
 * los pacientes de un consultorio en otro — o los devolvería al de origen, que
 * puede ser justo el que se está intentando reconstruir desde cero.
 */
export function reenraizar(ruta: string, clinicIdDestino: string): string {
  const partes = ruta.split('/')
  partes[1] = clinicIdDestino
  return partes.join('/')
}

/**
 * EL RE-ENRAIZADO DE LAS DE NIVEL RAÍZ: por CAMPO, no por ruta.
 *
 * Su identificador es global (`clinic_members/{uid}`), así que la ruta no dice a
 * qué consultorio pertenece el documento: lo dice un campo. Se fuerza al
 * destino por el mismo motivo por el que la ruta se reescribe siempre — quien
 * decide el destino es quien restaura, no el archivo.
 *
 * Dejar pasar el valor del archivo tendría una consecuencia concreta y muda:
 * una membresía restaurada seguiría apuntando al consultorio de ORIGEN, así que
 * el consultorio reconstruido tendría su expediente entero y **ni un solo
 * miembro** — que es exactamente el defecto que REG-343 quiso cerrar.
 */
export function reenraizarPorCampo(
  datos: Record<string, unknown>, campoClinica: string, clinicIdDestino: string,
): Record<string, unknown> {
  return { ...datos, [campoClinica]: clinicIdDestino }
}

export interface Veredicto {
  escribir: boolean
  porQue: string
}

/**
 * ¿SE PUEDE ESCRIBIR ESTE DOCUMENTO DE NIVEL RAÍZ, VISTO LO QUE YA HAY?
 *
 * Aquí no hay re-enraizado de ruta que separe consultorios: `clinic_members/U`
 * es la MISMA ruta en todos. Un `merge` sobre una membresía viva —de una
 * persona que hoy trabaja en otro consultorio— la arrastraría al consultorio
 * que se está restaurando, y esa persona perdería el acceso al suyo sin que
 * nadie hiciera nada mal. Restaurar no puede quitarle a nadie lo que tiene.
 *
 * Por eso el destino se lee ANTES de escribir, también en modo ensayo: un
 * ensayo que no ve la colisión no ensaya el paso que puede fallar.
 *
 * Un documento existente **sin** el campo de consultorio se trata como ajeno:
 * no se sabe de quién es, y pisar lo que no se sabe de quién es no es
 * restaurar.
 *
 * @param existente `undefined` cuando no hay documento en esa ruta.
 */
export function admitirRaizExistente(
  existente: Record<string, unknown> | undefined,
  campoClinica: string,
  clinicIdDestino: string,
): Veredicto {
  if (!existente) return { escribir: true, porQue: '' }
  const deQuienEs = existente[campoClinica]
  if (deQuienEs === clinicIdDestino) return { escribir: true, porQue: '' }
  const deQuien = typeof deQuienEs === 'string' && deQuienEs
    ? `otro consultorio (${deQuienEs})` : 'nadie declarado'
  return {
    escribir: false,
    porQue: `ese identificador ya existe y pertenece a ${deQuien}: restaurarlo se lo quitaría`,
  }
}

/**
 * ¿Se escribe este documento?
 *
 * `EXCLUIDAS` se consulta en los dos sentidos: lo que no sale en un respaldo
 * tampoco entra por uno. Si algún día se decide respaldar algo que hoy está
 * excluido, las dos mitades cambian a la vez y solas.
 */
export function admitir(coleccion: string): Veredicto {
  const raiz = coleccion.split('.')[0]
  if (raiz in EXCLUIDAS) {
    return {
      escribir: false,
      porQue: `«${raiz}» no se respalda y tampoco se restaura: ${EXCLUIDAS[raiz]}`,
    }
  }
  return { escribir: true, porQue: '' }
}

export interface InformeRestauracion {
  /** Documentos escritos (o que se escribirían, en modo ensayo). */
  escritos: number
  /** Por colección, para poder comparar con el respaldo. */
  porColeccion: Record<string, number>
  /** Líneas que no se entendieron o no se admiten, con su razón. */
  rechazadas: { porQue: string; crudo: string }[]
  /** ¿Traía pie? Sin él, el archivo puede estar cortado a la mitad. */
  archivoCompleto: boolean
  /** El `clinicId` del que salió el respaldo, si la cabecera lo decía. */
  origen: string | null
  /** `true` si se reescribió la raíz porque origen ≠ destino. */
  reenraizado: boolean
  /**
   * Documentos de nivel raíz cuyo campo de consultorio traía OTRO valor y se
   * reapuntó al destino. Sin esto una membresía volvería apuntando al origen.
   */
  raizReapuntada: number
  /**
   * Documentos de nivel raíz que NO se escribieron porque su identificador ya
   * pertenece a otro consultorio. Se cuentan aparte porque son la única pérdida
   * que una restauración puede tener sin que el archivo esté mal.
   */
  raizDeOtroConsultorio: number
}

export const POR_QUE_LA_RAIZ_SE_REAPUNTA_AL_DESTINO =
  'Las colecciones que pertenecen al consultorio por un CAMPO no se re-enraízan ' +
  'reescribiendo la ruta —su identificador es global—, sino forzando el campo al ' +
  'consultorio destino. Si se dejara pasar el valor del archivo, el consultorio ' +
  'reconstruido tendría el expediente entero y ni un solo miembro: justo el ' +
  'defecto que el respaldo de estas colecciones existe para evitar.'

export const POR_QUE_SOLO_A_CLINICA_VACIA =
  'Restaurar sobre un consultorio que ya tiene datos mezcla dos historias ' +
  'clínicas sin que nadie pueda distinguirlas después. El respaldo se restaura ' +
  'a un consultorio vacío; sobrescribir uno con datos exige pedirlo a propósito.'

export const POR_QUE_UNA_LINEA_ROTA_NO_ABORTA =
  'Una línea corrupta no puede tumbar la restauración de las otras diez mil: ' +
  'ése es el motivo de que el respaldo sea NDJSON y no un JSON único. Se ' +
  'rechaza con su razón y el informe la enseña, porque una restauración que no ' +
  'dice qué se quedó fuera no se puede dar por buena.'
