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

/** Escapa un campo para CSV (comillas dobles + envoltura si hace falta). */
function celda(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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

export type EstadoFila = 'nuevo' | 'duplicado' | 'sin_nombre'

/** Marca cada fila como nueva o duplicada contra los pacientes existentes. */
export function clasificarFilas(filas: FilaImport[], existentes: Patient[]): { fila: FilaImport; estado: EstadoFila }[] {
  const telExist = new Set(existentes.map(p => normalizarTel(p.telefono)).filter(Boolean))
  const nombreExist = new Set(existentes.map(p => normalizarNombre(p.nombre)))
  // también deduplica dentro del propio archivo
  const telVistos = new Set<string>()
  return filas.map(f => {
    const nombre = (f.nombre ?? '').trim()
    if (!nombre) return { fila: f, estado: 'sin_nombre' as EstadoFila }
    const tel = normalizarTel(f.telefono)
    const dupTel = tel !== '' && (telExist.has(tel) || telVistos.has(tel))
    const dupNombre = tel === '' && nombreExist.has(normalizarNombre(nombre))
    if (tel) telVistos.add(tel)
    return { fila: f, estado: dupTel || dupNombre ? 'duplicado' : 'nuevo' }
  })
}
