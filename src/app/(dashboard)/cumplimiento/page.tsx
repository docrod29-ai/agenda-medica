'use client'
/**
 * Panel de cumplimiento normativo NOM-024 / LFPDPPP.
 *
 * Concentra en un solo lugar:
 *  - Bitácora de accesos (audit_log)
 *  - Solicitudes ARCO pendientes + resueltas
 *  - Link al portal público de privacidad
 *  - Estado de cumplimiento por punto
 */
import { useEffect, useState } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { collection, getDocs, orderBy, query, where, limit as fbLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPatients } from '@/lib/firestore'
import {
  listarSolicitudesArco, resolverSolicitudArco,
  ARCO_TIPO_LABEL, type ArcoRequest, type ArcoEstado,
} from '@/lib/arco'
import { asientosPendientes, asientosDeOtros, etiquetaEvento, type AuditEvento } from '@/lib/expediente/audit-log'
import {
  ShieldCheck, FileSearch, Inbox, Copy, ExternalLink, AlertTriangle, Check, Clock, Shield, FlaskConical, Download,
} from 'lucide-react'
import { motoresSinValidar } from '@/components/SelloMotor'
import { Tabs, Spinner, EmptyState, Modal, Button } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { fetchAutenticado } from '@/lib/auth-client'

/**
 * LO QUE NO HA LLEGADO A LA BITÁCORA — y que no se veía en ninguna parte.
 *
 * `asientosPendientes()` existía desde que se puso la cola de reintentos, y no
 * lo mostraba ninguna pantalla. Una bitácora con huecos que nadie sabe que tiene
 * es peor que una bitácora incompleta declarada: al leerla, todo parece estar.
 *
 * La cola vive en ESTE navegador. Si el equipo no se vuelve a usar, esos
 * asientos no llegan nunca.
 */
