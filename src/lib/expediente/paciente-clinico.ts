/**
 * SUPERFICIE CLÍNICA PROTEGIDA DEL PACIENTE — núcleo PURO.
 *
 * Unidad Nexus OS E0-06, paso «add» de la secuencia que fijó el dueño:
 *
 *     add → backfill → verify → switch reads → verify → remove legacy
 *
 * Aquí vive el paso «add» ENTERO y nada más: el contrato, el reparto de campos,
 * la fusión de lectura, la comprobación de equivalencia y el plan de la migración.
 * No se ha movido un solo dato de producción, no se ha borrado un solo campo
 * legado, y ninguna pantalla lee todavía desde aquí — eso son los pasos
 * siguientes, y están sin autorizar.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * Las alergias son información clínica y hoy son CAMPOS de `patients/{id}`, un
 * documento que la regla abre con `isMember` porque recepción necesita nombre y
 * teléfono para agendar. Firestore **no autoriza por campo en lectura**: o se lee
 * el documento entero o no se lee. Mientras `alergias` viva ahí, ninguna regla
 * puede impedir que recepción lo lea — el arreglo es de MODELO DE DATOS.
 *
 * La fuente canónica futura es el documento único
 * `clinics/{clinicId}/patients/{patientId}/clinico/resumen`, que la regla ya cierra
 * con `isMedico`. Este módulo es el camino hacia allí.
 *
 * ── LO QUE ESTE MÓDULO SE NIEGA A HACER ─────────────────────────────────────
 *
 * 1. **No crea una segunda Clinical Truth.** El reparto (`repartirCamposDePaciente`)
 *    manda cada clave a UN solo destino; nunca escribe el mismo dato en los dos
 *    sitios. Lo comprueba `alergias-superficie-clinica.test.ts`.
 * 2. **No convierte ausencia en negación.** Si la lectura clínica falla o no está
 *    autorizada, los campos clínicos quedan AUSENTES del objeto fusionado — nunca
 *    `alergias: ''`. Esa cadena vacía es la que en su día imprimió «Negadas» en la
 *    receta de un paciente alérgico (ver `receta-word.ts`). El estado viaja aparte
 *    (`EstadoClinico`) para que la pantalla pueda decir «no disponible».
 * 3. **No destruye la fuente anterior.** Ninguna operación del plan de migración
 *    escribe en `patients/{id}` ni borra nada: el backfill sólo AÑADE el
 *    subdocumento. Retirar los campos legados es el último paso de la secuencia y
 *    exige demostrar equivalencia antes (`equivalenciaClinica`).
 *
 * MÓDULO PURO: sin Firebase, sin red, sin PHI. Se puede razonar y probar entero
 * sin levantar nada. El SDK vive en `paciente-clinico-firestore.ts`.
 */

import {
  CAMPOS_CLINICOS_PACIENTE,
  type AlergiaEstructurada,
  type CampoClinicoPaciente,
  type Patient,
  type ResumenClinicoPaciente,
} from '@/types'
import { alergiasDe } from '@/lib/seguridad/alergias'

/* ────────────────────────────────────────────────────────────────────────────
   1. DÓNDE VIVE
   ──────────────────────────────────────────────────────────────────────── */

/** Id FIJO del documento único. No es una colección de N docs a propósito: se lee
 *  y se escribe siempre completo, así el coste es UNA lectura por pantalla. */
export const ID_RESUMEN_CLINICO = 'resumen'

/** Ruta canónica del resumen clínico de un paciente. */
export function rutaResumenClinico(clinicId: string, patientId: string): string {
  return `clinics/${clinicId}/patients/${patientId}/clinico/${ID_RESUMEN_CLINICO}`
}

/** Ruta del documento ADMINISTRATIVO. Se declara aquí sólo para poder afirmar que
 *  ninguna operación de migración la toca. */
export function rutaPacienteAdministrativo(clinicId: string, patientId: string): string {
  return `clinics/${clinicId}/patients/${patientId}`
}

/* ────────────────────────────────────────────────────────────────────────────
   2. EL ESTADO DE LA LECTURA — el corazón de la seguridad de este módulo
   ──────────────────────────────────────────────────────────────────────── */

/**
 * En qué situación está el dato clínico de este paciente.
 *
 * Los cuatro valores son DISTINTOS y no se colapsan jamás:
 *  · `ok`          — el subdocumento existe y se leyó. Incluye «existe y está vacío»,
 *                    que es una afirmación legítima («no hay alergias registradas»).
 *  · `no_migrado`  — el subdocumento no existe todavía. El dato sigue en el campo
 *                    legado y de ahí se sirve (ventana transitoria del backfill).
 *  · `sin_permiso` — la regla denegó. El lector no es clínico. **No hay dato.**
 *  · `error`       — red, cuota, fallo. **No hay dato.**
 *
 * `sin_permiso` y `error` no se distinguen del `ok` vacío por casualidad: si se
 * confundieran, un fallo de red se leería como «este paciente no tiene alergias».
 */
