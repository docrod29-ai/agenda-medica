import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebase-admin'
import { MapPin, Phone, Star, CalendarPlus, Stethoscope, ShieldCheck } from 'lucide-react'
import { nombreAnonimizado } from '@/lib/reviews'

/**
 * Perfil público del médico/clínica — Server Component (SSR) optimizado para SEO.
 * A diferencia de /reservar (client), esto es indexable por Google e incluye
 * schema.org (Physician + AggregateRating) para snippets con estrellas.
 * Es la respuesta realista al "marketplace": presencia propia indexable, sin comisión.
 */

export const revalidate = 3600 // ISR: re-genera cada hora

interface Perfil {
  nombre: string
  medico: string
  especialidad: string
  cedula: string
  fotoUrl: string
  bio: string
  precios: { servicio: string; precio: number }[]
  direccion: string
  telefono: string
  mapsUrl: string
  bookingOn: boolean
  servicios: string[]
  reviews: { rating: number; texto: string; pacienteNombre: string }[]
  ratingProm: number
  ratingN: number
}

const TIPO_LABEL: Record<string, string> = {
  'primera-vez': 'Primera vez', 'seguimiento': 'Seguimiento', 'urgente': 'Urgente',
  'estudios': 'Revisión de estudios', 'teleconsulta': 'Teleconsulta',
  'prequirurgica': 'Valoración prequirúrgica', 'procedimiento': 'Procedimiento',
}

// cache(): dedupe entre generateMetadata() y el componente en el mismo render
const getPerfil = cache(async (clinicId: string): Promise<Perfil | null> => {
  try {
    const [cfgSnap, doctorsSnap, reviewsSnap] = await Promise.all([
      adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get(),
      adminDb.collection('clinics').doc(clinicId).collection('doctors').where('activo', '==', true).get(),
      adminDb.collection('clinics').doc(clinicId).collection('reviews').where('estado', '==', 'publicada').get(),
    ])
    const cfg = cfgSnap.exists ? cfgSnap.data()! : null
    if (!cfg) return null

    const reviews = reviewsSnap.docs
      .map(d => d.data())
      .map(r => ({ rating: Number(r.rating) || 0, texto: String(r.texto || ''), pacienteNombre: String(r.pacienteNombre || '') }))
    const ratingN = reviews.length
    const ratingProm = ratingN ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / ratingN) * 10) / 10 : 0

    const primerMedico = doctorsSnap.docs[0]?.data()
    const servicios = Object.keys(cfg.duraciones ?? {}).map(k => TIPO_LABEL[k] || k)

    const precios = Array.isArray(cfg.preciosPublicos)
      ? cfg.preciosPublicos
          .filter((x: unknown): x is { servicio: string; precio: number } =>
            !!x && typeof (x as { servicio?: unknown }).servicio === 'string' && typeof (x as { precio?: unknown }).precio === 'number')
          .map((x: { servicio: string; precio: number }) => ({ servicio: String(x.servicio), precio: Number(x.precio) }))
      : []

    return {
      nombre: cfg.nombreClinica || cfg.nombreMedico || 'Consultorio',
      medico: cfg.nombreMedico || primerMedico?.nombre || '',
      especialidad: cfg.especialidad || primerMedico?.especialidad || '',
      cedula: cfg.cedulaProfesional || '',
      fotoUrl: cfg.fotoMedicoUrl || '',
      bio: cfg.bioPublica || '',
      precios,
      direccion: cfg.direccion || '',
      telefono: cfg.telefonoAdmin || cfg.whatsappConsultorio || '',
      mapsUrl: cfg.googleMapsUrl || '',
      bookingOn: cfg.publicBookingEnabled !== false,
      servicios,
      reviews: reviews.slice(0, 12),
      ratingProm,
      ratingN,
    }
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: { params: Promise<{ clinicId: string }> }): Promise<Metadata> {
  const { clinicId } = await params
  const p = await getPerfil(clinicId)
  if (!p) return { title: 'Consultorio' }
  const titulo = `${p.medico || p.nombre}${p.especialidad ? ` — ${p.especialidad}` : ''}`
  const desc = `Agenda tu cita con ${p.medico || p.nombre}${p.especialidad ? `, ${p.especialidad}` : ''}${p.direccion ? ` en ${p.direccion}` : ''}. Reserva en línea, rápido y seguro.`
  return {
    title: titulo,
    description: desc,
    openGraph: { title: titulo, description: desc, type: 'profile' },
    robots: { index: true, follow: true },
  }
}

