'use client'
/**
 * Fotografía clínica seriada del paciente: toma/sube foto en cada consulta,
 * la etiqueta por región anatómica y permite COMPARAR dos fechas lado a lado.
 * Sirve para dermatología (lesiones, nevos, psoriasis) y para el seguimiento de
 * heridas quirúrgicas / úlceras.
 */
import { useState, useEffect, useCallback } from 'react'
import { zonaActiva, hoyISO } from '@/lib/timezone'
import { resizeImageFile } from '@/lib/image-utils'
import { enEspanolLlano } from '@/lib/texto-es'
import { useToast } from '@/context/ToastContext'
import { Camera, Loader2, Trash2, GitCompare, X } from 'lucide-react'
import { subirImagen } from '@/lib/subir-imagen'
import {
  crearFoto, getFotos, deleteFoto, agruparPorRegion, parAntesDespues, diasEntre,
  REGIONES, REGIONES_AGRUPADAS, type FotoClinica,
} from '@/lib/expediente/fotos-clinicas'

interface Props {
  clinicId: string
  patientId: string
  /** Si se toma durante una consulta, liga la foto a esa nota. */
  notaId?: string
  /**
   * 'captura'  → en la CONSULTA: tomar la foto (que es cuando tienes al paciente
   *              enfrente) y ver las últimas tomas como referencia.
   * 'completo' → en el EXPEDIENTE: la serie agrupada por región con el
   *              antes/después y los días de evolución.
   */
  modo?: 'captura' | 'completo'
  /** Dentro de la barra de herramientas: sin título propio. */
  embebido?: boolean
}

