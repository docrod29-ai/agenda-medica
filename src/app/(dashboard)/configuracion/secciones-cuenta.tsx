'use client'
/**
 * Secciones de configuración de CUENTA / IMPRESIÓN (extraídas del monolito).
 * - LlavesIASection: API keys de IA por consultorio (nunca se leen de vuelta).
 * - FirmaUploadSection: firma digital por médico.
 * - MembreteNotaSection: hoja membretada de notas por médico.
 * - MiembrosActivos: gestión de miembros del equipo.
 * Sin cambio de comportamiento respecto al monolito original.
 */
import { guardarFirma, migrarFirmaSiHaceFalta } from '@/lib/firma-protegida'
import { useState, useEffect } from 'react'
import type { ClinicConfig, Doctor as DoctorT } from '@/types'
import { getDoctors, saveConfigPartial } from '@/lib/firestore'
import { subirImagen as subirImagenServidor } from '@/lib/subir-imagen'
import { resizeImageFile, formatBytes, reducirDataUrlSiPesa } from '@/lib/image-utils'
import { fetchAutenticado } from '@/lib/auth-client'
import { listarMiembros, removerMiembro, cambiarRolMiembro, type MiembroActivo } from '@/lib/miembros'
import { type RolInvitacion } from '@/lib/invitations'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import { Loader2, Upload, X as IconX, KeyRound, PenLine, FileText, Lightbulb } from 'lucide-react'

type EstadoLlave = { configurada: boolean; hint: string }
interface EstadoIA {
  claves: { anthropic: EstadoLlave; assemblyai: EstadoLlave; openai: EstadoLlave }
  uso: { total: number; prueba: number; limitePrueba: number }
  creditos?: { usados: number; extra: number; limite: number }
  /** Cuál llave se llama DE VERDAD para cada proveedor. La calcula el servidor. */
  fuenteEfectiva?: Record<string, 'clinica' | 'fundador' | 'prueba' | 'ninguna'>
}

/**
 * El estado de una llave, dicho por lo que PASA y no por lo que hay guardado.
 *
 * Antes había dos etiquetas: «configurada ····1234» y «modo prueba». Ninguna
 * decía cuál se estaba usando, y el 31-jul-2026 esa ambigüedad costó una tarde
 * entera: la de Vercel estaba rotada y al día, la del consultorio estaba muerta
 * y le ganaba, y desde esta pantalla no había forma de verlo.
 *
 * Para el dueño «modo prueba» era además FALSO: corre sobre la llave de la
 * plataforma y sin tope, que no es una prueba.
 */
function etiquetaLlave(fuente: string | undefined, hint: string): { texto: string; color: string } {
  switch (fuente) {
    case 'clinica':  return { texto: `● tu llave ${hint} — en uso`, color: '#10b981' }
    case 'fundador': return { texto: '● llave de la plataforma — sin tope (dueño)', color: '#10b981' }
    case 'prueba':   return { texto: '○ llave de la plataforma — prueba con tope', color: 'var(--text3)' }
    case 'ninguna':  return { texto: '⚠ sin llave: la IA no puede funcionar', color: 'var(--red)' }
    // Servidor viejo o respuesta a medias: NO se inventa un estado. Se dice que
    // no se sabe, que es distinto de decir «prueba» y equivocarse.
    default:         return { texto: hint ? `● configurada ${hint}` : '○ sin llave propia', color: 'var(--text3)' }
  }
}
/**
 * SÓLO EL LLM ADMITE LLAVE PROPIA — decisión del Dr. (3-ago-2026).
 *
 * AssemblyAI y OpenAI se quitaron de aquí: **la transcripción es de la
 * plataforma, para todos**. Oír bien no es un extra que cada consultorio se
 * costea, es la promesa central del producto.
 *
 * Y ofrecerlas aquí no era neutral: la llave del consultorio GANABA a la de la
 * plataforma, así que un médico que pegara una vencida recibía peor
 * transcripción que uno que no pusiera ninguna — en silencio. Se quitó la
 * opción, no sólo el aviso.
 */
