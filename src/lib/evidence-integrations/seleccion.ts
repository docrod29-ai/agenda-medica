/**
 * ══════════════════════════════════════════════════════════════════════════
 * SELECCIÓN Y ORDEN DE PROVEEDORES (#314: «sin enseñarle al médico la
 * complejidad de proveedores»)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * #314 pide que el Evidence Engine ordene fuentes por pregunta clínica,
 * especialidad, recencia, autoridad y accesibilidad — y que el médico no vea
 * nada de eso. El médico pregunta; el sistema decide a quién consultar.
 *
 * ── LO QUE ESTE ARCHIVO SE PROHÍBE A SÍ MISMO ───────────────────────────────
 *
 * NO puntúa AUTORIDAD METODOLÓGICA. No dice que una revisión sistemática valga
 * más que un ensayo, ni que una guía valga más que una cohorte. Eso es criterio
 * clínico, y ponerlo aquí como un número sería inventarlo (regla 1 de
 * `.claude/rules/clinical-safety.md`) — con el agravante de que un número tiene
 * pinta de haber salido de algún sitio.
 *
 * Lo que sí ordena son señales OPERATIVAS y comprobables:
 *   · ¿está operativo el adaptador?      (accesibilidad — la más importante)
 *   · ¿puede respaldar o sólo descubrir? (rol, puntos 7 y 8 de #314)
 *   · ¿su clase encaja con la pregunta?  (una ficha de fármaco para una
 *                                         pregunta de dosis, un registro de
 *                                         ensayos para una de tratamiento)
 *
 * La CLASE de fuente no es un peso de evidencia: es qué publica cada sitio.
 * Preguntar por una dosis en ClinicalTrials.gov no es «menos riguroso», es
 * buscar en el sitio equivocado.
 *
 * ── LA REGLA DE ORO DEL ORDEN ───────────────────────────────────────────────
 *
 * Un proveedor NO OPERATIVO baja al final, pero NO DESAPARECE. Tiene que
 * seguir en la lista para que su sobre `not_configured` se genere y el médico
 * lea «UpToDate: no se consultó». Filtrarlo aquí sería la forma más limpia
 * posible de violar el punto 9 de #314: la fuente desaparecería sin que nadie
 * hubiera escrito una mentira.
 */

import {
  entradaDeCatalogo, proveedoresDeRespaldo,
  type ClaseDeFuente, type ProveedorDeEvidencia,
} from './catalogo'
import type { AdaptadorDeEvidencia, ConsultaDeEvidencia } from './contrato'

/**
 * Intención de la pregunta. Se declara con un vocabulario cerrado y corto: es
 * VOCABULARIO, NO CRITERIO (regla 5 de `.claude/rules/clinical-safety.md`).
 * Que falte una intención significa que ese caso cae en `general` y se consulta
 * todo — nunca que se descarte silenciosamente.
 */
export type IntencionClinica =
  | 'tratamiento' | 'diagnostico' | 'pronostico'
  | 'dosis_o_farmaco' | 'prevencion' | 'general'

/**
 * Qué clases de fuente encajan con cada intención. Vale para ORDENAR, no para
 * excluir: lo que no encaja se consulta igual, sólo que después.
 */
const ENCAJE: Readonly<Record<IntencionClinica, readonly ClaseDeFuente[]>> = {
  tratamiento: ['revision_sistematica', 'guia_de_practica', 'literatura_primaria', 'registro_de_ensayos'],
  diagnostico: ['guia_de_practica', 'revision_sistematica', 'literatura_primaria'],
  pronostico: ['literatura_primaria', 'revision_sistematica'],
  dosis_o_farmaco: ['ficha_de_farmaco', 'guia_de_practica', 'referencia_terciaria'],
  prevencion: ['guia_de_practica', 'revision_sistematica', 'literatura_primaria'],
  general: [],
}

/**
 * Clasificador de intención por palabras clave.
 *
 * ES DELIBERADAMENTE TONTO Y CONSERVADOR. Ante la duda devuelve `general`, que
 * consulta de todo. Un clasificador listo que se equivoca manda la pregunta al
 * sitio equivocado y NO trae la evidencia buena; uno tonto que duda trae de más.
 * De los dos errores, el segundo es el barato.
 *
 * NO decide nada clínico: sólo el ORDEN en que se pregunta.
 */
