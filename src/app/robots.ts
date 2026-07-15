import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://agenda-medica-one.vercel.app'

/**
 * robots.txt: permite indexar las páginas públicas (landing, precios, perfiles
 * /dr y reserva /reservar) y BLOQUEA todo lo privado — panel del médico, API y
 * enlaces con token de paciente (portal, teleconsulta, verificación, reseña).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // Panel del médico (tras autenticación)
          '/agenda', '/asistente', '/calendario', '/chat', '/citas', '/configuracion',
          '/consulta', '/consultor', '/corte-caja', '/crm', '/cumplimiento', '/dashboard',
          '/expediente', '/expedientes', '/farmacia', '/finanzas', '/guia', '/hospitalizacion',
          '/legal', '/lista-espera', '/migracion', '/nota', '/orden', '/pacientes',
          '/reactivacion', '/receta', '/referencia', '/resenas', '/waitlist',
          '/setup', '/superadmin', '/registro', '/login',
          // Enlaces privados con token de paciente
          '/mi/', '/teleconsulta/', '/verificar/', '/resena/', '/unirse/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
