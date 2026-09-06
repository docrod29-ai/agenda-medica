import type { Patient } from '@/types'

/**
 * Utilidades puras para exportar/importar pacientes en CSV.
 * Sin dependencias externas. Testeable de forma aislada.
 */

/** Normaliza un teléfono a solo dígitos (para deduplicar de forma robusta). */
export function normalizarTel(t?: string): string {
  return (t ?? '').replace(/\D/g, '')
}

/** Normaliza un nombre para comparar (minúsculas, sin acentos ni espacios extra). */
export function normalizarNombre(n?: string): string {
  return (n ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Escapa un campo para CSV. Delega en `celdaSegura`, que además de las comillas
 * neutraliza la inyección de fórmulas (un paciente llamado "=cmd|..." ejecutaba
 * la fórmula al abrir el export en Excel).
 */
import { celdaSegura } from '@/lib/csv-seguro'
import { validarCURP, normalizarCURP, fechaNacimientoDesdeCURP, sexoDesdeCURP } from '@/lib/curp'
function celda(v: unknown): string {
  return celdaSegura(v)
}

export const COLUMNAS_EXPORT: { key: keyof Patient; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'fechaNacimiento', label: 'Fecha de nacimiento' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'curp', label: 'CURP' },
  { key: 'seguroMedico', label: 'Seguro' },
  { key: 'alergias', label: 'Alergias' },
  { key: 'notas', label: 'Notas' },
  { key: 'ultimaCita', label: 'Última cita' },
]

/** Serializa una lista de pacientes a texto CSV (con BOM para Excel). */
export function pacientesACsv(pacientes: Patient[]): string {
  const head = COLUMNAS_EXPORT.map(c => celda(c.label)).join(',')
  const filas = pacientes.map(p =>
    COLUMNAS_EXPORT.map(c => celda((p as unknown as Record<string, unknown>)[c.key as string])).join(','),
  )
  return '﻿' + [head, ...filas].join('\r\n')
}

/** Parser CSV mínimo pero correcto (respeta comillas y saltos de línea internos). */
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = []
  let campo = ''
  let fila: string[] = []
  let enComillas = false
  const t = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ } else enComillas = false
      } else campo += c
    } else if (c === '"') {
      enComillas = true
    } else if (c === ',') {
      fila.push(campo); campo = ''
    } else if (c === '\n') {
      fila.push(campo); filas.push(fila); campo = ''; fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  // descarta filas totalmente vacías
  return filas.filter(f => f.some(x => x.trim() !== ''))
}

/**
 * LAS PIEZAS DEL NOMBRE QUE NO SON UN CAMPO DEL PACIENTE — ASE-004.
 *
 * `Patient` guarda UN nombre completo. Casi cualquier sistema mexicano exporta
 * tres columnas: nombre de pila, apellido paterno y apellido materno. El
 * auto-mapeo se escribió contra el CSV que exporta esta misma app (una sola
 * columna «Nombre»), así que esas dos columnas devolvían `null`, `construirFilas`
 * las ignoraba y 1 200 pacientes entraban con SOLO su nombre de pila, sin aviso.
 *
 * No se inventa un campo nuevo en el expediente: se reconocen las columnas y se
 * COMPONE el nombre al construir la fila. La fuente de verdad sigue siendo una.
 */
export type PiezaDelNombre = 'apellidoPaterno' | 'apellidoMaterno' | 'apellidos'

/** Lo que una columna del archivo puede alimentar. */
export type CampoImportado = keyof Patient | PiezaDelNombre

