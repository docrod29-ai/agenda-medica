'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import {
  enviarMensaje, suscribirMensajes, marcarComoLeido, suscribirLectura,
  type ChatMessage,
} from '@/lib/chat'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Send, Loader2, MessageCircle, Stethoscope, UserSquare2, Edit2, Check, X } from 'lucide-react'

const ROL_LABEL: Record<string, string> = {
  admin: 'Médico', medico: 'Médico', secretaria: 'Asistente',
}
const ROL_COLOR: Record<string, string> = {
  admin: 'var(--teal)', medico: 'var(--teal)', secretaria: '#a78bfa',
}

export default function ChatPage() {
  const { user } = useAuth()
  const { clinicId, role } = useClinic()
  const { config } = useConfig()
  const [mensajes, setMensajes] = useState<ChatMessage[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  // Nombre visible: leído del member doc (chat) o calculado por defecto
  const [miDisplayName, setMiDisplayName] = useState<string>('')
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreTemp, setNombreTemp] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Calcular nombre por defecto: el médico usa config.nombreMedico, otros usan email-prefix
  const nombreDefault = useMemo(() => {
    if ((role === 'medico' || role === 'admin') && config?.nombreMedico) {
      return config.nombreMedico
    }
    return user?.displayName || user?.email?.split('@')[0] || 'Usuario'
  }, [role, config?.nombreMedico, user?.displayName, user?.email])

  // Cargar nombre custom del member doc
  useEffect(() => {
    if (!clinicId || !user?.uid) return
    getDoc(doc(db, 'clinics', clinicId, 'members', user.uid)).then(snap => {
      const customName = snap.data()?.displayName
      setMiDisplayName(customName || nombreDefault)
    })
  }, [clinicId, user?.uid, nombreDefault])

  const guardarNombre = async () => {
    const limpio = nombreTemp.trim()
    if (!limpio || !clinicId || !user?.uid) return
    await setDoc(doc(db, 'clinics', clinicId, 'members', user.uid),
      { displayName: limpio }, { merge: true })
    setMiDisplayName(limpio)
    setEditandoNombre(false)
  }

  // Suscripción en tiempo real
  useEffect(() => {
    if (!clinicId) return
    const unsub = suscribirMensajes(clinicId, setMensajes)
    return () => unsub()
  }, [clinicId])

  // Suscripción a "último leído"
  useEffect(() => {
    if (!clinicId || !user?.uid) return
    const unsub = suscribirLectura(clinicId, user.uid, setLastReadAt)
    return () => unsub()
  }, [clinicId, user?.uid])

  // Auto-scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mensajes.length])

  // Al ver el chat: marcar como leído (en cada mensaje nuevo si la pestaña está activa)
  useEffect(() => {
    if (!clinicId || !user?.uid || mensajes.length === 0) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    marcarComoLeido(clinicId, user.uid)
  }, [clinicId, user?.uid, mensajes.length])

  const enviar = async () => {
    if (!clinicId || !user || !texto.trim()) return
    setEnviando(true)
    try {
      // Usar el nombre custom (member.displayName) o el default según rol
      const nombre = miDisplayName || nombreDefault
      await enviarMensaje(clinicId, texto, {
        uid: user.uid,
        email: user.email ?? '',
        nombre,
        rol: role ?? 'medico',
      })
      setTexto('')
      inputRef.current?.focus()
    } catch (e) {
      console.error(e)
    } finally {
      setEnviando(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  // Agrupar mensajes por día
  const grupos = useMemo(() => {
    const out: { fecha: string; msgs: ChatMessage[] }[] = []
    for (const m of mensajes) {
      const fecha = new Date(m.createdAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      const ult = out[out.length - 1]
      if (ult && ult.fecha === fecha) ult.msgs.push(m)
      else out.push({ fecha, msgs: [m] })
    }
    return out
  }, [mensajes])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', maxHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--s1)', flexShrink: 0,
      }}>
        <MessageCircle size={18} color="var(--teal)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Chat de la clínica</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {mensajes.length} mensaje{mensajes.length !== 1 ? 's' : ''} · entre médico y asistente
          </div>
        </div>
        {/* Mi nombre visible — editable */}
        {editandoNombre ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              autoFocus value={nombreTemp}
              onChange={(e) => setNombreTemp(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre(); if (e.key === 'Escape') setEditandoNombre(false) }}
              maxLength={40}
              style={{ width: 160, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 12 }}
            />
            <button onClick={guardarNombre} title="Guardar" style={{ background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer' }}>
              <Check size={11} />
            </button>
            <button onClick={() => setEditandoNombre(false)} title="Cancelar" style={{ background: 'var(--s2)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', cursor: 'pointer' }}>
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNombreTemp(miDisplayName); setEditandoNombre(true) }}
            title="Cambiar mi nombre en el chat"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--s2)', border: '1px solid var(--border)',
              color: 'var(--text2)', borderRadius: 'var(--r-pill)', padding: '6px 12px',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: ROL_COLOR[role ?? 'medico'],
            }} />
            Tú: <strong style={{ color: 'var(--text)' }}>{miDisplayName || nombreDefault}</strong>
            <Edit2 size={10} />
          </button>
        )}
      </div>

      {/* Lista de mensajes */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '16px max(16px, env(safe-area-inset-left)) 16px max(16px, env(safe-area-inset-right))',
        background: 'var(--bg)',
      }}>
        {grupos.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
            <MessageCircle size={36} color="var(--text3)" style={{ opacity: 0.4, marginBottom: 12 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Aún no hay mensajes. Escribe el primero abajo.</p>
          </div>
        )}

        {grupos.map(g => (
          <div key={g.fecha}>
            <div style={{ textAlign: 'center', margin: '14px 0' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--s2)', padding: '3px 12px', borderRadius: 'var(--r-pill)', textTransform: 'capitalize' }}>
                {g.fecha}
              </span>
            </div>
            {g.msgs.map((m, i) => {
              const mio = m.senderId === user?.uid
              const prev = i > 0 ? g.msgs[i - 1] : null
              const mismoEmisor = prev && prev.senderId === m.senderId
              const noLeidoPorMi = !mio && (!lastReadAt || m.createdAt > lastReadAt)
              const rolColor = ROL_COLOR[m.senderRol] ?? '#94a3b8'
              const rolLabel = ROL_LABEL[m.senderRol] ?? m.senderRol
              const inicial = (m.senderName ?? '?').replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').trim()[0]?.toUpperCase() ?? '?'
              return (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start',
                  marginBottom: 6, marginTop: mismoEmisor ? 2 : 12,
                  gap: 8, alignItems: 'flex-end',
                }}>
                  {/* Avatar a la izquierda para mensajes ajenos */}
                  {!mio && (
                    <div style={{
                      width: mismoEmisor ? 30 : 30, height: 30, borderRadius: '50%',
                      background: mismoEmisor ? 'transparent' : rolColor,
                      color: '#000', fontWeight: 700, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, visibility: mismoEmisor ? 'hidden' : 'visible',
                    }}>
                      {inicial}
                    </div>
                  )}

                  <div style={{
                    maxWidth: '74%',
                    background: mio ? rolColor : 'var(--s1)',
                    color: mio ? '#040b12' : 'var(--text)',
                    border: mio
                      ? 'none'
                      : `1px solid ${noLeidoPorMi ? 'rgba(96,165,250,0.5)' : `color-mix(in srgb, ${rolColor} 20%, transparent)`}`,
                    borderRadius: 14,
                    borderTopLeftRadius: !mio && !mismoEmisor ? 4 : 14,
                    borderTopRightRadius: mio && !mismoEmisor ? 4 : 14,
                    padding: '8px 12px',
                    fontSize: 14, lineHeight: 1.45,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    boxShadow: noLeidoPorMi ? '0 0 0 2px rgba(96,165,250,0.18)' : 'none',
                  }}>
                    {!mismoEmisor && (
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: mio ? 'rgba(0,0,0,0.7)' : rolColor,
                        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
                      }}>
                        {m.senderRol === 'secretaria' ? <UserSquare2 size={11} /> : <Stethoscope size={11} />}
                        <span>{m.senderName}</span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 600,
                          padding: '1px 6px', borderRadius: 'var(--r-pill)',
                          background: mio ? 'rgba(0,0,0,0.15)' : `color-mix(in srgb, ${rolColor} 13%, transparent)`,
                          color: mio ? 'rgba(0,0,0,0.7)' : rolColor,
                          marginLeft: 2,
                        }}>{rolLabel}</span>
                      </div>
                    )}
                    {m.text}
                    <div style={{
                      fontSize: 10, marginTop: 3, textAlign: 'right',
                      color: mio ? 'rgba(0,0,0,0.55)' : 'var(--text3)',
                    }}>
                      {new Date(m.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Avatar a la derecha para mis mensajes */}
                  {mio && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: mismoEmisor ? 'transparent' : rolColor,
                      color: '#000', fontWeight: 700, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, visibility: mismoEmisor ? 'hidden' : 'visible',
                    }}>
                      {inicial}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 14px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
        background: 'var(--s1)', borderTop: '1px solid var(--border)', flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={onKey}
          placeholder="Escribe un mensaje… (Enter = enviar · Shift+Enter = nueva línea)"
          rows={1}
          style={{
            flex: 1, background: 'var(--s2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
            outline: 'none', resize: 'none', minHeight: 42, maxHeight: 120,
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          aria-label="Enviar"
          style={{
            background: texto.trim() ? 'var(--nexus-solido)' : 'var(--s3)',
            color: texto.trim() ? '#fff' : 'var(--text3)',
            border: 'none', borderRadius: 12, padding: '0 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: texto.trim() && !enviando ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          {enviando ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
