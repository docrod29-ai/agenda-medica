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
