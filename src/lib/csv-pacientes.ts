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

/**
 * Las filas del CSV, UNA A UNA, sin materializar la tabla entera.
 *
 * ── POR QUÉ ES UN GENERADOR Y NO UN ARREGLO ──────────────────────────────────
 *
 * `parseCsv` devuelve la tabla completa, y para una hoja de 200 pacientes eso
 * está bien. Para una migración de 50 000 filas no: la tabla entera en memoria
 * es lo que impedía que el ensayo cupiera en una función sin servidor
 * (`docs/migration/RISK-REGISTER.md`, P1-2).
 *
 * **Hay UN solo analizador de CSV en el repositorio y es éste.** `parseCsv` se
 * construye encima. Escribir un segundo lector «para el caso grande» habría
 * dejado dos formas distintas de interpretar una comilla mal cerrada, y sólo se
 * habría descubierto el día en que las dos discreparan sobre el archivo de
 * alguien.
 *
 * Ojo: devuelve TODAS las filas, incluidas las totalmente vacías. Filtrarlas es
 * decisión de quien consume —`parseCsv` las descarta; la migración las cuenta—
 * y la decisión es por fila, así que no obliga a tener la tabla delante.
 */
export function* filasDeCsv(texto: string): Generator<string[]> {
  let campo = ''
  let fila: string[] = []
  let enComillas = false
  for (let i = 0; i < texto.length; i++) {
    let c = texto[i]
    /**
     * `\r\n` y `\r` suelto se leen como `\n`, dentro y fuera de comillas.
     *
     * Es exactamente lo que hacía el `.replace()` global que había antes aquí,
     * hecho carácter a carácter: normalizar de golpe obligaba a duplicar el
     * archivo en memoria ANTES de empezar a leerlo, que es justo lo que este
     * generador existe para no hacer.
     */
    if (c === '\r') { if (texto[i + 1] === '\n') i++; c = '\n' }
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else enComillas = false
      } else campo += c
    } else if (c === '"') {
      enComillas = true
    } else if (c === ',') {
      fila.push(campo); campo = ''
    } else if (c === '\n') {
      fila.push(campo); yield fila; campo = ''; fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); yield fila }
}

/** ¿Esta fila trae algo? Una fila de puros vacíos no es una fila de datos. */
export function filaConContenido(fila: readonly string[]): boolean {
  return fila.some(x => x.trim() !== '')
}

/** Parser CSV mínimo pero correcto (respeta comillas y saltos de línea internos). */
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = []
  // descarta filas totalmente vacías
  for (const f of filasDeCsv(texto)) if (filaConContenido(f)) filas.push(f)
  return filas
}

/** Sinónimos de encabezado → campo del paciente, para auto-mapear la importación. */
const SINONIMOS: Record<string, keyof Patient> = {
  nombre: 'nombre', paciente: 'nombre', 'nombre completo': 'nombre', name: 'nombre',
  telefono: 'telefono', 'teléfono': 'telefono', tel: 'telefono', celular: 'telefono', movil: 'telefono', 'móvil': 'telefono', phone: 'telefono',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  email: 'email', correo: 'email', 'correo electrónico': 'email', mail: 'email',
  'fecha de nacimiento': 'fechaNacimiento', nacimiento: 'fechaNacimiento', fechanacimiento: 'fechaNacimiento', dob: 'fechaNacimiento',
  sexo: 'sexo', genero: 'sexo', 'género': 'sexo',
  curp: 'curp',
  seguro: 'seguroMedico', 'seguro medico': 'seguroMedico', 'seguro médico': 'seguroMedico', aseguradora: 'seguroMedico',
  alergias: 'alergias', alergia: 'alergias',
  notas: 'notas', observaciones: 'notas', comentarios: 'notas',
}

export function mapearEncabezados(encabezados: string[]): (keyof Patient | null)[] {
  return encabezados.map(h => SINONIMOS[normalizarNombre(h)] ?? null)
}

export interface FilaImport {
  nombre: string
  telefono: string
  whatsapp?: string
  email?: string
  fechaNacimiento?: string
  sexo?: string
  curp?: string
  seguroMedico?: string
  alergias?: string
  notas?: string
}

/** Construye filas tipadas a partir del CSV + el mapeo de columnas. */
export function construirFilas(csv: string[][], mapeo: (keyof Patient | null)[]): FilaImport[] {
  const cuerpo = csv.slice(1)
  return cuerpo.map(cols => {
    const obj: Record<string, string> = {}
    mapeo.forEach((campo, idx) => {
      if (campo && cols[idx] != null) obj[campo] = cols[idx].trim()
    })
    return obj as unknown as FilaImport
  }).filter(f => (f.nombre ?? '').trim() !== '')  // el nombre es obligatorio
}

import { compararPacientes, type PacienteComparable } from '@/lib/pacientes/duplicados'

export type EstadoFila = 'nuevo' | 'duplicado' | 'sin_nombre'

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
export function clasificarFilas(filas: FilaImport[], existentes: Patient[]): { fila: FilaImport; estado: EstadoFila }[] {
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
    const dup = comparables.some(c => compararPacientes(candidato, c) !== null)
    // La fila entra a la comparación de las siguientes: dos filas iguales dentro
    // del mismo archivo son un duplicado tan real como uno contra la base.
    comparables.push(candidato)
    return { fila: f, estado: dup ? 'duplicado' : 'nuevo' }
  })
}
