import type { Metadata } from 'next'
import { verificarTokenReceta } from '@/lib/receta-token'
import { ShieldCheck, ShieldX, Stethoscope } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Verificación de documento · NexusMED',
  robots: { index: false, follow: false },
}

/**
 * Verificación pública de una receta dentro de NexusMED (destino del QR).
 * Verifica la FIRMA (integridad) del token; muestra emisor y estado. NO expone
 * datos del paciente. NO afirma validación regulatoria ni ante la autoridad.
 */
export default async function VerificarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = verificarTokenReceta(token)

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg, #0b0c0e)', color: 'var(--text, #e9edef)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--s1, #16181c)', border: '1px solid var(--border, #2a2d33)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(61,90,254,0.15)', display: 'grid', placeItems: 'center', color: '#3D5AFE' }}>
            <Stethoscope size={18} />
          </div>
          <strong style={{ fontSize: 15 }}>NexusMED · Verificación de documento</strong>
        </div>

        {!r ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f87171', marginBottom: 10 }}>
              <ShieldX size={22} /> <strong style={{ fontSize: 16 }}>No verificable</strong>
            </div>
            <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.55 }}>
              Este código no corresponde a un documento válido de NexusMED, o fue alterado o expiró.
              No confirma la autenticidad del documento.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16a34a', marginBottom: 14 }}>
              <ShieldCheck size={22} /> <strong style={{ fontSize: 16 }}>Integridad verificada</strong>
            </div>
            <Fila k="Documento" v="Generado por NexusMED" />
            <Fila k="Folio" v={r.folio} />
            <Fila k="Médico emisor" v={r.doctorNombre || '—'} />
            <Fila k="Cédula profesional (registrada en NexusMED)" v={r.cedula || '—'} />
            <Fila k="Emitido" v={r.emitido.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} />
            <Fila k="Estado" v="Vigente (sin registro de cancelación)" />
            <p style={{ fontSize: 11.5, opacity: 0.6, marginTop: 12 }}>
              La cédula mostrada es la registrada por el médico en NexusMED; NexusMED <strong>no</strong> la valida ante la autoridad.
              La verificación confirma que el documento se generó en NexusMED y no fue alterado.
            </p>
          </div>
        )}

        <p style={{ fontSize: 11, opacity: 0.55, marginTop: 18, borderTop: '1px solid var(--border, #2a2d33)', paddingTop: 12, lineHeight: 1.5 }}>
          La verificación dentro de NexusMED no sustituye los requisitos legales, la firma profesional
          ni las disposiciones aplicables a la dispensación de medicamentos.
        </p>
      </div>
    </main>
  )
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border, #2a2d33)', fontSize: 13.5 }}>
      <span style={{ opacity: 0.6 }}>{k}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
