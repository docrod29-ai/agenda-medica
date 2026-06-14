'use client'
/**
 * Panel de cumplimiento normativo NOM-024 / LFPDPPP.
 *
 * Concentra en un solo lugar:
 *  - Bitácora de accesos (audit_log)
 *  - Solicitudes ARCO pendientes + resueltas
 *  - Link al portal público de privacidad
 *  - Estado de cumplimiento por punto
 */
import { useEffect, useState } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { collection, getDocs, orderBy, query, limit as fbLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  listarSolicitudesArco, resolverSolicitudArco,
  ARCO_TIPO_LABEL, type ArcoRequest, type ArcoEstado,
} from '@/lib/arco'
import type { AuditEvento } from '@/lib/expediente/audit-log'
import {
  ShieldCheck, FileSearch, Inbox, Copy, ExternalLink, AlertTriangle, Check, Clock, Shield,
} from 'lucide-react'
import { useToast } from '@/context/ToastContext'

interface AuditEntry {
  id: string
  evento: AuditEvento
  timestamp: string
  medicoEmail?: string
  patientId?: string
  notaId?: string
  meta?: Record<string, unknown>
}

const EVENTO_LABEL: Record<string, string> = {
  expediente_lectura: 'Vio expediente',
  nota_lectura: 'Vio nota',
  nota_impresion: 'Imprimió nota',
  nota_firmada: 'Firmó nota',
  nota_borrador_guardado: 'Guardó borrador',
  nota_borrada: 'Borró borrador',
  receta_generada: 'Generó receta',
  receta_descargada: 'Descargó receta',
  orden_generada: 'Generó orden',
  paciente_creado: 'Creó paciente',
  paciente_modificado: 'Modificó paciente',
  paciente_borrado: 'Borró paciente',
  aviso_privacidad_aceptado: 'Aviso aceptado',
  arco_solicitud_recibida: 'Solicitud ARCO',
  arco_solicitud_resuelta: 'ARCO resuelta',
  login_exitoso: 'Inicio de sesión',
  login_fallido: 'Login fallido',
  export_datos: 'Export de datos',
  ia_procesamiento: 'IA procesó',
  ia_campo_aprobado: 'Aprobó campo IA',
  ia_campo_rechazado: 'Rechazó campo IA',
  consentimiento_grabacion: 'Consintió grabar',
}

type Tab = 'bitacora' | 'arco' | 'estado'

