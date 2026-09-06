'use client'
/**
 * LA BANDEJA QUE NADIE ABRÍA — REG-256.
 *
 * ── LO QUE PASABA ───────────────────────────────────────────────────────────
 *
 * `crearAlerta()` guarda cada alerta del episodio en `hospital_alertas`: valor
 * de laboratorio crítico, NEWS2, interconsulta, resultado listo. La colección
 * **existe**, tiene sus reglas de Firestore, está en la lista de respaldos y en
 * la matriz de acceso.
 *
 * Y **ninguna pantalla la leía**. `getAlertas()` y `marcarAlertaLeida()`
 * estaban escritas, y sin un solo llamador en todo el repositorio.
 *
 * Traducido: el potasio de 7.2 se marca crítico, se escribe la alerta, y va a
 * parar a un cajón que no tiene tirador.
 *
 * ── LO QUE SÍ FUNCIONABA, PARA NO EXAGERAR ──────────────────────────────────
 *
 * El envío por WhatsApp sí corría, y el propio código ya avisaba cuando no
 * salía. Pero WhatsApp es un canal que se pierde: se lee en el pasillo, se
 * olvida, o el teléfono no está registrado —que es el estado por defecto de una
 * clínica recién configurada—. **La alerta en la ficha del paciente es la que
 * sigue ahí mañana.**
 *
 * ── POR QUÉ SE MARCAN LEÍDAS A MANO Y NO AL VERLAS ──────────────────────────
 *
 * Marcar leído por el hecho de que la lista aparezca en pantalla convierte el
 * estado en ruido: se «leen» solas al abrir la ficha por cualquier otro motivo.
 * Aquí hay que pulsar. Es un clic, y es el que distingue «lo vi» de «pasó por
 * delante».
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Bell } from 'lucide-react'
import type { AlertaHospital } from '@/lib/hospital/firestore'
import { NoSePudoLeer } from '@/components/ui/NoSePudoLeer'
import { fechaConHora } from '@/lib/formato/fecha'

export interface AlertasDelEpisodioProps {
  clinicId: string
  internamientoId: string
  /** Se inyectan para poder probar el componente sin Firestore. */
  cargar: (clinicId: string, soloNoLeidas?: boolean) => Promise<AlertaHospital[]>
  marcarLeida: (clinicId: string, id: string) => Promise<void>
}

const COLOR: Record<AlertaHospital['tipo'], string> = {
  lab_critico: 'var(--red)',
  news2: 'var(--amber)',
  interconsulta: 'var(--nexus)',
  resultado: 'var(--text3)',
}

