import type { MetadataRoute } from 'next'
import { adminDb } from '@/lib/firebase-admin'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://agenda-medica-one.vercel.app'
const MAX_CLINICAS = 5000 // límite defensivo (el tope de Google es 50k URLs)

export const revalidate = 3600 // re-genera cada hora

/**
 * Sitemap dinámico: páginas públicas + un enlace por CADA perfil público /dr y su
 * reserva /reservar. Cierra el hueco de descubrimiento SEO (antes no había sitemap,
 * así Google descubría los perfiles mucho peor). Solo incluye clínicas activas con
 * el perfil público activado.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date()

  const estaticas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: ahora, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/precios`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/seguridad`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/evidencia`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/demo`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/demo/interactivo`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contacto`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/privacidad`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terminos`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const perfiles: MetadataRoute.Sitemap = []
  try {
    const snap = await adminDb.collection('clinics').where('status', 'in', ['active', 'trial']).get()
    let n = 0
    for (const c of snap.docs) {
      if (n >= MAX_CLINICAS) { console.warn(`[sitemap] tope ${MAX_CLINICAS} clínicas alcanzado; el resto se omitió`); break }
      const cfg = await adminDb.collection('clinics').doc(c.id).collection('config').doc('main').get()
      const d = cfg.data()
      if (!d) continue
      if (d.publicBookingEnabled === false) continue // perfil no público → no listar
      perfiles.push({ url: `${BASE}/dr/${c.id}`, lastModified: ahora, changeFrequency: 'weekly', priority: 0.8 })
      perfiles.push({ url: `${BASE}/reservar/${c.id}`, lastModified: ahora, changeFrequency: 'weekly', priority: 0.7 })
      n++
    }
  } catch (e) {
    console.warn('[sitemap] no se pudieron enumerar los perfiles públicos:', String(e))
  }

  return [...estaticas, ...perfiles]
}
