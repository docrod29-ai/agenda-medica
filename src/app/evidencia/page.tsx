import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, BookOpen, ShieldCheck } from 'lucide-react'
import { EVIDENCIA_RECORDATORIOS, doiUrl, pubmedUrl } from '@/lib/landing-evidencia'

export const metadata: Metadata = {
  title: 'Evidencia y transparencia · NexusMED',
  description: 'Las fuentes publicadas detrás de las cifras de NexusMED, con PMID y DOI verificables. No inflamos métricas ni inventamos testimonios.',
}

/**
 * Página pública de evidencia (PUBLIC_METRICS): expone las FUENTES reales tras la
 * única cifra numérica de la landing, con enlaces a PubMed y DOI para que
 * cualquiera las verifique. Declara con honestidad qué NO se afirma.
 */
export default function EvidenciaPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 22px 80px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none', marginBottom: 22 }}>
          <ArrowLeft size={15} /> Volver
        </Link>

        <h1 className="nx-display" style={{ fontSize: 'clamp(28px,4.5vw,42px)', fontWeight: 600, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
          Evidencia y transparencia
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 26px' }}>
          Preferimos cifras que puedas comprobar. Estas son las fuentes publicadas detrás de la afirmación de la
          página de inicio sobre recordatorios de citas e inasistencias.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          <BookOpen size={15} /> Recordatorios de citas → menos inasistencias
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EVIDENCIA_RECORDATORIOS.map(r => (
            <div key={r.pmid} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{r.titulo}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', margin: '3px 0 8px' }}>{r.autores} · {r.fuente}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 12 }}>{r.hallazgo}</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href={pubmedUrl(r.pmid)} target="_blank" rel="noopener noreferrer" style={enlace}>
                  PubMed · PMID {r.pmid} <ExternalLink size={12} />
                </a>
                <a href={doiUrl(r.doi)} target="_blank" rel="noopener noreferrer" style={enlace}>
                  DOI {r.doi} <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>Fuente de las referencias: PubMed.</p>

        {/* Qué NO afirmamos — honestidad de fase temprana */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 14, padding: 18, marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShieldCheck size={17} style={{ color: 'var(--nexus)' }} />
            <strong style={{ fontSize: 14.5 }}>Lo que no verás aquí</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65 }}>
            <li>Números de usuarios, consultorios o descargas inventados.</li>
            <li>Testimonios o reseñas fabricados.</li>
            <li>Cifras de resultados propias que aún no podemos medir con rigor.</li>
          </ul>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '10px 0 0', lineHeight: 1.6 }}>
            NexusMED es un producto nuevo. Cuando tengamos métricas propias verificables, las publicaremos aquí — con su método,
            no como eslogan. Mientras tanto, las cifras que mostramos provienen de literatura publicada o son ofertas reales
            (como los 14 días de prueba).
          </p>
        </div>
      </div>
    </main>
  )
}

const enlace: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
  color: 'var(--nexus)', textDecoration: 'none',
}
