'use client'
/**
 * Portal público para que el paciente ejerza sus derechos ARCO conforme a LFPDPPP.
 *
 * El paciente NO necesita cuenta — solo identificarse con sus datos básicos.
 * La solicitud llega a la clínica que la atiende en máximo 20 días hábiles.
 */
import { useEffect, useId, useState } from 'react'
import { useParams } from 'next/navigation'
import { crearSolicitudArco, ARCO_TIPO_LABEL, type ArcoTipo } from '@/lib/arco'
import { claveDeIntento } from '@/lib/idempotencia'
import { generarAvisoPrivacidad } from '@/lib/aviso-privacidad'
import type { ClinicConfig } from '@/types'
import { Shield, Check, Loader2, FileText, AlertCircle } from 'lucide-react'

interface ClinicInfo {
  ok: boolean
  clinic?: {
    nombre: string
    nombreMedico: string
    telefono: string
  }
}

export default function PortalPrivacidadPage() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [clinic, setClinic] = useState<ClinicInfo['clinic'] | null>(null)
  const [config, setConfig] = useState<ClinicConfig | null>(null)
  const [paso, setPaso] = useState<'info' | 'formulario' | 'enviado' | 'aviso'>('info')
  const [enviando, setEnviando] = useState(false)
  const [folioConfirmacion, setFolioConfirmacion] = useState('')
  /**
   * REG-561 — la clave nace con el formulario, no con el envío.
   *
   * `useState(claveDeIntento)` y no `useState(claveDeIntento())`: la forma
   * perezosa acuña UNA vez en el primer render. Con la llamada directa se
   * evaluaría en cada render, que es la misma clave nueva de siempre disfrazada.
   */
  const [claveSolicitud] = useState(claveDeIntento)

  const [tipo, setTipo] = useState<ArcoTipo>('acceso')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [curp, setCurp] = useState('')
  const [identificacion, setIdentificacion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  /** Lo que no se pudo hacer, escrito en la pantalla y no en un diálogo nativo. */
  const [aviso, setAviso] = useState('')
  /**
   * PP-013 — «SOLICITO EN REPRESENTACIÓN DE MI HIJO».
   *
   * El formulario pedía «Nombre completo, como aparece en tu INE». Un menor no
   * tiene INE, y quien ejerce sus derechos ARCO es su madre o su padre: no
   * había forma de decirlo, así que la solicitud llegaba al consultorio a
   * nombre de una persona que no es la del expediente.
   */
  const [enRepresentacion, setEnRepresentacion] = useState(false)
  const [titular, setTitular] = useState('')
  const [parentesco, setParentesco] = useState('')

  useEffect(() => {
    if (!clinicId) return
    // Una sola petición alimenta tanto los datos públicos de la clínica como la
    // config para el aviso (antes se llamaba DOS veces al mismo endpoint).
    fetch(`/api/public/clinic/${clinicId}`)
      .then(r => r.json())
      .then((d: ClinicInfo & { clinic?: { nombreMedico: string; especialidad?: string; direccion?: string; razonSocial?: string; responsablePrivacidad?: string; correoArco?: string } }) => {
        if (!d.ok || !d.clinic) return
        setClinic(d.clinic)
        setConfig({
          nombreClinica: d.clinic.nombre,
          nombreMedico: d.clinic.nombreMedico,
          direccion: d.clinic.direccion ?? '',
          telefonoAdmin: d.clinic.telefono,
          // RFC y domicilio fiscal NO llegan al portal público (protección de datos)
          razonSocial: d.clinic.razonSocial || undefined,
          responsablePrivacidad: d.clinic.responsablePrivacidad || undefined,
          correoArco: d.clinic.correoArco || undefined,
        } as ClinicConfig)
      })
      .catch(() => {})
  }, [clinicId])

  const enviar = async () => {
    /**
     * ── C-006 · PG-016 — ESTE FORMULARIO HABLABA POR `alert()` ──────────────
     *
     * Dos diálogos nativos: uno para «llena los campos obligatorios» y otro que
     * imprimía el MENSAJE CRUDO DE LA EXCEPCIÓN («Missing or insufficient
     * permissions») a un paciente que acababa de ejercer un derecho.
     *
     * Un `alert()` se cierra sin dejar rastro —la pantalla queda idéntica a la
     * del éxito— y en un WebView puede no salir siquiera: el propio guardián
     * `native-dialogs-guard` de este repositorio lo tiene documentado. Lo que
     * sustituye a los dos es un aviso que se QUEDA en la pantalla, con
     * `role="alert"` para que un lector de pantalla lo anuncie, y en español de
     * persona: sin `Error:` y sin la excepción dentro.
     */
    if (!nombre.trim() || !telefono.trim() || !descripcion.trim()) {
      setAviso('Para poder atender tu solicitud necesitamos tu nombre, tu teléfono y que nos cuentes qué necesitas.')
      return
    }
    setAviso('')
    setEnviando(true)
    try {
      const id = await crearSolicitudArco({
        clinicId,
        solicitante: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim() || undefined,
          curp: curp.trim() || undefined,
          identificacion: identificacion.trim() || undefined,
        },
        tipo,
        descripcion: enRepresentacion && titular.trim()
          ? `[Solicitud presentada por ${nombre.trim()} en representación de ${titular.trim()}${parentesco.trim() ? ` (${parentesco.trim()})` : ''}]\n${descripcion.trim()}`
          : descripcion.trim(),
      }, undefined, claveSolicitud)
      setFolioConfirmacion(id.slice(-8).toUpperCase())
      setPaso('enviado')
    } catch {
      /* El mensaje de la excepción no se le enseña a nadie: no le dice nada al
         paciente y puede filtrar detalles de la base. Se dice qué pasó y qué
         hacer. */
      setAviso('No pudimos enviar tu solicitud en este momento. Vuelve a intentarlo en unos minutos, o llama al consultorio para pedirla por teléfono.')
    } finally {
      setEnviando(false)
    }
  }

  // === Vista: confirmación ===
  if (paso === 'enviado') {
    return (
      <div style={layoutStyle}>
        {/*
          A11Y-GATE-001: el folio es el ACUSE de la solicitud ARCO — lo único que
          el paciente se lleva para reclamar el plazo de 20 días hábiles. Aparecía
          tras un cambio de vista sin que el lector de pantalla lo anunciara.
        */}
        <div style={cardStyle} role="status">
          <Check size={48} color="#10b981" style={{ marginBottom: 16 }} aria-hidden="true" />
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Solicitud recibida</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
            Tu solicitud fue registrada con el folio:
          </p>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: 'var(--teal)', marginBottom: 18 }}>
            #{folioConfirmacion}
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 20 }}>
            Conforme al Art. 32 de la LFPDPPP, recibirás respuesta en un plazo
            máximo de <strong>20 días hábiles</strong>.
            {clinic?.nombre && <> El responsable es <strong>{clinic.nombre}</strong>.</>}
          </p>
          {/*
            ── C-005 · «CERRAR» NO CERRABA NADA ────────────────────────────

            Era `window.close()`, que sólo funciona en ventanas que abrió un
            script. El paciente llega aquí por un enlace copiado o tecleado, así
            que el navegador ignoraba la llamada: el único botón de la pantalla,
            justo después de ejercer un derecho, no hacía absolutamente nada.

            El cierre real del trámite es el FOLIO de arriba. Lo que hacía falta
            aquí no era cerrar la pestaña: era decirle al paciente qué hacer con
            ese folio y darle a dónde ir.
          */}
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 16 }}>
            Guarda este folio o toma una foto de la pantalla: es tu comprobante
            si tienes que reclamar el plazo.
          </p>
          <button onClick={() => setPaso('info')} className="btn btn-secondary" style={{ minHeight: 44 }}>
            Hacer otra solicitud
          </button>
        </div>
      </div>
    )
  }

  // === Vista: aviso completo ===
  if (paso === 'aviso') {
    return (
      <div style={layoutStyle}>
        <div style={{ ...cardStyle, maxWidth: 720, textAlign: 'left' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Aviso de Privacidad</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.65, color: '#374151' }}>
            {generarAvisoPrivacidad(config)}
          </pre>
          <button onClick={() => setPaso('info')} className="btn btn-secondary" style={{ marginTop: 16, minHeight: 44 }}>
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  // === Vista: info y portal ===
  return (
    <div style={layoutStyle}>
      <div style={{ ...cardStyle, maxWidth: 560, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={24} color="var(--teal)" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            Portal de Privacidad
          </h1>
        </div>
        {clinic && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            {clinic.nombre} · {clinic.nombreMedico}
          </div>
        )}

        {paso === 'info' && (
          <>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 14 }}>
              Aquí puedes ejercer tus <strong>derechos ARCO</strong> conforme a la Ley Federal de
              Protección de Datos Personales en Posesión de los Particulares.
            </p>
            <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
              {(['acceso', 'rectificacion', 'cancelacion', 'oposicion', 'revocacion'] as ArcoTipo[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setPaso('formulario') }}
                  style={{
                    padding: '12px 14px', textAlign: 'left', background: '#f9fafb',
                    border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
                    fontSize: 14, fontWeight: 500, color: '#111827',
                  }}
                >
                  {ARCO_TIPO_LABEL[t]}
                </button>
              ))}
            </div>
            <button onClick={() => setPaso('aviso')} style={{
              background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer',
              fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <FileText size={13} /> Ver Aviso de Privacidad completo
            </button>
          </>
        )}

        {paso === 'formulario' && (
          <>
            {/*
              PO-012: medía 55×20 px en móvil, menos de la mitad del mínimo
              táctil de 44×44 — y es el único camino de vuelta de esta pantalla.
            */}
            <button onClick={() => setPaso('info')} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 16, marginBottom: 12, minHeight: 44, minWidth: 44, padding: '10px 4px', textAlign: 'left' }}>
              ← Volver
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {ARCO_TIPO_LABEL[tipo]}
            </h2>
            <p style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 14 }}>
              Llena tus datos para identificarte. Te responderemos en máximo 20 días hábiles.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Tu nombre completo *" value={nombre} onChange={setNombre} placeholder="Como aparece en tu identificación" />
              {/*
                PP-013 — el formulario daba por hecho que quien escribe es el
                paciente. Un menor no tiene INE, y quien ejerce sus derechos es
                su madre o su padre: sin esto, la solicitud llegaba a nombre de
                alguien que no está en el expediente y el consultorio no podía
                localizarlo.
              */}
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  checked={enRepresentacion}
                  onChange={e => setEnRepresentacion(e.target.checked)}
                  style={{ marginTop: 3, width: 20, height: 20 }}
                />
                <span>Lo pido en representación de otra persona (por ejemplo, mi hijo o alguien a quien cuido)</span>
              </label>
              {enRepresentacion && (
                <>
                  <Field label="Nombre de la persona del expediente *" value={titular} onChange={setTitular} />
                  <Field label="¿Quién es esa persona para ti?" value={parentesco} onChange={setParentesco} placeholder="Por ejemplo: mi hijo" />
                </>
              )}
              <Field label="Teléfono *" value={telefono} onChange={setTelefono} placeholder="10 dígitos" type="tel" />
              <Field label="Correo electrónico" value={email} onChange={setEmail} type="email" />
              <Field label="CURP (opcional, ayuda a localizar tu expediente)" value={curp} onChange={(v) => setCurp(v.toUpperCase())} maxLength={18} />
              <Field label="Identificación oficial (ej. INE folio 1234)" value={identificacion} onChange={setIdentificacion} />
              <div>
                <label htmlFor="arco-descripcion" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Describe tu solicitud *
                </label>
                <textarea
                  id="arco-descripcion"
                  aria-describedby="arco-descripcion-cuenta"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value.slice(0, 1000))}
                  rows={4}
                  placeholder={tipo === 'acceso' ? 'Solicito una copia de mi expediente médico completo.' : tipo === 'rectificacion' ? 'Mi nombre está mal escrito. Debería decir...' : tipo === 'cancelacion' ? 'Solicito que se elimine...' : 'Me opongo a que mis datos se usen para...'}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                    fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                {/*
                  D-007: iba a 10.5 px con un gris literal sobre blanco — 2.4:1,
                  la mitad del mínimo AA. La compuerta del paciente no lo cazó
                  porque mide TOKENS de color, y esto era un color escrito a
                  mano. Ahora usa el token de texto secundario, que cumple en los
                  dos temas, y el tamaño sube al del resto del formulario.
                */}
                <div id="arco-descripcion-cuenta" aria-live="polite" style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'right', marginTop: 4 }}>
                  {descripcion.length} de 1000 caracteres
                </div>
              </div>
              <div style={{
                padding: 10, background: '#fef3c7', borderRadius: 6, fontSize: 12, color: 'var(--amber)',
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  Para confirmar tu identidad, la clínica puede pedirte una copia de tu identificación
                  oficial cuando responda tu solicitud.
                </div>
              </div>
              {aviso && (
                <p role="alert" style={{ fontSize: 14, color: 'var(--amber-texto)', lineHeight: 1.6, margin: 0 }}>
                  {aviso}
                </p>
              )}
              {/*
                ── PI-023 · «ENVIAR SOLICITUD, NO DISPONIBLE» ─────────────────

                El botón salía `disabled` mientras faltara un campo, así que un
                lector de pantalla anunciaba «no disponible» y ahí acababa la
                conversación: nadie decía QUÉ faltaba. Un control deshabilitado
                sin explicación es una puerta cerrada sin cartel.

                Ahora el botón siempre se puede pulsar y es él quien dice qué
                falta —el mismo aviso que ve todo el mundo—, y `aria-describedby`
                lo cuenta antes de pulsarlo.
              */}
              <p id="arco-que-falta" style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                Los campos con * son obligatorios.
              </p>
              <button
                onClick={enviar}
                disabled={enviando}
                aria-busy={enviando}
                aria-describedby="arco-que-falta"
                className="btn btn-primary"
                style={{ marginTop: 6, minHeight: 44 }}
              >
                {enviando ? <><Loader2 size={14} className="spin" aria-hidden="true" /> Enviando…</> : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * A11Y-GATE-001. El `<label>` de este helper NO estaba atado a su `<input>`:
 * ni `htmlFor`, ni anidado. Se veía perfectamente y no existía — un lector de
 * pantalla llegaba al campo del nombre y anunciaba «cuadro de edición», sin
 * decir de qué. En un formulario de derechos ARCO, donde el paciente escribe su
 * nombre, su teléfono y su CURP, eso es el formulario entero.
 *
 * `useId` es lo correcto aquí y no un contador propio: el identificador tiene
 * que ser el MISMO en el servidor y en el cliente, o React lo rehace al
 * hidratar y el vínculo se rompe justo después de pintarse.
 */
function Field({ label, value, onChange, type = 'text', placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        id={id}
        type={type} value={value} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 6,
          border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

const layoutStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#f3f4f6', padding: 20,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24, maxWidth: 440, width: '100%',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center',
}