export function intencionDe(pregunta: string): IntencionClinica {
  const t = ` ${pregunta.toLowerCase()} `
  const hay = (...ps: string[]) => ps.some(p => t.includes(p))
  if (hay('dosis', 'mg/kg', 'ajuste renal', 'posolog', 'interacc', 'contraindic')) return 'dosis_o_farmaco'
  if (hay('prevenc', 'profilax', 'vacun', 'tamiz', 'cribado')) return 'prevencion'
  if (hay('pronóstic', 'pronostic', 'mortalidad', 'superviv', 'riesgo de morir')) return 'pronostico'
  if (hay('diagnóstic', 'diagnostic', 'sensibilidad', 'especificidad', 'prueba de')) return 'diagnostico'
  if (hay('tratar', 'tratamiento', 'terapia', 'antibiót', 'antibiot', 'esquema', 'duración del', 'duracion del')) return 'tratamiento'
  return 'general'
}

export interface ProveedorOrdenado {
  readonly proveedor: ProveedorDeEvidencia
  readonly operativo: boolean
  /** Sólo para depuración y benchmark. NUNCA se le enseña al médico. */
  readonly puntuacion: number
  readonly porQue: string
}

/**
 * Ordena los adaptadores disponibles para una consulta.
 *
 * Los no operativos van al final PERO SIGUEN EN LA LISTA (ver encabezado).
 */
export function ordenarProveedores(
  adaptadores: readonly AdaptadorDeEvidencia[],
  consulta: ConsultaDeEvidencia,
): readonly ProveedorOrdenado[] {
  const intencion = intencionDe(consulta.pregunta)
  const encaje = ENCAJE[intencion]

  return adaptadores.map(a => {
    const cat = entradaDeCatalogo(a.proveedor)
    const disp = a.disponibilidad()
    let puntuacion = 0
    const razones: string[] = []

    // 1. ACCESIBILIDAD. Domina todo lo demás: una fuente perfecta a la que no
    //    se puede llamar no aporta nada a esta consulta.
    if (disp.operativo) { puntuacion += 100; razones.push('operativo') }
    else razones.push(`no operativo (${disp.faltante ?? 'sin detalle'})`)

    // 2. ROL. Sólo `respaldo` puede sostener afirmaciones.
    if (cat.rol === 'respaldo') { puntuacion += 40; razones.push('puede respaldar') }
    else { puntuacion += 5; razones.push(`rol ${cat.rol}: orienta, no respalda`) }

    // 3. ENCAJE con la intención. Peso pequeño a propósito: es una heurística
    //    de orden, no un juicio sobre la calidad de la fuente.
    const i = encaje.indexOf(cat.clase)
    if (i >= 0) {
      puntuacion += 20 - i * 4
      razones.push(`encaja con "${intencion}" (${cat.clase})`)
    }

    // 4. Empate estable por nombre: sin esto el orden cambiaría entre
    //    ejecuciones y el benchmark dejaría de ser reproducible.
    return {
      proveedor: a.proveedor,
      operativo: disp.operativo,
      puntuacion,
      porQue: razones.join('; '),
    }
  }).sort((x, y) => y.puntuacion - x.puntuacion || (x.proveedor < y.proveedor ? -1 : x.proveedor > y.proveedor ? 1 : 0))
}

/**
 * Los proveedores que hay que CONSULTAR, en orden, y los que hay que
 * DECLARAR aunque no se consulten.
 *
 * La separación es el punto 9 de #314 hecho estructura de datos: quien llama no
 * puede quedarse sólo con `aConsultar` sin notar que existe `aDeclarar`.
 */
export interface PlanDeConsulta {
  readonly intencion: IntencionClinica
  readonly aConsultar: readonly ProveedorDeEvidencia[]
  /** No operativos. Producen sobre `not_configured`, que el médico debe leer. */
  readonly aDeclarar: readonly ProveedorDeEvidencia[]
}

export function planDeConsulta(
  adaptadores: readonly AdaptadorDeEvidencia[],
  consulta: ConsultaDeEvidencia,
): PlanDeConsulta {
  const orden = ordenarProveedores(adaptadores, consulta)
  return {
    intencion: intencionDe(consulta.pregunta),
    aConsultar: orden.filter(o => o.operativo).map(o => o.proveedor),
    aDeclarar: orden.filter(o => !o.operativo).map(o => o.proveedor),
  }
}

/**
 * ¿Puede una consulta salir adelante con lo que hay operativo?
 *
 * Responde a la condición de degradación de #314: la evidencia es OPCIONAL y su
 * caída no puede bloquear al médico. Si no hay ni un proveedor de respaldo
 * operativo, la respuesta correcta no es un error: es seguir sin evidencia y
 * DECIRLO.
 */
export function hayRespaldoOperativo(adaptadores: readonly AdaptadorDeEvidencia[]): boolean {
  const respaldo = new Set(proveedoresDeRespaldo())
  return adaptadores.some(a => respaldo.has(a.proveedor) && a.disponibilidad().operativo)
}
