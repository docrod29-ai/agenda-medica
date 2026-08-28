/**
 * HERRAMIENTA DE MIGRACIÓN DEL PHI CLÍNICO — el plan, la equivalencia, el rollback.
 *
 * Unidad Nexus OS E0-06. Ejecuta la parte de la secuencia del dueño que ocurre UNA
 * VEZ, desde un script y sobre la máquina del dueño:
 *
 *     add → [ backfill → verify ] → switch reads → verify → [ remove legacy ]
 *              ↑ esto              ↑ y esto
 *
 * ── POR QUÉ VIVE AQUÍ Y NO EN `src/lib/expediente/` ─────────────────────────
 *
 * Porque no es un motor clínico ni código de producto: **ninguna pantalla lo llama
 * ni debe llamarlo.** Su único consumidor es `scripts/migrar-phi-clinico.mjs`, que
 * corre a mano, con Admin SDK y con autorización expresa. La política que SÍ corre
 * en el camino del médico —el reparto de campos, la fusión de lectura, el estado de
 * la lectura, el indicador administrativo— vive en
 * `@/lib/expediente/paciente-clinico` y se importa desde aquí. No hay dos copias.
 *
 * ── LO QUE NO PUEDE HACER ───────────────────────────────────────────────────
 *
 * Retirar un campo legado. No existe aquí ninguna operación que escriba en
 * `patients/{id}` ni que borre contenido clínico: el plan es un DATO y
 * `operacionEsSegura` lo comprueba pieza a pieza, en la prueba y en el script.
 * Retirar los campos es el último paso de la secuencia, exige equivalencia
 * demostrada y está SIN AUTORIZAR.
 *
 * MÓDULO PURO: sin Firebase, sin red, sin PHI.
 */

import {
  CAMPOS_CLINICOS_PACIENTE,
  type AlergiaEstructurada,
  type CampoClinicoPaciente,
  type Patient,
  type ResumenClinicoPaciente,
} from '@/types'
import { alergiasDe } from '@/lib/seguridad/alergias'
import {
  ID_RESUMEN_CLINICO,
  destinoDe,
  hayContenidoClinico,
  rutaPacienteAdministrativo,
  rutaResumenClinico,
} from '@/lib/expediente/paciente-clinico'

/* ────────────────────────────────────────────────────────────────────────────
   1. LA PROYECCIÓN QUE COPIA EL BACKFILL
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Proyección del documento legado al resumen clínico. Es lo que copia el backfill.
 *
 * **Sólo copia lo que EXISTE.** Un paciente sin campo `alergias` no adquiere un
 * `alergias: ''` en el destino: adquirir una afirmación que nadie hizo es
 * exactamente el fallo que esta unidad viene a evitar. Un `alergias: ''` que SÍ
 * estaba en el origen se copia tal cual, porque el backfill tiene que ser una
 * copia fiel para que la equivalencia se pueda demostrar.
 */
export function resumenDesdePaciente(legado: Partial<Patient>): Partial<ResumenClinicoPaciente> {
  const out: Record<string, unknown> = {}
  for (const campo of CAMPOS_CLINICOS_PACIENTE) {
    const valor = (legado as Record<string, unknown>)[campo]
    if (valor === undefined || valor === null) continue
    out[destinoDe(campo)] = valor
  }
  return out as Partial<ResumenClinicoPaciente>
}

/* ────────────────────────────────────────────────────────────────────────────
   2. EQUIVALENCIA — la condición para retirar un campo legado (punto 8)
   ──────────────────────────────────────────────────────────────────────── */