export default function CumplimientoPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('estado')
  const [bitacora, setBitacora] = useState<AuditEntry[]>([])
  const [arcoList, setArcoList] = useState<ArcoRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    Promise.all([
      getDocs(query(collection(db, 'clinics', clinicId, 'audit_log'), orderBy('timestamp', 'desc'), fbLimit(200))),
      listarSolicitudesArco(clinicId),
    ]).then(([logSnap, arco]) => {
      setBitacora(logSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry)))
      setArcoList(arco)
    }).finally(() => setLoading(false))
  }, [clinicId])

  const copiarLinkPrivacidad = () => {
    if (!clinicId) return
    const url = `${window.location.origin}/privacidad/${clinicId}`
    navigator.clipboard.writeText(url)
    toast('Link copiado', 'success')
  }

  const resolverArco = async (req: ArcoRequest, estado: 'resuelta' | 'rechazada') => {
    if (!clinicId || !req.id || !user?.uid) return
    const resolucion = prompt(`Describe brevemente qué se hizo (${estado}):`)
    if (!resolucion) return
    try {
      await resolverSolicitudArco(clinicId, req.id, {
        estado, resolucion, resueltoPor: user.uid,
      })
      toast(`Solicitud ${estado}`, 'success')
      // refresh
      const arco = await listarSolicitudesArco(clinicId)
      setArcoList(arco)
    } catch {
      toast('Error al resolver', 'error')
    }
  }

  if (!clinicId) {
    return <div style={{ padding: 24, color: 'var(--text3)' }}>Cargando…</div>
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ShieldCheck size={22} color="var(--teal)" />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Cumplimiento normativo</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Panel de auditoría para NOM-024-SSA3-2012 y LFPDPPP. Aquí encuentras la bitácora
        de accesos, solicitudes ARCO de tus pacientes, y el estado de cumplimiento.
      </p>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {([
          { k: 'estado', label: 'Estado' },
          { k: 'bitacora', label: 'Bitácora' },
          { k: 'arco', label: `ARCO${arcoList.filter(a => a.estado === 'recibida' || a.estado === 'en_proceso').length > 0 ? ` (${arcoList.filter(a => a.estado === 'recibida' || a.estado === 'en_proceso').length})` : ''}` },
        ] as { k: Tab; label: string }[]).map(t => (
          <button key={t.k} className={`tab${tab === t.k ? ' active' : ''}`} onClick={() => setTab(t.k)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'estado' && (
        <EstadoCumplimiento clinicId={clinicId} bitacora={bitacora} arcoList={arcoList} onCopiarLink={copiarLinkPrivacidad} />
      )}

      {tab === 'bitacora' && (
        <Bitacora entries={bitacora} loading={loading} />
      )}

      {tab === 'arco' && (
        <ArcoPanel requests={arcoList} loading={loading} onResolver={resolverArco} />
      )}
    </div>
  )
}

function EstadoCumplimiento({ clinicId, bitacora, arcoList, onCopiarLink }: { clinicId: string; bitacora: AuditEntry[]; arcoList: ArcoRequest[]; onCopiarLink: () => void }) {
  const pendientes = arcoList.filter(a => a.estado === 'recibida' || a.estado === 'en_proceso')
  const urlPrivacidad = typeof window !== 'undefined' ? `${window.location.origin}/privacidad/${clinicId}` : ''

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Resumen
        ok={bitacora.length > 0}
        titulo="Bitácora de accesos (NOM-024 Art. 6.5)"
        descripcion={`${bitacora.length} eventos registrados (mostrando últimos 200). Cada lectura, escritura, impresión y firma queda con sello de tiempo.`}
      />
      <Resumen
        ok={pendientes.length === 0}
        titulo={`Derechos ARCO (LFPDPPP)`}
        descripcion={pendientes.length === 0
          ? 'Sin solicitudes pendientes. Todas resueltas.'
          : `Tienes ${pendientes.length} solicitud(es) pendiente(s). Plazo legal: 20 días hábiles.`}
      />
      <Resumen
        ok={true}
        titulo="Portal público de privacidad"
        descripcion="Comparte este link con tus pacientes para que ejerzan sus derechos ARCO."
        accion={
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onCopiarLink} className="btn btn-secondary" style={{ fontSize: 12 }}>
              <Copy size={12} /> Copiar link
            </button>
            <a href={urlPrivacidad} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12 }}>
              <ExternalLink size={12} /> Ver portal
            </a>
          </div>
        }
      />
      <Resumen
        ok={true}
        titulo="Integridad de notas firmadas (NOM-024)"
        descripcion="Hash SHA-256 + Firestore Rules garantizan que las notas firmadas son inmutables."
      />
      <Resumen
        ok={true}
        titulo="Multi-tenant aislado"
        descripcion="Tu clínica solo ve sus propios datos. Aislamiento garantizado por reglas Firestore."
      />
      <Seguridad2FAResumen />
      <RetencionResumen clinicId={clinicId} />
    </div>
  )
}

/** Estado de 2FA de la cuenta actual */
function Seguridad2FAResumen() {
  const [activo, setActivo] = useState(false)
  useEffect(() => {
    import('firebase/auth').then(({ multiFactor }) => {
      const u = (require('@/lib/firebase') as { auth: { currentUser: unknown } }).auth.currentUser
      if (!u) return
      try {
        const mfa = multiFactor(u as Parameters<typeof multiFactor>[0])
        setActivo(mfa.enrolledFactors.some(f => f.factorId === 'totp'))
      } catch { /* no-op */ }
    })
  }, [])
  return (
    <Resumen
      ok={activo}
      titulo="Autenticación de dos factores (2FA)"
      descripcion={activo
        ? 'Tu cuenta tiene 2FA activo. Al iniciar sesión te pediré el código de tu autenticador.'
        : 'Tu cuenta NO tiene 2FA. Recomendado para protección extra contra accesos no autorizados.'}
      accion={
        <a href="/cumplimiento/seguridad" className="btn btn-secondary" style={{ fontSize: 12 }}>
          <Shield size={12} /> {activo ? 'Administrar' : 'Activar 2FA'}
        </a>
      }
    />
  )
}

/** Panel de política de retención NOM-004 numeral 5.7 — mínimo 5 años desde última anotación */
function RetencionResumen({ clinicId }: { clinicId: string }) {
  const [pacientesViejos, setPacientesViejos] = useState<{ count: number; mas5: number }>({ count: 0, mas5: 0 })

  useEffect(() => {
    if (!clinicId) return
    import('@/lib/firestore').then(async ({ getPatients }) => {
      const pacientes = await getPatients(clinicId)
      const ahora = Date.now()
      const cincoAnios = 5 * 365 * 24 * 60 * 60 * 1000
      const mas5 = pacientes.filter(p => {
        const ult = p.ultimaCita || p.updatedAt || p.createdAt
        if (!ult) return false
        return ahora - new Date(ult).getTime() > cincoAnios
      }).length
      setPacientesViejos({ count: pacientes.length, mas5 })
    }).catch(() => {})
  }, [clinicId])

  const ok = pacientesViejos.mas5 === 0
  return (
    <Resumen
      ok={ok}
      titulo="Política de retención (NOM-004 numeral 5.7)"
      descripcion={ok
        ? `${pacientesViejos.count} pacientes en expediente. Ninguno supera 5 años sin actividad.`
        : `${pacientesViejos.mas5} paciente(s) con >5 años sin actividad. Revisa si proceden para archivar o anonimizar.`}
      accion={
        <a href="/cumplimiento/retencion" className="btn btn-secondary" style={{ fontSize: 12 }}>
          <FileSearch size={12} /> Ver lista
        </a>
      }
    />
  )
}

