import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NexusMED',
    short_name: 'NexusMED',
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
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
