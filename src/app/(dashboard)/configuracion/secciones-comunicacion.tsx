'use client'
/**
 * Secciones de Comunicación de Configuración (extraídas del monolito configuracion/page.tsx
 * para reducir su tamaño y acoplamiento — hallazgo del panel de producto/ingeniería).
 * Sin cambios de comportamiento: es un MOVE puro.
 */
import { useState, useEffect, useRef } from 'react'
import { saveConfigPartial } from '@/lib/firestore'
import { subirImagen as subirImagenServidor } from '@/lib/subir-imagen'
import { fetchAutenticado } from '@/lib/auth-client'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { copyToClipboard } from '@/lib/whatsapp'
import { Loader2, Save, Copy, QrCode, CheckCircle2, AlertTriangle, UserRound, Trash2 } from 'lucide-react'

// ── Entregas de WhatsApp (Iter. 7 · DELIVERY_DASHBOARD) ───────────────────────

interface ResumenEntregasUI {
  total: number
  entregados: number
  leidos: number
  fallidos: number
  fallosPermanentes: number
  tasaEntrega: number
  tasaLectura: number
  porEstado: Record<string, number>
  fallosPorCodigo: { codigo: number; titulo?: string; cuenta: number }[]
}

export function EntregasWhatsAppTab({ clinicId }: { clinicId: string | null }) {
  const [dias, setDias] = useState(14)
  const [data, setData] = useState<ResumenEntregasUI | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    setLoading(true); setError(null)
    fetchAutenticado(`/api/whatsapp/entregas?clinicId=${clinicId}&dias=${dias}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || 'Error')
        if (vivo) setData(j.resumen as ResumenEntregasUI)
      })
      .catch(e => { if (vivo) setError(String(e.message || e)) })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [clinicId, dias])

  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p className="t-body" style={{ color: 'var(--text2)', margin: '0 0 4px' }}>
          Cuántos recordatorios y avisos de WhatsApp se entregaron, se leyeron o fallaron.
          Se puebla automáticamente con los reportes de entrega de WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <label className="t-caption" style={{ color: 'var(--text3)' }}>Periodo:</label>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDias(d)}
              className="btn" style={{
                padding: '4px 12px', fontSize: 13,
                background: dias === d ? 'var(--nexus-soft)' : 'transparent',
                color: dias === d ? 'var(--nexus)' : 'var(--text2)',
                border: `1px solid ${dias === d ? 'rgba(61,90,254,0.3)' : 'var(--border)'}`,
              }}>{d} días</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </div>
      )}
      {error && <div className="t-body" style={{ color: 'var(--danger)' }}>No se pudo cargar: {error}</div>}

      {data && !loading && data.total === 0 && (
        <div style={{ padding: 20, border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Aún no hay reportes de entrega en este periodo. Aparecerán aquí cuando se envíen
          recordatorios por WhatsApp.
        </div>
      )}

      {data && !loading && data.total > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <TarjetaMetrica etiqueta="Enviados" valor={data.total} />
            <TarjetaMetrica etiqueta="Entregados" valor={data.entregados} sub={pct(data.tasaEntrega)} color="var(--nexus)" />
            <TarjetaMetrica etiqueta="Leídos" valor={data.leidos} sub={pct(data.tasaLectura) + ' de entregados'} color="var(--success, #16a34a)" />
            <TarjetaMetrica etiqueta="Fallidos" valor={data.fallidos} sub={data.fallosPermanentes ? `${data.fallosPermanentes} permanentes` : undefined} color={data.fallidos ? 'var(--danger)' : 'var(--text2)'} />
          </div>

          {data.fallosPorCodigo.length > 0 && (
            <div>
              <h3 className="t-h3" style={{ margin: '4px 0 8px' }}>Motivos de fallo</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.fallosPorCodigo.map(f => (
                  <div key={f.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span className="t-body">{f.titulo || `Código ${f.codigo}`} <span style={{ color: 'var(--text3)' }}>({f.codigo})</span></span>
                    <strong>{f.cuenta}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TarjetaMetrica({ etiqueta, valor, sub, color }: { etiqueta: string; valor: number; sub?: string; color?: string }) {
  return (
    <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface, transparent)' }}>
      <div className="t-caption" style={{ color: 'var(--text3)', marginBottom: 4 }}>{etiqueta}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--text1)', lineHeight: 1 }}>{valor}</div>
      {sub && <div className="t-caption" style={{ color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Perfil público /dr: foto, biografía, cédula y precios (captación/SEO) ──────

export function PerfilPublicoSection({ clinicId }: { clinicId: string | null }) {
  const { config, loading: cargandoConfig } = useConfig()
  const { toast } = useToast()
  const [foto, setFoto] = useState('')
  const [bio, setBio] = useState('')
  const [cedula, setCedula] = useState('')
  const [precios, setPrecios] = useState<{ servicio: string; precio: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    // Hay que esperar a que la config REAL llegue. useConfig devuelve
    // DEFAULT_CONFIG desde el primer render, así que `config` ya es truthy antes
    // de que Firestore conteste: sin la guarda de `cargandoConfig`, initRef se
    // trababa con los valores por defecto (precios = []) y el snapshot real se
    // ignoraba para siempre. Al pulsar "Guardar perfil" se escribía esa lista
    // vacía y se BORRABAN los precios públicos del médico.
    if (cargandoConfig || initRef.current) return
    setFoto(config.fotoMedicoUrl ?? '')
    setBio(config.bioPublica ?? '')
    setCedula(config.cedulaProfesional ?? '')
    setPrecios(Array.isArray(config.preciosPublicos) ? config.preciosPublicos : [])
    initRef.current = true
  }, [config, cargandoConfig])

  const subirFoto = async (file: File | undefined) => {
    if (!file) return
    setSubiendo(true)
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file)
      })
      const url = await subirImagenServidor(dataUrl, 'foto-medico')
      setFoto(url || '')
    } catch {
      toast('No se pudo subir la foto', 'error')
    } finally {
      setSubiendo(false)
    }
  }

  const guardar = async () => {
    if (!clinicId) return
    setSaving(true)
    try {
      const limpios = precios
        .map(p => ({ servicio: p.servicio.trim(), precio: Number(p.precio) || 0 }))
        .filter(p => p.servicio && p.precio > 0)
      await saveConfigPartial(clinicId, {
        fotoMedicoUrl: foto || undefined,
        bioPublica: bio.trim() || undefined,
        cedulaProfesional: cedula.trim() || undefined,
        preciosPublicos: limpios,
      })
      toast('Perfil público actualizado', 'success')
    } catch {
      toast('No se pudo guardar el perfil', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Tu perfil público</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 4 }}>
          Lo que ven los pacientes en tu página <code>/dr</code> (y lo que Google indexa). Un perfil completo convierte mejor.
        </div>
      </div>

      {/* Foto */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {foto
          ? <img src={foto} alt="Foto del médico" width={72} height={72} style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover', border: '1px solid var(--border)' }} />
          : <div style={{ width: 72, height: 72, borderRadius: 14, background: 'var(--s3)', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}><UserRound size={26} /></div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            {subiendo ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserRound size={14} />} {foto ? 'Cambiar foto' : 'Subir foto'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => subirFoto(e.target.files?.[0])} />
          </label>
          {foto && <button className="btn btn-ghost btn-sm" onClick={() => setFoto('')} style={{ color: 'var(--text3)' }}>Quitar</button>}
        </div>
      </div>

      {/* Cédula + Bio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label className="t-caption" style={{ color: 'var(--text3)' }}>Cédula profesional</label>
        <input className="input" value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Ej. 1234567" style={{ maxWidth: 220 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label className="t-caption" style={{ color: 'var(--text3)' }}>Biografía / presentación</label>
        <textarea className="input" value={bio} onChange={e => setBio(e.target.value)} rows={4}
          placeholder="Experiencia, formación, enfoque de atención… (lo que le da confianza al paciente)" />
      </div>

      {/* Precios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="t-caption" style={{ color: 'var(--text3)' }}>Precios por servicio</label>
        {precios.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" value={p.servicio} placeholder="Servicio (ej. Consulta)" style={{ flex: 1 }}
              onChange={e => setPrecios(ps => ps.map((x, j) => j === i ? { ...x, servicio: e.target.value } : x))} />
            <input className="input" type="number" min={0} value={p.precio || ''} placeholder="$ MXN" style={{ width: 120 }}
              onChange={e => setPrecios(ps => ps.map((x, j) => j === i ? { ...x, precio: Number(e.target.value) } : x))} />
            <button className="btn btn-ghost btn-sm" onClick={() => setPrecios(ps => ps.filter((_, j) => j !== i))} title="Quitar"><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
          onClick={() => setPrecios(ps => [...ps, { servicio: '', precio: 0 }])}>+ Agregar precio</button>
      </div>

      <button className="btn btn-primary" onClick={guardar} disabled={saving || subiendo} style={{ alignSelf: 'flex-start' }}>
        {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={15} /> Guardar perfil</>}
      </button>
    </div>
  )
}

// ── Plantillas HSM: alta de recordatorios fuera de la ventana de 24 h ─────────

const HSM_PLANTILLAS = [
  {
    clave: 'recordatorio24h',
    titulo: 'Recordatorio 24 horas antes',
    nombreSugerido: 'recordatorio_cita_24h',
    vars: '{{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora · {{5}} clínica',
    texto: 'Hola {{1}} 👋 Le recordamos su cita de mañana con {{2}}. 📅 {{3}} 🕐 {{4}} 📍 {{5}}. Responda SÍ para confirmar o NO para cancelar. Responda BAJA para dejar de recibir estos mensajes.',
  },
  {
    clave: 'recordatorioMismoDia',
    titulo: 'Recordatorio el mismo día',
    nombreSugerido: 'recordatorio_cita_dia',
    vars: '{{1}} paciente · {{2}} médico · {{3}} hora · {{4}} clínica',
    texto: 'Buenos días {{1}} ☀️ Hoy tiene su cita con {{2}} a las {{3}} en {{4}}. Le esperamos. Responda BAJA para dejar de recibir estos mensajes.',
  },
  {
    clave: 'listaEspera',
    titulo: 'Aviso de lugar disponible (lista de espera)',
    nombreSugerido: 'lista_espera_espacio',
    vars: '{{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora',
    texto: 'Hola {{1}}, se liberó un espacio con {{2}} el {{3}} a las {{4}}. ¿Le interesa? Responda SÍ para tomarlo o NO para quitarse de la lista.',
  },
] as const

interface HsmConfig {
  plantillas: Record<string, { name?: string; lang?: string }>
  silencio: { activo?: boolean; inicio?: string; fin?: string }
  topeDiarioProactivo: number
}

export function PlantillasHsmSection({ clinicId }: { clinicId: string | null }) {
  const { toast } = useToast()
  const [cfg, setCfg] = useState<HsmConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    setLoading(true)
    fetchAutenticado(`/api/whatsapp/plantillas-config?clinicId=${clinicId}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || 'Error')
        if (vivo) setCfg({
          plantillas: j.plantillas || {},
          silencio: j.silencio || { activo: true, inicio: '21:00', fin: '08:00' },
          topeDiarioProactivo: j.topeDiarioProactivo ?? 3,
        })
      })
      .catch(() => { if (vivo) toast('No se pudo cargar la configuración de plantillas', 'error') })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [clinicId, toast])

  const copiar = async (texto: string, id: string) => {
    try {
      await copyToClipboard(texto)
      setCopiado(id); setTimeout(() => setCopiado(null), 1600)
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  const setNombre = (clave: string, name: string) =>
    setCfg(c => c && ({ ...c, plantillas: { ...c.plantillas, [clave]: { ...c.plantillas[clave], name } } }))
  const setLang = (clave: string, lang: string) =>
    setCfg(c => c && ({ ...c, plantillas: { ...c.plantillas, [clave]: { ...c.plantillas[clave], lang } } }))

  const guardar = async () => {
    if (!clinicId || !cfg) return
    setSaving(true)
    try {
      const r = await fetchAutenticado('/api/whatsapp/plantillas-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, plantillas: cfg.plantillas, silencio: cfg.silencio, topeDiarioProactivo: cfg.topeDiarioProactivo }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Error al guardar')
      toast('Configuración guardada. Los recordatorios fuera de la ventana ya usarán tus plantillas.', 'success')
    } catch (e) {
      toast(String((e as Error).message || e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const registradas = cfg ? HSM_PLANTILLAS.filter(p => (cfg.plantillas[p.clave]?.name || '').trim()).length : 0

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <QrCode size={18} style={{ color: 'var(--nexus)' }} />
          <h3 className="t-h3" style={{ margin: 0 }}>Recordatorios fuera de la ventana de 24 h (plantillas)</h3>
          <span style={{
            marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            background: registradas === 3 ? 'color-mix(in srgb, var(--green) 12%, transparent)' : 'var(--nexus-soft)',
            color: registradas === 3 ? '#16a34a' : 'var(--nexus)',
          }}>{registradas}/3 registradas</span>
        </div>
        <p className="t-body" style={{ color: 'var(--text2)', margin: '8px 0 0' }}>
          WhatsApp solo permite texto libre si el paciente escribió en las últimas 24 h. Para los demás casos
          hay que usar <strong>plantillas aprobadas por Meta</strong>. <strong>Paso 1:</strong> copia cada texto
          y créalas en tu WhatsApp Manager (categoría <em>Utility</em>, idioma es_MX). <strong>Paso 2:</strong>
          cuando Meta las apruebe, escribe aquí el nombre exacto y guarda.
        </p>
      </div>

      {loading && (
        <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </div>
      )}

      {cfg && (
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {HSM_PLANTILLAS.map(p => {
            const configurada = (cfg.plantillas[p.clave]?.name || '').trim().length > 0
            return (
              <div key={p.clave} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
                  {configurada ? <CheckCircle2 size={15} style={{ color: 'var(--green)' }} /> : <AlertTriangle size={15} style={{ color: 'var(--text3)' }} />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.titulo}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => copiar(p.texto, p.clave)}
                    style={{ marginLeft: 'auto', color: copiado === p.clave ? 'var(--teal)' : 'var(--text3)' }}>
                    <Copy size={13} /> {copiado === p.clave ? 'Copiado' : 'Copiar texto'}
                  </button>
                </div>
                <pre style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text2)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontFamily: 'inherit' }}>{p.texto}</pre>
                <div style={{ padding: '4px 14px 10px', fontSize: 11.5, color: 'var(--text3)' }}>{p.vars}</div>
                <div style={{ padding: '10px 14px', background: 'var(--s1)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="t-caption" style={{ color: 'var(--text3)' }}>Nombre aprobado en Meta</label>
                    <input value={cfg.plantillas[p.clave]?.name || ''} onChange={e => setNombre(p.clave, e.target.value)}
                      placeholder={p.nombreSugerido} className="input"
                      style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
                  </div>
                  <div style={{ width: 110, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="t-caption" style={{ color: 'var(--text3)' }}>Idioma</label>
                    <input value={cfg.plantillas[p.clave]?.lang || 'es_MX'} onChange={e => setLang(p.clave, e.target.value)}
                      placeholder="es_MX" className="input" style={{ fontSize: 13 }} />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Opciones de envío */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Opciones de envío</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={cfg.silencio.activo !== false}
                onChange={e => setCfg(c => c && ({ ...c, silencio: { ...c.silencio, activo: e.target.checked } }))} />
              No enviar recordatorios en horas de silencio
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', opacity: cfg.silencio.activo !== false ? 1 : .5 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="t-caption" style={{ color: 'var(--text3)' }}>Desde</label>
                <input type="time" value={cfg.silencio.inicio || '21:00'} disabled={cfg.silencio.activo === false}
                  onChange={e => setCfg(c => c && ({ ...c, silencio: { ...c.silencio, inicio: e.target.value } }))} className="input" style={{ fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="t-caption" style={{ color: 'var(--text3)' }}>Hasta</label>
                <input type="time" value={cfg.silencio.fin || '08:00'} disabled={cfg.silencio.activo === false}
                  onChange={e => setCfg(c => c && ({ ...c, silencio: { ...c.silencio, fin: e.target.value } }))} className="input" style={{ fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="t-caption" style={{ color: 'var(--text3)' }}>Máx. mensajes/día por paciente</label>
                <input type="number" min={1} max={20} value={cfg.topeDiarioProactivo}
                  onChange={e => setCfg(c => c && ({ ...c, topeDiarioProactivo: Number(e.target.value) }))} className="input" style={{ width: 90, fontSize: 13 }} />
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={guardar} disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={15} /> Guardar configuración</>}
          </button>
        </div>
      )}
    </div>
  )
}