function Resumen({ ok, titulo, descripcion, accion }: { ok: boolean; titulo: string; descripcion: string; accion?: React.ReactNode }) {
  return (
    <div style={{
      padding: 16, background: ok ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.35)'}`,
      borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      {ok ? <Check size={18} color="#10b981" style={{ marginTop: 2 }} /> : <AlertTriangle size={18} color="#f59e0b" style={{ marginTop: 2 }} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>{descripcion}</div>
      </div>
      {accion && <div style={{ flexShrink: 0 }}>{accion}</div>}
    </div>
  )
}

function Bitacora({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  if (loading) return <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>Cargando…</div>
  if (entries.length === 0) return <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>Sin eventos registrados aún.</div>
  return (
    <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{entries.length} eventos · ordenados por más recientes</span>
        <span><FileSearch size={12} style={{ verticalAlign: 'middle' }} /> NOM-024 Art. 6.5</span>
      </div>
      <div style={{ maxHeight: 600, overflow: 'auto' }}>
        {entries.map(e => (
          <div key={e.id} style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 4,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {EVENTO_LABEL[e.evento] ?? e.evento}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {e.medicoEmail ?? '—'}
                {e.patientId && <> · paciente {e.patientId.slice(0, 8)}</>}
                {e.notaId && <> · nota {e.notaId.slice(0, 6)}</>}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', textAlign: 'right' }}>
              {new Date(e.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ArcoPanel({ requests, loading, onResolver }: { requests: ArcoRequest[]; loading: boolean; onResolver: (req: ArcoRequest, estado: 'resuelta' | 'rechazada') => void }) {
  if (loading) return <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>Cargando…</div>
  if (requests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
        <Inbox size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
        <div>Sin solicitudes ARCO todavía.</div>
        <div style={{ fontSize: 11.5, marginTop: 6 }}>
          Cuando un paciente solicite acceso, rectificación, cancelación u oposición, aparecerá aquí.
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {requests.map(r => {
        const limite = r.fechaLimiteRespuesta ? new Date(r.fechaLimiteRespuesta) : null
        const ahora = new Date()
        const diasRestantes = limite ? Math.ceil((limite.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)) : null
        const pendiente = r.estado === 'recibida' || r.estado === 'en_proceso'
        return (
          <div key={r.id} style={{
            padding: 14, background: 'var(--s)', border: `1px solid ${pendiente && diasRestantes !== null && diasRestantes <= 5 ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ARCO_TIPO_LABEL[r.tipo]}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                  {r.solicitante.nombre} · {r.solicitante.telefono}
                  {r.solicitante.email && <> · {r.solicitante.email}</>}
                </div>
              </div>
              <EstadoBadge estado={r.estado} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', padding: 8, background: 'var(--s2)', borderRadius: 6, marginBottom: 8 }}>
              {r.descripcion}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
              <span>
                Recibida {new Date(r.fechaSolicitud).toLocaleDateString('es-MX')}
                {pendiente && diasRestantes !== null && (
                  <span style={{ marginLeft: 8, color: diasRestantes <= 5 ? '#f87171' : 'var(--text3)' }}>
                    <Clock size={11} style={{ verticalAlign: 'middle' }} /> {diasRestantes > 0 ? `Faltan ${diasRestantes} días` : `Vencida hace ${Math.abs(diasRestantes)} días`}
                  </span>
                )}
              </span>
              {pendiente && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onResolver(r, 'rechazada')} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                    Rechazar
                  </button>
                  <button onClick={() => onResolver(r, 'resuelta')} className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }}>
                    Marcar resuelta
                  </button>
                </div>
              )}
            </div>
            {r.resolucion && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(16,185,129,0.06)', borderLeft: '2px solid #10b981', fontSize: 11.5, color: 'var(--text2)' }}>
                <strong>Resolución:</strong> {r.resolucion}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: ArcoEstado }) {
  const map: Record<ArcoEstado, { label: string; color: string; bg: string }> = {
    recibida: { label: 'RECIBIDA', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    en_proceso: { label: 'EN PROCESO', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    resuelta: { label: 'RESUELTA', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    rechazada: { label: 'RECHAZADA', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  }
  const m = map[estado]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}
