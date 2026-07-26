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

/**
 * Qué MÓDULOS abre cada PLAN de suscripción (planes-ia). Es la fuente de verdad
 * del "solo lo que compró": el webhook de Stripe guarda esto en clinic.modulos al
 * activar/cambiar de plan. Decisión del dueño (opción 2): Clínica y Pro abren los
 * MISMOS módulos (se distinguen por créditos + IA máxima + soporte), Hospital suma
 * Hospitalización, Agenda es solo agenda (sin IA de consulta).
 */
const CONSULTORIO = ['agenda', 'expediente', 'farmacia', 'crm', 'finanzas', 'cumplimiento']
export const MODULOS_DE_PLAN: Record<string, string[]> = {
  agenda:   ['agenda'],
  clinica:  CONSULTORIO,
  premium:  CONSULTORIO,                         // "Pro": mismos módulos que Clínica
  hospital: [...CONSULTORIO, 'hospitalizacion'],
  // Legados / especiales
  basico:   CONSULTORIO,
  pro:      CONSULTORIO,
  trial:    CONSULTORIO,   // Hospitalización es un producto APARTE: no se muestra en prueba
  cortesia: CONSULTORIO,
}

/**
 * Módulos OPT-IN: productos separados que NO se muestran por los "atajos" (pase
 * libre del dueño, clínica sin plan, prueba). Solo aparecen si el plan Hospital o
 * un módulo explícito los incluye. Así Hospitalización no estorba en un consultorio.
 */
export const MODULOS_OPT_IN = ['hospitalizacion']

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
  { key: 'expediente',     label: 'Expediente de consulta',  descripcion: 'Consulta ambulatoria: notas, recetas, órdenes, referencias, consultor', rutas: ['/consulta', '/expediente', '/expedientes', '/nota', '/orden', '/receta', '/referencia', '/consultor'] },
  // El Panel UCI (/uci) es una función de HOSPITALIZACIÓN (Hospital + UCI), no de
  // consulta: se cobra con ese plan. Antes vivía bajo 'expediente' y un plan de
  // consultorio ($899) tenía acceso técnico a lo que se cobra en el plan Hospital.
  { key: 'hospitalizacion', label: 'Hospitalización',        descripcion: 'Censo, internamientos, indicaciones/MAR, camas (hospital y UCI), Panel UCI', rutas: ['/hospitalizacion', '/uci'] },
  { key: 'farmacia',       label: 'Farmacia',                descripcion: 'Inventario y movimientos de farmacia', rutas: ['/farmacia'] },
  { key: 'crm',            label: 'CRM y reseñas',           descripcion: 'Seguimiento de pacientes, reputación', rutas: ['/crm', '/resenas'] },
  { key: 'finanzas',       label: 'Finanzas',                descripcion: 'Cobros, ingresos, reportes', rutas: ['/finanzas'] },
  { key: 'cumplimiento',   label: 'Cumplimiento',            descripcion: 'NOM-024, ARCO, bitácora, seguridad', rutas: ['/cumplimiento'] },
]