function AsientosPendientes() {
  const [n, setN] = useState(0)
  const [deOtros, setDeOtros] = useState(0)
  useEffect(() => {
    const leer = () => { setN(asientosPendientes()); setDeOtros(asientosDeOtros()) }
    leer()
    const t = setInterval(leer, 5000)
    return () => clearInterval(t)
  }, [])
  if (n === 0) return null
  return (
    <div style={{ background: 'color-mix(in srgb, var(--amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        <AlertTriangle size={15} /> {n} {n === 1 ? 'asiento' : 'asientos'} sin registrar en este equipo
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
        No se pudieron enviar (sin conexión o error del servidor) y se reintentan solos al usar la aplicación.
        Lo que ves abajo <strong>no incluye</strong> esos movimientos.
        {deOtros > 0 && <> {deOtros} {deOtros === 1 ? 'es' : 'son'} de otra persona que usó este equipo: se enviarán cuando vuelva a entrar, para no firmarlos con tu nombre.</>}
      </p>
    </div>
  )
}

interface AuditEntry {
  id: string
  evento: AuditEvento
  timestamp: string
  medicoEmail?: string
  patientId?: string
  notaId?: string
  meta?: Record<string, unknown>
}


type Tab = 'bitacora' | 'arco' | 'estado'

export default function CumplimientoPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('estado')
  const [bitacora, setBitacora] = useState<AuditEntry[]>([])
  const [arcoList, setArcoList] = useState<ArcoRequest[]>([])
  const [porCancelar, setPorCancelar] = useState<ArcoRequest | null>(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [veredicto, setVeredicto] = useState<{ camino: string; queOcurre: string; porQueNoSeBorra: string } | null>(null)
  /** El médico afirma que verificó al titular. Nace en false SIEMPRE. */
  const [identidadOk, setIdentidadOk] = useState(false)
  const [loading, setLoading] = useState(true)
  /**
   * «¿QUIÉN ENTRÓ AL EXPEDIENTE DE ESTE PACIENTE?»
   *
   * Es LA pregunta de la trazabilidad —la que hace un auditor, y la que puede
   * hacer el propio paciente al ejercer sus derechos ARCO— y esta pantalla no
   * podía contestarla: enseñaba los últimos 200 asientos de toda la clínica,
   * revueltos, con el paciente reducido a ocho caracteres de su id.
   *
   * Filtrar esos 200 en el navegador habría sido peor que no filtrar: «no hay
   * accesos» cuando en realidad los hay, sólo que más viejos que la ventana. Por
   * eso, al elegir un paciente se PREGUNTA AL SERVIDOR por sus asientos —todos—
   * y se dice en pantalla cuál de las dos cosas se está viendo.
   *
   * La consulta es sólo de igualdad, sin `orderBy`: así le basta el índice
   * automático de Firestore y no hace falta desplegar uno compuesto. El orden se
   * hace aquí.
   */
  const [pacienteFiltro, setPacienteFiltro] = useState('')
  const [descargandoBitacora, setDescargandoBitacora] = useState(false)
  const [eventoFiltro, setEventoFiltro] = useState('')
  const [pacientes, setPacientes] = useState<{ id: string; nombre: string }[]>([])

  useEffect(() => {
    if (!clinicId) return
    getPatients(clinicId)
      .then(ps => setPacientes(ps.map(p => ({ id: p.id, nombre: p.nombre }))))
      .catch(() => { /* el filtro es una ayuda: sin lista, la bitácora se ve igual */ })
  }, [clinicId])

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    const consulta = pacienteFiltro
      // TODOS los asientos de ese paciente, no los que quepan en la ventana global.
      ? query(collection(db, 'clinics', clinicId, 'audit_log'), where('patientId', '==', pacienteFiltro), fbLimit(500))
      : query(collection(db, 'clinics', clinicId, 'audit_log'), orderBy('timestamp', 'desc'), fbLimit(200))
    Promise.all([
      getDocs(consulta),
      listarSolicitudesArco(clinicId),
    ]).then(([logSnap, arco]) => {
      const filas = logSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry))
      filas.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      setBitacora(filas)
      setArcoList(arco)
    }).finally(() => setLoading(false))
    // Cambiar de paciente vuelve a preguntarle al servidor: filtrar en el
    // navegador contestaría «no hay accesos» cuando sólo son más viejos que la
    // ventana de 200.
  }, [clinicId, pacienteFiltro])

  /**
   * DESCARGAR LA BITÁCORA DEL PERIODO.
   *
   * El periodo por omisión es el último año: es lo que pide una auditoría
   * ordinaria, y se declara en el nombre del archivo y en su última línea para
   * que nadie lo presente como «todo el rastro» sin saber de cuándo a cuándo.
   */
  const descargarBitacora = async () => {
    if (!clinicId || descargandoBitacora) return
    setDescargandoBitacora(true)
    try {
      const hoy = new Date()
      const hasta = hoy.toISOString().slice(0, 10)
      const desde = new Date(hoy.getTime() - 365 * 86400_000).toISOString().slice(0, 10)
      const q = new URLSearchParams({ clinicId, desde, hasta })
      if (pacienteFiltro) q.set('patientId', pacienteFiltro)
      const res = await fetchAutenticado(`/api/cumplimiento/bitacora?${q.toString()}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast(d.error || 'No se pudo armar la bitácora', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bitacora_${desde}_a_${hasta}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast('Bitácora descargada. La última fila dice el periodo y cuántos asientos trae.', 'success')
    } catch {
      toast('No se pudo conectar para armar la bitácora', 'error')
    } finally {
      setDescargandoBitacora(false)
    }
  }

  const copiarLinkPrivacidad = () => {
    if (!clinicId) return
    const url = `${window.location.origin}/privacidad/${clinicId}`
    navigator.clipboard.writeText(url)
    toast('Link copiado', 'success')
  }

  /**
   * EJECUTAR UNA CANCELACIÓN ARCO.
   *
   * Se pregunta PRIMERO al servidor qué camino aplica —suprimir o bloquear— y
   * se le enseña al médico lo que va a pasar ANTES de confirmar, porque una de
   * las dos ramas es irreversible. Nadie debería enterarse de que el expediente
   * era imborrable después de haber pulsado el botón.
   */
  /** Pregunta al servidor qué camino aplica, sin ejecutar nada. */
  const consultarCamino = async (req: ArcoRequest) => {
    setPorCancelar(req)
    setVeredicto(null)
    setIdentidadOk(false)   // cada solicitud se verifica por separado
    if (!clinicId || !req.patientId) return
    try {
      const res = await fetchAutenticado('/api/arco/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, patientId: req.patientId, simular: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) setVeredicto({ camino: d.camino, queOcurre: d.queOcurre, porQueNoSeBorra: d.porQueNoSeBorra })
      else toast(d.error || 'No se pudo consultar el expediente', 'error')
    } catch { toast('No se pudo consultar el expediente', 'error') }
  }

  const ejecutarCancelacion = async () => {
    const req = porCancelar
    if (!clinicId || !req?.patientId || !req.id) return
    setEjecutando(true)
    try {
      const res = await fetchAutenticado('/api/arco/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, patientId: req.patientId, solicitudId: req.id, motivo: req.descripcion, identidadVerificada: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) { toast(d.error || 'No se pudo ejecutar la cancelación', 'error'); return }
      const resumen = d.camino === 'supresion'
        ? `Expediente suprimido (${d.borradas?.notas ?? 0} notas, ${d.borradas?.citas ?? 0} citas).`
        : 'Expediente bloqueado: se conserva por obligación legal, pero deja de usarse para contacto.'
      // Se deja la constancia en la propia solicitud, con lo que REALMENTE pasó.
      if (user?.uid) {
        await resolverSolicitudArco(clinicId, req.id, { estado: 'resuelta', resolucion: resumen, resueltoPor: user.uid }).catch(() => {})
      }
      toast(resumen, 'success')
      setPorCancelar(null)
      setArcoList(await listarSolicitudesArco(clinicId))
    } catch {
      toast('No se pudo ejecutar la cancelación', 'error')
    } finally {
      setEjecutando(false)
    }
  }

  /**
   * LA «A» DE ARCO, EJECUTADA.
   *
   * Se resolvía con un `prompt()`: se guardaba un texto, la solicitud pasaba a
   * «resuelta», y al titular NO se le entregaba nada. El plazo de 20 días
   * hábiles se contaba en esta misma pantalla y no había qué entregar cuando
   * vencía.
   *
   * Ahora arma el expediente completo con el MISMO manifiesto que el botón del
   * médico, lo descarga, y deja acuse: el hash de lo entregado, el conteo por
   * sección y la fecha, en la solicitud y en la bitácora. Sin el hash no hay
   * forma de demostrar QUÉ se entregó.
   */
  const entregarAcceso = async (req: ArcoRequest) => {
    if (!clinicId || !req.id || !req.patientId) {
      toast('Esta solicitud no está ligada a un expediente. Identifícala primero.', 'error')
      return
    }
    setEjecutando(true)
    try {
      const res = await fetchAutenticado('/api/arco/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, patientId: req.patientId, solicitudId: req.id, identidadVerificada: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) { toast(d.error || 'No se pudo armar la entrega', 'error'); return }

      const blob = new Blob([JSON.stringify(d.expediente, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arco_acceso_${req.id}.json`
      a.click()
      URL.revokeObjectURL(url)

      // Lo que falta se DICE, también aquí: entregar un expediente incompleto
      // sin señalarlo es peor que no entregarlo.
      const faltan = (d.faltantes ?? []) as { seccion: string }[]
      toast(faltan.length
        ? `Entregado con acuse ${String(d.paqueteHash).slice(0, 12)}…, pero ${faltan.length} sección(es) no se pudieron leer: ${faltan.map(f => f.seccion).join(', ')}.`
        : `Entregado. Acuse ${String(d.paqueteHash).slice(0, 12)}… guardado en la solicitud.`,
        faltan.length ? 'info' : 'success')
      setArcoList(await listarSolicitudesArco(clinicId))
    } catch {
      toast('No se pudo conectar para armar la entrega', 'error')
    } finally {
      setEjecutando(false)
    }
  }

  /**
   * LA «O» DE ARCO, EJECUTADA.
   *
   * Registra la baja del contacto —el candado que el envío proactivo ya
   * consulta en cada mensaje— y deja constancia. Lo que el sistema NO puede
   * apagar se enseña como aviso con la acción que le toca a una persona:
   * declarar apagado lo que sigue encendido es peor que no prometer nada.
   */
  const ejecutarOposicion = async (req: ArcoRequest) => {
    if (!clinicId || !req.id || !req.patientId) {
      toast('Esta solicitud no está ligada a un expediente. Identifícala primero.', 'error')
      return
    }
    setEjecutando(true)
    try {
      const res = await fetchAutenticado('/api/arco/oponerse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, patientId: req.patientId, solicitudId: req.id, identidadVerificada: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) { toast(d.error || 'No se pudo ejecutar la oposición', 'error'); return }

      const avisos = (d.avisos ?? []) as string[]
      toast(avisos.length
        ? `Oposición asentada, pero ${avisos.length} punto(s) requieren acción a mano: ${avisos.join(' ')}`
        : d.bajaContacto
          ? 'Oposición ejecutada: el contacto quedó dado de baja y los recordatorios dejan de salir.'
          : 'Oposición asentada en el expediente.',
        avisos.length ? 'info' : 'success')
      setArcoList(await listarSolicitudesArco(clinicId))
    } catch {
      toast('No se pudo conectar para ejecutar la oposición', 'error')
    } finally {
      setEjecutando(false)
    }
  }

  const resolverArco = async (req: ArcoRequest, estado: 'resuelta' | 'rechazada') => {
    if (!clinicId || !req.id || !user?.uid) return
    /**
     * El ACCESO ya no se resuelve escribiendo: se ejecuta y se entrega.
     *
     * Rechazarlo sí sigue siendo un texto —una negativa es una decisión con su
     * fundamento, no una operación de datos—.
     */
    if (req.tipo === 'acceso' && estado === 'resuelta') { await entregarAcceso(req); return }
    /**
     * La OPOSICIÓN tampoco se resuelve escribiendo: apaga el contacto.
     *
     * Se «resolvía» con el mismo `prompt()` y no se apagaba nada — el paciente
     * que ejercía su derecho por escrito seguía recibiendo recordatorios,
     * mientras que el que contestaba «BAJA» por WhatsApp sí dejaba de
     * recibirlos. La vía formal era la única que no servía.
     */
    if (req.tipo === 'oposicion' && estado === 'resuelta') { await ejecutarOposicion(req); return }
    const resolucion = prompt(`Describe brevemente qué se hizo (${estado}):`)
    if (!resolucion) return
    try {
      await resolverSolicitudArco(clinicId, req.id, {
        estado, resolucion, resueltoPor: user.uid,
      })
      toast(`Solicitud ${estado}`, 'success')
      // refresh
      const arco = await listarSolicitudesArco(clinicId)
      setArcoList(arco)
    } catch {
      toast('Error al resolver', 'error')
    }
  }

  if (!clinicId) {
    return <Spinner center label="Cargando…" />
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <ShieldCheck size={22} color="var(--teal)" />
        <h1 className="t-h1" style={{ margin: 0 }}>Cumplimiento normativo</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>
        Panel de auditoría para NOM-024-SSA3-2012 y LFPDPPP. Aquí encuentras la bitácora
        de accesos, solicitudes ARCO de tus pacientes, y el estado de cumplimiento.
      </p>
      <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 20, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', lineHeight: 1.5 }}>
        <strong>Autoevaluación interna</strong> del apego a la norma — <strong>no constituye una certificación</strong>
        emitida por un organismo acreditado. La certificación formal NOM-024 la realiza un tercero autorizado.
      </p>

      <div style={{ marginBottom: 20 }}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'estado', label: 'Estado' },
            { key: 'bitacora', label: 'Bitácora' },
            { key: 'arco', label: 'ARCO', count: arcoList.filter(a => a.estado === 'recibida' || a.estado === 'en_proceso').length },
          ]}
        />
      </div>

      {tab === 'estado' && (
        <EstadoCumplimiento clinicId={clinicId} bitacora={bitacora} arcoList={arcoList} onCopiarLink={copiarLinkPrivacidad} />
      )}

      {tab === 'bitacora' && (
        <>
          <AsientosPendientes />
          <Bitacora
            entries={bitacora} loading={loading} pacientes={pacientes}
            pacienteFiltro={pacienteFiltro} setPacienteFiltro={setPacienteFiltro}
            descargarBitacora={descargarBitacora} descargando={descargandoBitacora}
            eventoFiltro={eventoFiltro} setEventoFiltro={setEventoFiltro}
          />
        </>
      )}

      {tab === 'arco' && (
        <ArcoPanel requests={arcoList} loading={loading} onResolver={resolverArco} onCancelar={consultarCamino} />
      )}

      {/*
        EL VEREDICTO SE ENSEÑA ANTES, NO DESPUÉS.
        Una de las dos ramas es irreversible. El servidor dice cuál aplica —lo
        decide un hecho comprobable, si hay una nota firmada— y aquí se lee
        antes de confirmar. Enterarse de que el expediente era imborrable
        después de pulsar el botón sería exactamente al revés.
      */}
      <Modal
        open={!!porCancelar}
        onClose={() => { setPorCancelar(null); setVeredicto(null) }}
        title="Ejecutar cancelación ARCO"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPorCancelar(null); setVeredicto(null) }}>Volver</Button>
            <Button
              disabled={!veredicto || ejecutando || !identidadOk}
              loading={ejecutando}
              onClick={ejecutarCancelacion}
            >
              {veredicto?.camino === 'supresion' ? 'Suprimir el expediente' : 'Bloquear el expediente'}
            </Button>
          </>
        }
      >
        {!veredicto ? (
          <Spinner center label="Revisando el expediente…" />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{
              padding: 12, borderRadius: 8,
              border: `1px solid ${veredicto.camino === 'supresion' ? 'var(--red)' : 'var(--amber)'}`,
              background: 'var(--s2)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: veredicto.camino === 'supresion' ? 'var(--red)' : 'var(--amber)', marginBottom: 6 }}>
                {veredicto.camino === 'supresion' ? 'Se puede suprimir' : 'Sólo se puede bloquear'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{veredicto.queOcurre}</div>
            </div>
            {veredicto.porQueNoSeBorra && (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text2)' }}>Por qué no se puede borrar:</strong> {veredicto.porQueNoSeBorra}
              </div>
            )}
            {/*
              LA IDENTIDAD LA ACREDITA UNA PERSONA, NO UN FORMULARIO.
              El portal público pide nombre, teléfono, CURP e «identificación
              oficial» como TEXTO LIBRE, sin validación ni adjunto: cualquiera
              puede abrir una solicitud a nombre de otro. Bloquear el formulario
              no sirve —un impostor teclea cualquier cosa igual—, así que el
              candado va donde de verdad importa: en el acto irreversible.
              El médico afirma que verificó al titular, y esa afirmación queda
              en la bitácora con su nombre.
            */}
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={identidadOk}
                onChange={e => setIdentidadOk(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Verifiqué la identidad del titular (o de su representante) por un medio fiable.
                <span style={{ display: 'block', color: 'var(--text3)', marginTop: 2 }}>
                  El formulario público no la comprueba: quien lo llena escribe lo que quiera.
                </span>
              </span>
            </label>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              Queda registrado en la bitácora quién lo hizo y cuándo. El plazo de respuesta al
              paciente y la redacción de esa respuesta los define tu abogado.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function EstadoCumplimiento({ clinicId, bitacora, arcoList, onCopiarLink }: { clinicId: string; bitacora: AuditEntry[]; arcoList: ArcoRequest[]; onCopiarLink: () => void }) {
  const pendientes = arcoList.filter(a => a.estado === 'recibida' || a.estado === 'en_proceso')
  const urlPrivacidad = typeof window !== 'undefined' ? `${window.location.origin}/privacidad/${clinicId}` : ''

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <EstadoCsp clinicId={clinicId} />
      <Resumen
        ok={bitacora.length > 0}
        titulo="Bitácora de accesos (NOM-024 Art. 6.5)"
        descripcion={`${bitacora.length} eventos registrados (mostrando últimos 200). Cada lectura, escritura, impresión y firma queda con sello de tiempo.`}
      />
      <Resumen
        ok={pendientes.length === 0}
        titulo={`Derechos ARCO (LFPDPPP)`}
        descripcion={pendientes.length === 0
          ? 'Sin solicitudes pendientes. Todas resueltas.'
          : `Tienes ${pendientes.length} solicitud(es) pendiente(s). Plazo legal: 20 días hábiles.`}
      />
      <Resumen
        ok={true}
        titulo="Portal público de privacidad"
        descripcion="Comparte este link con tus pacientes para que ejerzan sus derechos ARCO."
        accion={
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onCopiarLink} className="btn btn-secondary" style={{ fontSize: 12 }}>
              <Copy size={12} /> Copiar link
            </button>
            <a href={urlPrivacidad} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12 }}>
              <ExternalLink size={12} /> Ver portal
            </a>
          </div>
        }
      />
      <Resumen
        ok={true}
        titulo="Integridad de notas firmadas (NOM-024)"
        descripcion="Hash SHA-256 + Firestore Rules garantizan que las notas firmadas son inmutables."
      />
      <Resumen
        ok={true}
        titulo="Multi-tenant aislado"
        descripcion="Tu clínica solo ve sus propios datos. Aislamiento garantizado por reglas Firestore."
      />
      <Seguridad2FAResumen />
      <RetencionResumen clinicId={clinicId} />
      <MotoresResumen />
    </div>
  )
}

/** Estado de 2FA de la cuenta actual */
function Seguridad2FAResumen() {
  const [activo, setActivo] = useState(false)
  useEffect(() => {
    /**
     * Los DOS por import dinámico.
     *
     * Aquí había un `require()` colgado dentro del `then`, que además de estar
     * prohibido por el analizador mezclaba dos formas de cargar en la misma
     * línea. Se resuelven juntos: la promesa espera a los dos y no hay carga
     * síncrona escondida en medio de una asíncrona.
     */
    void Promise.all([import('firebase/auth'), import('@/lib/firebase')]).then(([{ multiFactor }, { auth }]) => {
      const u = auth.currentUser
      if (!u) return
      try {
        const mfa = multiFactor(u as Parameters<typeof multiFactor>[0])
        setActivo(mfa.enrolledFactors.some(f => f.factorId === 'totp'))
      } catch { /* no-op */ }
    })
  }, [])
  return (
    <Resumen
      ok={activo}
      titulo="Autenticación de dos factores (2FA)"
      descripcion={activo
        ? 'Tu cuenta tiene 2FA activo. Al iniciar sesión te pediré el código de tu autenticador.'
        : 'Tu cuenta NO tiene 2FA. Recomendado para protección extra contra accesos no autorizados.'}
      accion={
        <a href="/cumplimiento/seguridad" className="btn btn-secondary" style={{ fontSize: 12 }}>
          <Shield size={12} /> {activo ? 'Administrar' : 'Activar 2FA'}
        </a>
      }
    />
  )
}

/**
 * Cuántos motores clínicos esperan la revisión del médico.
 *
 * El registro clasificaba los 89 motores desde hace meses y lo leían SÓLO las
 * pruebas: ninguna pantalla lo consultaba, así que la clasificación no llegaba a
 * quien decide. El número sale del mapa delgado (`sellos.json`), el mismo que
 * usa la etiqueta que aparece junto a los resultados.
 */
function MotoresResumen() {
  const pendientes = motoresSinValidar().length
  return (
    <Resumen
      ok={pendientes === 0}
      titulo="Motores clínicos sin validar"
      descripcion={pendientes === 0
        ? 'Todos los cálculos clínicos tienen validación de un médico responsable.'
        : `${pendientes} cálculos funcionan y tienen pruebas, pero sus reglas todavía no las ha revisado un médico responsable. Sus resultados salen marcados en pantalla; ninguno se oculta ni se bloquea.`}
      accion={
        <a href="/cumplimiento/motores" className="btn btn-secondary" style={{ fontSize: 12 }}>
          <FlaskConical size={12} /> Revisar
        </a>
      }
    />
  )
}

/** Panel de política de retención NOM-004 numeral 5.7 — mínimo 5 años desde última anotación */
function RetencionResumen({ clinicId }: { clinicId: string }) {
  const [pacientesViejos, setPacientesViejos] = useState<{ count: number; mas5: number }>({ count: 0, mas5: 0 })

  useEffect(() => {
    if (!clinicId) return
    import('@/lib/firestore').then(async ({ getPatients }) => {
      const pacientes = await getPatients(clinicId)
      const ahora = Date.now()
      const cincoAnios = 5 * 365 * 24 * 60 * 60 * 1000
      const mas5 = pacientes.filter(p => {
        const ult = p.ultimaCita || p.updatedAt || p.createdAt
        if (!ult) return false
        return ahora - new Date(ult).getTime() > cincoAnios
      }).length
      setPacientesViejos({ count: pacientes.length, mas5 })
    }).catch(() => {})
  }, [clinicId])

  const ok = pacientesViejos.mas5 === 0
  return (
    <Resumen
      ok={ok}
      titulo="Política de retención (NOM-004 numeral 5.7)"
      descripcion={ok
        ? `${pacientesViejos.count} pacientes en expediente. Ninguno supera 5 años sin actividad.`
        : `${pacientesViejos.mas5} paciente(s) con >5 años sin actividad. Revisa si proceden para archivar o anonimizar.`}
      accion={
        <a href="/cumplimiento/retencion" className="btn btn-secondary" style={{ fontSize: 12 }}>
          <FileSearch size={12} /> Ver lista
        </a>
      }
    />
  )
}

function Resumen({ ok, titulo, descripcion, accion }: { ok: boolean; titulo: string; descripcion: string; accion?: React.ReactNode }) {
  return (
    <div style={{
      padding: 16, background: ok ? 'rgba(16,185,129,0.06)' : 'color-mix(in srgb, var(--amber) 6%, transparent)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'color-mix(in srgb, var(--amber) 35%, transparent)'}`,
      borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      {ok ? <Check size={18} color="#10B981" style={{ marginTop: 2 }} /> : <AlertTriangle size={18} color="var(--amber)" style={{ marginTop: 2 }} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>{descripcion}</div>
      </div>
      {accion && <div style={{ flexShrink: 0 }}>{accion}</div>}
    </div>
  )
}

function Bitacora({
  entries, loading, pacientes, pacienteFiltro, setPacienteFiltro, eventoFiltro, setEventoFiltro,
  descargarBitacora, descargando,
}: {
  entries: AuditEntry[]; loading: boolean
  pacientes: { id: string; nombre: string }[]
  pacienteFiltro: string; setPacienteFiltro: (v: string) => void
  descargarBitacora: () => void; descargando: boolean
  eventoFiltro: string; setEventoFiltro: (v: string) => void
}) {
  const nombrePaciente = (id?: string) => pacientes.find(p => p.id === id)?.nombre ?? ''
  // El filtro por evento SÍ es de navegador: se aplica sobre lo ya traído, y
  // por eso la cabecera dice sobre qué conjunto está filtrando.
  const visibles = eventoFiltro ? entries.filter(e => e.evento === eventoFiltro) : entries
  // Sólo los tipos que de verdad aparecen: una lista de 40 opciones vacías no
  // ayuda a nadie.
  const tiposPresentes = [...new Set(entries.map(e => e.evento))].sort()

  return (
    <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/*
        EL FILTRO QUE FALTABA.

        «¿Quién entró al expediente de este paciente?» es LA pregunta de la
        trazabilidad —la que hace un auditor y la que puede hacer el propio
        paciente al ejercer sus derechos ARCO— y esta pantalla no podía
        contestarla: los últimos 200 asientos de toda la clínica, revueltos, con
        el paciente reducido a ocho caracteres de su id.
      */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="input" value={pacienteFiltro} onChange={e => setPacienteFiltro(e.target.value)}
          style={{ flex: '1 1 220px', fontSize: 12.5 }} aria-label="Filtrar por paciente">
          <option value="">Toda la clínica (últimos 200)</option>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className="input" value={eventoFiltro} onChange={e => setEventoFiltro(e.target.value)}
          style={{ flex: '1 1 200px', fontSize: 12.5 }} aria-label="Filtrar por tipo de evento">
          <option value="">Todos los tipos</option>
          {tiposPresentes.map(t => <option key={t} value={t}>{etiquetaEvento(t)}</option>)}
        </select>
        {/*
          DESCARGAR EL RASTRO DEL PERIODO.

          La pantalla enseña 200 asientos —500 filtrando por paciente— y cita
          NOM-024 en el título. Pero el rastro NO SE PODÍA SACAR de aquí: ante
          una auditoría, una queja al INAI o un litigio, lo que se pide es el
          periodo completo, no lo que quepa en una pantalla. Un registro que
          sólo se puede mirar no es un registro entregable.
        */}
        <button onClick={descargarBitacora} disabled={descargando}
          className="btn btn-secondary" style={{ fontSize: 12.5 }}>
          <Download size={13} /> {descargando ? 'Armando…' : 'Descargar periodo (CSV)'}
        </button>
      </div>
      {loading ? <div style={{ padding: 24 }}><Spinner center label="Cargando…" /></div> : visibles.length === 0 ? (
        <EmptyState icon={<FileSearch size={22} />}
          title={pacienteFiltro ? 'Sin asientos para este paciente' : 'Sin eventos registrados aún'}
          description={pacienteFiltro
            ? 'Nadie ha tocado este expediente, o los asientos son anteriores a que existiera la bitácora.'
            : 'Cada acceso, escritura, impresión y firma quedará aquí con sello de tiempo.'} />
      ) : (<>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {/*
          QUÉ CONJUNTO SE ESTÁ MIRANDO, dicho sin ambigüedad. Un filtro que
          parece completo y sólo mira una ventana contesta «no hay accesos»
          cuando en realidad los hay, y eso es peor que no filtrar.
        */}
        <span>
          {visibles.length} eventos ·{' '}
          {pacienteFiltro
            ? `TODOS los asientos de ${nombrePaciente(pacienteFiltro) || 'este paciente'}`
            : 'últimos 200 de toda la clínica'}
          {eventoFiltro && ' · filtrado por tipo'}
        </span>
        <span><FileSearch size={12} style={{ verticalAlign: 'middle' }} /> NOM-024 Art. 6.5</span>
      </div>
      <div style={{ maxHeight: 600, overflow: 'auto' }}>
        {visibles.map(e => (
          <div key={e.id} style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 4,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {etiquetaEvento(e.evento)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {e.medicoEmail ?? '—'}
                {/* El NOMBRE cuando se puede: ocho caracteres de un id no le dicen
                    nada a quien tiene que revisar quién tocó a quién. */}
                {e.patientId && <> · {nombrePaciente(e.patientId) || `paciente ${e.patientId.slice(0, 8)}`}</>}
                {e.notaId && <> · nota {e.notaId.slice(0, 6)}</>}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', textAlign: 'right' }}>
              {new Date(e.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        ))}
      </div>
      </>)}
    </div>
  )
}

function ArcoPanel({ requests, loading, onResolver, onCancelar }: { requests: ArcoRequest[]; loading: boolean; onResolver: (req: ArcoRequest, estado: 'resuelta' | 'rechazada') => void; onCancelar?: (req: ArcoRequest) => void }) {
  if (loading) return <Spinner center label="Cargando…" />
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} />}
        title="Sin solicitudes ARCO todavía"
        description="Cuando un paciente solicite acceso, rectificación, cancelación u oposición, aparecerá aquí."
      />
    )
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {requests.map(r => {
        const limite = r.fechaLimiteRespuesta ? new Date(r.fechaLimiteRespuesta) : null
        const ahora = new Date()
        const diasRestantes = limite ? Math.ceil((limite.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)) : null
        const pendiente = r.estado === 'recibida' || r.estado === 'en_proceso'
        return (
          <div key={r.id} style={{
            padding: 14, background: 'var(--s)', border: `1px solid ${pendiente && diasRestantes !== null && diasRestantes <= 5 ? 'color-mix(in srgb, var(--red) 40%, transparent)' : 'var(--border)'}`,
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ARCO_TIPO_LABEL[r.tipo]}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                  {r.solicitante.nombre} · {r.solicitante.telefono}
                  {r.solicitante.email && <> · {r.solicitante.email}</>}
                  {r.origen === 'portal-publico' && !r.identidadVerificada && (
                    <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 'var(--r-pill)', fontSize: 10.5, fontWeight: 700, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', color: 'var(--amber)' }}>
                      Identidad sin verificar
                    </span>
                  )}
                </div>
              </div>
              <EstadoBadge estado={r.estado} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', padding: 8, background: 'var(--s2)', borderRadius: 6, marginBottom: 8 }}>
              {r.descripcion}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
              <span>
                Recibida {new Date(r.fechaSolicitud).toLocaleDateString('es-MX')}
                {pendiente && diasRestantes !== null && (
                  <span style={{ marginLeft: 8, color: diasRestantes <= 5 ? '#F87171' : 'var(--text3)' }}>
                    <Clock size={11} style={{ verticalAlign: 'middle' }} /> {diasRestantes > 0 ? `Faltan ${diasRestantes} días` : `Vencida hace ${Math.abs(diasRestantes)} días`}
                  </span>
                )}
              </span>
              {pendiente && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {/*
                    LA «C» DE ARCO, QUE ANTES NO TENÍA CAMINO TÉCNICO.
                    «Marcar resuelta» sólo escribía un texto: el derecho se
                    atendía en prosa y los datos del paciente seguían igual.
                    Este botón lo EJECUTA — suprime si se puede, y si hay una
                    nota firmada bloquea el expediente y explica por qué no se
                    puede borrar.
                  */}
                  {r.tipo === 'cancelacion' && r.patientId && onCancelar && (
                    <button onClick={() => onCancelar(r)} style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--red) 50%, transparent)', color: 'var(--red)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      Ejecutar cancelación…
                    </button>
                  )}
                  {/*
                    SIN EXPEDIENTE LIGADO NO HAY BOTÓN — Y AHORA SE DICE.
                    Una solicitud del portal público no puede traer `patientId`
                    (las reglas lo impiden: si pudiera, cualquiera desde
                    internet señalaría el expediente de un tercero y el panel
                    ofrecería suprimirlo de un clic). Antes el botón
                    simplemente no aparecía y nadie sabía por qué.
                  */}
                  {r.tipo === 'cancelacion' && !r.patientId && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 420, lineHeight: 1.5 }}>
                      Llegó sin expediente ligado. Identifica al paciente con su identificación
                      delante y ejecuta la cancelación desde su expediente: una solicitud del
                      portal público dice quién <em>dice</em> ser el solicitante, no a qué
                      expediente corresponde.
                    </span>
                  )}
                  <button onClick={() => onResolver(r, 'rechazada')} style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', color: 'var(--red)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                    Rechazar
                  </button>
                  <button onClick={() => onResolver(r, 'resuelta')} className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }}>
                    Marcar resuelta
                  </button>
                </div>
              )}
            </div>
            {r.resolucion && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(16,185,129,0.06)', borderLeft: '2px solid #10B981', fontSize: 11.5, color: 'var(--text2)' }}>
                <strong>Resolución:</strong> {r.resolucion}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: ArcoEstado }) {
  const map: Record<ArcoEstado, { label: string; color: string; bg: string }> = {
    recibida: { label: 'RECIBIDA', color: 'var(--blue)', bg: 'rgba(59,130,246,0.15)' },
    en_proceso: { label: 'EN PROCESO', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 15%, transparent)' },
    resuelta: { label: 'RESUELTA', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    rechazada: { label: 'RECHAZADA', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  }
  const m = map[estado]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--r-pill)', background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}


/**
 * ¿YA SE PUEDE PONER LA CSP A BLOQUEAR DE VERDAD?
 *
 * La política va en report-only: el navegador avisa de lo que bloquearía y no
 * bloquea nada. El criterio para pasarla a `enforce` estaba escrito y probado
 * (`lib/security/csp-observacion.ts`: siete días y cero violaciones recientes)
 * pero **nadie leía los reportes**: se acumulaban y no había pantalla que dijera
 * cuántos días llevan ni cuántas violaciones hay. Un criterio que nadie puede
 * consultar no es un criterio, es un comentario.
 */
function EstadoCsp({ clinicId }: { clinicId: string }) {
  const [d, setD] = useState<{
    hayDatos?: boolean
    veredicto?: { listo: boolean; motivo: string }
    diasObservados?: number
    violaciones7d?: number
    modo?: string
    top?: { que: string; veces: number }[]
  } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    fetchAutenticado(`/api/seguridad/csp-estado?clinicId=${encodeURIComponent(clinicId)}`)
      .then(r => r.json())
      .then(j => { if (vivo) { if (j?.ok) setD(j); else setError(true) } })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [clinicId])

  if (error) {
    // Un fallo de lectura NO se enseña como «todo en orden».
    return <Resumen ok={false} titulo="Política de contenido (CSP)" descripcion="No se pudo leer el estado de la CSP. Recarga la pantalla." />
  }
  if (!d) return <Resumen ok titulo="Política de contenido (CSP)" descripcion="Consultando…" />

  const enforce = d.modo === 'enforce'
  return (
    <div>
      <Resumen
        ok={enforce || !!d.veredicto?.listo}
        titulo={`Política de contenido (CSP) — ${enforce ? 'bloqueando' : 'sólo observando'}`}
        descripcion={enforce
          ? 'La política está en modo bloqueo: lo que no esté permitido no se carga.'
          : (d.veredicto?.motivo ?? '')}
      />
      {!enforce && d.hayDatos && (d.top?.length ?? 0) > 0 && (
        <div style={{ marginTop: 8, padding: '10px 13px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
            Lo que la política bloquearía hoy ({d.violaciones7d} en los últimos 7 días)
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
            {d.top!.map(t => <li key={t.que}>{t.que} — {t.veces}×</li>)}
          </ul>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
            Arregla esto antes de bloquear: si pasas a modo bloqueo con violaciones vivas,
            se rompe justo eso — y con un paciente enfrente. Cuando el veredicto diga que sí,
            se activa poniendo <strong>CSP_MODE=enforce</strong> en Vercel.
          </div>
        </div>
      )}
    </div>
  )
}
