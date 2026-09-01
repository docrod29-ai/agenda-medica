import Link from 'next/link'
import { ArrowLeft, Check, ShieldCheck, Layers } from 'lucide-react'
import { PAQUETES, incluyeDe } from '@/lib/specialty-packages'

export const metadata = {
  title: 'Paquetes por especialidad — Ausculta',
  description:
    'Cada especialidad ve las herramientas de su especialidad, no las de todas. Los paquetes filtran la consulta por tronco y las subespecialidades heredan del suyo.',
}

const CONTEXTO_LABEL: Record<'activo' | 'contexto', string> = {
  activo: 'Activo en la consulta',
  contexto: 'Activo + se enciende por el diagnóstico',
}

export default function PaquetesPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 90px' }}>
        <Link href="/arquitectura" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none', marginBottom: 16 }}>
          <ArrowLeft size={15} /> Ver los motores
        </Link>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--nexus)', background: 'var(--nexus-soft, var(--nexus-soft))', padding: '5px 11px', borderRadius: 'var(--r-pill)', marginBottom: 14 }}>
          <Layers size={14} /> Specialty Packages
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px' }}>
          Cada especialidad ve lo suyo
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 8px', maxWidth: '68ch' }}>
          Un internista no calcula dosis pediátricas por peso; un pediatra no usa riesgo cardiovascular a
          10 años. En vez de mostrar las mismas herramientas a todos, la consulta se arma por
          <strong> tronco de especialidad</strong> — y las subespecialidades <strong>heredan</strong> el
          juego del suyo (un infectólogo y un cardiólogo son internistas antes que subespecialistas).
        </p>
        <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.55, margin: '0 0 26px', maxWidth: '68ch' }}>
          Filtrar no es quitar: ninguna herramienta desaparece, todas siguen en el buscador. Y esto no es
          una maqueta — es lo que gobierna la consulta hoy en producción.
        </p>

        <div style={{ display: 'grid', gap: 16 }}>
          {PAQUETES.map(p => {
            const herr = incluyeDe(p.tronco)
            return (
              <section key={p.tronco} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--s1, rgba(127,127,127,.03))', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{p.nombre}</h2>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--teal)', background: 'rgba(13,148,136,.12)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>
                    <ShieldCheck size={12} /> {CONTEXTO_LABEL[p.estado]}
                  </span>
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--text2)', margin: '2px 0 10px', lineHeight: 1.5 }}>{p.foco}</p>

                <div style={{ display: 'grid', gap: 7, marginBottom: 12 }}>
                  {herr.map(h => (
                    <div key={h.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <Check size={15} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                        <b style={{ color: 'var(--text)' }}>{h.nombre}</b>
                        <span style={{ color: 'var(--text3)' }}> — {h.que}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <b style={{ color: 'var(--text2)' }}>Le toca a:</b> {p.cubre}
                </div>
              </section>
            )
          })}
        </div>

        <div style={{ marginTop: 22, padding: '16px 18px', border: '1px solid var(--border)', borderLeft: '3px solid var(--nexus)', borderRadius: 12, background: 'var(--s1, rgba(127,127,127,.04))', fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Medicina general, familiar y urgencias ven TODO.</strong> Es a
          propósito: atienden al niño, a la embarazada y al adulto complejo el mismo día. Filtrarles
          herramientas no les ahorra tiempo, se lo quita. El paquete tiene sentido para el
          subespecialista, cuyo día es predecible.
        </div>

        <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/demo/razonamiento" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700 }}>
            Ver cómo razona el copiloto
          </Link>
          <Link href="/arquitectura" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2)', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}>
            Ver los 10 motores
          </Link>
        </div>
      </div>
    </main>
  )
}
