import Link from 'next/link'
import { DemoWorkflow } from '@/components/DemoWorkflow'

export const metadata = {
  title: 'Operación y finanzas · Ausculta',
  description: 'Corte de caja, cuentas por cobrar, inventario de farmacia, paquetes, comisiones y control financiero. La operación de tu consultorio, no solo la agenda.',
}

type Estado = 'activo' | 'parcial' | 'roadmap'
interface Item { nombre: string; desc: string; estado: Estado }

const FINANZAS: Item[] = [
  { nombre: 'Corte de caja', estado: 'activo', desc: 'Cierre del día con embudo agendadas → atendidas → cobradas, cobrado por método y cuentas pendientes. En hora de México.' },
  { nombre: 'Cuentas por cobrar', estado: 'activo', desc: 'Worklist de consultas atendidas sin cobro, con anti-doble-cobro por transacción y opción de cortesía auditada.' },
  { nombre: 'Cobros', estado: 'activo', desc: 'La asistente registra el pago cuando el paciente paga; efectivo, tarjeta, transferencia, cheque. Anulación auditada.' },
  { nombre: 'Inventario de farmacia', estado: 'activo', desc: 'Existencias, entradas/salidas transaccionales (sin stock negativo), caducidades y bloqueo/dispensación.' },
  { nombre: 'Paquetes', estado: 'activo', desc: 'Precios por paquete, incluso escalando por número de médicos o camas.' },
  /**
   * DECISIÓN 13 DEL DR. (3-ago-2026): «no se vende una función que no existe».
   *
   * Esto decía «Disponible hoy · Timbrado 4.0 … Requiere TUS CSD/SAT», dentro de
   * una lista de capacidades DEL CONSULTORIO. Un comprador lo lee como «puedo
   * facturar a mis pacientes», y no puede.
   *
   * Lo que SÍ existe es lo contrario: Ausculta te timbra a TI el CFDI de tu
   * suscripción (emisor = la plataforma, receptor = el consultorio). Eso
   * funciona, es real, y ahora se dice tal cual.
   *
   * Facturar al paciente exige PAC, cuenta productiva, RFC y régimen del médico,
   * CSD, manejo seguro de la llave, catálogo fiscal, timbrado, cancelación,
   * sustitución, XML/PDF y conciliación. Es un proyecto aparte.
   */
  { nombre: 'Recibo de cobro (no fiscal)', estado: 'activo', desc: 'Comprobante del pago para el paciente, claramente identificado como NO fiscal. Con folio, concepto, método y quién cobró.' },
  { nombre: 'Tu factura de Ausculta (CFDI 4.0)', estado: 'activo', desc: 'Nosotros te timbramos a TI el CFDI de tu suscripción: pides la factura desde la app, con tus datos fiscales, y descargas PDF y XML. No requiere tus CSD.' },
  { nombre: 'Facturar a tus pacientes (CFDI)', estado: 'roadmap', desc: 'Que el consultorio timbre a su paciente NO existe todavía: exige PAC, tus CSD y llave, catálogo fiscal, timbrado, cancelación y conciliación. Cuando esté en producción lo diremos aquí, no antes.' },
  { nombre: 'Reportes financieros', estado: 'parcial', desc: 'Ingresos, IVA contenido, costos y margen. Se están ampliando por médico, servicio y tendencia.' },
  { nombre: 'Comisiones', estado: 'parcial', desc: 'Cálculo por médico/servicio en construcción.' },
  { nombre: 'Membresías de pacientes', estado: 'roadmap', desc: 'Planes recurrentes para pacientes (la recurrencia Stripe ya existe para clínicas).' },
  { nombre: 'TPV (terminal de pago)', estado: 'roadmap', desc: 'Cobro con terminal integrada (Stripe Terminal / Clip / Mercado Pago).' },
  { nombre: 'Multi-sucursal', estado: 'roadmap', desc: 'Varias sedes sobre el multi-tenant existente.' },
]

const CHIP: Record<Estado, { t: string; c: string; bg: string }> = {
/*
  LOS ESTADOS HABLAN EL TEMA, y no lo hacían.

  `#0d9488`, `#b45309` y `#4f5bd5` eran literales: no seguían al tema, así que
  el mismo tono servía para el fondo claro y para el oscuro. axe los midió
  sobre la página servida y los tres REPROBABAN sobre su propio tinte oscuro,
  en los tres anchos — 30 nodos sólo en esta página.

  Los tres tokens semánticos ya existían con su contraste medido por tema
  (`--green`, `--amber`, `--blue`, ver la nota de globals.css). Lo que faltaba
  no era el color: era usarlos. Y el tinte de fondo se deriva del mismo token
  con `color-mix`, para que los dos lados de la pareja se muevan juntos.
*/
  activo:  { t: 'Disponible hoy', c: 'var(--green)', bg: 'color-mix(in srgb, var(--green) var(--tinte), transparent)' },
  parcial: { t: 'En expansión',   c: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) var(--tinte), transparent)' },
  roadmap: { t: 'Roadmap',        c: 'var(--blue)',  bg: 'color-mix(in srgb, var(--blue) var(--tinte), transparent)' },
}

export default function OperacionPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 90px' }}>
      <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: 700 }}>
        Operación y finanzas
      </div>
      <h1 style={{ fontSize: 'clamp(26px,4.5vw,40px)', lineHeight: 1.1, margin: '.35em 0 .3em', color: 'var(--text)', letterSpacing: '-.02em' }}>
        No solo agenda. La operación completa del consultorio.
      </h1>
      <p style={{ fontSize: 16.5, color: 'var(--text2)', maxWidth: '68ch', lineHeight: 1.55 }}>
        Corte de caja, cuentas por cobrar, inventario de farmacia y paquetes ya funcionan hoy.
        Lo que falta lo decimos con claridad — sin vender humo: si algo dice «Roadmap», es que todavía no existe.
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
        {FINANZAS.map(m => (
          <div key={m.nombre} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{m.nombre}</h2>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--r-pill)', color: CHIP[m.estado].c, background: CHIP[m.estado].bg, whiteSpace: 'nowrap' }}>
                {CHIP[m.estado].t}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: 0 }}>{m.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 34 }}>
        <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: 700, marginBottom: 4 }}>
          Workflow Orchestrator · en vivo
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '2px 0 12px', letterSpacing: '-.01em' }}>
          El sistema te dice qué atender primero
        </h2>
        <DemoWorkflow />
      </div>

      <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/arquitectura" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700 }}>
          Ver los motores del sistema
        </Link>
        <Link href="/precios" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2)', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}>
          Planes
        </Link>
      </div>
    </div>
  )
}