const PROVEEDORES_IA = [
  { id: 'anthropic', nombre: 'Claude (ordenar la nota)', url: 'https://console.anthropic.com', placeholder: 'sk-ant-...' },
] as const

/**
 * Llaves de IA del consultorio. Cada doctor pone SUS propias llaves (paga su
 * uso); si no, usa la del dueño en modo prueba con tope. Las llaves nunca se
 * leen de vuelta — solo estado enmascarado.
 */
export function LlavesIASection({ clinicId }: { clinicId: string }) {
  const { toast } = useToast()
  const [estado, setEstado] = useState<EstadoIA | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({ anthropic: '', assemblyai: '', openai: '' })
  const [guardando, setGuardando] = useState('')

  useEffect(() => {
    let activo = true
    fetchAutenticado(`/api/clinic/ai-keys?clinicId=${encodeURIComponent(clinicId)}`)
      .then(r => r.ok ? r.json().catch(() => null) : null)
      .then(d => { if (activo && d?.ok) setEstado(d) })
      .catch(() => {})
    return () => { activo = false }
  }, [clinicId])

  const guardar = async (proveedor: string, override?: string) => {
    const key = override !== undefined ? override : (inputs[proveedor] ?? '')
    setGuardando(proveedor)
    try {
      const r = await fetchAutenticado('/api/clinic/ai-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, proveedor, key }),
      })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.ok) {
        setEstado(d)
        setInputs(p => ({ ...p, [proveedor]: '' }))
        toast('Llave guardada', 'success')
      } else {
        toast(d?.error ?? 'No se pudo guardar la llave', 'error')
      }
    } catch {
      toast('Error de red al guardar la llave', 'error')
    } finally {
      setGuardando('')
    }
  }

  const u = estado?.uso
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(61,90,254,0.06), rgba(61,90,254,0.02))', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <KeyRound size={18} style={{ color: 'var(--nexus)' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Llaves de IA (tu propio saldo)</div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, margin: '0 0 14px' }}>
        Pon tus propias llaves para que la transcripción y el ordenado con IA corran con <strong>tu saldo</strong> (no compartido). Si no pones ninguna, usas una <strong>prueba gratis</strong> limitada. La llave se guarda cifrada del lado servidor — nunca se muestra completa.
      </p>

      {/* MEDIDOR DE CRÉDITOS del mes (L1 auditoría maestra): antes el médico gastaba
          a ciegas. Barra usados/límite + recarga cuando queda poco. */}
      {estado?.creditos && estado.creditos.limite > 0 && (() => {
        const c = estado.creditos!
        const tope = c.limite + c.extra
        const pct = Math.min(100, Math.round((c.usados / tope) * 100))
        const casiVacio = pct >= 85
        const color = pct >= 100 ? 'var(--red)' : casiVacio ? 'var(--amber)' : 'var(--nexus)'
        return (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Créditos de IA este mes</span>
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}><strong style={{ color }}>{c.usados}</strong> / {tope}{c.extra > 0 && <span style={{ color: 'var(--text3)' }}> (incl. {c.extra} recarga)</span>}</span>
            </div>
            <div style={{ height: 7, borderRadius: 'var(--r-pill)', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
            </div>
            {pct >= 100
              ? <div style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 700, marginTop: 6 }}>Créditos agotados — las acciones de IA se pausan. Recarga o pon tu propia llave abajo.</div>
              : casiVacio
                ? <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 6 }}>Te queda poco crédito ({tope - c.usados}). Valora recargar.</div>
                : null}
          </div>
        )
      })()}

      {u && (
        <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
          Acciones de IA este mes: <strong>{u.total}</strong> · Prueba gratis: <strong>{u.prueba}/{u.limitePrueba}</strong>
          {u.prueba >= u.limitePrueba && <span style={{ color: 'var(--amber)', fontWeight: 700 }}> · prueba agotada, pon tu llave</span>}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {PROVEEDORES_IA.map(p => {
          const st = estado?.claves?.[p.id as keyof EstadoIA['claves']]
          return (
            <div key={p.id} style={{ display: 'grid', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{p.nombre}</span>
                {(() => {
                  const e = etiquetaLlave(estado?.fuenteEfectiva?.[p.id], st?.hint ?? '')
                  return <span style={{ fontSize: 11, fontWeight: e.color === '#10b981' ? 700 : 400, color: e.color }}>{e.texto}</span>
                })()}
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--nexus)', marginLeft: 'auto' }}>obtener llave ↗</a>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password" autoComplete="off"
                  value={inputs[p.id] ?? ''}
                  onChange={e => setInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={st?.configurada ? 'Pega una nueva para reemplazar' : p.placeholder}
                  style={{ flex: 1, padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                />
                <button
                  className="btn btn-sm btn-primary"
                  disabled={guardando === p.id || !(inputs[p.id] ?? '').trim()}
                  onClick={() => guardar(p.id)}
                >
                  {guardando === p.id ? '…' : 'Guardar'}
                </button>
                {st?.configurada && (
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={guardando === p.id}
                    onClick={() => guardar(p.id, '')}
                    title="Quitar la llave (volver a modo prueba)"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FirmaUploadSection({ form, clinicId, onLocalChange }: {
  form: ClinicConfig
  clinicId: string | null
  onLocalChange: (patch: Partial<ClinicConfig>) => void
}) {
  const { toast } = useToast()
  const [procesando, setProcesando] = useState(false)
  const [doctores, setDoctores] = useState<DoctorT[]>([])
  const [medicoSel, setMedicoSel] = useState('')

  useEffect(() => {
    if (!clinicId) return
    getDoctors(clinicId).then(ds => {
      setDoctores(ds)
      setMedicoSel(prev => {
        if (prev && ds.some(d => d.id === prev)) return prev
        const mio = ds.find(d => d.email && d.email === auth.currentUser?.email)
        return mio?.id ?? ds[0]?.id ?? ''
      })
    }).catch(() => {})
  }, [clinicId])

  // Firma EFECTIVA: la del médico seleccionado (si hay médicos) o la general.
  const firmaDataUrl = medicoSel ? form.firmaPorMedico?.[medicoSel] : form.firmaImagenDataUrl

  // Guarda la firma del médico (merge conserva las de los demás) o la general.
  /**
   * REG-014 — la firma se guarda en el SUBDOCUMENTO PROTEGIDO (`config/firma`),
   * que solo pueden leer los médicos. Ya NO se escribe en `config/main`, cuyo
   * `read` es `isMember`: ahí cualquier miembro del consultorio podía leerla con
   * el SDK y llevársela para estampar recetas.
   *
   * `onLocalChange` sigue actualizando el formulario en memoria para que la
   * vista previa reaccione al instante; lo que cambia es DÓNDE se persiste.
   */
  const persistir = (url: string | undefined) => {
    const medico = doctores.find(d => d.id === medicoSel)
    const patch = medicoSel
      ? { firmaPorMedico: { ...(form.firmaPorMedico ?? {}), [medicoSel]: url ?? '' } }
      : { firmaImagenDataUrl: url }
    onLocalChange(patch)
    if (!clinicId) return
    guardarFirma(clinicId, medicoSel
      ? { firmaPorMedico: { [medicoSel]: url ?? '' } }
      : { firmaImagenDataUrl: url ?? '' })
      .then(() => toast(
        url
          ? (medicoSel ? `Firma de ${medico?.nombre ?? 'médico'} guardada` : 'Firma guardada')
          : 'Firma eliminada',
        'success'))
      .catch((e) => toast(`No se pudo guardar: ${e instanceof Error ? e.message.slice(0, 80) : ''}`, 'error'))
  }

  /**
   * MIGRACIÓN AUTOMÁTICA. Mientras la firma siga en `config/main`, el agujero
   * está abierto aunque el código nuevo ya lea del subdocumento. Al abrir esta
   * sección (solo la abre un médico) se copia y se BORRA del general.
   * Es idempotente: si no hay nada que migrar, no escribe.
   */
  useEffect(() => {
    if (!clinicId) return
    migrarFirmaSiHaceFalta(clinicId, {
      firmaImagenDataUrl: form.firmaImagenDataUrl,
      firmaPorMedico: form.firmaPorMedico,
    }).catch(() => { /* si falla, el respaldo del lector mantiene la firma viva */ })
    // Solo al montar con clinicId: la migración es de una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])
  const onChange = (url: string | undefined) => persistir(url)

  const subir = async (file: File) => {
    const esPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!file.type.startsWith('image/') && !esPDF) {
      toast('Sube una imagen (PNG/JPG) o un PDF', 'error')
      return
    }
    setProcesando(true)
    try {
      // PDF → primera página a imagen; imagen → se redimensiona (PNG conserva transparencia).
      let dataUrl: string
      let sizeBytes: number
      if (esPDF) {
        const { pdfFileToImageDataUrl } = await import('@/lib/pdf-to-image')
        const r = await pdfFileToImageDataUrl(file, { dpi: 220, quality: 0.95, type: 'image/png', timeoutMs: 60_000 })
        /**
         * Y SE REDUCE ANTES DE SUBIR — esto es lo que faltaba.
         *
         * La hoja se rasterizaba a 220 DPI y se mandaba tal cual. Una carta a esa
         * resolución son ~1900×2400 px: varios MB en PNG, y el data URL infla
         * otro 33 % al ir en base64 dentro del JSON. La petición **moría antes de
         * llegar al servidor** por el tope de la función, sin ningún error que
         * explicara nada. El médico veía que «no se subía» y no había a qué
         * agarrarse.
         *
         * Una firma no necesita una hoja entera a 220 DPI: necesita la firma.
         */
        const red = await reducirDataUrlSiPesa(r.dataUrl, 2_500_000, 'image/png')
        dataUrl = red.dataUrl; sizeBytes = red.sizeBytes
      } else {
        const esPNG = file.type === 'image/png'
        const r = await resizeImageFile(file, {
          maxWidth: 1000, maxHeight: 600, quality: 0.9,
          type: esPNG ? 'image/png' : 'image/jpeg',
        })
        dataUrl = r.dataUrl; sizeBytes = r.sizeBytes
      }

      // Subir a Storage vía el SERVIDOR (Admin SDK) → doc de config chico, sin
      // depender de reglas/CORS del navegador. Si falla, avisamos con la causa real.
      let src: string
      try { src = (await subirImagenServidor(dataUrl, 'firma')) ?? dataUrl }
      catch (err) { toast(`No se pudo subir la firma: ${(err as Error).message}`, 'error'); return }
      onChange(src)
      toast(`Firma cargada (${formatBytes(sizeBytes)}) · alta resolución`, 'success')
    } catch (e) {
      toast(`No se pudo procesar: ${(e as Error).message}`, 'error')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20,184,166,0.06), rgba(20,184,166,0.02))',
      border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <PenLine size={18} style={{ color: 'var(--teal)' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Firma + sello (imagen)</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
            Cada médico sube la SUYA. Aparece sobre la línea de firma en <strong>sus</strong> notas, recetas y órdenes.
          </div>
        </div>
      </div>

      {doctores.length > 0 && (() => {
        const soyDoctor = doctores.find(d => d.email && d.email === auth.currentUser?.email)
        const medicoUnico = soyDoctor ?? (doctores.length === 1 ? doctores[0] : undefined)
        return (
          <div style={{ marginBottom: 10 }}>
            {medicoUnico ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Tu firma · {medicoUnico.nombre}</div>
            ) : (<>
              <label style={{ fontSize: 11.5, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Firma de:</label>
              <select aria-label="Médico al que aplica" value={medicoSel} onChange={(e) => setMedicoSel(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }}>
                {doctores.map(d => <option key={d.id} value={d.id}>{d.nombre}{form.firmaPorMedico?.[d.id] ? ' · tiene la suya' : ''}</option>)}
              </select>
            </>)}
          </div>
        )
      })()}

      {firmaDataUrl ? (
        <div style={{ position: 'relative', background: '#fff', borderRadius: 8, padding: 14, border: '1px solid var(--border)', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firmaDataUrl}
            alt="Firma del médico"
            style={{ maxWidth: '100%', maxHeight: 120, display: 'block', margin: '0 auto' }}
          />
          <button
            onClick={() => onChange(undefined)}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'color-mix(in srgb, var(--red) 90%, transparent)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <IconX size={11} /> Quitar
          </button>
        </div>
      ) : (
        <label style={{
          display: 'block', textAlign: 'center', padding: '20px 14px',
          border: '2px dashed rgba(20,184,166,0.4)', borderRadius: 10,
          background: 'rgba(20,184,166,0.04)', cursor: procesando ? 'wait' : 'pointer',
          color: 'var(--text2)',
        }}>
          {procesando ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} />
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Procesando…</div>
            </>
          ) : (
            <>
              <Upload size={20} style={{ marginBottom: 6, color: 'var(--teal)' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Sube tu firma + sello</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                PNG (recomendado, fondo transparente), JPG o PDF · alta resolución
              </div>
            </>
          )}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            disabled={procesando}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f) }}
            style={{ display: 'none' }}
          />
        </label>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8, padding: '6px 10px', background: 'rgba(255,200,0,0.05)', borderLeft: '2px solid #f59e0b', borderRadius: 3, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Lightbulb size={12} className="ds-icon" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Tip: Escanea tu firma en una hoja blanca con tu sello al lado, recórtalo en blanco y súbelo como PNG con fondo transparente. Mide unos 6 × 3 cm en la vida real.</span>
      </div>
    </div>
  )
}

/* ── Hoja membretada para NOTAS (sube tu papel; la nota se imprime encima) ── */
export function MembreteNotaSection({ form, clinicId, onLocalChange }: {
  form: ClinicConfig
  clinicId: string | null
  onLocalChange: (patch: Partial<ClinicConfig>) => void
}) {
  const { toast } = useToast()
  const [procesando, setProcesando] = useState(false)
  const [doctores, setDoctores] = useState<DoctorT[]>([])
  const [medicoSel, setMedicoSel] = useState('')  // id del médico; cada quien la suya
  const CW = 216, CH = 279  // hoja carta en mm

  useEffect(() => {
    if (!clinicId) return
    getDoctors(clinicId).then(ds => {
      setDoctores(ds)
      // Default: el médico de la cuenta logueada; si no, el primero.
      setMedicoSel(prev => {
        if (prev && ds.some(d => d.id === prev)) return prev
        const mio = ds.find(d => d.email && d.email === auth.currentUser?.email)
        return mio?.id ?? ds[0]?.id ?? ''
      })
    }).catch(() => {})
  }, [clinicId])

  // Valor efectivo según la selección (hoja general del consultorio o la del médico).
  const perMed = medicoSel ? form.notaMembretePorMedico?.[medicoSel] : undefined
  const membreteUrl = medicoSel ? perMed?.url : form.notaMembreteDataUrl
  const m = (medicoSel ? perMed?.margenes : form.notaMembreteMargenes) ?? { top: 42, right: 22, bottom: 28, left: 22 }

  // Guarda en local + Firestore. Por médico: escribe SOLO la entrada de ESE médico
  // (Firestore `merge` conserva las de los demás) → nunca se cruza ni se pierde
  // info entre médicos, aunque `form` esté desincronizado. La general va aparte.
  const persistir = (url: string | undefined, margenes: { top: number; right: number; bottom: number; left: number }) => {
    const medico = doctores.find(d => d.id === medicoSel)
    if (medicoSel) {
      const entry = { url: url ?? '', margenes }
      onLocalChange({ notaMembretePorMedico: { ...(form.notaMembretePorMedico ?? {}), [medicoSel]: entry } })
      if (clinicId) saveConfigPartial(clinicId, { notaMembretePorMedico: { [medicoSel]: entry } })
        .then(() => toast(url ? `Hoja de ${medico?.nombre ?? 'médico'} guardada` : 'Hoja del médico eliminada', 'success'))
        .catch((e) => toast(`No se pudo guardar: ${e instanceof Error ? e.message.slice(0, 80) : ''}`, 'error'))
    } else {
      onLocalChange({ notaMembreteDataUrl: url, notaMembreteMargenes: margenes })
      if (clinicId) saveConfigPartial(clinicId, { notaMembreteDataUrl: url ?? '', notaMembreteMargenes: margenes })
        .then(() => toast(url ? 'Hoja GENERAL del consultorio guardada' : 'Hoja general eliminada', 'success'))
        .catch((e) => toast(`No se pudo guardar: ${e instanceof Error ? e.message.slice(0, 80) : ''}`, 'error'))
    }
  }

  const subir = async (file: File) => {
    const esPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!file.type.startsWith('image/') && !esPDF) { toast('Sube una imagen (PNG/JPG) o un PDF', 'error'); return }
    setProcesando(true)
    try {
      let dataUrl: string; let sizeBytes: number
      if (esPDF) {
        // Auditoría papelería 2026-07 (P2): 300 DPI de imprenta (antes 200). Como
        // la hoja SIEMPRE va a Storage (abajo), el peso ya no es problema.
        const { pdfFileToImageDataUrl } = await import('@/lib/pdf-to-image')
        const r0 = await pdfFileToImageDataUrl(file, { dpi: 300, quality: 0.92, type: 'image/jpeg', timeoutMs: 60_000 })
        // Mismo tope que la firma: lo que no cabe en el cuerpo de la petición no
        // llega, por muy bien que esté configurado Storage.
        const rr = await reducirDataUrlSiPesa(r0.dataUrl, 2_500_000, 'image/jpeg')
        const r = { ...r0, dataUrl: rr.dataUrl, sizeBytes: rr.sizeBytes }
        dataUrl = r.dataUrl; sizeBytes = r.sizeBytes
      } else {
        // Auditoría papelería 2026-07 (P2): resolución de imprenta ~300 DPI a carta
        // (2550×3300) en vez de ~146 DPI (1240×1650). El logo y la tipografía del
        // membrete se imprimen nítidos. Igual criterio que el diseño de receta.
        const esPNG = file.type === 'image/png'
        const r = await resizeImageFile(file, { maxWidth: 2550, maxHeight: 3300, quality: 0.95, type: esPNG ? 'image/png' : 'image/jpeg' })
        dataUrl = r.dataUrl; sizeBytes = r.sizeBytes
      }
      // Subir SIEMPRE a Storage vía el servidor (Admin SDK) — la hoja es página
      // completa y no cabe como base64 en el doc de config.
      let src: string
      try { src = (await subirImagenServidor(dataUrl, 'nota-membrete')) ?? dataUrl }
      catch (e) { toast(`No se pudo subir la hoja: ${(e as Error).message}`, 'error'); return }
      persistir(src, m)
      toast(`Hoja membretada cargada (${formatBytes(sizeBytes)}) · alta resolución`, 'success')
    } catch (e) { toast(`No se pudo procesar: ${(e as Error).message}`, 'error') }
    finally { setProcesando(false) }
  }

  const setM = (k: 'top' | 'right' | 'bottom' | 'left', v: number) => persistir(membreteUrl, { ...m, [k]: Math.max(0, v) })

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.06), rgba(20,184,166,0.02))', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <FileText size={18} style={{ color: 'var(--teal)' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Hoja membretada para notas</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
            Sube tu <strong>papel membretado</strong> (con tu logo/encabezado y pie). Las <strong>notas</strong> se imprimen ENCIMA — tú solo llenas el contenido.
          </div>
        </div>
      </div>

      {/* Cada médico su propia hoja. Con TU cuenta o 1 médico: sin dropdown. */}
      {doctores.length > 0 && (() => {
        const soyDoctor = doctores.find(d => d.email && d.email === auth.currentUser?.email)
        const medicoUnico = soyDoctor ?? (doctores.length === 1 ? doctores[0] : undefined)
        return (
          <div style={{ marginBottom: 10 }}>
            {medicoUnico ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Tu hoja membretada · {medicoUnico.nombre}</div>
            ) : (<>
              <label style={{ fontSize: 11.5, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Hoja de:</label>
              <select aria-label="Médico al que aplica" value={medicoSel} onChange={(e) => setMedicoSel(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }}>
                {doctores.map(d => <option key={d.id} value={d.id}>{d.nombre}{form.notaMembretePorMedico?.[d.id]?.url ? ' · tiene la suya' : ''}</option>)}
              </select>
            </>)}
          </div>
        )
      })()}

      {!membreteUrl ? (
        <label style={{ display: 'block', textAlign: 'center', padding: '20px 14px', border: '2px dashed rgba(20,184,166,0.4)', borderRadius: 10, background: 'rgba(20,184,166,0.04)', cursor: procesando ? 'wait' : 'pointer', color: 'var(--text2)' }}>
          {procesando ? (
            <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} /><div style={{ fontSize: 12.5, fontWeight: 600 }}>Procesando…</div></>
          ) : (
            <><Upload size={20} style={{ marginBottom: 6, color: 'var(--teal)' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Sube tu hoja membretada</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Hoja carta completa · PDF, PNG o JPG · alta resolución</div></>
          )}
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={procesando} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f) }} style={{ display: 'none' }} />
        </label>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14, alignItems: 'start' }}>
          {/* Vista previa con la ZONA de contenido marcada */}
          <div style={{ position: 'relative', width: 160, aspectRatio: `${CW} / ${CH}`, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={membreteUrl} alt="Hoja membretada" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
            <div style={{ position: 'absolute', top: `${m.top / CH * 100}%`, bottom: `${m.bottom / CH * 100}%`, left: `${m.left / CW * 100}%`, right: `${m.right / CW * 100}%`, border: '1.5px dashed #14b8a6', background: 'rgba(20,184,166,0.10)' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Zona de la nota (mm)</div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 8 }}>Ajusta para que el texto NO tape tu encabezado ni tu pie (el recuadro verde es donde cae la nota).</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {([['top', 'Arriba'], ['bottom', 'Abajo'], ['left', 'Izquierda'], ['right', 'Derecha']] as const).map(([k, lbl]) => (
                <label key={k} style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                  {lbl}
                  <input type="number" min={0} max={120} value={m[k]} onChange={(e) => setM(k, Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13, marginTop: 3 }} />
                </label>
              ))}
            </div>
            <button onClick={() => persistir(undefined, m)} style={{ marginTop: 10, background: 'color-mix(in srgb, var(--red) 90%, transparent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconX size={12} /> Quitar hoja membretada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Miembros activos del equipo ─────────────────────────────── */


export function MiembrosActivos({ clinicId, miUid }: { clinicId: string | null; miUid?: string }) {
  const { toast, confirm } = useToast()
  const [miembros, setMiembros] = useState<MiembroActivo[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = async () => {
    if (!clinicId) return
    setCargando(true)
    try {
      const list = await listarMiembros(clinicId)
      setMiembros(list)
    } catch (e) {
      console.error('[miembros]', e)
    } finally { setCargando(false) }
  }
  useEffect(() => { recargar() /* eslint-disable-next-line */ }, [clinicId])

  const soloUnAdmin = () => miembros.filter(x => x.role === 'admin').length <= 1

  const remover = async (m: MiembroActivo) => {
    if (m.uid === miUid) { toast('No puedes removerte a ti misma/o', 'error'); return }
    if (m.role === 'admin' && soloUnAdmin()) { toast('No puedes dejar la clínica sin administrador. Nombra otro admin primero.', 'error'); return }
    if (!(await confirm(`¿Remover a ${m.email} del equipo? Perderá acceso inmediatamente.`, { peligro: true, confirmar: 'Remover' }))) return
    try {
      await removerMiembro(m.uid)
      toast('Miembro removido', 'info')
      recargar()
    } catch {
      toast('Error al remover (revisa que seas admin)', 'error')
    }
  }

  const cambiarRol = async (m: MiembroActivo, nuevo: RolInvitacion) => {
    if (m.role === nuevo) return
    if (m.role === 'admin' && nuevo !== 'admin' && soloUnAdmin()) { toast('No puedes degradar al único administrador. Nombra otro admin primero.', 'error'); return }
    try {
      await cambiarRolMiembro(m.uid, nuevo)
      toast(`Rol actualizado a ${nuevo}`, 'success')
      recargar()
    } catch {
      toast('Error al cambiar rol', 'error')
    }
  }

  const ROL_LABEL: Record<string, string> = { admin: 'Admin', medico: 'Médico', secretaria: 'Asistente', enfermeria: 'Enfermería', farmacia: 'Farmacia', laboratorio: 'Laboratorio' }
  const ROL_COLOR: Record<string, string> = { admin: '#f59e0b', medico: 'var(--nexus)', secretaria: '#a78bfa', enfermeria: '#0d9488', farmacia: '#db2777', laboratorio: '#7c3aed' }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Equipo activo {miembros.length > 0 && `(${miembros.length})`}
        </div>
        <button onClick={recargar} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11.5, cursor: 'pointer' }}>
          ↻ Actualizar
        </button>
      </div>
      {cargando ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: 8 }}>Cargando…</div>
      ) : miembros.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: 10 }}>
          Sin miembros aún. Genera tu primera invitación abajo.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {miembros.map(m => (
            <div key={m.uid} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', background: 'var(--s2)', borderRadius: 8,
              border: m.uid === miUid ? '1px solid rgba(20,184,166,0.4)' : '1px solid var(--border)',
            }}>
              {/* Avatar inicial */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: ROL_COLOR[m.role] ?? '#9ca3af', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, flexShrink: 0,
              }}>
                {(m.email ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                  {m.uid === miUid && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--teal)', fontWeight: 700 }}>(TÚ)</span>}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>
                  Miembro desde {m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </div>
              </div>
              {/* Selector de rol — deshabilitado si soy yo */}
              <select
                value={m.role}
                onChange={(e) => cambiarRol(m, e.target.value as RolInvitacion)}
                disabled={m.uid === miUid}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  background: 'var(--s)', color: ROL_COLOR[m.role] ?? 'var(--text)',
                  border: `1px solid ${ROL_COLOR[m.role] ?? 'var(--border)'}55`,
                  cursor: m.uid === miUid ? 'not-allowed' : 'pointer',
                  opacity: m.uid === miUid ? 0.6 : 1,
                }}
              >
                <option value="admin">{ROL_LABEL.admin}</option>
                <option value="medico">{ROL_LABEL.medico}</option>
                <option value="secretaria">{ROL_LABEL.secretaria}</option>
                <option value="enfermeria">{ROL_LABEL.enfermeria}</option>
                <option value="farmacia">{ROL_LABEL.farmacia}</option>
                <option value="laboratorio">{ROL_LABEL.laboratorio}</option>
              </select>
              {m.uid !== miUid && (
                <button
                  onClick={() => remover(m)}
                  title="Quitar del equipo"
                  style={{
                    background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)',
                    border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: 6,
                    padding: '5px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

