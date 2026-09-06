'use client'
import { useState, useEffect, useMemo } from 'react'
import { PageHeader, Button, Spinner, EmptyState } from '@/components/ui'
import { AgendaVacia } from '@/components/brand/EmptyArt'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { listarPacientesCompat, getAppointments, TECHO_COMPAT_PACIENTES } from '@/lib/firestore'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Patient, Appointment } from '@/types'
import { pacientesParaReactivar, desgloseDeReactivacion, msgReactivacion, msgReferido, msgSeguimiento, diasEntre, type CandidatoReactivacion } from '@/lib/reactivacion'
import { describirVacioDeUnaLista, type RestriccionDeLista } from '@/lib/ui/vacio-de-una-lista'
import { openWhatsApp, copyToClipboard } from '@/lib/whatsapp'
import { normalizarTelefonoWa } from '@/lib/whatsapp/telefono'
import { puedeContactar, type LecturasPrevias } from '@/lib/whatsapp/puede-contactar'
import { MessageSquare, Copy, Share2, HeartHandshake, Clock, Stethoscope, AlertTriangle } from 'lucide-react'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const UMBRALES = [
  { dias: 90, label: '3 meses' },
  { dias: 180, label: '6 meses' },
  { dias: 365, label: '1 año' },
]

export default function ReactivacionPage() {
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const { toast } = useToast()
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [listaTruncada, setListaTruncada] = useState(false)
  const [seguimiento, setSeguimiento] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [umbral, setUmbral] = useState(90)
  // Exclusiones: quien pidió BAJA (opt-out) y quien YA tiene cita futura.
  const [optOut, setOptOut] = useState<Set<string>>(new Set())
  /** Qué se pudo leer antes de ofrecer un contacto. Ver `puedeContactar`. */
  const [lecturas, setLecturas] = useState<LecturasPrevias>({ bajasLeidas: true, futurasLeidas: true })
  const [conCitaFutura, setConCitaFutura] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!clinicId) return
    // Atendidas de los últimos 10 días → candidatas a seguimiento posconsulta.
    const desde = (() => { const d = new Date(); d.setDate(d.getDate() - 10); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    const hoyStr = hoyISO()
    let falloFuturas = false
    Promise.all([
      listarPacientesCompat(clinicId),
      getAppointments(clinicId, { desde: desde + ' 00:00' }),
      // Bajas de WhatsApp: NO reactivar a quien pidió BAJA (cumplimiento).
      getDocs(collection(db, 'clinics', clinicId, 'whatsapp_optout')).catch(() => null),   // null = NO SE PUDO LEER (≠ nadie de baja)
      // Citas FUTURAS: no ofrecer "¿desea agendar?" a quien ya tiene lugar reservado.
      getAppointments(clinicId, { desde: hoyStr + ' 00:00' })
        .catch(() => { falloFuturas = true; return [] as Appointment[] }),
    ]).then(([ps, cits, optSnap, futuras]) => {
      setPacientes(ps.pacientes)
      /**
       * REG-351 — a quién se reactiva sale de una lista con techo (REG-341).
       * Un desglose que dice «12 pacientes por reactivar» de un consultorio con
       * más, y una lista que se lee como «éstos son todos», dejan fuera a gente
       * de forma invisible: la campaña se da por hecha con parte del trabajo sin
       * hacer, y nadie vuelve a mirar.
       */
      setListaTruncada(ps.truncada)
      /**
       * UN FALLO DE LECTURA NO ES «NADIE SE DIO DE BAJA».
       *
       * `catch(() => null)` producía el MISMO conjunto vacío que un consultorio
       * donde nadie pidió la baja, y con él la pantalla ofrecía «WhatsApp» sobre
       * toda la base — incluida la gente que pidió expresamente que no se le
       * escriba. Ver `lib/whatsapp/puede-contactar.ts`.
       */
      setLecturas({ bajasLeidas: optSnap !== null, futurasLeidas: !falloFuturas })
      // El id del doc de opt-out ya es el teléfono normalizado.
      const bajas = new Set((optSnap?.docs ?? []).map(d => d.id))
      setOptOut(bajas)
      const atendidas = cits.filter(c => c.estado === 'atendida' || c.estado === 'finalizada' || c.estado === 'pagada')
      // una por paciente (la más reciente), EXCLUYENDO a quien pidió BAJA.
      const porPac = new Map<string, Appointment>()
      for (const c of atendidas.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))) {
        const tel = normalizarTelefonoWa(c.pacienteTelefono || '')
        if (tel && bajas.has(tel)) continue
        if (!porPac.has(c.pacienteId)) porPac.set(c.pacienteId, c)
      }
      setSeguimiento(Array.from(porPac.values()))
      // Solo citas realmente por venir y aún vigentes (no canceladas/atendidas).
      const activasFuturas = ['solicitada', 'pendiente-confirmar', 'confirmada', 'recordatorio-enviado']
      setConCitaFutura(new Set(
        (futuras as Appointment[])
          .filter(c => activasFuturas.includes(c.estado))
          .map(c => c.pacienteId),
      ))
    }).finally(() => setLoading(false))
  }, [clinicId])

  /*
    UN SOLO «hoy» PARA TODA LA PANTALLA. Estaba declarado más abajo, junto al
    seguimiento posconsulta; subirlo evita que el desglose, la lista y las filas
    puedan calcularse contra dos días distintos si el render cruza la
    medianoche — y evita repetir la llamada, que es lo que cuenta el escáner de
    zona horaria (`timezone-sitios`).
  */
  const hoy = hoyISO()

  /**
   * RTC-30 — LA LISTA VACÍA TIENE CINCO CAUSAS Y ANTES SÓLO DECÍA UNA.
   *
   * `desgloseDeReactivacion` devuelve los candidatos que se enseñan Y el
   * recuento de todo lo que queda fuera. La razón de exclusión se parte en dos
   * —baja y cita futura— porque no se dicen igual: una es un límite y la otra
   * es una buena noticia. El booleano que consume el núcleo sigue siendo el
   * mismo de siempre (`!!razón`), así que a quién se contacta no cambia.
   */
  const desglose = useMemo(
    () => desgloseDeReactivacion(pacientes, hoy, umbral, UMBRALES[0].dias, (p) => {
      const tel = normalizarTelefonoWa(p.whatsapp || p.telefono || '')
      if (tel && optOut.has(tel)) return 'baja'
      if (conCitaFutura.has(p.id)) return 'cita-futura'
      return null
    }),
    [pacientes, umbral, optOut, conCitaFutura, hoy],
  )
  const candidatos = desglose.candidatos

  /**
   * El gesto sale de la CAUSA: bajar la píldora al umbral más bajo que de
   * verdad enseña a alguien. Ofrecer «+3 meses» cuando tampoco hay nadie a 3
   * meses sería mandar al médico a otra pantalla vacía.
   */
  const umbralQueEnseña = useMemo(() => {
    if (desglose.bajoElUmbral === 0) return null
    const razon = (p: Patient) => {
      const tel = normalizarTelefonoWa(p.whatsapp || p.telefono || '')
      return (!!tel && optOut.has(tel)) || conCitaFutura.has(p.id)
    }
    return UMBRALES.find(u => u.dias < umbral && pacientesParaReactivar(pacientes, hoy, u.dias, razon).length > 0) ?? null
  }, [desglose.bajoElUmbral, pacientes, umbral, optOut, conCitaFutura, hoy])

  /**
   * El estado vacío, decidido fuera de la pantalla (`describirVacioDeUnaLista`,
   * la regla RTC-30 escrita una sola vez). Aquí sólo se le dan las frases que
   * un módulo general no puede saber y se pinta lo que devuelve.
   */
  const vacio = useMemo(() => {
    const r: RestriccionDeLista[] = []
    if (desglose.bajoElUmbral > 0) r.push({
      id: 'umbral',
      frase: `${desglose.bajoElUmbral} ${desglose.bajoElUmbral === 1 ? 'lleva' : 'llevan'} menos de ${UMBRALES.find(u => u.dias === umbral)?.label ?? `${umbral} días`}`,
      gesto: umbralQueEnseña ? `Ver +${umbralQueEnseña.label}` : null,
    })
    if (desglose.conCitaFutura > 0) r.push({
      id: 'cita-futura', gesto: null,
      frase: `${desglose.conCitaFutura} ya ${desglose.conCitaFutura === 1 ? 'tiene' : 'tienen'} cita agendada`,
    })
    if (desglose.conBaja > 0) r.push({
      id: 'baja', gesto: null,
      frase: `${desglose.conBaja} ${desglose.conBaja === 1 ? 'pidió' : 'pidieron'} no recibir mensajes`,
    })
    if (desglose.bloqueoArco > 0) r.push({
      id: 'arco', gesto: null,
      frase: `${desglose.bloqueoArco} ${desglose.bloqueoArco === 1 ? 'ejerció' : 'ejercieron'} su derecho ARCO`,
    })
    /*
      SIN TELÉFONO NO ES «BIEN SEGUIDO». Es el caso que más se parecía a un
      éxito y menos lo era: un paciente que lleva dos años sin volver y no
      tiene un número al que escribir era invisible aquí, y su ausencia se leía
      como buen seguimiento. Ahora se dice, y se dice dónde se arregla.
    */
    if (desglose.sinTelefono > 0) r.push({
      id: 'sin-telefono', gesto: null,
      frase: `${desglose.sinTelefono} no ${desglose.sinTelefono === 1 ? 'tiene teléfono' : 'tienen teléfono'} registrado`,
    })
    return describirVacioDeUnaLista({
      total: desglose.total,
      sustantivo: ['paciente', 'pacientes'],
      restricciones: r,
      registroVacio: {
        titulo: 'Nadie pendiente de reactivar',
        // La felicitación se queda, pero SÓLO aquí: es el único caso en que es
        // verdad que nadie lleva más de tres meses sin volver.
        descripcion: `Ningún paciente lleva más de ${UMBRALES[0].label} sin volver. ¡Buen seguimiento!`,
      },
    })
  }, [desglose, umbral, umbralQueEnseña])

  const nombreMedico = config?.nombreMedico || undefined
  const urlReserva = typeof window !== 'undefined' && clinicId
    ? `${window.location.origin}/reservar/${clinicId}` : ''

  // Un solo veredicto para toda la pantalla: si no se sabe quién pidió la baja,
  // no se ofrece ningún contacto.
  const veredicto = puedeContactar(lecturas)

  const contactar = (c: CandidatoReactivacion) => {
    if (!veredicto.sePuede) { toast(veredicto.motivo, 'error'); return }
    const tel = c.paciente.whatsapp || c.paciente.telefono
    openWhatsApp(tel, msgReactivacion(c.paciente.nombre, nombreMedico))
  }
  const copiar = async (c: CandidatoReactivacion) => {
    try { await copyToClipboard(msgReactivacion(c.paciente.nombre, nombreMedico)); toast('Mensaje copiado', 'success') }
    catch { toast('No se pudo copiar', 'error') }
  }

  const seguir = (c: Appointment) => {
    if (!veredicto.sePuede) { toast(veredicto.motivo, 'error'); return }
    const p = pacientes.find(x => x.id === c.pacienteId)
    const tel = p?.whatsapp || p?.telefono || c.pacienteTelefono
    openWhatsApp(tel, msgSeguimiento(c.pacienteNombre, nombreMedico))
  }

  const compartirReferido = () => {
    if (!urlReserva) return
    openWhatsApp('', msgReferido(nombreMedico, urlReserva))
  }
  const copiarReferido = async () => {
    try { await copyToClipboard(urlReserva); toast('Enlace copiado', 'success') }
    catch { toast('No se pudo copiar', 'error') }
  }

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      <PageHeader
        title="Reactivación y referidos"
        subtitle="Tu base de pacientes es tu mejor activo. Recupera a quien no ha vuelto y facilita que te recomienden."
      />

      {/**
        * REG-351 — la campaña sale de una lista con techo. Una lista de
        * reactivación que se lee como «éstos son todos» deja gente fuera de
        * forma invisible: se da la campaña por hecha con parte sin hacer.
        */}
      {listaTruncada && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 14, padding: '13px 15px', marginBottom: 16 }}>
          <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
            Se revisaron los primeros <strong>{TECHO_COMPAT_PACIENTES}</strong> pacientes.
            Hay más en tu consultorio que <strong>esta pantalla no ha mirado</strong>: la lista de abajo no está completa.
          </div>
        </div>
      )}

      {veredicto.motivo && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 12, padding: '13px 15px', marginBottom: 16 }}>
          <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{veredicto.motivo}</div>
        </div>
      )}

      {/* Referidos */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--nexus-soft)', display: 'grid', placeItems: 'center', color: 'var(--nexus)', flexShrink: 0 }}>
            <HeartHandshake size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Pide un referido</div>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', margin: '4px 0 14px', lineHeight: 1.5 }}>
              Comparte tu enlace de reserva en línea. Tus pacientes lo reenvían a quien confían y agendan solos.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={compartirReferido} disabled={!urlReserva} icon={<Share2 size={16} />}>Compartir por WhatsApp</Button>
              <Button variant="secondary" onClick={copiarReferido} disabled={!urlReserva} icon={<Copy size={16} />}>Copiar enlace</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Seguimiento posconsulta */}
      {!loading && seguimiento.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 20 }}>
          <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={16} style={{ color: 'var(--nexus)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Seguimiento posconsulta</span>
            <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>· atendidos hace ≤10 días</span>
          </div>
          {seguimiento.slice(0, 30).map((c, i) => {
            const dias = diasEntre(c.fechaHora.slice(0, 10), hoy)
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                borderTop: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.pacienteNombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{dias === 0 ? 'Hoy' : `Hace ${dias} día${dias !== 1 ? 's' : ''}`}</div>
                </div>
                <Button variant="secondary" onClick={() => seguir(c)} disabled={!veredicto.sePuede} icon={<MessageSquare size={15} />}>Seguimiento</Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Reactivación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
          Pacientes sin volver {candidatos.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {candidatos.length}</span>}
        </div>
        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: 4 }}>
          {UMBRALES.map(u => (
            <button key={u.dias} onClick={() => setUmbral(u.dias)}
              className="nx-chip nx-chip--relleno"
              aria-pressed={umbral === u.dias}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)', padding: '6px 14px', fontSize: 12.5, fontWeight: 700,
                // El relleno de la activa —`--nexus-solido` con blanco encima,
                // «5.16 : 1 ✓ AA»; con `--nexus` daba 2.93 : 1, lo cazó axe a
                // 390px— vive ahora en `.nx-chip--relleno`, en la hoja, porque
                // desde el estilo en línea no había forma de darle `:hover`.
                color: umbral === u.dias ? '#fff' : 'var(--text3)',
              }}>
              +{u.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Spinner center label="Cargando pacientes…" />
        ) : candidatos.length === 0 ? (
          <EmptyState
            variante={vacio.variante}
            illustration={vacio.variante === 'hero' ? <AgendaVacia /> : undefined}
            title={vacio.titulo}
            description={vacio.descripcion}
            action={vacio.gestos[0]
              ? <Button variant="ghost" size="sm" icon={<Clock size={14} />} onClick={() => { if (umbralQueEnseña) setUmbral(umbralQueEnseña.dias) }}>{vacio.gestos[0].etiqueta}</Button>
              : undefined}
          />
        ) : (
          candidatos.map((c, i) => (
            <div key={c.paciente.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: i === candidatos.length - 1 ? 'none' : '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.paciente.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={11} />
                  {c.tuvoCita
                    ? `Última visita hace ${Math.floor(c.dias / 30)} mes${Math.floor(c.dias / 30) !== 1 ? 'es' : ''}`
                    : 'Nunca ha vuelto tras darse de alta'}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" title="Copiar mensaje" onClick={() => copiar(c)}>
                <Copy size={15} />
              </button>
              <Button variant="secondary" onClick={() => contactar(c)} disabled={!veredicto.sePuede} icon={<MessageSquare size={15} />}>WhatsApp</Button>
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14, lineHeight: 1.5 }}>
        Los mensajes se abren en WhatsApp con el texto listo — tú revisas y envías. Nada se manda automáticamente.
      </p>
    </div>
  )
}