/** Sinónimos de encabezado → campo del paciente, para auto-mapear la importación. */
const SINONIMOS: Record<string, CampoImportado> = {
  nombre: 'nombre', paciente: 'nombre', 'nombre completo': 'nombre', name: 'nombre',
  nombres: 'nombre', 'nombre s': 'nombre', 'nombre de pila': 'nombre', 'primer nombre': 'nombre',
  'nombre del paciente': 'nombre', 'first name': 'nombre', firstname: 'nombre',
  apellidos: 'apellidos', apellido: 'apellidos', 'apellidos del paciente': 'apellidos',
  'last name': 'apellidos', lastname: 'apellidos', surname: 'apellidos',
  'apellido paterno': 'apellidoPaterno', paterno: 'apellidoPaterno', 'primer apellido': 'apellidoPaterno',
  'apellido 1': 'apellidoPaterno', apellidopaterno: 'apellidoPaterno',
  'apellido materno': 'apellidoMaterno', materno: 'apellidoMaterno', 'segundo apellido': 'apellidoMaterno',
  'apellido 2': 'apellidoMaterno', apellidomaterno: 'apellidoMaterno',
  telefono: 'telefono', 'teléfono': 'telefono', tel: 'telefono', celular: 'telefono', movil: 'telefono', 'móvil': 'telefono', phone: 'telefono',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  email: 'email', correo: 'email', 'correo electrónico': 'email', mail: 'email',
  'fecha de nacimiento': 'fechaNacimiento', nacimiento: 'fechaNacimiento', fechanacimiento: 'fechaNacimiento', dob: 'fechaNacimiento',
  'fecha nacimiento': 'fechaNacimiento', 'f nacimiento': 'fechaNacimiento', 'fecha de nac': 'fechaNacimiento',
  sexo: 'sexo', genero: 'sexo', 'género': 'sexo',
  curp: 'curp',
  seguro: 'seguroMedico', 'seguro medico': 'seguroMedico', 'seguro médico': 'seguroMedico', aseguradora: 'seguroMedico',
  alergias: 'alergias', alergia: 'alergias',
  notas: 'notas', observaciones: 'notas', comentarios: 'notas',
}

export function mapearEncabezados(encabezados: string[]): (CampoImportado | null)[] {
  return encabezados.map(h => SINONIMOS[normalizarNombre(h)] ?? null)
}

/**
 * LAS COLUMNAS QUE SE VAN A TIRAR, DICHAS ANTES DE IMPORTAR.
 *
 * El hueco de ASE-004 no dolió por el mapeo: dolió porque nadie lo vio. Esto
 * devuelve, para la vista previa, qué columnas del archivo TRAEN DATO y no
 * alimentan ningún campo — que es la única lista que hace falta enseñar en rojo.
 */
export function columnasDescartadas(csv: string[][], mapeo: (CampoImportado | null)[]): { indice: number; encabezado: string; ejemplo: string }[] {
  const encabezados = csv[0] ?? []
  const cuerpo = csv.slice(1)
  const fuera: { indice: number; encabezado: string; ejemplo: string }[] = []
  encabezados.forEach((h, i) => {
    if (mapeo[i]) return
    const ejemplo = cuerpo.map(f => (f[i] ?? '').trim()).find(v => v !== '')
    if (!ejemplo) return                     // columna vacía: tirarla no pierde nada
    fuera.push({ indice: i, encabezado: h.trim() || `columna ${i + 1}`, ejemplo })
  })
  return fuera
}

/* ════════════════════════════════════════════════════════════════════════════
   LO QUE VIENE DE UN ARCHIVO NO ESTÁ EN EL FORMATO DE LA CASA — ASE-003/005
   ════════════════════════════════════════════════════════════════════════════

   Familia REG-160: el dato se valida en un formato (ISO, el del formulario) y
   se escribe en otro (el de Excel es-MX, dd/mm/aaaa) sin que nadie traduzca.

   `fechaNacimiento` se guardaba tal cual venía. «15/03/1980» no lo entiende
   `fechaLocalDesdeISO`, así que la edad no se derivaba —y de la edad comen la
   dosis pediátrica, los percentiles y las escalas de riesgo— y el motor de
   duplicados compara la fecha como CADENA, así que ese mismo paciente
   capturado a mano como «1980-03-15» era otra persona para siempre.

   Aquí se traduce ANTES de escribir. Lo que no se puede traducir NO se escribe
   —el campo queda vacío, que es la verdad— y se anota como reparo visible: una
   corrección en silencio sobre el dato de un paciente está prohibida (regla 3
   de seguridad clínica), y tirarlo sin decirlo es la misma falta.
*/

/** En qué orden vienen día y mes en las fechas de este archivo. */
export type OrdenDeFecha = 'dia-primero' | 'mes-primero'