export default async function PerfilPublico({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params
  const p = await getPerfil(clinicId)
  if (!p) notFound()

  const preciosNum = p.precios.map(x => x.precio).filter(n => n > 0)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: p.medico || p.nombre,
    ...(p.fotoUrl ? { image: p.fotoUrl } : {}),
    ...(p.bio ? { description: p.bio } : {}),
    ...(p.especialidad ? { medicalSpecialty: p.especialidad } : {}),
    ...(p.telefono ? { telephone: p.telefono } : {}),
    ...(p.direccion ? { address: { '@type': 'PostalAddress', streetAddress: p.direccion, addressCountry: 'MX' } } : {}),
    ...(preciosNum.length ? { priceRange: `$${Math.min(...preciosNum)}–$${Math.max(...preciosNum)} MXN` } : {}),
    ...(p.ratingN > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingProm, reviewCount: p.ratingN } } : {}),
    // Reseñas INDIVIDUALES (schema Review) → rich snippets más fuertes que solo el agregado
    ...(p.reviews.length ? {
      review: p.reviews.slice(0, 8).map(r => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        ...(r.pacienteNombre ? { author: { '@type': 'Person', name: nombreAnonimizado(r.pacienteNombre) } } : {}),
        ...(r.texto ? { reviewBody: r.texto } : {}),
      })),
    } : {}),
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px 64px' }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {p.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.fotoUrl} alt={`Foto de ${p.medico || p.nombre}`} width={84} height={84}
              style={{ width: 84, height: 84, borderRadius: 18, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--nexus-soft)', color: 'var(--nexus)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Stethoscope size={30} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 className="t-display" style={{ margin: 0 }}>{p.medico || p.nombre}</h1>
            {p.especialidad && <div style={{ fontSize: 15, color: 'var(--nexus)', fontWeight: 600, marginTop: 4 }}>{p.especialidad}</div>}
            {p.cedula && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>Cédula profesional {p.cedula}</div>}
            {p.ratingN > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 14, color: 'var(--text2)' }}>
                <Star size={15} fill="var(--amber)" color="var(--amber)" />
                <strong className="t-num">{p.ratingProm.toFixed(1)}</strong>
                <span style={{ color: 'var(--text3)' }}>· {p.ratingN} reseña{p.ratingN !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA reservar */}
        {p.bookingOn && (
          <Link href={`/reservar/${clinicId}`} style={{ textDecoration: 'none' }}>
            <div className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 24, justifyContent: 'center' }}>
              <CalendarPlus size={18} /> Agendar cita en línea
            </div>
          </Link>
        )}

        {/* Biografía / presentación */}
        {p.bio && (
          <section style={{ marginTop: 32 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Acerca del médico</h2>
            <p style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.65, whiteSpace: 'pre-line', margin: 0 }}>{p.bio}</p>
          </section>
        )}

        {/* Servicios */}
        {p.servicios.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Servicios</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {p.servicios.map(s => (
                <span key={s} className="badge badge-neutral" style={{ padding: '6px 12px', fontSize: 13 }}>{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* Precios */}
        {p.precios.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Precios</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {p.precios.map((x, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 }}>
                  <span style={{ color: 'var(--text2)' }}>{x.servicio}</span>
                  <strong className="t-num" style={{ color: 'var(--text)' }}>${x.precio.toLocaleString('es-MX')}</strong>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>Precios informativos en pesos mexicanos; pueden variar según el caso.</p>
          </section>
        )}

        {/* Ubicación */}
        {(p.direccion || p.telefono) && (
          <section style={{ marginTop: 32 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Ubicación y contacto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text2)' }}>
              {p.direccion && (
                <a href={p.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(p.direccion)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
                  <MapPin size={15} className="ds-icon" /> {p.direccion}
                </a>
              )}
              {p.telefono && <a href={`tel:${p.telefono}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--nexus)' }}><Phone size={15} className="ds-icon" /> {p.telefono}</a>}
            </div>
          </section>
        )}

        {/* Reseñas */}
        {p.reviews.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Lo que dicen los pacientes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {p.reviews.map((r, i) => (
                <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={13} fill={j < r.rating ? 'var(--amber)' : 'transparent'} color={j < r.rating ? 'var(--amber)' : 'var(--border2, var(--border))'} />
                    ))}
                  </div>
                  {r.texto && <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 6px' }}>“{r.texto}”</p>}
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>— {r.pacienteNombre ? nombreAnonimizado(r.pacienteNombre) : 'Paciente'}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Confianza / pie */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
          <ShieldCheck size={14} className="ds-icon" /> Reserva segura · {p.nombre}
        </div>
      </div>
    </div>
  )
}