/** Clave de comparación de un alérgeno: el nombre, sin acentos ni mayúsculas. */
function claveDeAlergeno(a: AlergiaEstructurada): string {
  return a.alergeno.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export interface Equivalencia {
  /** `true` sólo si NADA se perdió ni cambió. Es la condición del punto 8. */
  readonly equivalente: boolean
  /** Campos que estaban en el origen y no llegaron al destino. */
  readonly camposFaltantes: readonly CampoClinicoPaciente[]
  /** Campos que llegaron con otro contenido. */
  readonly camposDistintos: readonly CampoClinicoPaciente[]
  /** Alérgenos del origen que el destino no reproduce. */
  readonly alergenosPerdidos: readonly string[]
  /** Alérgenos cuya REACCIÓN o GRAVEDAD se perdió o cambió por el camino. */
  readonly detallesPerdidos: readonly string[]
}

/**
 * ¿El resumen clínico reproduce, sin pérdida, lo que decía el documento legado?
 *
 * Se comprueba en dos planos a propósito:
 *
 *  · **Campo a campo** (comparación estructural): caza un renombre mal hecho o una
 *    copia truncada.
 *  · **Alergia a alergia** (comparación clínica, a través del normalizador
 *    canónico `alergiasDe`): caza lo que la comparación de campos no ve. El texto
 *    libre y la lista estructurada pueden decir lo mismo escrito distinto, y lo que
 *    importa para la seguridad del paciente es que no desaparezca un alérgeno, una
 *    reacción ni una gravedad — que es literalmente lo que pide el punto 9.
 *
 * No decide nada clínico: compara lo que hay a los dos lados de la frontera. Es la
 * regla «el dato tiene que LLEGAR» hecha función.
 */
export function equivalenciaClinica(
  legado: Partial<Patient>,
  resumen: Partial<ResumenClinicoPaciente> | null | undefined,
): Equivalencia {
  const camposFaltantes: CampoClinicoPaciente[] = []
  const camposDistintos: CampoClinicoPaciente[] = []

  for (const campo of CAMPOS_CLINICOS_PACIENTE) {
    const origen = (legado as Record<string, unknown>)[campo]
    if (origen === undefined || origen === null) continue    // nada que conservar
    const destino = (resumen as Record<string, unknown> | null | undefined)?.[destinoDe(campo)]
    if (destino === undefined || destino === null) { camposFaltantes.push(campo); continue }
    if (JSON.stringify(destino) !== JSON.stringify(origen)) camposDistintos.push(campo)
  }

  /* Plano clínico: el normalizador canónico, el mismo del que ya leen la receta,
     la nota, el recurso FHIR y el sesgo del reconocedor. */
  const antes = alergiasDe(legado)
  const despues = alergiasDe(resumen ?? {})
  const porClave = new Map(despues.map(a => [claveDeAlergeno(a), a]))

  const alergenosPerdidos: string[] = []
  const detallesPerdidos: string[] = []
  for (const a of antes) {
    const llegada = porClave.get(claveDeAlergeno(a))
    if (!llegada) { alergenosPerdidos.push(a.alergeno); continue }
    if (a.reaccion && llegada.reaccion !== a.reaccion) detallesPerdidos.push(`${a.alergeno}: reacción`)
    if (a.severidad && llegada.severidad !== a.severidad) detallesPerdidos.push(`${a.alergeno}: gravedad`)
  }

  return {
    equivalente: camposFaltantes.length === 0 && camposDistintos.length === 0
      && alergenosPerdidos.length === 0 && detallesPerdidos.length === 0,
    camposFaltantes, camposDistintos, alergenosPerdidos, detallesPerdidos,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   3. EL PLAN DE LA MIGRACIÓN — dato, no imperativo
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Una operación del backfill. Es un DATO, no una llamada: así el guardián puede
 * afirmar sobre el plan ENTERO antes de que toque la base, y la prueba de «el
 * fallo de migración no destruye la fuente anterior» no necesita una base de datos
 * para ser verdad — necesita que el plan no contenga ninguna operación destructiva.
 */
export type OperacionMigracion =
  | {
      readonly tipo: 'escribir_resumen'
      readonly ruta: string
      readonly datos: Partial<ResumenClinicoPaciente>
      /** Siempre `merge`: nunca se pisa lo que el médico ya escribió en el destino. */
      readonly fusionar: true
    }
  | {
      readonly tipo: 'quitar_sello'
      readonly ruta: string
    }

export type MotivoDeBackfill = 'a_migrar' | 'ya_migrado' | 'sin_contenido_clinico'

export interface PlanDeBackfill {
  readonly patientId: string
  readonly motivo: MotivoDeBackfill
  readonly operaciones: readonly OperacionMigracion[]
}

/**
 * Qué habría que escribir para migrar a este paciente. **Idempotente:** un paciente
 * que ya trae `migradoEn` no genera ninguna operación, así que el script se puede
 * relanzar tantas veces como haga falta sin duplicar ni pisar nada.
 *
 * Un paciente SIN contenido clínico también recibe su documento —con el sello y
 * nada más—: es lo que distingue «ya se miró y no había nada» de «todavía no se ha
 * mirado», y sin esa diferencia el paso `verify` no puede cerrar. No adquiere
 * ninguna alergia al hacerlo: `resumenDesdePaciente` no inventa campos.
 */
export function planDeBackfill(args: {
  clinicId: string
  patientId: string
  legado: Partial<Patient>
  resumenActual: Partial<ResumenClinicoPaciente> | null
  ahora: string
  uid: string
}): PlanDeBackfill {
  const { clinicId, patientId, legado, resumenActual, ahora, uid } = args
  const ruta = rutaResumenClinico(clinicId, patientId)

  if (resumenActual?.migradoEn) {
    return { patientId, motivo: 'ya_migrado', operaciones: [] }
  }

  const proyeccion = resumenDesdePaciente(legado)
  const datos: Partial<ResumenClinicoPaciente> = {
    ...proyeccion,
    actualizadoEn: ahora,
    actualizadoPor: uid,
    migradoEn: ahora,
  }

  return {
    patientId,
    motivo: hayContenidoClinico(proyeccion) ? 'a_migrar' : 'sin_contenido_clinico',
    operaciones: [{ tipo: 'escribir_resumen', ruta, datos, fusionar: true }],
  }
}

/**
 * Cómo se deshace el backfill ANTES del corte — la condición «rollback disponible»
 * del punto 9.
 *
 * Es corto porque tiene que serlo: mientras los campos legados sigan en su sitio
 * (y siguen: retirarlos es el último paso y está sin autorizar), deshacer la
 * migración es quitar el sello. Al perder `migradoEn` el paciente vuelve a leerse
 * como `no_migrado`, o sea desde el campo legado — el estado exacto de antes.
 *
 * Que el rollback sea trivial NO es suerte: es la consecuencia de que el backfill
 * sólo AÑADA. Un backfill que hubiera borrado el origen no tendría rollback, y por
 * eso el borrado va en un paso aparte que exige la equivalencia demostrada.
 */
export function planDeRollback(clinicId: string, patientId: string): PlanDeBackfill {
  return {
    patientId,
    motivo: 'ya_migrado',
    operaciones: [{ tipo: 'quitar_sello', ruta: rutaResumenClinico(clinicId, patientId) }],
  }
}

/**
 * ¿Esta operación puede destruir la fuente anterior?
 *
 * El guardián en tiempo de EJECUCIÓN, no sólo en la prueba: el script lo llama
 * sobre cada operación antes de mandarla, así que una operación mal formada aborta
 * la corrida en vez de escribirse. Dos condiciones, las dos necesarias:
 *
 *  · la ruta es EXACTAMENTE la del resumen clínico de un paciente — se reconstruye
 *    a partir de la propia ruta y se compara, en vez de mirar sólo el sufijo: así
 *    una ruta que terminara bien pero apuntara a otro sitio no cuela;
 *  · y no es la del documento administrativo, dicho aparte y a propósito, porque
 *    ése es el destino que haría daño;
 *  · el tipo de operación es uno de los dos conocidos (no hay ninguno destructivo:
 *    el tipo lo impide, y esto lo comprueba también en runtime por si alguien
 *    amplía la unión sin mirar aquí).
 */
export function operacionEsSegura(op: OperacionMigracion): boolean {
  const partes = op.ruta.split('/')
  // clinics/{c}/patients/{p}/clinico/resumen → seis segmentos, ni uno más.
  if (partes.length !== 6) return false
  const [, clinicId, , patientId] = partes
  if (op.ruta !== rutaResumenClinico(clinicId, patientId)) return false
  if (op.ruta === rutaPacienteAdministrativo(clinicId, patientId)) return false
  if (!op.ruta.endsWith(`/clinico/${ID_RESUMEN_CLINICO}`)) return false
  return op.tipo === 'escribir_resumen' || op.tipo === 'quitar_sello'
}