/**
 * Por omisión, es-MX: día/mes/año.
 *
 * No es una adivinanza que resuelva la ambigüedad —«03/04/1975» sigue pudiendo
 * ser el 3 de abril o el 4 de marzo—: es el valor con el que se PREGUNTA. La
 * pantalla de migración detecta las fechas ambiguas del archivo y ofrece
 * cambiarlo antes de importar (clinical-safety §6: se pregunta, no se adivina).
 */
export const ORDEN_DE_FECHA_POR_OMISION: OrdenDeFecha = 'dia-primero'

const DIAS_DEL_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function esFechaDeCalendario(a: number, m: number, d: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (a < 1900 || a > 2100 || m < 1 || m > 12 || d < 1) return false
  const bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
  const tope = m === 2 && !bisiesto ? 28 : DIAS_DEL_MES[m - 1]
  return d <= tope
}

const enISO = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Las dos formas en las que una hoja de cálculo escribe una fecha. */
const ISO_SUELTA = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
const DIA_Y_MES = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/

/**
 * La fecha del archivo, en ISO (`aaaa-mm-dd`), o `null` si no se entiende.
 *
 * Devuelve `null` —y no una fecha plausible— para el año de dos cifras
 * («15/03/80»): elegir el siglo por el que suena bien es exactamente lo que
 * convierte a un señor de 1926 en un recién nacido.
 */
export function fechaISODesdeTextoDeArchivo(
  cruda: string | null | undefined,
  orden: OrdenDeFecha = ORDEN_DE_FECHA_POR_OMISION,
): string | null {
  const t = String(cruda ?? '').trim()
  if (!t) return null

  const i = ISO_SUELTA.exec(t)
  if (i) {
    const a = Number(i[1]), m = Number(i[2]), d = Number(i[3])
    return esFechaDeCalendario(a, m, d) ? enISO(a, m, d) : null
  }

  const p = DIA_Y_MES.exec(t)
  if (p) {
    const x = Number(p[1]), y = Number(p[2]), a = Number(p[3])
    // Un número mayor que 12 sólo puede ser el día: el archivo se declara solo
    // y el orden que haya elegido el médico no manda sobre un hecho.
    let d: number, m: number
    if (x > 12) { d = x; m = y }
    else if (y > 12) { d = y; m = x }
    else if (orden === 'mes-primero') { m = x; d = y }
    else { d = x; m = y }
    return esFechaDeCalendario(a, m, d) ? enISO(a, m, d) : null
  }

  return null
}

/**
 * ¿Esta fecha puede leerse de dos maneras? («03/04/1975» = 3 de abril o 4 de
 * marzo.) Es lo que la pantalla tiene que PREGUNTAR, una vez por archivo.
 */
export function fechaDeArchivoEsAmbigua(cruda: string | null | undefined): boolean {
  const p = DIA_Y_MES.exec(String(cruda ?? '').trim())
  if (!p) return false
  const x = Number(p[1]), y = Number(p[2])
  return x <= 12 && y <= 12 && x !== y
}

/**
 * SEXO — «M» ES AMBIGUO Y NO SE ADIVINA.
 *
 * En México conviven dos convenciones: H/M (Hombre/Mujer) y M/F
 * (Masculino/Femenino). Una «M» suelta significa cosas opuestas según cuál use
 * el sistema del que se viene. El archivo suele declararse solo —si en la
 * columna aparece también una «H», la «M» es Mujer; si aparece una «F», es
 * Masculino— y leer eso es leer un hecho, no adivinar. Sin esa pista, no se
 * escribe nada.
 */
export type PistaDeLaM = 'M-es-masculino' | 'M-es-mujer'

const SEXO_SINONIMOS: Record<string, 'Masculino' | 'Femenino' | 'Otro'> = {
  masculino: 'Masculino', hombre: 'Masculino', varon: 'Masculino', male: 'Masculino', h: 'Masculino',
  femenino: 'Femenino', mujer: 'Femenino', female: 'Femenino', f: 'Femenino',
  otro: 'Otro', 'no binario': 'Otro', indeterminado: 'Otro', x: 'Otro',
}