export type EstadoClinico = 'ok' | 'no_migrado' | 'sin_permiso' | 'error'

export interface LecturaClinica {
  readonly datos: ResumenClinicoPaciente | null
  readonly estado: EstadoClinico
}

/**
 * ¿Se puede AFIRMAR algo sobre el contenido clínico de este paciente?
 *
 * `false` significa que la pantalla debe decir «no disponible» y BLOQUEAR lo que
 * dependa del dato (el cruce alergia↔fármaco, la firma). Nunca «negadas», nunca
 * «no referidas»: eso sería inventar la negación desde una lectura que falló.
 * Regla 4 de seguridad clínica — ausencia de dato no es dato de ausencia.
 */
export function sePuedeAfirmarSobreLoClinico(estado: EstadoClinico): boolean {
  return estado === 'ok' || estado === 'no_migrado'
}

/* ────────────────────────────────────────────────────────────────────────────
   3. EL REPARTO DE CAMPOS — un dato, un destino
   ──────────────────────────────────────────────────────────────────────── */

/**
 * El ÚNICO renombre del traslado. `notas` pasa a llamarse `notasClinicas` porque
 * «notas» ya significa otra cosa en el expediente: la subcolección de notas de
 * consulta. Dos cosas con el mismo nombre acaban leyéndose la una por la otra.
 */
const RENOMBRE = { notas: 'notasClinicas' } as const satisfies
  Partial<Record<CampoClinicoPaciente, keyof ResumenClinicoPaciente>>

/** Cómo se llama, en el subdocumento clínico, el campo que en `Patient` se llama así. */
export function destinoDe(campo: CampoClinicoPaciente): keyof ResumenClinicoPaciente {
  return (RENOMBRE as Record<string, keyof ResumenClinicoPaciente>)[campo]
    ?? (campo as keyof ResumenClinicoPaciente)
}

const CLINICOS = new Set<string>(CAMPOS_CLINICOS_PACIENTE)

/** ¿Esta clave de `Patient` es contenido clínico? */
export function esCampoClinico(clave: string): clave is CampoClinicoPaciente {
  return CLINICOS.has(clave)
}

export interface RepartoDePaciente {
  /** Lo que va al documento `patients/{id}` (lo que recepción puede ver). */
  readonly administrativo: Partial<Patient>
  /** Lo que va al subdocumento `clinico/resumen` (sólo isMedico). */
  readonly clinico: Partial<ResumenClinicoPaciente>
  /** ¿El parche llevaba al menos un campo clínico? */
  readonly tocaLoClinico: boolean
}

/**
 * Reparte un parche de paciente entre los dos documentos.
 *
 * **La invariante que sostiene «no se permite doble Clinical Truth»:** cada clave
 * de la entrada sale en EXACTAMENTE UNO de los dos lados. Nunca en los dos. Si un
 * día alguien duplicara un campo «por compatibilidad», habría dos verdades que
 * podrían divergir y ningún criterio para saber cuál manda.
 *
 * PURO: no escribe nada. Quien escribe es `paciente-clinico-firestore.ts`.
 */
export function repartirCamposDePaciente(parche: Partial<Patient>): RepartoDePaciente {
  const administrativo: Record<string, unknown> = {}
  const clinico: Record<string, unknown> = {}
  let tocaLoClinico = false

  for (const [clave, valor] of Object.entries(parche)) {
    if (esCampoClinico(clave)) {
      tocaLoClinico = true
      clinico[destinoDe(clave)] = valor
    } else {
      administrativo[clave] = valor
    }
  }

  return {
    administrativo: administrativo as Partial<Patient>,
    clinico: clinico as Partial<ResumenClinicoPaciente>,
    tocaLoClinico,
  }
}

/** ¿Este resumen guarda algún contenido clínico de verdad? */
export function hayContenidoClinico(resumen: Partial<ResumenClinicoPaciente> | null | undefined): boolean {
  if (!resumen) return false
  if (typeof resumen.alergias === 'string' && resumen.alergias.trim() !== '') return true
  if (resumen.alergiasEstructuradas?.length) return true
  if (typeof resumen.notasClinicas === 'string' && resumen.notasClinicas.trim() !== '') return true
  if (resumen.txValoracion && Object.keys(resumen.txValoracion).length > 0) return true
  if (resumen.txValoracionHist?.length) return true
  return false
}

/* ────────────────────────────────────────────────────────────────────────────
   4. LA FUSIÓN DE LECTURA — y el fail-closed
   ──────────────────────────────────────────────────────────────────────── */

export interface PacienteFusionado {
  readonly paciente: Patient
  readonly estadoClinico: EstadoClinico
}

