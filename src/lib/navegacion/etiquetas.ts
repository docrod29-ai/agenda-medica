/**
 * UNA RUTA, UN NOMBRE — Panel de Lujo D-014 (y la mitad de C-034).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El mismo destino se llamaba distinto según la barra desde la que se mirara:
 *
 *     /pacientes  →  «Consulta»   (Sidebar)
 *                    «Pacientes»  (barra inferior, modo asistente)
 *                    «Paciente»   (barra inferior, modo médico)
 *     /dashboard  →  «Dashboard»  (Sidebar)
 *                    «Inicio»     (barra inferior, modo asistente)
 *                    «Hoy»        (barra inferior, modo médico)
 *
 * Aprenderse tres nombres para el mismo sitio no es un detalle de estilo: es la
 * razón por la que alguien busca «Pacientes» en la barra lateral y no lo
 * encuentra, porque ahí se llama «Consulta».
 *
 * ── LO QUE ESTA TABLA **NO** HACE ────────────────────────────────────────────
 *
 * No aplana la barra inferior del móvil. Sus cuatro destinos —Hoy, Paciente,
 * Seguimiento, Operaciones— **no son nombres de ruta**: son los cuatro CONTEXTOS
 * de V15, con su propia tabla (`contextos.ts`), sus pruebas y su razón escrita.
 * «Hoy» agrupa `/dashboard`, `/citas` y `/calendario`; llamarlo «Dashboard»
 * rompería esa arquitectura para arreglar una incoherencia que no existe ahí.
 *
 * Lo que sí se unifica es el nombre que recibe una RUTA cuando se la nombra como
 * ruta: la barra lateral y el índice de Operaciones, que son listas de destinos.
 *
 * ── CÓMO SE ELIGIÓ CADA NOMBRE ───────────────────────────────────────────────
 *
 * Gana el que ya usa la pantalla a la que se llega, y en su defecto el más
 * concreto. `/pacientes` se llama «Pacientes» porque eso es lo que enseña —una
 * lista de pacientes—, no «Consulta», que es lo que se hace después de elegir
 * uno. `/dashboard` se llama «Inicio» porque es donde se aterriza, y «Dashboard»
 * ni siquiera es español.
 */
export const ETIQUETA_POR_RUTA: Readonly<Record<string, string>> = {
  '/dashboard': 'Inicio',
  '/pacientes': 'Pacientes',
  '/pendientes': 'Pendientes',
  '/asistente': 'Agendar rápido',
  '/citas': 'Citas',
  '/calendario': 'Calendario',
  '/lista-espera': 'Lista de espera',
  '/hospitalizacion': 'Hospitalización',
  '/uci': 'UCI',
  '/consultor': 'Consultor IA',
  '/antibiograma': 'Antibiograma',
  '/crm': 'CRM',
  '/resenas': 'Reseñas',
  '/reactivacion': 'Reactivación',
  '/chat': 'Chat del equipo',
  '/farmacia': 'Farmacia',
  '/finanzas': 'Cobros y corte del día',
  '/membresias': 'Membresías',
  '/cumplimiento': 'Cumplimiento',
  '/legal': 'Documentos legales',
  '/migracion': 'Migración',
  '/guia': 'Guía de uso',
  '/configuracion': 'Configuración',
  '/operaciones': 'Operaciones',
  '/motores': 'Lo que te protege',
}

/**
 * El nombre de una ruta. Si no está en la tabla devuelve `undefined` a
 * propósito: quien la pinte tiene que decidir, y así una ruta nueva sin nombre
 * declarado se ve en la revisión en vez de heredar uno inventado.
 */
export function etiquetaDeRuta(href: string): string | undefined {
  return ETIQUETA_POR_RUTA[href]
}
