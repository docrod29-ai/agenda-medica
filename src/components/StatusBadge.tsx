import { AppointmentStatus } from '@/types'

const STATUS_STYLES: Record<AppointmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  'solicitada':           { label: 'Solicitada',           bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', dot: '#fbbf24' },
  'pendiente-datos':      { label: 'Pendiente de datos',   bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', dot: '#fbbf24' },
  'pendiente-confirmar':  { label: 'Pendiente confirmar',  bg: 'rgba(251,191,36,0.12)',  text: '#fb923c', dot: '#fb923c' },
  'confirmada':           { label: 'Confirmada',           bg: 'rgba(0,212,168,0.12)',   text: '#00d4a8', dot: '#00d4a8' },
  'recordatorio-enviado': { label: 'Recordatorio enviado', bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', dot: '#60a5fa' },
  'en-sala':              { label: 'En sala de espera',    bg: 'rgba(59,130,246,0.18)',  text: '#93c5fd', dot: '#93c5fd' },
  'en-consulta':          { label: 'En consulta',          bg: 'rgba(168,85,247,0.18)',  text: '#c084fc', dot: '#c084fc' },
  'atendida':             { label: 'Atendida',             bg: 'rgba(0,212,168,0.12)',   text: '#34d399', dot: '#34d399' },
  'finalizada':           { label: 'Finalizada',           bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', dot: '#94a3b8' },
  'cancelada':            { label: 'Cancelada',            bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#f87171' },
  'reagendada':           { label: 'Reagendada',           bg: 'rgba(251,146,60,0.12)',  text: '#fb923c', dot: '#fb923c' },
  'no-asistio':           { label: 'No asistió',           bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', dot: '#ef4444' },
  'pendiente-pago':       { label: 'Pendiente de pago',    bg: 'rgba(249,115,22,0.15)',  text: '#fb923c', dot: '#fb923c' },
  'pagada':               { label: 'Pagada',               bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#4ade80' },
}

interface Props {
  status: AppointmentStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const s = STATUS_STYLES[status]
  if (!s) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      borderRadius: 9999,
      background: s.bg,
      color: s.text,
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}
