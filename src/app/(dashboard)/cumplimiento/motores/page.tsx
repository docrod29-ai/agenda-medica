'use client'
/**
 * /cumplimiento/motores — HOJA DE REVISIÓN CLÍNICA.
 *
 * ── POR QUÉ EXISTE (PRACTICE-GA-005) ─────────────────────────────────────────
 *
 * El registro clínico clasifica los 89 motores en validado / pendiente de
 * validación / experimental, con su referencia y —para los pendientes— **la
 * pregunta concreta que hay que hacerle al médico responsable**. Todo eso
 * existía desde hace meses y **lo leían sólo las pruebas**: ninguna pantalla lo
 * consultaba, así que para el médico no existía.
 *
 * Esta página es la otra mitad del sello que aparece junto a los resultados. El
 * sello dice «esto no está revisado»; aquí está la lista completa, agrupada por
 * especialidad, con lo que hace cada motor, de dónde salen sus reglas y qué hay
 * que decidir para poder marcarlo como validado.
 *
 * ── NO SE INVENTA NADA ───────────────────────────────────────────────────────
 *
 * La página no propone umbrales, dosis ni criterios: sólo muestra lo que el
 * registro ya declara. Validar un motor es una decisión clínica del médico
 * responsable y se hace cambiando su `estado` en `registry.ts` — con su nombre
 * y su fecha en el commit.
 *
 * El registro completo se importa AQUÍ y no en el componente del sello: Next
 * parte el código por ruta, así que sus 2 100 líneas sólo las descarga quien
 * abre esta pantalla. El sello usa el mapa delgado.
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, FlaskConical, ShieldCheck, Search } from 'lucide-react'
import { CLINICAL_ENGINE_REGISTRY } from '@/lib/clinical/registry'

const ESTILO_ESTADO: Record<string, { etiqueta: string; color: string; fondo: string }> = {
  pendiente_validacion: { etiqueta: 'SIN VALIDAR', color: 'var(--amber)', fondo: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
  experimental: { etiqueta: 'EXPERIMENTAL', color: 'var(--purple)', fondo: 'rgba(124,58,237,.12)' },
  validado: { etiqueta: 'VALIDADO', color: '#059669', fondo: 'rgba(5,150,105,.12)' },
}

export default function MotoresPage() {
  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(true)

  const { grupos, totales } = useMemo(() => {
    const t = { validado: 0, pendiente_validacion: 0, experimental: 0 } as Record<string, number>
    for (const m of CLINICAL_ENGINE_REGISTRY) t[m.estado] = (t[m.estado] ?? 0) + 1

    const q = busqueda.trim().toLowerCase()
    const lista = CLINICAL_ENGINE_REGISTRY
      .filter(m => (soloPendientes ? m.estado !== 'validado' : true))
      .filter(m => !q || `${m.nombre} ${m.especialidad} ${m.id}`.toLowerCase().includes(q))

    const porEspecialidad = new Map<string, typeof lista>()
    for (const m of lista) {
      const k = m.especialidad || 'Sin clasificar'
      porEspecialidad.set(k, [...(porEspecialidad.get(k) ?? []), m])
    }
    return {
      grupos: [...porEspecialidad.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      totales: t,
    }
  }, [busqueda, soloPendientes])

  const sinValidar = totales.pendiente_validacion + totales.experimental

  return (
    <div className="page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link href="/cumplimiento" style={{ fontSize: 13, color: 'var(--nexus, #3D5AFE)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={14} /> Cumplimiento
      </Link>

      <h1 style={{ fontSize: 25, fontWeight: 800, margin: '12px 0 6px', color: 'var(--text)' }}>
        Motores clínicos
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 18px', lineHeight: 1.6 }}>
        Cada cálculo clínico de NexusMED es un motor determinista con su referencia y sus casos de prueba.
        Aquí está cuáles ha revisado un médico responsable y cuáles no.
      </p>

      {/* El número que importa, arriba y sin adornos. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tarjeta icono={<ShieldCheck size={16} />} n={totales.validado} label="validados" color="#059669" />
        <Tarjeta icono={<FlaskConical size={16} />} n={sinValidar} label="esperan tu revisión" color="var(--amber)" />
      </div>

      <div style={{
        background: 'color-mix(in srgb, var(--amber) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
        borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, lineHeight: 1.6, color: 'var(--text2)',
      }}>
        <strong style={{ color: 'var(--text)' }}>Qué significa «sin validar».</strong> El motor funciona y tiene
        pruebas: lo que falta es que un médico responsable confirme que sus reglas son las correctas para tu
        práctica. Mientras tanto, sus resultados salen en pantalla con una etiqueta ámbar junto al dato —
        nunca se ocultan ni se bloquean. <strong style={{ color: 'var(--text)' }}>NexusMED no propone aquí ningún
        umbral ni dosis</strong>: sólo muestra lo que hay que decidir.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o especialidad…"
            aria-label="Buscar motor clínico"
            style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px 9px 32px', fontSize: 13.5, color: 'var(--text)' }}
          />
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} />
          Sólo los que esperan revisión
        </label>
      </div>

      {grupos.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>Ningún motor coincide con esa búsqueda.</p>
      )}

      {grupos.map(([especialidad, motores]) => (
        <section key={especialidad} style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', margin: '0 0 10px' }}>
            {especialidad} <span style={{ fontWeight: 500 }}>· {motores.length}</span>
          </h2>

          {motores.map(m => {
            const est = ESTILO_ESTADO[m.estado] ?? ESTILO_ESTADO.validado
            // La pregunta pendiente ya la declara el propio registro. No se
            // redacta aquí: se muestra la que escribió quien construyó el motor.
            const pregunta = m.rangoValido.fuente === 'pendiente_validacion_clinica'
              ? m.rangoValido.preguntaAlMedico
              : null
            return (
              <article key={m.id} style={{ border: '1px solid var(--border)', background: 'var(--s1)', borderRadius: 11, padding: '13px 15px', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{m.nombre}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', padding: '2px 8px', borderRadius: 'var(--r-pill)', color: est.color, background: est.fondo }}>
                    {est.etiqueta}
                  </span>
                  <code style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{m.id} · v{m.version}</code>
                </div>

                <Campo titulo="De dónde salen sus reglas" texto={m.referencia} />
                {m.calculos?.length ? <Campo titulo="Qué decide" texto={m.calculos.join(' · ')} /> : null}
                <Campo titulo="Qué hace si falta un dato" texto={m.missingData} />

                {pregunta && (
                  <div style={{ marginTop: 9, padding: '10px 12px', borderRadius: 9, background: 'color-mix(in srgb, var(--amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--amber)', marginBottom: 4 }}>
                      Lo que hay que decidir
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>{pregunta}</div>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      ))}

      <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        Los cálculos clínicos son deterministas y viven fuera de la IA: el modelo de lenguaje redacta y ordena,
        pero nunca calcula una escala ni una dosis. Cada motor lleva su decisión de arquitectura documentada y
        sus casos de prueba en el repositorio.
      </p>
    </div>
  )
}

function Tarjeta({ icono, n, label, color }: { icono: React.ReactNode; n: number; label: string; color: string }) {
  return (
    <div style={{ flex: '1 1 160px', border: '1px solid var(--border)', background: 'var(--s1)', borderRadius: 11, padding: '12px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color, marginBottom: 3 }}>
        {icono}
        <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{label}</div>
    </div>
  )
}

function Campo({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto) return null
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text2)', marginTop: 3 }}>
      <span style={{ color: 'var(--text3)' }}>{titulo}: </span>{texto}
    </div>
  )
}