export function FotosClinicas({ clinicId, patientId, notaId, modo = 'completo', embebido }: Props) {
  const { confirm } = useToast()
  const [fotos, setFotos] = useState<FotoClinica[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [region, setRegion] = useState(REGIONES[0])
  const [descripcion, setDescripcion] = useState('')
  const [comparar, setComparar] = useState<{ a: FotoClinica; b: FotoClinica } | null>(null)
  /** MC-012 — compuerta de consentimiento; ver el comentario del formulario. */
  const [consintio, setConsintio] = useState(false)
  /** MO-008 — la fecha de la TOMA; por omisión hoy, en la zona del consultorio. */
  const [fechaDeLaToma, setFechaDeLaToma] = useState(() => hoyISO())

  const cargar = useCallback(async () => {
    if (!clinicId || !patientId) return
    setCargando(true)
    try { setFotos(await getFotos(clinicId, patientId)) }
    catch (e) { setError('No se pudieron cargar las fotos: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setCargando(false) }
  }, [clinicId, patientId])

  useEffect(() => { cargar() }, [cargar])

  /**
   * LA FOTO DE UNA HERIDA NO SUBE CON EL GPS DENTRO — Panel de Lujo MC-011 (P2).
   *
   * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
   *
   * El archivo CRUDO del teléfono se leía con `FileReader.readAsDataURL` y se
   * mandaba tal cual, así que sus metadatos EXIF —coordenadas GPS, modelo de
   * dispositivo, hora original— viajaban dentro y el servidor guardaba el búfer
   * íntegro sin reencodar. La foto de una lesión en el domicilio del paciente
   * lleva su dirección pegada.
   *
   * El canvas que lo resuelve YA existía —`image-utils.ts`, que redibuja y
   * reencoda, y en ese trayecto el EXIF se pierde por construcción— y este
   * componente no lo llamaba. «Escrito y sin conectar», otra vez.
   *
   * De paso cae el segundo cargo del hallazgo: una foto de teléfono moderno pasa
   * de 3.5 MB y fallaba con el mensaje de `subir-imagen.ts`, que habla de PDF y
   * de firmas —«si viene de un PDF, exporta sólo la zona de la firma»— porque
   * ese texto se escribió para otra pantalla. Reencodada ya no pesa eso, y si
   * aun así falla, el mensaje es el de esta pantalla.
   *
   * ── QUÉ **NO** CAMBIA ──────────────────────────────────────────────────────
   *
   * No se toca la ruta de Storage: que la foto clínica acabe bajo
   * `receta-diseno/{uid}/` es un defecto real que el equipo rojo verificó, y
   * vive en `api/imagen/route.ts`, de otra rebanada. Va en el handoff.
   */
  const onArchivo = async (file: File) => {
    setSubiendo(true); setError('')
    try {
      /*
       * 1600 px de lado mayor: una foto clínica se mira para comparar evolución,
       * no para hacer dermatoscopia — el detalle diagnóstico fino no vive en el
       * archivo, vive en el ojo del médico delante del paciente. Es el mismo
       * criterio con el que ya se reencodan las demás imágenes del producto.
       */
      const { dataUrl } = await resizeImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.88 })
      const url = await subirImagen(dataUrl, `fotos/${patientId}/${Date.now()}`)
      if (!url) throw new Error('Storage no devolvió URL')
      await crearFoto(clinicId, patientId, {
        url,
        /*
         * MO-008 — la fecha de la TOMA, no la de la subida.
         *
         * `fecha` era siempre `new Date()`, así que una radiografía traída de
         * fuera quedaba fechada el día que se escaneó y la línea de tiempo del
         * paciente mentía. Ahora se puede fechar; el valor por omisión sigue
         * siendo hoy, que es el caso frecuente.
         */
        fecha: fechaDeLaToma ? new Date(`${fechaDeLaToma}T12:00:00`).toISOString() : new Date().toISOString(),
        region,
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        ...(notaId ? { notaId } : {}),
      })
      setDescripcion('')
      await cargar()
    } catch (e) {
      setError(`No se pudo guardar la foto. ${enEspanolLlano(e)}`)
    } finally { setSubiendo(false) }
  }

  const borrar = async (f: FotoClinica) => {
    // confirm in-app: el nativo se ignora en silencio en la PWA instalada.
    if (!(await confirm('¿Eliminar esta foto del expediente?', { peligro: true, confirmar: 'Eliminar' }))) return
    try { await deleteFoto(clinicId, patientId, f.id); await cargar() }
    catch (e) { setError('No se pudo eliminar: ' + (e instanceof Error ? e.message : String(e))) }
  }

  const grupos = agruparPorRegion(fotos)
  /* ZC-019 — la zona es la del consultorio, no la del navegador que mira. */
  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: zonaActiva(), day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!embebido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={17} color="var(--teal)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Fotografía clínica seriada</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>({fotos.length})</span>
        </div>
      )}

      {/* Captura */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 14, background: 'var(--s1)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={rotulo}>1 · Zona anatómica</span>
            <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...input, width: '100%' }}>
              {REGIONES_AGRUPADAS.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.regiones.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={rotulo}>2 · Hallazgo <span style={{ fontWeight: 400 }}>(opcional)</span></span>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="p. ej. placa eritematosa de 3 cm"
              style={{ ...input, width: '100%' }} />
          </label>
          {/*
            MO-008 — LA FECHA DE LA TOMA, EDITABLE.
            La fecha era siempre `new Date()`, así que una radiografía traída de
            fuera se fechaba el día que se escaneó y la línea de tiempo del
            paciente decía algo falso. Por omisión, hoy: el caso frecuente sigue
            costando cero.
          */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={rotulo}>3 · Cuándo se tomó</span>
            <input
              type="date"
              aria-label="Fecha en que se tomó la imagen"
              value={fechaDeLaToma}
              max={hoyISO()}
              onChange={e => setFechaDeLaToma(e.target.value)}
              style={{ ...input, width: '100%' }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
              Déjala en hoy si la estás tomando ahora. Cámbiala si la imagen viene de fuera.
            </span>
          </label>
          <span style={rotulo}>4 · Captura</span>
        </div>
        {/*
          MC-012 — EL CONSENTIMIENTO SE PIDE, NO SE MENCIONA.

          El párrafo de abajo decía «Requiere consentimiento del paciente (dato
          personal sensible)» y el código no lo pedía, no lo registraba y no lo
          comprobaba: `FotoClinica` no tiene campo de consentimiento y `crearFoto`
          no lo exige. Un requisito escrito sólo en un párrafo informativo es un
          requisito que nadie cumple.

          Lo que se hace AQUÍ, y lo que no: la compuerta —una casilla que hay que
          marcar antes de poder capturar, en cada sesión de captura— impide que la
          foto se tome sin que alguien lo afirme. Lo que NO se hace es inventar el
          modelo de datos del consentimiento de imagen: guardar
          `consentimientoImagen {fecha, recabadoPor}` en el expediente y anotarlo
          en la bitácora de auditoría toca `fotos-clinicas.ts` y `audit-eventos.ts`
          con una decisión de producto detrás (¿una vez por paciente, como la voz,
          o por sesión?). Eso va al handoff y a `decisiones-UI-CONFIG.md`.

          Sin el registro, esta compuerta no prueba nada ante un tercero — y por
          eso lo dice en voz alta en vez de dar a entender que sí.
        */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 10,
          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
          border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
          background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
        }}>
          <input
            type="checkbox"
            checked={consintio}
            onChange={e => setConsintio(e.target.checked)}
            style={{ width: 17, height: 17, accentColor: 'var(--teal)', marginTop: 1, flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            El paciente <b>consintió</b> que se le tome esta imagen y que quede en su
            expediente. Es un dato personal sensible (Art. 9 LFPDPPP).
            <span style={{ display: 'block', color: 'var(--text3)', marginTop: 3 }}>
              Esta casilla bloquea la captura; todavía <b>no</b> queda registrada como
              consentimiento formal en el expediente.
            </span>
          </span>
        </label>
        <label style={{
          ...cta,
          opacity: subiendo || !consintio ? 0.5 : 1,
          cursor: subiendo ? 'wait' : consintio ? 'pointer' : 'not-allowed',
        }}>
          {subiendo ? <><Loader2 size={16} className="spin" /> Guardando…</> : <><Camera size={16} /> Tomar / subir foto</>}
          <input type="file" accept="image/*" capture="environment" disabled={subiendo || !consintio} style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = '' }} />
        </label>
        <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: '8px 0 0', lineHeight: 1.5 }}>
          Toma la foto siempre de la <b>misma zona, distancia y luz</b> para que la comparación sea válida.
        </p>
      </div>

      {error && <div style={{ ...caja, borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)' }}>{error}</div>}
      {cargando && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Cargando fotos…</div>}
      {!cargando && fotos.length === 0 && (
        <div style={{ ...caja, color: 'var(--text3)' }}>Sin fotos aún. La primera toma es la línea base del seguimiento.</div>
      )}

      {/* En la CONSULTA basta una tira de las últimas tomas como referencia para
          encuadrar igual; la serie completa vive en el expediente. */}
      {modo === 'captura' && fotos.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            Últimas tomas — la serie completa y el antes/después están en el expediente
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {fotos.slice(0, 6).map(f => (
              <div key={f.id} style={{ minWidth: 96, maxWidth: 96 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`${f.region} ${fechaCorta(f.fecha)}`}
                  style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)', display: 'block' }} />
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>{f.region}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>{fechaCorta(f.fecha)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Galería agrupada por región (expediente) */}
      {modo === 'completo' && grupos.map(g => {
        const par = parAntesDespues(g.fotos)
        return (
          <div key={g.region}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{g.region}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{g.fotos.length} foto(s)</span>
              {par && (
                <button type="button" onClick={() => setComparar({ a: par.antes, b: par.despues })}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: 'color-mix(in srgb, var(--nexus) 12%, transparent)', color: 'var(--teal)', border: '1px solid color-mix(in srgb, var(--nexus) 35%, transparent)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <GitCompare size={13} /> Comparar antes/después
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {g.fotos.map(f => (
                <div key={f.id} style={{ minWidth: 130, maxWidth: 130 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`${g.region} ${fechaCorta(f.fecha)}`}
                    style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text2)', flex: 1 }}>{fechaCorta(f.fecha)}</span>
                    <button type="button" onClick={() => borrar(f)} aria-label="Eliminar"
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {f.descripcion && <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>{f.descripcion}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Comparación lado a lado */}
      {modo === 'completo' && comparar && (
        <div style={{ border: '1px solid color-mix(in srgb, var(--nexus) 35%, transparent)', borderRadius: 12, padding: 14, background: 'color-mix(in srgb, var(--nexus) 5%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <GitCompare size={15} color="var(--teal)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>
              {comparar.a.region} · {diasEntre(comparar.a, comparar.b)} días de evolución
            </span>
            <button type="button" onClick={() => setComparar(null)} aria-label="Cerrar"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[{ f: comparar.a, t: 'Antes' }, { f: comparar.b, t: 'Después' }].map(({ f, t }) => (
              <div key={t}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t} · {fechaCorta(f.fecha)}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={t} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }} />
                {f.descripcion && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>{f.descripcion}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const input: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, color: 'var(--text)' }
const rotulo: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.3 }
const cta: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--nexus-solido)', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600 }
const caja: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5 }