/** Qué significa la «M» en ESTE archivo, deducido de la propia columna. */
export function deducirQueSignificaLaM(valores: readonly string[]): PistaDeLaM | null {
  const n = valores.map(v => normalizarNombre(v))
  if (n.some(v => v === 'h' || v === 'hombre')) return 'M-es-mujer'
  if (n.some(v => v === 'f' || v === 'femenino')) return 'M-es-masculino'
  return null
}

export function normalizarSexoImportado(
  raw: string | null | undefined,
  pista?: PistaDeLaM | null,
): 'Masculino' | 'Femenino' | 'Otro' | null {
  const v = normalizarNombre(raw ?? '')
  if (!v) return null
  if (v === 'm') {
    if (pista === 'M-es-masculino') return 'Masculino'
    if (pista === 'M-es-mujer') return 'Femenino'
    return null                                     // ambiguo: se declara, no se elige
  }
  return SEXO_SINONIMOS[v] ?? null
}

/** Un dato del archivo que no pudo usarse tal cual. Se ENSEÑA, nunca se calla. */
export interface ReparoDeFila {
  campo: 'fechaNacimiento' | 'sexo' | 'curp'
  /** Lo que traía el archivo, verbatim. */
  valor: string
  motivo: string
  /** `descartado` = no se guarda · `derivado` = se rellenó desde otro dato del archivo. */
  gravedad: 'descartado' | 'derivado'
}

export interface FilaImport {
  nombre: string
  telefono: string
  whatsapp?: string
  email?: string
  /** SIEMPRE en ISO `aaaa-mm-dd` cuando existe. Lo ilegible no llega hasta aquí. */
  fechaNacimiento?: string
  /** SIEMPRE 'Masculino' | 'Femenino' | 'Otro' cuando existe. */
  sexo?: string
  /** SIEMPRE un CURP de formato válido cuando existe. */
  curp?: string
  seguroMedico?: string
  alergias?: string
  notas?: string
  /** Lo que venía en el archivo y no se pudo usar (o se dedujo). Para la pantalla. */
  reparos?: ReparoDeFila[]
}

/** Cómo leer las columnas de ESTE archivo. Lo elige el médico en la pantalla. */
export interface OpcionesDeImportacion {
  ordenDeFecha?: OrdenDeFecha
}

/**
 * Une el nombre de pila con los apellidos cuando vienen en columnas separadas.
 * El orden es el de una identidad mexicana: nombre + paterno + materno.
 */
function componerNombre(pieza: Record<string, string>): string {
  const partes = [pieza.nombre, pieza.apellidoPaterno, pieza.apellidoMaterno, pieza.apellidos]
  return partes.filter(x => (x ?? '').trim() !== '').join(' ').replace(/\s+/g, ' ').trim()
}

