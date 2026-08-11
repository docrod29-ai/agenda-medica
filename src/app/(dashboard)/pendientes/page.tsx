'use client'
/**
 * EL WORKLIST: todo lo que quedó abierto, en un solo sitio.
 *
 * La pantalla existe porque el pendiente no tenía dónde reclamarse. Estaba en
 * una frase dentro de una nota firmada, y una nota firmada es un documento al
 * que nadie vuelve.
 *
 * Dos decisiones de diseño que no son estéticas:
 *
 *  · **Lo que hay que escalar va arriba y aparte.** Si un resultado crítico sin
 *    dueño se dibuja igual que un seguimiento de rutina, la lista deja de
 *    ordenar y hay que leerla entera — que es como no tenerla.
 *
 *  · **«Completada» no saca la tarea de la lista.** Sale al CERRARLA, que es
 *    cuando alguien dice que la miró. Entre «el laboratorio está hecho» y
 *    «alguien leyó el resultado» vive exactamente el daño que esto evita.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader, Button, EmptyState, Spinner, Modal, Textarea } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useClinic } from '@/context/ClinicContext'
import { auth } from '@/lib/firebase'
import { tareasVivas, cambiarEstado } from '@/lib/tareas-clinicas/firestore'
import { ordenWorklist, debeEscalar, estaVencida, type TareaClinica, type EstadoTarea } from '@/lib/tareas-clinicas/modelo'
import { esTareaDeResultado } from '@/lib/tareas-clinicas/progreso-resultado'
import { estadoDeAccion, ORDEN_ESTADO_DE_ACCION, ETIQUETA_ESTADO_DE_ACCION, type EstadoDeAccion } from '@/lib/tareas-clinicas/estado-de-accion'
import { ProgresoResultado } from '@/components/tareas/ProgresoResultado'
import { AlertTriangle, CheckCircle2, Clock, User, X, ClipboardList } from 'lucide-react'

const ETIQUETA_TIPO: Record<string, string> = {
  estudio_pendiente: 'Estudio',
  resultado_por_revisar: 'Resultado',
  seguimiento: 'Seguimiento',
  receta_por_entregar: 'Receta',
  indicacion_paciente: 'Indicación',
  reconciliacion_medicamento: 'Reconciliar',
  otra: 'Pendiente',
}

/** Qué botón toca ahora. Enseñar los seis estados sería enseñar el modelo, no el trabajo. */
function siguientePaso(t: TareaClinica): { estado: EstadoTarea; texto: string } | null {
  if (t.estado === 'solicitada' || t.estado === 'aceptada') return { estado: 'en_curso', texto: 'Tomarla' }
  if (t.estado === 'en_curso') return { estado: 'completada', texto: 'Ya se hizo' }
  if (t.estado === 'completada') return { estado: 'cerrada', texto: 'Lo revisé — cerrar' }
  return null
}

function fechaCorta(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''
}

