'use client'
/**
 * SUBIR UN ESTUDIO DESDE EL PORTAL — D-058.
 *
 * El paciente elige PDF o fotos; se validan AQUÍ (tipo, tamaño, cantidad) con
 * el mismo módulo que usa el servidor, para que el «no» llegue antes de mover
 * un byte. Luego: credencial → subida directa a Storage (resumible, con
 * progreso) → registro en el servidor, que es quien abre la tarea al médico.
 *
 * Lo que el paciente ve después es la verdad y nada más: «tu médico lo tiene
 * pendiente de revisar» hasta que lo revise. Subir no es que lo hayan visto.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { ref, uploadBytesResumable } from 'firebase/storage'
import { Upload, FileText, Image as ImageIcon, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import {
  rechazoDelEnvio, TEXTO_RECHAZO, TIPOS_ACEPTADOS, MAX_ARCHIVOS_POR_ENVIO, MAX_ARCHIVOS_POR_MES,
  type ArchivoCandidato,
} from '@/lib/portal/estudios-aportados'
import { storageDelPaciente, cerrarSesionDelPaciente } from '@/lib/firebase-portal'
import { fechaCorta } from '@/lib/formato/fecha'

interface EstudioEnPantalla { id: string; nombre: string; contentType: string; bytes: number; subidoEn: string; estado: 'sin_revisar' | 'revisado'; texto: string }

const ACCEPT = Object.keys(TIPOS_ACEPTADOS).join(',')

function mb(bytes: number): string { return `${(bytes / 1_048_576).toFixed(bytes > 10_485_760 ? 0 : 1)} MB` }

export function SubirEstudio({ api, token }: { api: string; token: string }) {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [elegidos, setElegidos] = useState<File[]>([])
  const [aviso, setAviso] = useState('')
  const [progreso, setProgreso] = useState<Record<string, number>>({})
  const [subiendo, setSubiendo] = useState(false)
  const [listo, setListo] = useState('')
  const [estudios, setEstudios] = useState<EstudioEnPantalla[] | null>(null)
  const [errorLista, setErrorLista] = useState('')

  const cargar = async () => {
    try {
      const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'estudios', token }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setErrorLista(data.error || 'No pudimos cargar tus estudios.'); return }
      setEstudios(data.estudios ?? []); setErrorLista('')
    } catch { setErrorLista('Sin conexión: no pudimos cargar tus estudios.') }
  }
  // La lectura arranca fuera del efecto (siguiente tick): la regla de hooks no quiere setState directo dentro.
  useEffect(() => { const t = setTimeout(() => { void cargar() }, 0); return () => clearTimeout(t) }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (files: FileList | null) => {
    setAviso(''); setListo('')
    const lista = files ? [...files] : []
    const candidatos: ArchivoCandidato[] = lista.map(f => ({ nombre: f.name, contentType: f.type.toLowerCase(), bytes: f.size }))
    const subidosEsteMes = (estudios ?? []).filter(e => e.subidoEn.slice(0, 7) === new Date().toISOString().slice(0, 7)).length
    const rechazo = rechazoDelEnvio(candidatos, subidosEsteMes)
    if (rechazo) { setAviso(TEXTO_RECHAZO[rechazo]); setElegidos([]); if (fileRef.current) fileRef.current.value = ''; return }
    setElegidos(lista)
  }

  const subir = async () => {
    if (!elegidos.length || subiendo) return
    setSubiendo(true); setAviso(''); setListo('')
    try {
      const archivos = elegidos.map(f => ({ nombre: f.name, contentType: f.type.toLowerCase(), bytes: f.size }))
      const rc = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'credencial-estudio', token, archivos }) })
      const cred = await rc.json().catch(() => ({}))
      if (!rc.ok || !cred.ok) { setAviso(cred.error || 'No se pudo preparar la subida. Inténtalo de nuevo.'); return }
      const storage = await storageDelPaciente(cred.token)
      let registrados = 0
      for (let i = 0; i < elegidos.length; i++) {
        const f = elegidos[i]; const destino = cred.rutas[i]
        await new Promise<void>((resolve, reject) => {
          const tarea = uploadBytesResumable(ref(storage, destino.ruta), f, { contentType: f.type.toLowerCase() })
          tarea.on('state_changed',
            s => setProgreso(p => ({ ...p, [f.name]: Math.round((s.bytesTransferred / s.totalBytes) * 100) })),
            reject, () => resolve())
        })
        const rr = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'registrar-estudio', token, ruta: destino.ruta, nombre: f.name }) })
        const reg = await rr.json().catch(() => ({}))
        if (!rr.ok || !reg.ok) { setAviso(reg.error || `No se pudo registrar ${f.name}. Tu médico no lo verá hasta que se registre: inténtalo de nuevo.`); break }
        registrados++
      }
      if (registrados === elegidos.length) {
        setListo(registrados === 1 ? 'Tu estudio ya está en tu expediente. Tu médico lo tiene pendiente de revisar.' : `Tus ${registrados} estudios ya están en tu expediente. Tu médico los tiene pendientes de revisar.`)
        setElegidos([]); setProgreso({}); if (fileRef.current) fileRef.current.value = ''
      }
      await cargar()
    } catch (e) {
      setAviso(e instanceof Error && /storage\/unauthorized|permission/i.test(e.message)
        ? 'El archivo no pasó la validación del servidor (tipo o tamaño). Prueba con un PDF o una foto de menos de 20 MB.'
        : 'No se pudo subir. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSubiendo(false)
      void cerrarSesionDelPaciente()
    }
  }

  return (
    <section aria-labelledby={`${inputId}-t`} style={{ marginTop: 28, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <h2 id={`${inputId}-t`} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Upload size={16} aria-hidden="true" /> Subir un estudio
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
        El PDF que te dio el laboratorio o una foto clara del resultado. Hasta {MAX_ARCHIVOS_POR_ENVIO} archivos de 20 MB por envío ({MAX_ARCHIVOS_POR_MES} al mes).
        Tu médico lo revisa; subirlo no sustituye la consulta.
      </p>
      <label htmlFor={inputId} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: subiendo ? 'default' : 'pointer' }}>
        <FileText size={14} aria-hidden="true" /> Elegir PDF o fotos
      </label>
      <input id={inputId} ref={fileRef} type="file" accept={ACCEPT} multiple disabled={subiendo} onChange={e => elegir(e.target.files)} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
      {aviso && (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--red-texto)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /> {aviso}
        </p>
      )}
      {elegidos.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {elegidos.map(f => (
            <li key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)' }}>
              {f.type === 'application/pdf' ? <FileText size={14} aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>{progreso[f.name] != null ? `${progreso[f.name]} %` : mb(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
      {elegidos.length > 0 && (
        <button type="button" onClick={subir} disabled={subiendo} aria-busy={subiendo} className="btn btn-primary btn-sm" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {subiendo ? <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} aria-hidden="true" />}
          {subiendo ? 'Subiendo…' : `Enviar a mi médico${elegidos.length > 1 ? ` (${elegidos.length})` : ''}`}
        </button>
      )}
      {listo && <p role="status" style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--green)', display: 'flex', gap: 6 }}><CheckCircle2 size={15} aria-hidden="true" /> {listo}</p>}

      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '18px 0 6px' }}>Tus estudios</h3>
      {errorLista && <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>{errorLista} <b>Esto no quiere decir que no tengas.</b></p>}
      {!errorLista && estudios === null && <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>Cargando…</p>}
      {!errorLista && estudios && estudios.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>Todavía no has subido ninguno.</p>}
      {!errorLista && estudios && estudios.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {estudios.map(e => (
            <li key={e.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 14, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              {e.contentType === 'application/pdf' ? <FileText size={14} aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}
              <span style={{ flex: '1 1 160px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{e.nombre}</span>
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>{fechaCorta(e.subidoEn)} · {mb(e.bytes)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: e.estado === 'revisado' ? 'var(--green)' : 'var(--amber)' }}>{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