/**
 * Une el documento administrativo con la lectura clínica y devuelve el paciente
 * tal como lo espera el resto del producto — más el estado de esa lectura.
 *
 * El objeto sale tipado como `Patient` para que los ~100 usos de
 * `paciente.alergias` no tengan que reescribirse en el paso «switch reads». Lo que
 * cambia por dentro es DE DÓNDE sale el valor:
 *
 *  · `ok` CON SELLO (`migradoEn`)  → sale del subdocumento, y SÓLO de ahí. Si el
 *                    subdocumento no trae el campo, el campo queda ausente aunque
 *                    el documento administrativo todavía lo tenga: el paciente ya
 *                    migró y su legado dejó de ser verdad.
 *  · `ok` SIN SELLO → el subdocumento manda campo a campo, y lo que él no trae se
 *                    sirve del legado. Es el estado de un paciente cuyo médico ya
 *                    escribió algo clínico por la superficie nueva pero al que el
 *                    backfill todavía no ha llegado: sin este respaldo, apuntar una
 *                    alergia haría desaparecer de la pantalla sus antecedentes.
 *  · `no_migrado`  → sale del campo legado. Es la ventana transitoria: sin esto,
 *                    entre el «add» y el «backfill» los pacientes se quedarían sin
 *                    alergias en pantalla, que es peor que el agujero que se cierra.
 *  · `sin_permiso` → AUSENTE. El lector no es clínico y no ve contenido clínico.
 *  · `error`       → AUSENTE. No se sabe, y no saber se dice.
 *
 * En los dos últimos, `estadoClinico` obliga a la pantalla a declararlo. Ese es el
 * contrato: el objeto no miente y el estado no se puede ignorar sin verlo.
 *
 * ── EL SELLO ES EL INTERRUPTOR DEL CORTE ────────────────────────────────────
 *
 * Que el respaldo al legado se apague con `migradoEn` —y no con una constante del
 * código— es lo que hace que el `switch reads` de la secuencia del dueño sea una
 * operación de DATOS y no un despliegue: el backfill sella a quien ha verificado, y
 * ese paciente deja de mirar atrás. Y el rollback es quitar el sello, con lo que
 * vuelve a mirar atrás. Ningún cambio de código en medio, en ninguna de las dos
 * direcciones.
 */
export function fusionarPaciente(administrativo: Patient, lectura: LecturaClinica): PacienteFusionado {
  const fusionado = { ...administrativo } as Record<string, unknown>

  if (lectura.estado === 'no_migrado') {
    // Se dejan los campos legados intactos: son la única fuente que hay.
    return { paciente: fusionado as unknown as Patient, estadoClinico: lectura.estado }
  }

  const sellado = Boolean(lectura.datos?.migradoEn)

  for (const campo of CAMPOS_CLINICOS_PACIENTE) {
    const legado = fusionado[campo]
    // Se BORRA la clave, no se pone ''. Una cadena vacía es una afirmación.
    delete fusionado[campo]
    if (lectura.estado !== 'ok') continue
    const valor = (lectura.datos as Record<string, unknown> | null)?.[destinoDe(campo)]
    if (valor !== undefined && valor !== null) fusionado[campo] = valor
    else if (!sellado && legado !== undefined && legado !== null) fusionado[campo] = legado
  }

  return { paciente: fusionado as unknown as Patient, estadoClinico: lectura.estado }
}

/* ────────────────────────────────────────────────────────────────────────────
   5. EL INDICADOR NO DESCRIPTIVO (política del dueño, punto 4)
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Lo único que una superficie ADMINISTRATIVA puede saber del expediente clínico.
 *
 * El dueño autorizó avisar de que «existe un asunto clínico» sin revelar su
 * naturaleza. Por eso se enciende con CUALQUIER contenido clínico —alergias,
 * antecedentes o valoración—, no sólo con alergias: un indicador que se encendiera
 * exactamente cuando hay alergia revelaría, por inferencia, que el paciente es
 * alérgico. Que sea ambiguo es el punto, no un descuido.
 *
 * **Residual declarado:** el indicador sí revela que EXISTE algo clínico anotado.
 * Es el precio de que el mostrador pueda decir «esto lo tiene que ver el médico»,
 * y es lo que el dueño autorizó — no más.
 */
export type IndicadorAdministrativo = 'requiere_revision_clinica' | 'ninguno'

/** Texto de cara al usuario. Vive aquí para que no se escriba de doce maneras. */
export const TEXTO_INDICADOR_ADMINISTRATIVO = 'Requiere revisión clínica'

export function indicadorAdministrativo(
  resumen: Partial<ResumenClinicoPaciente> | null | undefined,
): IndicadorAdministrativo {
  return hayContenidoClinico(resumen) ? 'requiere_revision_clinica' : 'ninguno'
}