export default function PendientesPage() {
  const { toast } = useToast()
  const { clinicId } = useClinic()
  const [tareas, setTareas] = useState<TareaClinica[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [cancelando, setCancelando] = useState<TareaClinica | null>(null)
  const [motivo, setMotivo] = useState('')
  const [soloMias, setSoloMias] = useState(false)
  const [recarga, setRecarga] = useState(0)
  /**
   * El «ahora» con el que se decide qué está vencido se fija AL CARGAR, no en
   * cada render. Leer el reloj mientras se pinta hace que dos renders del mismo
   * segundo puedan discrepar sobre si una tarea venció — y una tarjeta que salta
   * sola entre «vence» y «venció» es exactamente la clase de detalle por la que
   * se deja de creer en una lista.
   */
  const [ahora, setAhora] = useState(0)

  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    tareasVivas(clinicId)
      .then(t => { if (vivo) { setTareas(t); setErrorCarga(''); setAhora(Date.now()) } })
      .catch(e => {
        // Un fallo de lectura NO puede verse igual que «no hay pendientes»:
        // en esta pantalla eso se lee como «todo está al día», que es la
        // conclusión más peligrosa posible aquí.
        //
        // Y se REGISTRA la causa: al abrir esta pantalla por primera vez en
        // producción salió el error genérico y la consola estaba muda, porque
        // este catch se tragaba el motivo. Diagnosticar a ciegas costó más que
        // escribir esta línea.
        console.error('[pendientes] no se pudo leer el worklist', e)
        if (vivo) setErrorCarga('No se pudieron cargar los pendientes. Revisa tu conexión y reintenta.')
      })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [clinicId, recarga])

  const visibles = useMemo(() => {
    const base = soloMias ? tareas.filter(t => t.ownerUid === uid) : tareas
    return [...base].sort((a, b) => ordenWorklist(a, b, ahora))
  }, [tareas, soloMias, uid, ahora])

  const urgentes = visibles.filter(t => debeEscalar(t, ahora).escalar)
  const resto = visibles.filter(t => !debeEscalar(t, ahora).escalar)

  /**
   * V15-FOLLOWUP-WORK-001 (Fase 7, §10): «group by action state, not by
   * arbitrary module». `resto` ya no se pinta como una sola lista «Abiertos»:
   * se reparte por lo que cada tarea está ESPERANDO — mismo criterio que ya
   * usa `debeEscalar` para «urgentes», sólo que aquí no hay urgencia, hay
   * un porqué distinto. Ninguna tarea vencida llega aquí (`debeEscalar` ya
   * las captura arriba), así que el grupo `vencida` de `estadoDeAccion`
   * nunca aparece en `gruposResto` — comprobado en el guardián de esta
   * pantalla, no sólo supuesto.
   */
  const gruposResto = useMemo(() => {
    const acc = {} as Record<EstadoDeAccion, TareaClinica[]>
    for (const t of resto) {
      const cat = estadoDeAccion(t, ahora)
      ;(acc[cat] ??= []).push(t)
    }
    return acc
  }, [resto, ahora])

  const mover = useCallback(async (t: TareaClinica, nuevo: EstadoTarea, motivoCancelacion?: string) => {
    if (!clinicId) return
    const r = await cambiarEstado(clinicId, t, nuevo, { motivoCancelacion })
    if (!r.ok) { toast(r.motivo, 'error'); return }
    toast(nuevo === 'cerrada' ? 'Cerrada' : 'Actualizada', 'success')
    setRecarga(n => n + 1)
  }, [clinicId, toast])

  /*
    LOS TOKENS SON LOS DE ESTA APP, NO LOS GENÉRICOS.
    La primera versión usaba --danger, --primary, --warning y --text-muted, que
    NO existen aquí: en el navegador real las tarjetas salían con colores
    inválidos —texto sin color propio y urgencia invisible— y ninguna prueba lo
    veía, porque ningún test resuelve variables CSS. Los de verdad son --red,
    --teal, --amber y --text3.
  */
  const Tarjeta = ({ t }: { t: TareaClinica }) => {
    const esc = debeEscalar(t, ahora)
    const vencida = estaVencida(t, ahora)
    const paso = siguientePaso(t)
    return (
      <div style={{
        border: `1px solid ${esc.escalar ? 'var(--red)' : 'var(--border)'}`,
        borderLeft: `4px solid ${t.prioridad === 'critica' ? 'var(--red)' : t.prioridad === 'alta' ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 10, padding: 14, background: 'var(--panel)', display: 'grid', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)' }}>
            {ETIQUETA_TIPO[t.tipo] ?? 'Pendiente'}
          </span>
          <strong style={{ color: 'var(--text)', fontSize: 15 }}>{t.titulo}</strong>
        </div>

        {/*
          §9 del master loop V15: un resultado es una cola de trabajo de ocho
          etapas, no una tabla estática. Sólo se pinta para los DOS tipos que
          de verdad son "un resultado" (estudio pedido / resultado por
          revisar) — un seguimiento o una receta no tienen esas etapas.
        */}
        {esTareaDeResultado(t.tipo) && (
          <ProgresoResultado estado={t.estado} ownerUid={t.ownerUid} prioridad={t.prioridad} />
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text3)' }}>
          {t.patientNombre && (
            <Link href={`/expediente/${t.patientId}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>
              {t.patientNombre}
            </Link>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <User size={13} /> {t.ownerNombre || 'sin dueño'}
          </span>
          {t.venceEn && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: vencida ? 'var(--red)' : undefined }}>
              <Clock size={13} /> {vencida ? 'venció' : 'vence'} {fechaCorta(t.venceEn)}
            </span>
          )}
        </div>

        {t.detalle && <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>{t.detalle}</p>}

        {esc.escalar && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {esc.motivo}
          </p>
        )}

        {/*
          «Ya se hizo» y «lo revisé» son DOS botones a propósito. Fundirlos en uno
          dejaría cerrar sin haber mirado el resultado, que es el fallo entero.
        */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {paso && (
            <Button size="sm" onClick={() => mover(t, paso.estado)}>
              {paso.estado === 'cerrada' ? <CheckCircle2 size={14} /> : null} {paso.texto}
            </Button>
          )}
          {t.estado === 'completada' && (
            <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
              Hecha, pero nadie la ha revisado todavía.
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setCancelando(t); setMotivo('') }}>
            <X size={14} /> Ya no aplica
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Pendientes"
        subtitle="Estudios pedidos, resultados sin revisar y recetas sin entregar. Salen solos al firmar la nota."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button size="sm" variant={soloMias ? 'primary' : 'ghost'} onClick={() => setSoloMias(v => !v)}>
          {soloMias ? 'Viendo sólo los míos' : 'Ver sólo los míos'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRecarga(n => n + 1)}>Actualizar</Button>
      </div>

      {cargando ? <Spinner /> : errorCarga ? (
        <div style={{ padding: 16, border: '1px solid var(--red)', borderRadius: 10, color: 'var(--red)' }}>
          {errorCarga}
        </div>
      ) : !visibles.length ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="Nada abierto"
          description="Cuando firmes una consulta con estudios o receta, sus pendientes aparecen aquí con fecha y dueño."
        />
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {urgentes.length > 0 && (
            <section style={{ display: 'grid', gap: 10 }}>
              <h2 style={{ fontSize: 14, margin: 0, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Requiere atención ({urgentes.length})
              </h2>
              {urgentes.map(t => <Tarjeta key={t.id} t={t} />)}
            </section>
          )}
          {ORDEN_ESTADO_DE_ACCION.filter(cat => cat !== 'vencida').map(cat => {
            const items = gruposResto[cat]
            if (!items?.length) return null
            return (
              <section key={cat} style={{ display: 'grid', gap: 10 }}>
                <h2 style={{ fontSize: 14, margin: 0, color: 'var(--text3)' }}>
                  {ETIQUETA_ESTADO_DE_ACCION[cat]} ({items.length})
                </h2>
                {items.map(t => <Tarjeta key={t.id} t={t} />)}
              </section>
            )
          })}
        </div>
      )}

      {/*
        Cancelar EXIGE motivo. Sin él, «ya no aplica» y «lo quité de la lista»
        son el mismo gesto, y el segundo es justo lo que hay que poder auditar.
      */}
      <Modal open={!!cancelando} onClose={() => setCancelando(null)} title="¿Por qué ya no aplica?">
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
            Queda constancia de quién lo canceló y por qué. Un pendiente cancelado no revive.
          </p>
          <Textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="El paciente ya trajo el resultado / se pidió por error / se resolvió en otra consulta…"
            rows={3}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCancelando(null)}>Volver</Button>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                const t = cancelando
                setCancelando(null)
                if (t) mover(t, 'cancelada', motivo.trim())
              }}
            >
              Cancelar el pendiente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
