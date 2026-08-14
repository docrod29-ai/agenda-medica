'use client'
/**
 * OPERACIONES — V15-SHELL-GREYBOX-001 / V15-IA-001.
 *
 * §11: «Administrative surfaces remain available but must not dominate
 * physician navigation.» Esta pantalla es el destino de eso: los 18 destinos
 * que salieron del `FlowRail` de 5 (ver `docs/design/v15/IA-001-sitemap.md`
 * para el mapa completo pre/post) siguen existiendo en las MISMAS rutas —
 * nada se movió, nada se borró — sólo cambió desde dónde se llega.
 *
 * No es un dashboard nuevo: es un índice. La jerarquía visual es plana a
 * propósito: agrupar y listar, sin promover ninguna capacidad administrativa
 * a «destino que pesa». El cromo habla las clases del sistema (t-h1,
 * t-overline, t-body) — V15-REMAINING-SCREENS-001, 5ª rebanada.
 */
import Link from 'next/link'
import {
  CalendarPlus, CalendarDays, Calendar, Clock, BedDouble, Activity,
  TrendingUp, Star, HeartHandshake, Pill, ShieldCheck, FileText, ArrowLeftRight,
  MessageCircle, BookOpen, Settings, CreditCard, LogOut, Moon, Sun, Monitor,
  type LucideIcon,
} from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { useMode } from '@/context/ModeContext'
import { rutaPermitida } from '@/lib/modulos'
import { salirSeguro } from '@/lib/salir-seguro'
import { useTema } from '@/hooks/useTema'

type Item = { href: string; label: string; icon: LucideIcon; modos: 'ambos' | 'medico' }
type Grupo = { titulo: string; items: Item[] }

const GRUPOS: Grupo[] = [
  {
    titulo: 'Agenda',
    items: [
      { href: '/asistente', label: 'Agendar rápido', icon: CalendarPlus, modos: 'ambos' },
      { href: '/citas', label: 'Citas', icon: CalendarDays, modos: 'ambos' },
      { href: '/calendario', label: 'Calendario', icon: Calendar, modos: 'ambos' },
      { href: '/lista-espera', label: 'Lista de espera', icon: Clock, modos: 'ambos' },
    ],
  },
  /**
   * RTC-09: aquí había un grupo titulado «Clínico» — dentro del índice que se
   * define a sí mismo como «lo administrativo, APARTE del trabajo clínico».
   *
   * Dos cosas distintas vivían juntas y las dos salieron mal:
   *
   * 1. **Consultor IA y Antibiograma** eran páginas-módulo de IA en un menú:
   *    IA feature-first, la antítesis de §3.2. Se fueron al PACIENTE, que es
   *    donde ocurre la pregunta que contestan (ver `capacidades-del-paciente`
   *    y la barra de Herramientas del expediente). No se borró ninguna ruta.
   *
   * 2. **Hospitalización y UCI** no son capacidades: son otro ESCENARIO de
   *    atención (producto Hospital/UCI, ALPHA tras bandera — se usa, no se
   *    vende). Se quedan en el índice secundario porque no son el flujo
   *    primario del médico de consultorio (§11), pero con el nombre de lo que
   *    son. El título viejo afirmaba que el área admin contenía «lo clínico»,
   *    y eso era justo lo que §11 pide que no pase.
   */
  {
    titulo: 'Hospital y UCI',
    items: [
      { href: '/hospitalizacion', label: 'Hospitalización', icon: BedDouble, modos: 'ambos' },
      { href: '/uci', label: 'UCI', icon: Activity, modos: 'medico' },
    ],
  },
  {
    titulo: 'Negocio',
    items: [
      { href: '/crm', label: 'CRM', icon: TrendingUp, modos: 'medico' },
      { href: '/resenas', label: 'Reseñas', icon: Star, modos: 'medico' },
      { href: '/reactivacion', label: 'Reactivación', icon: HeartHandshake, modos: 'medico' },
      { href: '/farmacia', label: 'Farmacia', icon: Pill, modos: 'medico' },
      { href: '/finanzas', label: 'Finanzas', icon: TrendingUp, modos: 'medico' },
      { href: '/membresias', label: 'Membresías', icon: CreditCard, modos: 'ambos' },
    ],
  },
  {
    titulo: 'Cumplimiento y documentos',
    items: [
      { href: '/cumplimiento', label: 'Cumplimiento', icon: ShieldCheck, modos: 'medico' },
      { href: '/legal', label: 'Documentos legales', icon: FileText, modos: 'medico' },
      { href: '/migracion', label: 'Migración', icon: ArrowLeftRight, modos: 'medico' },
    ],
  },
  {
    titulo: 'Comunicación',
    items: [
      { href: '/chat', label: 'Chat', icon: MessageCircle, modos: 'ambos' },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { href: '/guia', label: 'Guía de uso', icon: BookOpen, modos: 'ambos' },
      { href: '/configuracion', label: 'Configuración', icon: Settings, modos: 'ambos' },
    ],
  },
]

