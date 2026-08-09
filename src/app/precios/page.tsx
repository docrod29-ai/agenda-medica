import Link from 'next/link'
import { PLANES, RECARGA, MOTORES, TOPE_ECONOMICO, precioAnual, consultasIncluidasTexto, type PlanCreditos } from '@/lib/planes-ia'
import { adminDb } from '@/lib/firebase-admin'
import { catalogoEfectivo, type CatalogoGuardado } from '@/lib/finanzas/catalogo-planes'
import { TablaNivelesIA } from '@/components/TablaNivelesIA'

export const metadata = {
  title: 'Precios · NexusMED',
  description: 'Planes de NexusMED por créditos: agenda, notas clínicas con IA, evidencia con citas y revisión de seguridad clínica. Precios en pesos.',
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Card({ plan }: { plan: PlanCreditos }) {
  const destacado = plan.destacado
  return (
    <div style={{
      position: 'relative', flex: '1 1 300px', maxWidth: 380, background: 'var(--s1, #FFF)',
      border: '1px solid ' + (destacado ? 'var(--nexus, #3D5AFE)' : 'var(--border, #E5E7EB)'),
      borderRadius: 18, padding: '26px 24px',
      boxShadow: destacado ? '0 12px 40px rgba(61,90,254,0.14)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {destacado && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--nexus-solido)', color: '#FFF', fontSize: 12, fontWeight: 700,
          padding: '4px 14px', borderRadius: 'var(--r-pill)', letterSpacing: 0.3,
        }}>Más popular</div>
      )}
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #0F172A)' }}>{plan.nombre}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--text, #0F172A)', letterSpacing: -1 }}>${plan.precioMXN.toLocaleString('es-MX')}</span>
        <span style={{ fontSize: 15, color: 'var(--text3, #64748B)' }}>MXN/mes</span>
      </div>
      {/*
        LO QUE COMPRA UN MÉDICO SON CONSULTAS, NO CRÉDITOS.
        «200 créditos al mes» no dice si alcanza para la semana o para el mes, y
        averiguarlo exige aprender cuánto cuesta cada motor. Nadie evalúa un
        producto haciendo esa cuenta: cierra la pestaña.
        El crédito no desaparece —es la unidad interna, y la honesta, porque una
        nota Máxima cuesta diez veces una Rápida— pero baja al segundo renglón.
      */}
      <div style={{ fontSize: 13, color: 'var(--text2, #475569)', fontWeight: 600, marginTop: 4, minHeight: 18 }}>
        {consultasIncluidasTexto(plan)}
      </div>
      {plan.creditos > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text3, #64748B)', marginTop: 1 }}>
          {plan.creditos} créditos · por médico
        </div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--teal)', fontWeight: 600, marginTop: 4 }}>
        o ${precioAnual(plan).toLocaleString('es-MX')}/año · 2 meses gratis
      </div>
      <Link href="/registro" style={{
        display: 'block', textAlign: 'center', marginTop: 18, padding: '12px 0', borderRadius: 12,
        fontSize: 15, fontWeight: 700, textDecoration: 'none',
        /* Relleno con texto blanco encima → el azul SÓLIDO (5,13 : 1). Como
           texto sobre transparente se queda --nexus, que es el que se lee. */
        background: destacado ? 'var(--nexus-solido)' : 'transparent',
        color: destacado ? '#FFF' : 'var(--nexus, #3D5AFE)',
        border: '1px solid var(--nexus, #3D5AFE)',
      }}>Prueba gratis 14 días</Link>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        {plan.incluye.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--text2, #334155)', lineHeight: 1.45 }}>
            <Check /> <span>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Se revalida cada 60 s: un precio no cambia cada minuto, y así la página sigue
 * siendo estática para quien la visita. Ése es el retraso máximo entre que el
 * dueño guarda un precio nuevo y el mundo lo ve.
 */
export const revalidate = 60

/**
 * LOS PRECIOS QUE SE PINTAN SALEN DEL CATÁLOGO VIGENTE, NO DE LA CONSTANTE.
 *
 * Es lo que faltaba para que el catálogo editable sirviera de algo: se podía
 * cambiar un precio en la consola del dueño y esta página —la que ve quien está
 * a punto de comprar— seguía enseñando el del código. Un ajuste que no llega al
 * cliente no es un ajuste.
 *
 * Si la base no responde se usan los valores de fábrica. Es la respuesta menos
 * mala: un precio de hace un mes es mucho mejor que una página de precios en
 * blanco delante de alguien decidiendo si paga.
 */
async function planesVigentes() {
  try {
    const snap = await adminDb.collection('platform_config').doc('catalogo_planes').get()
    return catalogoEfectivo(snap.exists ? (snap.data() as CatalogoGuardado) : null).planes
  } catch {
    return PLANES
  }
}

export default async function PreciosPage() {
  const planes = await planesVigentes()
  return (
    <div style={{ background: 'var(--bg, #F8FAFC)', minHeight: '100vh', padding: '56px 20px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus, #3D5AFE)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Precios</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '10px 0 0', letterSpacing: -0.5 }}>
          Paga por lo que usas, con IA de nivel mundial
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text3, #64748B)', maxWidth: 640, margin: '14px auto 0', lineHeight: 1.5 }}>
          Cada plan incluye créditos de IA al mes. Documentas por voz, la nota se arma sola, con separación
          médico-paciente, evidencia con citas y revisión de consistencia y seguridad clínica. Si se acaban,
          compras más o subes de plan — nunca te cobran de sorpresa.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'stretch', marginTop: 44 }}>
        <Card plan={planes.agenda} />
        <Card plan={planes.clinica} />
        <Card plan={planes.premium} />
      </div>

      {/* ── Menú de IA: los 3 motores ── */}
      <div style={{ maxWidth: 780, margin: '40px auto 0' }}>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text, #0F172A)', marginBottom: 4 }}>
          Elige el motor de IA en cada nota
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3, #64748B)', margin: '0 auto 16px', maxWidth: 560, lineHeight: 1.5 }}>
          Cada nota gasta créditos según el motor que uses — paga poco por lo rutinario, mucho solo cuando lo necesitas.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {(['rapida', 'estandar', 'maxima'] as const).map(k => {
            const m = MOTORES[k]
            return (
              <div key={k} style={{ flex: '1 1 210px', maxWidth: 250, background: 'var(--s1, #FFF)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0F172A)' }}>{m.emoji} {m.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text3, #64748B)', marginTop: 3 }}>{m.modelos}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--nexus, #3D5AFE)', marginTop: 10 }}>
                  {m.creditos} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3, #64748B)' }}>{m.creditos === 1 ? 'crédito/nota' : 'créditos/nota'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '22px auto 0', textAlign: 'center', fontSize: 13, color: 'var(--text2, #334155)', background: 'var(--s2, #F1F5F9)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: '12px 16px' }}>
        ¿Se te acaban los créditos del mes? Recarga <strong>{RECARGA.creditos} créditos</strong> por <strong>${RECARGA.precioMXN} MXN</strong> — o sigue con ⚡ Rápida sin costo
        hasta un tope mensual (<strong>{TOPE_ECONOMICO.pro} notas</strong> en Clínica, <strong>{TOPE_ECONOMICO.premium}</strong> en Pro). Pasado ese punto la IA se pausa y recargas o subes de plan.
      </div>

      {/* Tabla funcional de IA: qué CAMBIA CLÍNICAMENTE en cada nivel (no solo el precio). */}
      <div style={{ maxWidth: 860, margin: '48px auto 0' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text, #0F172A)', textAlign: 'center', margin: '0 0 6px', letterSpacing: -0.3 }}>
          Qué cambia clínicamente en cada nivel de IA
        </h2>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text2, #334155)', margin: '0 0 18px', maxWidth: 620, marginInline: 'auto' }}>
          Mantenemos los nombres simples, pero te decimos exactamente qué hace la IA en cada uno — sin cajas negras.
        </p>
        <TablaNivelesIA />
      </div>

      <div style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center', fontSize: 13, color: 'var(--text2, #334155)', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <strong>Precio fundador</strong> — los primeros 50 médicos congelan su tarifa de por vida. Aplica tu código <strong>FUNDADOR</strong> al pagar.
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text3, #64748B)', marginTop: 24 }}>
        Precios en pesos mexicanos, por médico. Paga <strong>anual y llévate 2 meses gratis</strong> (−17%). Cada nota gasta créditos
        según el motor de IA que elijas (⚡ 1 · ⭐ 3 · 💎 10). Al agotar tus créditos sigues con ⚡ Rápida sin costo hasta un tope mensual; pasado ese punto la IA se pausa
        y recargas o subes de plan. Nunca hay cobros de sorpresa. Cancela cuando quieras.
      </p>
    </div>
  )
}
