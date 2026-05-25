import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agenda Médica',
    short_name: 'Agenda Médica',
    description: 'Agenda inteligente y expediente clínico electrónico para médicos en México',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#040b12',
    theme_color: '#040b12',
    lang: 'es-MX',
    categories: ['medical', 'productivity', 'health'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
