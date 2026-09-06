import type { MetadataRoute } from 'next'
import { RUTAS_PRIVADAS, RUTAS_PACIENTE_CON_PHI } from '@/lib/security/rutas-privadas'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://agenda-medica-one.vercel.app'

/**
 * robots.txt: permite indexar las páginas públicas (landing, precios, perfiles
 * /dr y reserva /reservar) y BLOQUEA todo lo privado — panel del médico, API y
 * enlaces con token de paciente (portal, teleconsulta, verificación, reseña).
 *
 * LA LISTA SE DERIVA, NO SE COPIA (Panel de Lujo C-035). La versión a mano
 * prohibía `/agenda` y `/waitlist`, que no existen, y le faltaban
 * `/membresias`, `/motores`, `/operaciones`, `/pendientes`, `/uci` y
 * `/antibiograma`, que sí. `RUTAS_PRIVADAS` ya es la fuente única de la zona
 * autenticada y el CI la cruza contra el árbol real; usarla aquí hace que
 * robots.txt no pueda volver a desincronizarse. Lo que no está en esa lista y
 * aun así se bloquea va abajo, con su motivo.
 */
export const RUTAS_BLOQUEADAS_ADEMAS = [
  // Se entra con enlace o formulario; no son zona autenticada pero tampoco indexables.
  '/registro',
  '/unirse/',
] as const

export function rutasNoIndexables(): string[] {
  return [
    '/api/',
    ...RUTAS_PRIVADAS.map(r => `/${r}`),
    ...RUTAS_PACIENTE_CON_PHI.map(r => `/${r}/`),
    ...RUTAS_BLOQUEADAS_ADEMAS,
  ]
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: rutasNoIndexables(),
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
