/**
 * MÓDULOS y PAQUETES — control de acceso por funciones (entitlements).
 *
 * El dueño de la plataforma arma PAQUETES (combinaciones de módulos con precio).
 * Cada clínica tiene `modulos: string[]` = a qué tiene acceso. La app oculta y
 * bloquea lo que no esté incluido.
 *
 * Este archivo es CLIENTE-SEGURO (no importa firebase-admin): lo usan el sidebar,
 * el guard de rutas y la consola del dueño.
 *
 * COMPATIBILIDAD: si una clínica NO tiene `modulos` definido (clientes previos),
 * se le da acceso a TODO — nunca se bloquea a alguien que ya usaba la app.
 */
import type { ModeloPrecio } from './pricing'

export interface ModuloDef {
  key: string
  label: string
  descripcion: string
  rutas: string[]   // prefijos de ruta que este módulo habilita
}

/**
 * Rutas SIEMPRE disponibles (no se cobran / son la base): inicio, configuración,
 * chat interno y el directorio de pacientes. Sin esto una clínica quedaría inservible.
 */
export const RUTAS_CORE = ['/dashboard', '/configuracion', '/chat', '/pacientes', '/guia']

/** Catálogo de módulos vendibles. El dueño combina estos en paquetes. */
export const MODULOS: ModuloDef[] = [
  { key: 'agenda',         label: 'Agenda y citas',          descripcion: 'Agendar, calendario, recordatorios, lista de espera', rutas: ['/asistente', '/citas', '/calendario', '/lista-espera', '/waitlist'] },
  { key: 'expediente',     label: 'Expediente de consulta',  descripcion: 'Consulta ambulatoria: notas, recetas, órdenes, referencias', rutas: ['/consulta', '/expediente', '/expedientes', '/nota', '/orden', '/receta', '/referencia'] },
  { key: 'hospitalizacion', label: 'Hospitalización',        descripcion: 'Censo, internamientos, indicaciones/MAR, camas', rutas: ['/hospitalizacion'] },
  { key: 'farmacia',       label: 'Farmacia',                descripcion: 'Inventario y movimientos de farmacia', rutas: ['/farmacia'] },
  { key: 'crm',            label: 'CRM y reseñas',           descripcion: 'Seguimiento de pacientes, reputación', rutas: ['/crm', '/resenas'] },
  { key: 'finanzas',       label: 'Finanzas',                descripcion: 'Cobros, ingresos, reportes', rutas: ['/finanzas'] },
  { key: 'cumplimiento',   label: 'Cumplimiento',            descripcion: 'NOM-024, ARCO, bitácora, seguridad', rutas: ['/cumplimiento'] },
]

export const MODULO_LABEL: Record<string, string> = Object.fromEntries(MODULOS.map(m => [m.key, m.label]))
export const TODOS_LOS_MODULOS = MODULOS.map(m => m.key)

/**
 * Catálogo de PAQUETES por defecto (los que se ofrecen al vender). Se siembran
 * en `platform_packages` la primera vez que el dueño abre la consola. Precios en
 * MXN/mes — son un punto de partida sensato; el dueño los edita en /superadmin.
 * ids fijos → sembrar es idempotente (no duplica).
 */
export interface PaqueteDef {
  id: string; nombre: string; precio: number; modulos: string[]; descripcion: string; orden: number
  // Cobro escalable: 'por_medico' (consultorio) o 'por_cama' (hospital). Si se
  // omite, es 'fijo' y se usa `precio`.
  modeloPrecio?: ModeloPrecio
  precioBase?: number       // 1er médico / base del hospital
  precioPorUnidad?: number  // por médico adicional / por cama
}
export const PAQUETES_SUGERIDOS: PaqueteDef[] = [
  { id: 'agenda',          nombre: 'Agenda',            precio: 399,  orden: 0, modulos: ['agenda'],
    descripcion: 'Citas, calendario, recordatorios y lista de espera. Ideal para recepción.' },
  // Consultorios: se cobran POR MÉDICO que usa el consultorio (1º = base, cada extra suma).
  { id: 'consultorio',     nombre: 'Consultorio',       precio: 699,  orden: 1, modulos: ['agenda', 'expediente'],
    modeloPrecio: 'por_medico', precioBase: 699, precioPorUnidad: 250,
    descripcion: 'Agenda + expediente de consulta con recetas y órdenes. Se cobra por médico.' },
  { id: 'consultorio-pro', nombre: 'Consultorio Pro',   precio: 999,  orden: 2, modulos: ['agenda', 'expediente', 'farmacia', 'crm', 'finanzas'],
    modeloPrecio: 'por_medico', precioBase: 999, precioPorUnidad: 350,
    descripcion: 'Consultorio completo: además farmacia, CRM/reseñas y finanzas. Se cobra por médico.' },
  // Hospital: se cobra POR TAMAÑO (número de camas).
  { id: 'hospitalario',    nombre: 'Hospitalario',      precio: 1299, orden: 3, modulos: ['agenda', 'expediente', 'hospitalizacion'],
    modeloPrecio: 'por_cama', precioBase: 1299, precioPorUnidad: 40,
    descripcion: 'Consulta + hospitalización (censo, indicaciones/MAR, camas). Se cobra por tamaño.' },
  { id: 'institucion',     nombre: 'Institución (Todo)', precio: 1799, orden: 4, modulos: [...TODOS_LOS_MODULOS],
    modeloPrecio: 'por_cama', precioBase: 1799, precioPorUnidad: 40,
    descripcion: 'Acceso completo a toda la plataforma. Se cobra por tamaño del hospital.' },
]

/** Módulos efectivos de una clínica. undefined/null → TODOS (compatibilidad). */
export function modulosDe(clinic: { modulos?: string[] | null } | null | undefined): string[] {
  if (!clinic) return TODOS_LOS_MODULOS
  const m = clinic.modulos
  if (!Array.isArray(m) || m.length === 0) return TODOS_LOS_MODULOS
  return m
}

export function tieneModulo(clinic: { modulos?: string[] | null } | null | undefined, key: string): boolean {
  return modulosDe(clinic).includes(key)
}

/**
 * ¿La clínica puede entrar a esta ruta? Las RUTAS_CORE siempre sí. Si ninguna
 * definición de módulo cubre la ruta (rutas nuevas/sueltas), NO se bloquea
 * (fail-open, conservador: preferimos no encerrar a nadie por una ruta no mapeada).
 */
export function rutaPermitida(clinic: { modulos?: string[] | null } | null | undefined, pathname: string): boolean {
  if (RUTAS_CORE.some(r => pathname === r || pathname.startsWith(r + '/'))) return true
  const activos = modulosDe(clinic)
  // ¿Qué módulos reclaman esta ruta?
  const duenos = MODULOS.filter(m => m.rutas.some(r => pathname === r || pathname.startsWith(r + '/')))
  if (duenos.length === 0) return true            // ruta no mapeada → no bloquear
  return duenos.some(m => activos.includes(m.key)) // basta con tener uno de los módulos que la cubren
}