/** Construye filas tipadas a partir del CSV + el mapeo de columnas. */
export function construirFilas(
  csv: string[][],
  mapeo: (CampoImportado | null)[],
  opciones: OpcionesDeImportacion = {},
): FilaImport[] {
  const cuerpo = csv.slice(1)
  const orden = opciones.ordenDeFecha ?? ORDEN_DE_FECHA_POR_OMISION

  // La pista de la «M» se lee del archivo ENTERO, no de la fila: una fila sola
  // nunca puede declararse.
  const colSexo = mapeo.indexOf('sexo')
  const pistaM = colSexo >= 0 ? deducirQueSignificaLaM(cuerpo.map(f => f[colSexo] ?? '')) : null

  return cuerpo.map(cols => {
    const bruto: Record<string, string> = {}
    mapeo.forEach((campo, idx) => {
      if (campo && cols[idx] != null) bruto[campo] = cols[idx].trim()
    })

    const reparos: ReparoDeFila[] = []
    const fila: FilaImport = {
      nombre: componerNombre(bruto),
      telefono: bruto.telefono ?? '',
    }
    for (const k of ['whatsapp', 'email', 'seguroMedico', 'alergias', 'notas'] as const) {
      if (bruto[k]) fila[k] = bruto[k]
    }

    // ── CURP: identidad oficial. O tiene forma de CURP, o no se guarda. ──────
    const curpCrudo = bruto.curp ?? ''
    let curpBueno = ''
    if (curpCrudo) {
      const limpio = normalizarCURP(curpCrudo)
      if (validarCURP(limpio)) { curpBueno = limpio; fila.curp = limpio }
      else reparos.push({
        campo: 'curp', valor: curpCrudo, gravedad: 'descartado',
        motivo: 'No tiene forma de CURP (18 caracteres con el patrón oficial). No se guardó.',
      })
    }

    // ── Fecha de nacimiento ─────────────────────────────────────────────────
    const fechaCruda = bruto.fechaNacimiento ?? ''
    if (fechaCruda) {
      const norm = fechaISODesdeTextoDeArchivo(fechaCruda, orden)
      if (norm) fila.fechaNacimiento = norm
      else reparos.push({
        campo: 'fechaNacimiento', valor: fechaCruda, gravedad: 'descartado',
        motivo: 'No se entiende como fecha (usa dd/mm/aaaa o aaaa-mm-dd, con el año de cuatro cifras). No se guardó.',
      })
    }
    // El CURP válido lleva la fecha dentro: si el archivo no la traía, se
    // rellena DESDE ÉL y se dice de dónde salió. Nada aparece sin procedencia.
    if (!fila.fechaNacimiento && curpBueno) {
      const delCurp = fechaNacimientoDesdeCURP(curpBueno)
      if (delCurp) {
        fila.fechaNacimiento = delCurp
        reparos.push({
          campo: 'fechaNacimiento', valor: delCurp, gravedad: 'derivado',
          motivo: 'Salió del CURP: el archivo no traía una fecha de nacimiento legible.',
        })
      }
    }

    // ── Sexo ────────────────────────────────────────────────────────────────
    const sexoCrudo = bruto.sexo ?? ''
    if (sexoCrudo) {
      const norm = normalizarSexoImportado(sexoCrudo, pistaM)
      if (norm) fila.sexo = norm
      else reparos.push({
        campo: 'sexo', valor: sexoCrudo, gravedad: 'descartado',
        motivo: normalizarNombre(sexoCrudo) === 'm'
          ? 'La «M» puede ser Masculino o Mujer y este archivo no lo aclara. No se guardó: corrígelo en el expediente.'
          : 'No se reconoce (usa Masculino/Femenino, H/F u Hombre/Mujer). No se guardó.',
      })
    }
    if (!fila.sexo && curpBueno) {
      const delCurp = sexoDesdeCURP(curpBueno)
      if (delCurp) {
        fila.sexo = delCurp
        reparos.push({
          campo: 'sexo', valor: delCurp, gravedad: 'derivado',
          motivo: 'Salió del CURP: el archivo no traía un sexo reconocible.',
        })
      }
    }

    if (reparos.length) fila.reparos = reparos
    return fila
  }).filter(f => f.nombre !== '')  // el nombre es obligatorio
}

import { compararPacientes, type PacienteComparable } from '@/lib/pacientes/duplicados'

export type EstadoFila = 'nuevo' | 'duplicado' | 'sin_nombre'

/**
 * CON QUIÉN CHOCÓ ESTA FILA — ASE-007.
 *
 * La vista previa decía «N duplicados (se omiten)» y pintaba la fila en gris.
 * No decía con QUIÉN coincidía ni con cuánta certeza, así que el médico no
 * podía distinguir «es el mismo, ya lo tengo» de «es su hijo, que se llama
 * igual». Omitir sin enseñar la evidencia es decidir por él en silencio.
 *
 * El umbral BAJO de esta función es deliberado y se explica más abajo (evita
 * duplicar el consultorio entero al reimportar el mismo archivo). Lo que
 * faltaba no era subirlo: era enseñar contra qué se chocó y dejar forzar.
 */
export interface CoincidenciaDeFila {
  id: string
  nombre: string
  motivo: string
  certeza: 'seguro' | 'probable'
}

export interface FilaClasificada {
  fila: FilaImport
  estado: EstadoFila
  /** El expediente existente (o la fila anterior del archivo) con el que chocó. */
  coincide?: CoincidenciaDeFila
}