export default function OperacionesPage() {
  const { clinic } = useClinic()
  const { mode } = useMode()

  const grupos = GRUPOS
    .map(g => ({
      ...g,
      items: g.items.filter(it =>
        (it.modos === 'ambos' || mode === 'medico') && rutaPermitida(clinic, it.href)),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 60px' }}>
      <h1 className="t-h1" style={{ margin: '0 0 4px' }}>
        Operaciones
      </h1>
      <p className="t-body" style={{ color: 'var(--text2)', margin: '0 0 28px', maxWidth: 560 }}>
        La administración del consultorio y los módulos de hospital, aparte del
        trabajo clínico del día. Nada de esto cambió de sitio — sólo se llega
        desde aquí en vez del menú principal.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {grupos.map(g => (
          <section key={g.titulo}>
            <h2 className="t-overline" style={{ margin: '0 0 10px' }}>
              {g.titulo}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
              {g.items.map(it => (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 10, minHeight: 44, boxSizing: 'border-box',
                    background: 'var(--s1)', border: '1px solid var(--border)',
                    color: 'var(--text)', textDecoration: 'none', fontSize: 14, fontWeight: 500,
                  }}
                >
                  <it.icon size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                  {it.label}
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* RTC-05 (§11): el tema es SISTEMA, no trabajo clínico. En móvil el
            toggle flotante murió (ocluía contenido clínico); su casa es ésta.
            En escritorio conviven: el flotante y esta fila son dos VISTAS del
            mismo estado (`useTema`), sincronizadas por evento. */}
        <TemaSection />

        {/* V15-MOBILE-001 (§22): en móvil de médico el cajón lateral se retiró
            (era el árbol de escritorio clonado) y con él su botón «Cerrar
            sesión». La salida vive aquí — Operaciones ES el área de sistema
            (§11) — con el MISMO salirSeguro que usan FlowRail y Sidebar (espera
            el acuse y purga IndexedDB; no una salida propia con otro criterio). */}
        <section>
          <h2 className="t-overline" style={{ margin: '0 0 10px' }}>
            Sesión
          </h2>
          <button
            onClick={() => { void salirSeguro('/login') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 10, minHeight: 44, boxSizing: 'border-box', cursor: 'pointer',
              background: 'var(--s1)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <LogOut size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
            Cerrar sesión
          </button>
        </section>
      </div>
    </div>
  )
}

function TemaSection() {
  const { modo, ciclar, montado, titulo } = useTema()
  if (!montado) return null
  const Icono = modo === 'dark' ? Moon : modo === 'light' ? Sun : Monitor
  const etiqueta = modo === 'dark' ? 'Tema: oscuro' : modo === 'light' ? 'Tema: claro' : 'Tema: automático'
  return (
    <section>
      <h2 className="t-overline" style={{ margin: '0 0 10px' }}>
        Apariencia
      </h2>
      <button
        onClick={ciclar}
        title={titulo}
        aria-label={titulo}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderRadius: 10, minHeight: 44, boxSizing: 'border-box', cursor: 'pointer',
          background: 'var(--s1)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
        }}
      >
        <Icono size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
        {etiqueta}
      </button>
    </section>
  )
}
