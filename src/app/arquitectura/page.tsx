import Link from 'next/link'

export const metadata = {
  title: 'Arquitectura · Ausculta',
  description: 'Los motores internos de Ausculta: razonamiento clínico, seguridad de dosis, evidencia con PMID, interoperabilidad HL7/FHIR, paquetes por especialidad. Qué existe hoy y cómo se demuestra.',
}

type Estado = 'activo' | 'parcial' | 'roadmap'

interface Motor {
  nombre: string
  desc: string
  estado: Estado
  demo: string
}

const MOTORES: Motor[] = [
  { nombre: 'Clinical Reasoning Engine', estado: 'activo',
    desc: 'Encadena los 12 pasos del razonamiento clínico y muestra, por paso, de dónde salió cada afirmación (regla con código, IA o evidencia) y con cuánta confianza.',
    demo: 'Visible en cada consulta: “Cómo razoné este caso”.' },
  { nombre: 'Dosing & Safety Engine', estado: 'activo',
    desc: 'Verificación DETERMINISTA de dosis: error de decimal, sobre-máximo, mg/kg pediátrico, ajuste por función renal, contraindicación en embarazo e interacciones fármaco-fármaco.',
    demo: 'Corre en la receta y en la consulta, con código (no IA).' },
  { nombre: 'Evidence Engine', estado: 'activo',
    desc: 'Recupera evidencia real de PubMed y verifica cada cita contra su PMID/DOI. Nunca inventa una referencia.',
    demo: 'Consultor de evidencia + nivel Máxima.' },
  { nombre: 'Voice & Dictation Engine', estado: 'activo',
    desc: 'Dictado médico con separación de voces (médico/paciente), corrector de fármacos y estructuración de la nota.',
    demo: 'El botón de micrófono en la consulta.' },
  { nombre: 'Specialty Packages', estado: 'activo',
    desc: 'La consulta se arma por TRONCO de especialidad y las subespecialidades heredan del suyo: interna (cardiometabólico, PROA), pediatría (dosis por peso, curvas OMS), gineco-obstetricia, quirúrgico/preop. El copiloto de seguridad va en todos.',
    demo: 'Catálogo público en /paquetes; gobierna la consulta hoy.' },
  { nombre: 'Interoperability Engine', estado: 'activo',
    desc: 'Importación/exportación HL7 v2 y FHIR (laboratorios, pacientes), con verificación de sujeto e idempotencia.',
    demo: 'Módulo hospitalario (import de labs).' },
  { nombre: 'Finance & Operations Engine', estado: 'activo',
    desc: 'Corte de caja, cuentas por cobrar, cobros con anti-doble-cobro, inventario de farmacia, paquetes y recibo de cobro no fiscal. (El CFDI que se timbra es el de TU suscripción a Ausculta, no el de tu paciente.)',
    demo: 'Módulos Finanzas y Farmacia.' },
  { nombre: 'Messaging Engine (WhatsApp)', estado: 'activo',
    desc: 'Recordatorios y confirmaciones por WhatsApp con opt-out, ventana de 24 h, plantillas HSM, outbox y horas de silencio.',
    demo: 'Recordatorios automáticos de cita.' },
  { nombre: 'Workflow Orchestrator', estado: 'activo',
    desc: 'Motor determinista que UNIFICA en una sola lista priorizada lo que necesita atención hoy: consultas atendidas sin cobro, membresías vencidas, citas sin confirmar. Cada acción sale de un estado real del expediente, no de una promesa.',
    demo: 'Panel "Siguiente acción" en el Dashboard.' },
  { nombre: 'Learning Engine', estado: 'activo',
    desc: 'Aprende de lo que ESE médico realmente hace: (1) reordena las sugerencias del copiloto según cuáles acepta (las críticas nunca se mueven); (2) aprende sus recetas — al emitir una, guarda el fármaco con SU posología y le ofrece "tus más recetados" para llenar la fila con un toque. Arranque en frío honesto, personalización por médico y aislada por autor, sin prometer ML que no existe.',
    demo: 'En la receta: chips "tus más recetados" con tu dosis habitual.' },
]

const CHIP: Record<Estado, { t: string; c: string; bg: string }> = {
  activo:  { t: 'Activo',       c: '#0d9488', bg: 'rgba(13,148,136,.14)' },
  parcial: { t: 'En expansión', c: '#b45309', bg: 'color-mix(in srgb, var(--amber) 14%, transparent)' },
  roadmap: { t: 'Roadmap',      c: '#4f5bd5', bg: 'rgba(79,91,213,.14)' },
}

export default function ArquitecturaPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 90px' }}>
      <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: 700 }}>
        Arquitectura
      </div>
      <h1 style={{ fontSize: 'clamp(26px,4.5vw,40px)', lineHeight: 1.1, margin: '.35em 0 .3em', color: 'var(--text)', letterSpacing: '-.02em' }}>
        No es una app de agenda con IA encima. Son motores.
      </h1>
      <p style={{ fontSize: 16.5, color: 'var(--text2)', maxWidth: '68ch', lineHeight: 1.55 }}>
        Ausculta es un sistema operativo clínico: cada capacidad es un motor con una responsabilidad clara.
        Aquí está el estado <strong>real</strong> de cada uno — sin humo. Lo que dice “Activo” lo puedes usar hoy;
        lo que dice “Roadmap” lo estamos construyendo y lo decimos.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 6px' }}>
        {(['activo', 'parcial', 'roadmap'] as Estado[]).map(e => (
          <span key={e} style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 'var(--r-pill)', color: CHIP[e].c, background: CHIP[e].bg }}>
            {CHIP[e].t}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
        {MOTORES.map(m => (
          <div key={m.nombre} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{m.nombre}</h2>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)', color: CHIP[m.estado].c, background: CHIP[m.estado].bg }}>
                {CHIP[m.estado].t}
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 8px' }}>{m.desc}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: 0 }}>▸ {m.demo}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 34, padding: '18px 20px', border: '1px solid var(--border)', borderLeft: '3px solid var(--teal)', borderRadius: 12, background: 'var(--panel2)' }}>
        <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Principio de honestidad.</strong> Nunca inventamos datos clínicos, dosis, breakpoints ni referencias.
          El Reasoning Engine expone <em>de dónde</em> viene cada afirmación precisamente para que la incertidumbre sea visible, no oculta.
        </p>
      </div>

      <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/precios" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700 }}>
          Ver planes y niveles de IA
        </Link>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2)', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
