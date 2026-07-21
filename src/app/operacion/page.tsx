import Link from 'next/link'

export const metadata = {
  title: 'Operación y finanzas · NexusMED',
  description: 'Corte de caja, cuentas por cobrar, inventario de farmacia, paquetes, comisiones y facturación CFDI (SAT). La operación de tu consultorio, no solo la agenda.',
}

type Estado = 'activo' | 'parcial' | 'roadmap'
interface Item { nombre: string; desc: string; estado: Estado }

const FINANZAS: Item[] = [
  { nombre: 'Corte de caja', estado: 'activo', desc: 'Cierre del día con embudo agendadas → atendidas → cobradas, cobrado por método y cuentas pendientes. En hora de México.' },
  { nombre: 'Cuentas por cobrar', estado: 'activo', desc: 'Worklist de consultas atendidas sin cobro, con anti-doble-cobro por transacción y opción de cortesía auditada.' },
  { nombre: 'Cobros', estado: 'activo', desc: 'La asistente registra el pago cuando el paciente paga; efectivo, tarjeta, transferencia, cheque. Anulación auditada.' },
  { nombre: 'Inventario de farmacia', estado: 'activo', desc: 'Existencias, entradas/salidas transaccionales (sin stock negativo), caducidades y bloqueo/dispensación.' },
  { nombre: 'Paquetes', estado: 'activo', desc: 'Precios por paquete, incluso escalando por número de médicos o camas.' },
  { nombre: 'Facturación CFDI (SAT)', estado: 'activo', desc: 'Timbrado 4.0 vía Facturama, idempotente (sin doble timbre). Requiere tus CSD/SAT.' },
  { nombre: 'Reportes financieros', estado: 'parcial', desc: 'Ingresos, IVA contenido, costos y margen. Se están ampliando por médico, servicio y tendencia.' },
  { nombre: 'Comisiones', estado: 'parcial', desc: 'Cálculo por médico/servicio en construcción.' },
  { nombre: 'Membresías de pacientes', estado: 'roadmap', desc: 'Planes recurrentes para pacientes (la recurrencia Stripe ya existe para clínicas).' },
  { nombre: 'TPV (terminal de pago)', estado: 'roadmap', desc: 'Cobro con terminal integrada (Stripe Terminal / Clip / Mercado Pago).' },
  { nombre: 'Multi-sucursal', estado: 'roadmap', desc: 'Varias sedes sobre el multi-tenant existente.' },
]

const CHIP: Record<Estado, { t: string; c: string; bg: string }> = {
  activo:  { t: 'Disponible hoy', c: '#0d9488', bg: 'rgba(13,148,136,.14)' },
  parcial: { t: 'En expansión',   c: '#b45309', bg: 'rgba(180,83,9,.14)' },
  roadmap: { t: 'Roadmap',        c: '#4f5bd5', bg: 'rgba(79,91,213,.14)' },
}

export default function OperacionPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 90px' }}>
      <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal, #0d9488)', fontWeight: 700 }}>
        Operación y finanzas
      </div>
      <h1 style={{ fontSize: 'clamp(26px,4.5vw,40px)', lineHeight: 1.1, margin: '.35em 0 .3em', color: 'var(--text, #0f172a)', letterSpacing: '-.02em' }}>
        No solo agenda. La operación completa del consultorio.
      </h1>
      <p style={{ fontSize: 16.5, color: 'var(--text2, #334155)', maxWidth: '68ch', lineHeight: 1.55 }}>
        Corte de caja, cuentas por cobrar, inventario de farmacia, paquetes y facturación CFDI ya funcionan hoy.
        Lo que falta lo decimos con claridad — sin vender humo.
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {FINANZAS.map(m => (
          <div key={m.nombre} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, background: 'var(--panel, #fff)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text, #0f172a)', margin: 0 }}>{m.nombre}</h2>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 100, color: CHIP[m.estado].c, background: CHIP[m.estado].bg, whiteSpace: 'nowrap' }}>
                {CHIP[m.estado].t}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2, #334155)', lineHeight: 1.5, margin: 0 }}>{m.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/arquitectura" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal, #0d9488)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700 }}>
          Ver los motores del sistema
        </Link>
        <Link href="/precios" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2, #334155)', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border, #e5e7eb)' }}>
          Planes
        </Link>
      </div>
    </div>
  )
}