export const MODULO_LABEL: Record<string, string> = Object.fromEntries(MODULOS.map(m => [m.key, m.label]))
export const TODOS_LOS_MODULOS = MODULOS.map(m => m.key)
/** Todos MENOS los opt-in (lo que ve un consultorio por defecto, sin Hospital). */
export const MODULOS_BASE = TODOS_LOS_MODULOS.filter(k => !MODULOS_OPT_IN.includes(k))

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
// Paquetes = los 4 PLANES de suscripción reales (alineados con planes-ia y con
// los precios de Stripe). Sus `id` coinciden con la clave del plan para que la
// consola del dueño concuerde con lo que se cobra. Cobro fijo por médico.
export const PAQUETES_SUGERIDOS: PaqueteDef[] = [
  { id: 'agenda',   nombre: 'Agenda',   precio: 349,  orden: 0, modulos: MODULOS_DE_PLAN.agenda,
    descripcion: 'Agenda, calendario, recordatorios y portal del paciente. Sin IA de consulta.' },
  { id: 'clinica',  nombre: 'Clínica',  precio: 899,  orden: 1, modulos: MODULOS_DE_PLAN.clinica,
    descripcion: 'Consultorio completo con IA Estándar (Sonnet 5): nota por voz, recetas, consultor, farmacia, CRM y finanzas. 200 créditos/mes.' },
  { id: 'premium',  nombre: 'Pro',      precio: 1590, orden: 2, modulos: MODULOS_DE_PLAN.premium,
    descripcion: 'Todo lo de Clínica con IA Máxima (Opus 4.8 + GPT-5) por defecto, 2ª opinión automática y soporte prioritario. 450 créditos/mes.' },
  { id: 'hospital', nombre: 'Hospital', precio: 3499, orden: 3, modulos: MODULOS_DE_PLAN.hospital,
    modeloPrecio: 'por_cama', precioBase: 3499, precioPorUnidad: 250,
    descripcion: 'Todo lo de Pro + Hospitalización: censo, camas de hospital y de UCI, internamiento (indicaciones/MAR, signos, interconsultas, laboratorio), Panel UCI con motores deterministas (ventilación, gasometría, SOFA/APACHE, POCUS/VExUS, CKRT/PRISMA y ECMO) y nota de evolución UCI por sistemas.' },
]

/** Versión del catálogo de paquetes. Al subirla, el seed reemplaza los viejos. */
export const PAQUETES_VERSION = 5

type ClinicMod = { modulos?: string[] | null; plan?: string | null; paseLibre?: boolean | null }

/**
 * Módulos efectivos de una clínica (entitlements). Orden:
 *  1) null → TODOS (contextos sin clínica, p.ej. carga inicial).
 *  2) paseLibre (dueño/cortesía) → TODOS.
 *  3) `modulos` explícito (lo que guardó el webhook) → eso, EXACTO.
 *  4) sin modulos pero con `plan` → se deriva del plan (MODULOS_DE_PLAN).
 *  5) sin nada (legado muy viejo) → TODOS (no encerrar a nadie).
 */
export function modulosDe(clinic: ClinicMod | null | undefined): string[] {
  // El PASE LIBRE (dueño de la plataforma / cortesía) da acceso a TODO, incluidos
  // los módulos opt-in (Hospitalización). El dueño debe ver su propia app completa;
  // antes recibía solo la BASE y Hospitalización/UCI le quedaban ocultas.
  if (clinic?.paseLibre) return TODOS_LOS_MODULOS
  // Sin clínica (carga inicial): BASE, para no parpadear módulos opt-in.
  if (!clinic) return MODULOS_BASE
  const m = clinic.modulos
  if (Array.isArray(m) && m.length > 0) return m   // módulos explícitos (pueden incluir Hospital si se contrató)
  if (clinic.plan && MODULOS_DE_PLAN[clinic.plan]) return MODULOS_DE_PLAN[clinic.plan]
  return MODULOS_BASE
}

export function tieneModulo(clinic: ClinicMod | null | undefined, key: string): boolean {
  return modulosDe(clinic).includes(key)
}

/**
 * ¿La clínica puede entrar a esta ruta? Las RUTAS_CORE siempre sí. Si ninguna
 * definición de módulo cubre la ruta (rutas nuevas/sueltas), NO se bloquea
 * (fail-open, conservador: preferimos no encerrar a nadie por una ruta no mapeada).
 */
export function rutaPermitida(clinic: ClinicMod | null | undefined, pathname: string): boolean {
  if (RUTAS_CORE.some(r => pathname === r || pathname.startsWith(r + '/'))) return true
  const activos = modulosDe(clinic)
  // ¿Qué módulos reclaman esta ruta?
  const duenos = MODULOS.filter(m => m.rutas.some(r => pathname === r || pathname.startsWith(r + '/')))
  if (duenos.length === 0) return true            // ruta no mapeada → no bloquear
  return duenos.some(m => activos.includes(m.key)) // basta con tener uno de los módulos que la cubren
}
