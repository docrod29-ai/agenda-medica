import type { MetadataRoute } from 'next'

import { MARCA } from '@/lib/marca'
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA,
    short_name: MARCA,
    description: 'El consultorio, conectado. Agenda, expediente, recetas y cobros en una sola herramienta.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0B0C0E',
    theme_color: '#0B0C0E',
    lang: 'es-MX',
    categories: ['medical', 'productivity', 'health'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // PNG rasterizados 192/512: requisito de instalabilidad (Lighthouse/Android) y
      // maskable fiable; el SVG solo no bastaba y Safari no lo usa como ícono de app.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Accesos rápidos (mantener pulsado el ícono). Todas son rutas bajo el layout
    // autenticado → validan sesión al abrir; no exponen datos por sí mismas.
    shortcuts: [
      { name: 'Agenda de hoy', short_name: 'Agenda', url: '/calendario', icons: [{ src: '/icon.svg', sizes: 'any' }] },
      { name: 'Nueva cita', short_name: 'Cita', url: '/asistente', icons: [{ src: '/icon.svg', sizes: 'any' }] },
      { name: 'Pacientes', short_name: 'Pacientes', url: '/pacientes', icons: [{ src: '/icon.svg', sizes: 'any' }] },
    ],
  }
}