export function AlertasDelEpisodio(p: AlertasDelEpisodioProps) {
  const [alertas, setAlertas] = useState<AlertaHospital[] | null>(null)
  const [marcando, setMarcando] = useState<string | null>(null)
  /**
   * EL FALLO DE LECTURA ES UN ESTADO PROPIO — Panel de Lujo ZC-001.
   *
   * `alertas === null` significaba dos cosas incompatibles: «todavía no llegan»
   * y «no se pudieron leer». Las dos terminaban en `return null`, así que un
   * potasio de 7.2 escrito en la colección desaparecía de la pantalla igual que
   * si el episodio no tuviera ninguna alerta — que es exactamente la mentira que
   * este componente nació para reparar, cometida un piso más abajo.
   */
  const [falloAlLeer, setFalloAlLeer] = useState<unknown>(undefined)
  const [intento, setIntento] = useState(0)

  const { clinicId, internamientoId, cargar } = p
  const reintentar = useCallback(() => { setFalloAlLeer(undefined); setIntento(n => n + 1) }, [])

  /**
   * Las dependencias son los VALORES, no el objeto de props.
   *
   * Con `[p]` el efecto se volvía a disparar en cada render —el objeto es
   * nuevo cada vez— y encadenaba lecturas de Firestore sin que nada hubiera
   * cambiado. Lo marcó el compilador de React, y tenía razón: una bandeja de
   * alertas que relee sola en bucle es un coste por consulta.
   */
  useEffect(() => {
    if (!clinicId || !internamientoId) return
    let vivo = true
    cargar(clinicId, false)
      /* Sólo las de ESTE episodio: la colección es de toda la clínica. */
      .then(todas => { if (vivo) { setAlertas(todas.filter(a => a.internamientoId === internamientoId)); setFalloAlLeer(undefined) } })
      /* Sin lectura no se finge una bandeja vacía: el fallo se GUARDA y se
         PINTA. Enseñar «0 alertas» cuando la consulta falló sería exactamente
         la mentira que este componente repara. */
      .catch((e: unknown) => { if (vivo) { setAlertas(null); setFalloAlLeer(e ?? new Error('lectura fallida')) } })
    return () => { vivo = false }
  }, [clinicId, internamientoId, cargar, intento])

  const marcar = async (id?: string) => {
    if (!id) return
    setMarcando(id)
    try {
      await p.marcarLeida(clinicId, id)
      setAlertas(prev => prev?.map(a => (a.id === id ? { ...a, leida: true } : a)) ?? null)
    } catch { /* Si no se pudo marcar, se queda sin marcar: no se finge. */ }
    finally { setMarcando(null) }
  }

  /* Si NO se pudo leer, se dice — antes de cualquier «no hay nada». */
  if (falloAlLeer !== undefined) {
    return <NoSePudoLeer que="las alertas de este paciente" error={falloAlLeer} alReintentar={reintentar} />
  }

  /* Sin alertas de este episodio no se enseña un recuadro vacío. */
  if (!alertas || alertas.length === 0) return null

  const sinLeer = alertas.filter(a => !a.leida)

  return (
    <section style={{
      border: `1px solid ${sinLeer.length ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 11, background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Bell size={15} style={{ color: sinLeer.length ? 'var(--red)' : 'var(--text3)' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Alertas de este paciente
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text3)' }}>
          {sinLeer.length
            ? `${sinLeer.length} sin leer`
            : `${alertas.length} · todas leídas`}
        </span>
      </header>

      <div style={{ padding: 6 }}>
        {[...sinLeer, ...alertas.filter(a => a.leida)].map(a => (
          <div
            key={a.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 8px', opacity: a.leida ? 0.5 : 1,
            }}
          >
            <AlertTriangle size={15} style={{ color: COLOR[a.tipo] ?? 'var(--text3)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: a.leida ? 400 : 600, color: 'var(--text)' }}>
                {a.titulo}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>
                {a.detalle}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text3)' }}>
                {fechaConHora(a.fecha)}
                {a.destinatarioNombre ? ` · para ${a.destinatarioNombre}` : ''}
                {/* Que el WhatsApp NO saliera es información, no un detalle. */}
                {a.whatsappEnviado === false ? ' · no se envió por WhatsApp' : ''}
              </p>
            </div>

            {!a.leida && (
              <button
                onClick={() => marcar(a.id)}
                disabled={marcando === a.id}
                aria-label={`Marcar como vista: ${a.titulo}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 'var(--r-pill)', flexShrink: 0,
                  background: 'var(--s3)', color: 'var(--text)',
                  border: '1px solid var(--border)', font: 'inherit', fontSize: 12,
                  cursor: marcando === a.id ? 'wait' : 'pointer',
                }}
              >
                <Check size={12} /> La vi
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export const POR_QUE_EXISTE =
  'crearAlerta() escribía en hospital_alertas y NINGUNA pantalla la leía. El ' +
  'potasio de 7.2 se marcaba crítico, se guardaba la alerta, y caía en un cajón ' +
  'sin tirador.'

export const POR_QUE_NO_SE_MARCAN_SOLAS =
  'Marcar leído porque la lista aparezca en pantalla convierte el estado en ' +
  'ruido: se «leen» solas al abrir la ficha por cualquier otro motivo. Un clic ' +
  'distingue «lo vi» de «pasó por delante».'

export const POR_QUE_NULL_NO_ES_CERO =
  'Si la consulta falla se dice, no se enseña «0 alertas». Fingir una bandeja ' +
  'vacía sería la misma mentira que este componente repara. Y «se dice» quiere ' +
  'decir en pantalla: hasta el Panel de Lujo (ZC-001) el fallo y el vacío ' +
  'compartían el mismo `return null`, así que no se decía en ninguna parte.'
