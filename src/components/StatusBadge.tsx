import { AppointmentStatus } from '@/types'

/**
 * ESTADOS DE CITA — con color por TEMA, no fijo.
 *
 * Antes cada estado llevaba un color claro cableado (verde/azul pastel: #34d399,
 * #93c5fd, #4ade80…) pensado para texto claro sobre fondo oscuro. En MODO CLARO
 * esos pasteles caían sobre un fondo translúcido casi blanco y desaparecían — el
 * médico no distinguía "Atendida" de "Pagada". Los badges no se adaptaban al tema.
 *
 * Ahora cada estado se mapea a un TONO semántico (blue/amber/red/green/purple/
 * gris) y el color sale de las variables `--blue/--amber/...`, que globals.css ya
 * define con contraste AA POR TEMA. El fondo es una tinta translúcida del mismo
 * tono con `color-mix`. Resultado: legible en claro y oscuro sin duplicar tablas.
 */

type Tono = 'blue' | 'amber' | 'red' | 'green' | 'purple' | 'gris'

const STATUS: Record<AppointmentStatus, { label: string; tono: Tono }> = {
  'solicitada':           { label: 'Solicitada',           tono: 'amber' },
  'pendiente-datos':      { label: 'Pendiente de datos',   tono: 'amber' },
  'pendiente-confirmar':  { label: 'Pendiente confirmar',  tono: 'amber' },
  'confirmada':           { label: 'Confirmada',           tono: 'blue' },
  'recordatorio-enviado': { label: 'Recordatorio enviado', tono: 'blue' },
  'en-sala':              { label: 'En sala de espera',    tono: 'blue' },
  'en-consulta':          { label: 'En consulta',          tono: 'purple' },
  'atendida':             { label: 'Atendida',             tono: 'green' },
  'finalizada':           { label: 'Finalizada',           tono: 'gris' },
  'cancelada':            { label: 'Cancelada',            tono: 'red' },
  'reagendada':           { label: 'Reagendada',           tono: 'amber' },
  'no-asistio':           { label: 'No asistió',           tono: 'red' },
  'pendiente-pago':       { label: 'Pendiente de pago',    tono: 'amber' },
  'pagada':               { label: 'Pagada',               tono: 'green' },
}

interface Props {
  status: AppointmentStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const s = STATUS[status]
  if (!s) return null
  // Paleta de badge dedicada (globals.css), tuneada AA por tema. El texto NO se
  // tinta contra su propio color: fondo claro-neutro + texto oscuro del tono.
  const texto = `var(--badge-${s.tono}-t)`
  const fondo = `var(--badge-${s.tono}-b)`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      borderRadius: 'var(--r-pill)',
      background: fondo,
      color: texto,
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: texto, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}