/**
 * Marca cada fila como nueva o duplicada contra los pacientes existentes.
 *
 * ── LO QUE ESTA FUNCIÓN HACÍA MAL, Y POR QUÉ AQUÍ DUELE MÁS ─────────────────
 *
 * Usaba la misma regla rota que el formulario —el teléfono bastaba por sí solo—
 * pero con una consecuencia mucho peor: en el formulario se PREGUNTABA, y aquí
 * la fila marcada «duplicado» simplemente NO SE IMPORTA.
 *
 * En México el celular es de la casa. Un médico que se trae sus pacientes de
 * otro sistema, con la madre ya registrada y sus tres hijos compartiendo su
 * número, importaba a la madre y **perdía a los tres hijos en silencio** — y el
 * reporte final decía «3 duplicados», como si eso fuera lo correcto. Pérdida de
 * datos que se lee como un trabajo bien hecho.
 *
 * Y al revés se le escapaban los de verdad: el nombre sólo se comparaba cuando
 * NO había teléfono, así que un mismo paciente con dos números entraba dos veces.
 *
 * ── AHORA ──────────────────────────────────────────────────────────────────
 *
 * Se usa el MISMO motor que el alta y el barrido (`compararPacientes`): el
 * parecido del nombre es condición necesaria, el teléfono sólo refuerza, y la
 * fecha de nacimiento separa. Una sola definición de «es la misma persona» para
 * toda la aplicación, en vez de tres que discrepan.
 *
 * También se comparan las filas del archivo ENTRE SÍ —un CSV exportado de otro
 * sistema trae repetidos con frecuencia— y con los mismos criterios, no sólo por
 * teléfono como antes.
 */
export function clasificarFilas(filas: FilaImport[], existentes: Patient[]): FilaClasificada[] {
  const comparables: PacienteComparable[] = existentes.map(p => ({
    id: p.id, nombre: p.nombre, telefono: p.telefono, whatsapp: p.whatsapp,
    curp: p.curp, fechaNacimiento: p.fechaNacimiento, edad: p.edad,
  }))
  return filas.map(f => {
    const nombre = (f.nombre ?? '').trim()
    if (!nombre) return { fila: f, estado: 'sin_nombre' as EstadoFila }
    const candidato: PacienteComparable = {
      nombre,
      telefono: f.telefono,
      whatsapp: f.whatsapp,
      curp: f.curp,
      fechaNacimiento: f.fechaNacimiento,
    }
    /**
     * Aquí basta CUALQUIER coincidencia del motor, no sólo una «segura».
     *
     * Es distinto que en el alta a mano, y a propósito. Importar el mismo archivo
     * dos veces es un accidente comunísimo, y con un listón alto —exigir «seguro»,
     * que pide fecha de nacimiento o edad— un CSV con nombres y teléfonos se
     * queda en «probable» y el consultorio entero se duplicaría de golpe.
     *
     * Bajar el listón es seguro porque el motor ya exige PARECIDO DE NOMBRE para
     * decir nada: el teléfono nunca basta solo. La familia que comparte celular
     * —que es lo que esta función perdía en silencio— sigue entrando entera,
     * porque «Rosa Hernández Cruz» y «Diego Hernández Cruz» no se parecen lo
     * suficiente. Y el padre y el hijo homónimos también, porque la fecha de
     * nacimiento los separa antes de mirar el nombre.
     */
    let coincide: CoincidenciaDeFila | undefined
    for (const c of comparables) {
      const r = compararPacientes(candidato, c)
      if (!r) continue
      // Se guarda la MEJOR: si hay una coincidencia segura, es la que el médico
      // tiene que ver — no la primera que salga del recorrido.
      if (!coincide || (r.certeza === 'seguro' && coincide.certeza === 'probable')) {
        coincide = { id: c.id ?? '', nombre: String(c.nombre ?? ''), motivo: r.motivo, certeza: r.certeza }
      }
      if (r.certeza === 'seguro') break
    }
    // La fila entra a la comparación de las siguientes: dos filas iguales dentro
    // del mismo archivo son un duplicado tan real como uno contra la base.
    comparables.push(candidato)
    return { fila: f, estado: coincide ? 'duplicado' : 'nuevo', coincide }
  })
}
