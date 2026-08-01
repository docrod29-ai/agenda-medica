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
  premium:  CONSULTORIO,                         // "Pro": mismos módulos + IA Máxima/2ª opinión/soporte
  // Hospital = consultorio + hospitalización + el ICU OS (Panel UCI). El UCI OS
  // también se vende como add-on suelto (paquete 'uci', por médico).
  hospital: [...CONSULTORIO, 'hospitalizacion', 'uci'],
  // Legados / especiales
  basico:   CONSULTORIO,
  pro:      CONSULTORIO,
  trial:    CONSULTORIO,   // Hospitalización/UCI son productos APARTE: no se muestran en prueba
  cortesia: CONSULTORIO,
}

/**
 * Módulos OPT-IN: productos separados que NO se muestran por los "atajos" (clínica
 * sin plan, prueba). Solo aparecen si el plan Hospital o un módulo explícito los
 * incluye. Así Hospitalización y el UCI OS no estorban en un consultorio normal.
 * (El dueño con pase libre SÍ ve todo — ver modulosDe.)
 */
export const MODULOS_OPT_IN = ['hospitalizacion', 'uci']

export interface ModuloDef {
  key: string
  label: string
  descripcion: string
  rutas: string[]   // prefijos de ruta que este módulo habilita
  precioMedico: number  // MXN/mes POR MÉDICO à la carte (los bundles son un descuento)
}

/**
 * Rutas SIEMPRE disponibles (no se cobran / son la base): inicio, configuración,
 * chat interno y el directorio de pacientes. Sin esto una clínica quedaría inservible.
 */
export const RUTAS_CORE = ['/dashboard', '/configuracion', '/chat', '/pacientes', '/guia']

/** Catálogo de módulos vendibles. El dueño combina estos en paquetes. */
export const MODULOS: ModuloDef[] = [
  { key: 'agenda',         label: 'Agenda y citas',          precioMedico: 349,  descripcion: 'Agendar, calendario, recordatorios, lista de espera', rutas: ['/asistente', '/citas', '/calendario', '/lista-espera', '/waitlist'] },
  { key: 'expediente',     label: 'Expediente de consulta',  precioMedico: 700,  descripcion: 'Consulta ambulatoria: notas, recetas, órdenes, referencias, consultor', rutas: ['/consulta', '/expediente', '/expedientes', '/nota', '/orden', '/receta', '/referencia', '/consultor', '/pendientes'] },
  { key: 'hospitalizacion', label: 'Hospitalización',        precioMedico: 1200, descripcion: 'Censo, internamientos, indicaciones/MAR, camas (hospital y UCI)', rutas: ['/hospitalizacion'] },
  // UCI OS = módulo/entitlement PROPIO (la joya sin competencia). Trae SU PROPIO
  // censo/camas (rutas de hospitalización) para que "consulta + UCI" o "solo UCI"
  // puedan ingresar pacientes a camas de terapia sin comprar Hospitalización entera.
  { key: 'uci',            label: 'UCI OS',                  precioMedico: 700,  descripcion: 'Panel UCI de cabecera (ventilación, gasometría, SOFA/APACHE, POCUS/VExUS, neurocrítico, CKRT/PRISMA, ECMO, Copilot IA, nota por 7 sistemas) + censo y camas de terapia', rutas: ['/uci', '/hospitalizacion'] },
  { key: 'farmacia',       label: 'Farmacia',                precioMedico: 150,  descripcion: 'Inventario y movimientos de farmacia', rutas: ['/farmacia'] },
  { key: 'crm',            label: 'CRM y reseñas',           precioMedico: 150,  descripcion: 'Seguimiento de pacientes, reputación', rutas: ['/crm', '/resenas'] },
  { key: 'finanzas',       label: 'Finanzas',                precioMedico: 150,  descripcion: 'Cobros, ingresos, reportes', rutas: ['/finanzas'] },
  { key: 'cumplimiento',   label: 'Cumplimiento',            precioMedico: 150,  descripcion: 'NOM-024, ARCO, bitácora, seguridad', rutas: ['/cumplimiento'] },
]

export const MODULO_LABEL: Record<string, string> = Object.fromEntries(MODULOS.map(m => [m.key, m.label]))
export const PRECIO_MODULO: Record<string, number> = Object.fromEntries(MODULOS.map(m => [m.key, m.precioMedico]))

/**
 * COTIZADOR À LA CARTE: precio de CUALQUIER combinación de módulos, por médico.
 * El médico arma su combo (p.ej. consulta + UCI, o solo UCI) y esto lo cotiza.
 * `agenda` siempre se incluye como base (sin ella no hay pacientes). Total mensual
 * = (suma de los módulos elegidos) × nº de médicos. Los PAQUETES son un descuento
 * sobre esta suma (bundle < à la carte). La IA se cobra APARTE por consumo (créditos).
 */
export function precioCombinacion(moduloKeys: string[], medicos = 1): { porMedico: number; total: number; modulos: string[] } {
  const set = new Set(moduloKeys.filter(k => k in PRECIO_MODULO))
  set.add('agenda')   // la agenda es la base: sin ella no hay a quién atender
  const modulos = [...set]
  const porMedico = modulos.reduce((s, k) => s + (PRECIO_MODULO[k] ?? 0), 0)
  return { porMedico, total: porMedico * Math.max(1, medicos), modulos }
}
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
    modeloPrecio: 'por_medico', precioBase: 3499, precioPorUnidad: 999,
    descripcion: 'Todo lo de Pro + Hospitalización: censo, camas de hospital y de UCI, internamiento (indicaciones/MAR, signos, interconsultas, laboratorio). Incluye el UCI OS. Incluye 1 médico · +$999/mes por médico adicional.' },
  // ADD-ON: UCI OS. La joya sin competencia, desacoplada para venderse sobre
  // Hospital (o a quien haga terapia intensiva). Se cobra POR MÉDICO, igual que el
  // resto de la plataforma (cada médico que la usa quema su propia IA).
  { id: 'uci', nombre: 'UCI OS (add-on)', precio: 700, orden: 4, modulos: ['uci'],
    modeloPrecio: 'por_medico', precioBase: 700, precioPorUnidad: 700,
    descripcion: 'Add-on por médico: Panel UCI de cabecera con motores deterministas (ventilación, gasometría/ácido-base, SOFA/APACHE, POCUS/VExUS/PLR, neurocrítico PPC/PIC, CKRT/PRISMA, ECMO), Copilot IA de UCI (Claude + GPT) que aprende, y nota de evolución por los 7 sistemas dictada manos libres. $700/mes por médico.' },
]

/** Versión del catálogo de paquetes. Al subirla, el seed reemplaza los viejos. */
export const PAQUETES_VERSION = 7

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
