'use client'
/**
 * PANEL DE UCI — vertical slice del ICU Hands-Free Note Engine (icu-005/013).
 *
 * El médico captura los valores (a mano o, más adelante, dictados) y VE cómo el
 * CÓDIGO calcula en vivo: ventilación (P/F, driving pressure, compliance),
 * gasometría (ácido-base), hemodinamia (PAM), SOFA — y las ALERTAS citadas, en un
 * panel SEPARADO de la nota. Ningún cálculo lo hace la IA. Si falta un dato, el
 * motor lo declara y no inventa. Gateado bajo el módulo de Expediente (consulta).
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import LandingUci from './LandingUci'
import ResumenPase from './ResumenPase'
import Verificacion from './Verificacion'
import MarPaciente from './MarPaciente'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, Wind, Droplets, HeartPulse, ShieldAlert, Info, Mic, Square, Waves, BedDouble, AlertTriangle, FileText, Calculator, Brain, Sparkles, ThumbsUp, ThumbsDown, ArrowLeft, FlaskConical } from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { auth } from '@/lib/firebase'
import { ofuscar, desofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'
import { EVENTO_GUARDAR_TODO } from '@/lib/salir-seguro'
import { useToast } from '@/context/ToastContext'
import { fetchAutenticado } from '@/lib/auth-client'
import type { FusionCopilot } from '@/lib/uci/copilot'
import { formatear, type FormatoNota } from '@/lib/uci/formato-nota'
import { resumen as resumenLabs, type LabMedido } from '@/lib/uci/labs-nota'
import { planDesdeCopilot } from '@/lib/uci/plan-desde-copilot'
import { ANALITOS, valorPlausible } from '@/lib/expediente/laboratorio/analitos'
import { PanelLaboratorios } from '@/components/laboratorio/PanelLaboratorios'
import { MOTORES, COPILOT_UCI_POR_MOTOR, type ClaveMotor } from '@/lib/planes-ia'
import { getInternamiento } from '@/lib/hospital/firestore'
import { getPatient } from '@/lib/firestore'
import { construirSeccionesUCI } from '@/lib/uci/nota'
import { guardarToma, getTomas, serieTomas } from '@/lib/uci/observaciones'
import { getEstanciaUci, guardarSoportesUci, fijarPesoDosificacion } from '@/lib/uci/estancia-cliente'
import { validarPeso, pesoParaCalcular, avisoSinPeso, validarTalla, tallaParaCalcular, TIPOS_PESO, ETIQUETA_TIPO_PESO, type PesoFijado, type TipoPesoDosificacion } from '@/lib/uci/peso-dosificacion'
import { SOPORTES_ACTIVOS, SOPORTE_LABEL, type SoporteActivo } from '@/types/hospital'
import { medirEstancia } from '@/lib/uci/estancia'
import { useConfig } from '@/hooks/useConfig'
import { especialidadesDelMedico } from '@/lib/asr/especialidad-del-medico'
import { leerAprendido } from '@/lib/asr/aprendizaje-firestore'
import { alergenosDe } from '@/lib/seguridad/alergias'
import type { Internamiento } from '@/types/hospital'
import type { Patient } from '@/types'
import { analizarVentilacion, esModoEspontaneo, esModoInvasivo } from '@/lib/uci/ventilacion'
import { analizarGasometria } from '@/lib/uci/gasometria'
import { cantidad, cantidadDesde } from '@/types/clinical-quantity'
import { presionArterialMedia } from '@/lib/uci/hemodinamia'
import { calcularSOFA } from '@/lib/uci/scores'
import { vexus, respuestaPLR, disfuncionVD_TAPSE, sobrecargaVD_VDVI, lineasB as lineasBPocus, type PatronVena, type ParametroPLR } from '@/lib/uci/pocus'
import { analizarCKRT, analizarCitrato, type ModalidadCKRT } from '@/lib/uci/ckrt'
import { analizarECMO, type ConfigECMO } from '@/lib/uci/ecmo'
import { CATALOGO_INFUSIONES, farmacoPorKey, dosisARate, rateADosis } from '@/lib/uci/infusiones'
import { analizarNeuro, type Pupilas } from '@/lib/uci/neuro'
import { aplanarLectura, compararLecturas, correlacionTemporal, resumenCambios, type Lectura } from '@/lib/uci/correlacion'
import { analizarSeguridadUCI, type NivelAlerta } from '@/lib/uci/seguridad'
import { FUENTES, citarFuente } from '@/lib/uci/evidencia'
import { extraerValoresUCIConAvisos, type AvisoExtraccionUCI } from '@/lib/uci/extraccion'
import { atribuirRolesDiscusion, formatearDiscusion } from '@/lib/uci/discusion'
import { useGrabacionAudio, type Utterance } from '@/hooks/useGrabacionAudio'
import { paraElMedico } from '@/lib/expediente/confianza-audio'
import { textosDeMotivos } from '@/lib/expediente/motivos-confirmacion-texto'
import { AlertasDictado } from '@/components/AlertasDictado'
import { CambiosCifrasPanel } from '@/components/CambiosCifrasPanel'
import { MOTIVO_SIN_DIARIZACION } from '@/lib/expediente/motivo-sin-diarizacion'
import { esMonologo } from '@/lib/asr/un-solo-hablante'
import { DosisMeropenem } from './DosisMeropenem'

type Campos = Record<string, string>

/**
 * LA JERARQUÍA ESTABA INVERTIDA, Y MEDIDA.
 *
 * Con los hex quemados, sobre el fondo real de esas filas (--s2) en tema oscuro:
 * crítica 3.50 · alta 5.31 · moderada 3.30 · informativa 5.21. O sea, el nivel
 * más peligroso era el SEGUNDO MENOS VISIBLE y el más inocuo el segundo más
 * visible. En un pase de visita con diez alertas en pantalla, lo que salta a la
 * vista es una nota informativa.
 *
 * Por token: los tres primeros ya están medidos AA en los dos temas.
 */
const colorNivel: Record<NivelAlerta, string> = {
  critica: 'var(--red)', alta: 'var(--amber)', moderada: 'var(--nexus)', informativa: 'var(--text3)',
}

function Campo({ label, k, v, set, sufijo, w }: { label: string; k: string; v: Campos; set: (k: string, val: string) => void; sufijo?: string; w?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--text3)', width: w ?? 92 }}>
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input value={v[k] ?? ''} onChange={e => set(k, e.target.value)} inputMode="decimal"
          style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }} />
        {sufijo && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sufijo}</span>}
      </span>
    </label>
  )
}

function Selector({ label, k, v, set, opciones, w }: { label: string; k: string; v: Campos; set: (k: string, val: string) => void; opciones: { val: string; txt: string }[]; w?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--text3)', width: w ?? 120 }}>
      {label}
      <select value={v[k] ?? ''} onChange={e => set(k, e.target.value)}
        style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }}>
        <option value="">—</option>
        {opciones.map(o => <option key={o.val} value={o.val}>{o.txt}</option>)}
      </select>
    </label>
  )
}

function Bloque({ icon: Icon, titulo, children }: { icon: typeof Wind; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
        <Icon size={16} style={{ color: 'var(--nexus)' }} /> {titulo}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{children}</div>
    </div>
  )
}

function Resultado({ label, r, ocultar }: { label: string; r: { ok: boolean; valor: number | null; unidad?: string; motivoBloqueo?: string | null; interpretacion?: string }; ocultar?: boolean }) {
  // En modo simple no se muestran los cálculos bloqueados (solo lo que se dictó).
  if (ocultar && !r.ok) return null
  return (
    <div style={{ padding: '8px 10px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: 'var(--text3)' }}>{label}</span>
        <strong style={{ color: r.ok ? 'var(--text)' : '#d97706' }}>{r.ok ? `${r.valor} ${r.unidad ?? ''}` : 'bloqueado'}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.ok ? r.interpretacion : r.motivoBloqueo}</div>
    </div>
  )
}

export default function UciPanelPage() {
  const [v, setV] = useState<Campos>({})
  const set = (k: string, val: string) => setV(prev => ({ ...prev, [k]: val }))
  const n = (k: string) => (v[k] === undefined || v[k] === '' ? undefined : v[k])

  // ── Paciente INGRESADO (si el panel se abrió desde un internamiento) ──
  const router = useRouter()
  const params = useSearchParams()
  const internamientoId = params.get('internamiento') || undefined
  // ICU-P2-6: sin paciente en la URL se muestra el LANDING (§3). El panel
  // suelto sigue disponible a un clic: se usaba como calculadora y quitarlo
  // seria retirar algo que ya funcionaba.
  const [panelLibre, setPanelLibre] = useState(false)
  // Decisión del Dr. (2026-07-30): dentro del paciente, el pase va antes que la
  // calculadora. El panel fisiológico NO se quita: es una pestaña más.
  const [pestana, setPestana] = useState<'resumen' | 'panel' | 'verificacion' | 'mar' | 'linea' | 'dosis'>('resumen')
  const { clinicId } = useClinic()
  const { toast } = useToast()
  const [inter, setInter] = useState<Internamiento | null>(null)
  const [paciente, setPaciente] = useState<Patient | null>(null)
  useEffect(() => {
    if (!clinicId || !internamientoId) { setInter(null); setPaciente(null); return }
    let vivo = true
    getInternamiento(clinicId, internamientoId).then(async i => {
      if (!vivo) return
      setInter(i)
      if (i) {
        // prefill sexo desde el expediente si no se ha capturado
        const p = await getPatient(clinicId, i.pacienteId).catch(() => null)
        if (!vivo) return
        setPaciente(p)
        if (p?.sexo) setV(prev => (prev.sexo ? prev : { ...prev, sexo: /^f/i.test(p.sexo!) ? 'F' : 'M' }))
      }
    }).catch(() => {})
    return () => { vivo = false }
  }, [clinicId, internamientoId])

  // ── ESTANCIA UCI: soportes activos (charter §32) ──
  //
  // Se DECLARAN, nunca se deducen de las mediciones: que haya una PEEP anotada no
  // prueba que el paciente siga ventilado — el ventilador pudo retirarse y la
  // última toma seguir ahí.
  const { config } = useConfig()
  const [soportes, setSoportes] = useState<SoporteActivo[] | null>(null)
  /**
   * EL PESO CON EL QUE SE DOSIFICA (charter §16).
   *
   * Estaba modelado en `ICUStay` con autor y fecha y no lo escribía nadie: cada
   * calculadora pedía el suyo, así que dos pantallas del mismo paciente podían
   * dosificar con pesos distintos sin que nadie se enterara.
   */
  const [pesoFijado, setPesoFijado] = useState<PesoFijado | null>(null)
  const [pesoBorrador, setPesoBorrador] = useState('')
  const [tipoPesoBorrador, setTipoPesoBorrador] = useState<TipoPesoDosificacion>('actual')
  const [fijandoPeso, setFijandoPeso] = useState(false)
  /** La talla de la estancia (charter §31): de ella salen PBW y VT/PBW. */
  const [tallaFijada, setTallaFijada] = useState<number | null>(null)
  const [tallaBorrador, setTallaBorrador] = useState('')
  const [guardandoSoportes, setGuardandoSoportes] = useState(false)
  const [ingresoUci, setIngresoUci] = useState<string | null>(null)
  useEffect(() => {
    if (!clinicId || !internamientoId) { setSoportes(null); setIngresoUci(null); return }
    let vivo = true
    getEstanciaUci(clinicId, internamientoId)
      .then(e => { if (vivo) { setSoportes((e?.soportes ?? []) as SoporteActivo[]); setIngresoUci(e?.fechaIngresoUci ?? null); setPesoFijado(e?.pesoDosificacion ?? null); setTallaFijada(e?.tallaCm ?? null) } })
      .catch(() => { if (vivo) setSoportes([]) })
    return () => { vivo = false }
  }, [clinicId, internamientoId])

  const alternarSoporte = async (sp: SoporteActivo) => {
    if (!clinicId || !internamientoId || soportes === null) return
    const siguiente = soportes.includes(sp) ? soportes.filter(x => x !== sp) : [...soportes, sp]
    const previo = soportes
    setSoportes(siguiente)                     // optimista: el pase de visita no espera
    setGuardandoSoportes(true)
    try {
      const e = await guardarSoportesUci(clinicId, internamientoId, siguiente, inter?.pacienteId)
      if (e?.fechaIngresoUci) setIngresoUci(e.fechaIngresoUci)
    } catch (err) {
      setSoportes(previo)                      // se revierte: no dejar la pantalla mintiendo
      toast(err instanceof Error ? err.message : 'No se pudieron guardar los soportes', 'error')
    } finally { setGuardandoSoportes(false) }
  }

  const estanciaUci = ingresoUci
    ? (() => { try { return medirEstancia({ admittedAt: ingresoUci, unitTimezone: config.zonaHoraria || 'America/Mexico_City' }, new Date().toISOString()) } catch { return null } })()
    : null

  /**
   * LAS ALERGIAS, CON EL PARSER DE TODOS Y NO CON UNO PROPIO.
   *
   * Aquí vivía un tercer `split` —sólo coma, punto y coma y salto de línea— con
   * su propia heurística de negación. El canónico entiende además la barra y la
   * «y» («Penicilina / Sulfas», «penicilina y sulfas» = DOS alérgenos), descarta
   * los fragmentos negados uno por uno en vez de mirar sólo si la lista tiene un
   * elemento, y lee `alergiasEstructuradas` cuando existen.
   *
   * El mismo campo no puede significar dos cosas según qué pantalla lo lea.
   */
  const alergias = (() => {
    const lista = alergenosDe(paciente ?? {})
    const negadas = lista.length === 0 && Boolean(String(paciente?.alergias ?? '').trim())
    return { lista, negadas }
  })()

  // ── Voz del pase de visita (multi-voz) → prellena el panel ──
  const audio = useGrabacionAudio()
  /**
   * EL EXPEDIENTE DEL PACIENTE TAMBIÉN SESGA EL MOTOR EN UCI.
   *
   * Hasta la v983 aquí sólo viajaban `recoveryKey` y `contexto`. O sea que el
   * paciente **con más fármacos activos de todo el hospital** dictaba su pase
   * con el sesgo genérico, mientras la consulta —donde hay tres fármacos— sí
   * mandaba los suyos.
   *
   * El sesgo es lo único que cambia lo que el motor OYE: ninguna etapa
   * posterior recupera un vasopresor que nunca llegó.
   */
  /**
   * Las palabras que el audio no oyó bien, también en el pase de visita.
   *
   * El dato ya llegaba —`utterances[].palabras`— y esta pantalla no lo miraba.
   */
  const palabrasDudosasPase = useMemo(() => paraElMedico(audio.utterances), [audio.utterances])
  /** El gate de ambigüedad, que hasta la v990 no salía del hook. */
  const motivosDictado = useMemo(() => textosDeMotivos(audio.motivosConfirmacion), [audio.motivosConfirmacion])

  /**
   * ── RECUPERACIÓN DE AUDIO EN UCI ────────────────────────────────────────────
   *
   * Los trozos del pase YA se guardaban en este dispositivo bajo la llave
   * `uci-panel.<id>` —el panel siempre pasó `recoveryKey`— y **ninguna pantalla
   * los leía**. Dos daños a la vez:
   *
   * 1. Un pase cuya transcripción falla se pierde entero, aunque el audio esté
   *    ahí. En consulta hay botones para reintentar, descargar y descartar desde
   *    hace versiones; en UCI, nada.
   * 2. Y esos trozos son PHI: la conversación de un paciente crítico quedaba
   *    huérfana en el dispositivo, **sin forma de borrarla desde la app**.
   */
  /**
   * LO QUE ESTE MÉDICO YA CORRIGIÓ A MANO, TAMBIÉN EN EL PASE (v1025).
   *
   * El aprendizaje se guarda **por consultorio** desde la v1024, así que aquí no
   * hace falta un paciente para leerlo: es el mismo médico, dictando las mismas
   * palabras, en la pantalla donde más fármacos hay. Sin esto, LEARN mejoraba la
   * consulta y dejaba la UCI exactamente igual que antes.
   */
  const [aprendidoUci, setAprendidoUci] = useState<string[]>([])
  useEffect(() => {
    if (!clinicId) return
    leerAprendido(clinicId)
      .then(l => setAprendidoUci(l.map(a => a.palabra)))
      .catch(() => {})   // es un extra: nunca puede estorbar al pase
  }, [clinicId])

  const [ofreceRecovery, setOfreceRecovery] = useState(false)
  const claveRecovery = `uci-panel${internamientoId ? '.' + internamientoId : ''}`
  useEffect(() => {
    audio.hayRecovery(claveRecovery).then(setOfreceRecovery).catch(() => {})
    // Sólo al abrir: preguntarlo en cada render sería leer IndexedDB sin motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRecovery])

  const opcionesDictadoUci = useMemo(() => ({
    recoveryKey: `uci-panel${internamientoId ? '.' + internamientoId : ''}`,
    contexto: 'uci' as const,
    /**
     * En UCI dicta SOLO, por aparatos y sistemas — lo contestó él. Pedir
     * separación de voces aquí es trabajo y espera para nada, y puede partir su
     * dictado en dos hablantes y atribuírselo a un paciente que no habló.
     */
    modoDeHabla: 'dictado' as const,
    medicamentos: (inter?.indicaciones ?? [])
      .map(i => String((i as { medicamento?: string; nombre?: string })?.medicamento
        ?? (i as { nombre?: string })?.nombre ?? '').trim())
      .filter(Boolean),
    problemas: [inter?.diagnosticoIngreso ?? ''].map(x => String(x).trim()).filter(Boolean),
    // Si el expediente NIEGA alergias, no hay alérgeno que sesgar.
    alergias: alergias.negadas ? [] : alergias.lista,
    /**
     * Y la especialidad del médico, que tampoco llegaba aquí.
     *
     * En UCI el módulo ya carga lo crítico —ventilación, aminas, sepsis, CKRT—,
     * pero no lo del intensivista que además es infectólogo o nefrólogo. Esto
     * sólo puede añadir: sin coincidencia devuelve vacío.
     */
    especialidades: especialidadesDelMedico(config?.especialidad),
    aprendidas: aprendidoUci,
  }), [internamientoId, inter?.indicaciones, inter?.diagnosticoIngreso, alergias.negadas, alergias.lista, config?.especialidad, aprendidoUci])
  const [discusionTxt, setDiscusionTxt] = useState('')
  const [detectados, setDetectados] = useState<string[]>([])
  const [avisosVoz, setAvisosVoz] = useState<AvisoExtraccionUCI[]>([])
  const [paseTexto, setPaseTexto] = useState('')       // cuadro de texto editable del pase
  const [modoAvanzado, setModoAvanzado] = useState(false) // false = simple (dictado + nota); true = grid de campos
  const [avisoPase, setAvisoPase] = useState('')       // confirmación tras "Generar nota"
  const procesadoRef = useRef('')

  /**
   * ── RESPALDO LOCAL DEL PASE ────────────────────────────────────────────────
   *
   * Este panel NO persistía NADA de lo dictado. Ni los campos, ni el texto del
   * pase, ni la discusión, ni los valores extraídos: todo vivía en `useState` y
   * salir de la ruta lo borraba.
   *
   * Y agravaba: tras una diarización exitosa se borra el audio crudo de
   * IndexedDB en cuanto el texto llega a la pantalla. Así que un pase de visita
   * de quince minutos, ya transcrito, desaparecía por completo con tocar
   * «Hospitalización» —un botón de esta misma pantalla— sin forma de
   * recuperarlo. En la consulta hay red de respaldo desde hace tiempo; aquí no
   * había ninguna.
   *
   * Se guarda con la misma ofuscación y el mismo prefijo (`nx.uci.`) que ya
   * reconoce la purga de PHI al cerrar sesión, así que el respaldo hereda esa
   * política sin inventar una nueva.
   */
  const claveRespaldo = `nx.uci.pase.${internamientoId ?? 'sin-paciente'}`
  const restauradoRef = useRef(false)

  useEffect(() => {
    if (restauradoRef.current) return
    restauradoRef.current = true
    // La LECTURA del disco va aquí (es un sistema externo); la aplicación del
    // estado se difiere para no encadenar renders dentro del efecto.
    let b: Record<string, unknown> | null = null
    try {
      const crudo = localStorage.getItem(claveRespaldo)
      if (!crudo) return
      b = JSON.parse(desofuscar(crudo, secretoLocal(auth.currentUser?.uid)) ?? crudo)
    } catch { /* respaldo ilegible: se sigue con la pantalla en blanco */ }
    if (!b || typeof b !== 'object') return
    const datos = b
    void Promise.resolve().then(() => {
      if (datos.v && typeof datos.v === 'object') setV(datos.v as Campos)
      if (typeof datos.paseTexto === 'string') setPaseTexto(datos.paseTexto)
      if (typeof datos.discusionTxt === 'string') setDiscusionTxt(datos.discusionTxt)
      if (Array.isArray(datos.detectados)) setDetectados(datos.detectados as string[])
    })
  }, [claveRespaldo])

  // Espejo para poder guardar desde el cleanup y desde el cierre de sesión sin
  // meter todo el estado en las dependencias.
  const vivoRef = useRef({ v, paseTexto, discusionTxt, detectados })
  useEffect(() => { vivoRef.current = { v, paseTexto, discusionTxt, detectados } })

  const guardarRespaldo = useCallback(() => {
    const e = vivoRef.current
    const hay = Object.values(e.v).some(x => String(x ?? '').trim()) || e.paseTexto.trim() || e.discusionTxt.trim()
    try {
      if (!hay) { localStorage.removeItem(claveRespaldo); return }
      localStorage.setItem(claveRespaldo, ofuscar(JSON.stringify({ ...e, ts: Date.now() }), secretoLocal(auth.currentUser?.uid)))
    } catch { /* almacenamiento lleno: no es crítico */ }
  }, [claveRespaldo])

  // Debounce mientras se trabaja.
  useEffect(() => {
    const id = setTimeout(guardarRespaldo, 1200)
    return () => clearTimeout(id)
  }, [v, paseTexto, discusionTxt, detectados, guardarRespaldo])

  // Al DESMONTAR (tocar «Hospitalización», el Sidebar, atrás…) y al cerrar la
  // pestaña: el debounce pendiente se pierde si no se fuerza aquí.
  useEffect(() => {
    const alSalir = () => guardarRespaldo()
    window.addEventListener('pagehide', alSalir)
    return () => { window.removeEventListener('pagehide', alSalir); guardarRespaldo() }
  }, [guardarRespaldo])

  /**
   * El cierre de sesión pide guardar a la pantalla activa. Este panel no
   * escuchaba, así que un cierre por inactividad se llevaba el pase sin
   * intentar siquiera salvarlo — y la purga de `nx.uci.*` lo remataba.
   */
  useEffect(() => {
    const alGuardarTodo = (ev: Event) => {
      guardarRespaldo()
      const d = (ev as CustomEvent<{ esperar?: (p: Promise<unknown>) => void }>).detail
      d?.esperar?.(Promise.resolve())
    }
    window.addEventListener(EVENTO_GUARDAR_TODO, alGuardarTodo)
    return () => window.removeEventListener(EVENTO_GUARDAR_TODO, alGuardarTodo)
  }, [guardarRespaldo])

  // Procesa el texto del pase (dictado o escrito): arma la discusión por roles y
  // extrae los valores hacia el panel/nota. Reutilizado por la voz y por el botón
  // "Generar nota" del cuadro de texto.
  const aplicarPase = (t: string, utterances?: Utterance[]) => {
    const txt = (t ?? '').trim()
    if (!txt) return
    /**
     * UN PASE DICTADO POR UNA SOLA PERSONA NO ES UNA DISCUSIÓN.
     *
     * El médico contestó que en UCI **dicta solo, por aparatos**. El diarizador
     * parte a una sola persona en dos hablantes cuando cambia el tono o hay una
     * pausa larga, y entonces `atribuirRolesDiscusion` reparte roles —adscrito,
     * residente, enfermería, paciente— entre trozos del MISMO dictado.
     *
     * Con un solo hablante hay un turno: el suyo. Igual que cuando no hay
     * diarización, que es el caso que la rama de abajo ya trataba bien.
     */
    const turnos = (utterances && utterances.length && !esMonologo(utterances))
      ? utterances.map(u => ({ hablante: u.speaker, texto: u.text }))
      : [{ hablante: 'A', texto: txt }]
    setDiscusionTxt(formatearDiscusion(atribuirRolesDiscusion(turnos)))
    const { valores: extraidos, avisos } = extraerValoresUCIConAvisos(txt)
    const n = Object.keys(extraidos).length
    if (n) {
      setV(prev => ({ ...prev, ...extraidos }))
      setDetectados(Object.keys(extraidos))
    }
    // icu-005: valores imposibles (error de dictado) o decimales ambiguos NO se
    // prellenan; se muestran para que el médico los redicte/confirme (no se inventan).
    setAvisosVoz(avisos)
    setAvisoPase(n
      ? `✓ ${n} valor${n === 1 ? '' : 'es'} reconocido${n === 1 ? '' : 's'} — la nota y los cálculos están abajo.`
      : 'No reconocí valores clínicos en el texto. Revisa la redacción (p. ej. «PEEP 10, FiO2 60, norepinefrina 0.2»).')
  }

  useEffect(() => {
    const t = audio.transcripcion?.trim()
    if (!t || t === procesadoRef.current) return
    procesadoRef.current = t
    setPaseTexto(t)                       // refleja el dictado en el cuadro editable
    aplicarPase(t, audio.utterances)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.transcripcion, audio.utterances])

  // SEGURIDAD: al cambiar de paciente (otra cama) se LIMPIA todo el panel. Sin esto,
  // los valores del paciente anterior (p. ej. plaquetas) quedaban pegados y
  // contaminaban el SOFA/alertas del siguiente si el pase no los volvía a mencionar.
  useEffect(() => {
    if (!internamientoId) return
    setV({})
    setDetectados([])
    setAvisosVoz([])
    setAvisoPase('')
    setPaseTexto('')
    setDiscusionTxt('')
    procesadoRef.current = ''
  }, [internamientoId])
  const grabando = audio.estado === 'grabando' || audio.estado === 'pausado'

  const vent = useMemo(() => analizarVentilacion({
    // La talla FIJADA de la estancia va por debajo de lo que se teclee aquí:
    // así el VT/PBW no cambia según qué pantalla se abrió (charter §31).
    sexo: v.sexo === 'F' ? 'F' : v.sexo === 'M' ? 'M' : undefined,
    tallaCm: n('talla') ?? tallaParaCalcular(tallaFijada) ?? undefined,
    vtMl: n('vt'),
    fio2: n('fio2'), fio2Unidad: '%', pplat: n('pplat'), peep: n('peep'), autoPeep: n('autoPeep'),
    esfuerzoEspontaneo: esModoEspontaneo(v.modo),
    pao2: n('pao2'), muestraGasometria: (v.muestra as 'arterial' | 'venosa' | 'capilar') || undefined,
  }), [v])
  const gaso = useMemo(() => analizarGasometria({
    ph: n('ph'),
    // E0-05 — FRONTERA: aquí el campo del formulario adquiere su unidad y ya no
    // la puede perder. `cantidadDesde` devuelve null igual que `num()` cuando el
    // campo está vacío: misma semántica de "faltante", cero cambios de número.
    paco2: cantidadDesde(n('paco2'), 'mmHg', 'presion'),
    hco3: cantidadDesde(n('hco3'), 'mEq/L', 'concentracion_equivalente'),
    na: cantidadDesde(n('na'), 'mEq/L', 'concentracion_equivalente'),
    cl: cantidadDesde(n('cl'), 'mEq/L', 'concentracion_equivalente'),
    albumina: cantidadDesde(n('alb'), 'g/dL', 'concentracion_masa'),
  }), [v])
  const pam = useMemo(() => presionArterialMedia(n('pas'), n('pad')), [v])
  const sofa = useMemo(() => calcularSOFA({
    pafi: vent.indiceKirby.ok ? vent.indiceKirby.valor ?? undefined : undefined,
    soporteRespiratorio: ['si', 'sí', 'true', '1'].includes((v.soporte || '').trim().toLowerCase()),
    plaquetas: n('plaquetas'), bilirrubina: n('bili'), pam: pam.ok ? pam.valor ?? undefined : undefined,
    norepinefrina: n('norepi'), dopamina: n('dopa'), dobutamina: n('dobu'), epinefrina: n('epi'),
    glasgow: n('glasgow'), creatinina: n('creat'),
  }), [v, vent, pam])
  const neuro = useMemo(() => analizarNeuro({
    mapMmHg: pam.ok ? pam.valor ?? undefined : undefined, pic: n('pic'), glasgow: n('glasgow'),
    pupilas: (v.pupilas as Pupilas) || undefined, paco2: n('paco2'), temperatura: n('temp'), sodio: n('na'), osmolaridad: n('osm'),
    intubado: esModoInvasivo(v.modo), rass: n('rass'),
  }), [v, pam])
  const alertas = useMemo(() => analizarSeguridadUCI({
    ph: n('ph'), glucosa: n('glucosa'), potasio: n('k'), pam: pam.ok ? pam.valor ?? undefined : undefined,
    pplat: n('pplat'), drivingPressure: vent.drivingPressure.ok ? vent.drivingPressure.valor ?? undefined : undefined,
    vtPorPbw: vent.vtPorPbw.ok ? vent.vtPorPbw.valor ?? undefined : undefined, spo2: n('spo2'), fio2: vent.fio2.valor ?? undefined,
    lactato: n('lactato'), sodio: n('na'), rass: n('rass'),
  }), [v, vent, pam])

  // ── POCUS: congestión venosa (VExUS-C), respuesta a líquidos (PLR), corazón derecho ──
  const patron = (k: string): PatronVena | undefined => (v[k] === 'normal' || v[k] === 'leve' || v[k] === 'grave' ? v[k] : undefined)
  const vex = useMemo(() => vexus({ vciCm: n('vci'), hepatica: patron('vHep'), porta: patron('vPor'), renal: patron('vRen') }), [v])
  const plr = useMemo(() => respuestaPLR(n('plrDelta'), (v.plrParam as ParametroPLR) || undefined), [v])
  const tapse = useMemo(() => disfuncionVD_TAPSE(n('tapse')), [v])
  const vdvi = useMemo(() => sobrecargaVD_VDVI(n('vdvi')), [v])
  const lb = useMemo(() => lineasBPocus(n('lineasB')), [v])

  // ── Soportes extracorpóreos: CKRT/PRISMA + ECMO ──
  const bool = (k: string): boolean | undefined => (v[k] === 'si' ? true : v[k] === 'no' ? false : undefined)
  const ckrt = useMemo(() => analizarCKRT({
    modalidad: (v.ckrtMod as ModalidadCKRT) || undefined, pesoKg: n('ckrtPeso'), qbMlMin: n('ckrtQb'),
    dializadoMlH: n('ckrtDial'), reposicionPreMlH: n('ckrtPre'), reposicionPostMlH: n('ckrtPost'),
    ufNetaMlH: n('ckrtUf'), hematocrito: n('ckrtHto'), tiempoActivoH: n('ckrtHoras'),
  }), [v])
  const citrato = useMemo(() => analizarCitrato({ caIonicoSistemico: n('ciCaSis'), caPostfiltro: n('ciCaPost'), caTotal: n('ciCaTot') }), [v])
  const ecmo = useMemo(() => analizarECMO({
    config: (v.ecmoConf as ConfigECMO) || undefined,
    presionPre: n('ecmoPre'), presionPost: n('ecmoPost'), deltaPBasal: n('ecmoBasal'),
    plasmaFreeHb: n('ecmoPfhb'), ldh: n('ecmoLdh'), haptoglobina: n('ecmoHapto'),
    flujoLMin: n('ecmoFlujo'), gastoCardiacoLMin: n('ecmoCo'), saO2: n('ecmoSao2'), preOxiSvO2: n('ecmoSvo2'), sweepLMin: n('ecmoSweep'), paco2: n('ecmoPaco2'),
    spo2ManoDerecha: n('ecmoSpD'), spo2MiembroInferior: n('ecmoSpI'), pas: n('ecmoPas'), pad: n('ecmoPad'),
    valvulaAorticaAbre: bool('ecmoValv'), edemaPulmonar: bool('ecmoEdema'),
  }), [v])

  // ── Copilot IA (dual-model Anthropic + OpenAI, razona sobre lo determinista) ──
  const [copilot, setCopilot] = useState<FusionCopilot | null>(null)
  const [copilotCargando, setCopilotCargando] = useState(false)
  const [copilotError, setCopilotError] = useState('')
  const [feedbackDado, setFeedbackDado] = useState<'up' | 'down' | null>(null)
  const [evidAlerta, setEvidAlerta] = useState<number | null>(null)  // "¿Por qué?" abierto

  // ── Tendencias: lecturas seriadas (qué cambió en el tiempo) ──
  const claveLecturas = `nx.uci.lecturas${internamientoId ? '.' + internamientoId : ''}`
  const [lecturas, setLecturas] = useState<Lectura[]>([])
  /**
   * ICU-003 · las lecturas dejan de vivir SOLO en este navegador.
   *
   * Se carga primero lo local (instantáneo, y es lo único que hay para el modo
   * calculadora sin paciente) y DESPUÉS se pide el servidor. Si el servidor
   * responde, gana: es lo que ve toda la guardia, no solo esta máquina.
   *
   * Si falla —sin internet, reglas, o paciente no internado— se queda lo local y
   * el panel funciona igual que siempre. Esa es la condición para poder revertir.
   */
  const [tomasEnServidor, setTomasEnServidor] = useState<number | null>(null)
  useEffect(() => {
    try { const raw = localStorage.getItem(claveLecturas); setLecturas(raw ? JSON.parse(raw) : []) } catch { setLecturas([]) }
  }, [claveLecturas])
  useEffect(() => {
    if (!clinicId || !internamientoId) { setTomasEnServidor(null); return }
    let vivo = true
    getTomas(clinicId, internamientoId)
      .then(tomas => {
        if (!vivo) return
        setTomasEnServidor(tomas.length)
        // `serieTomas` resuelve las correcciones: una toma corregida NO aparece
        // como punto extra en la gráfica, aparece en el lugar del original.
        const serie = serieTomas(tomas)
        if (serie.length > 0) {
          setLecturas(serie.map(t => ({ t: Date.parse(t.medidoEn), m: t.medidas as Lectura['m'] })))
        }
      })
      .catch(() => { if (vivo) setTomasEnServidor(null) })
    return () => { vivo = false }
  }, [clinicId, internamientoId])
  const computados = useMemo(() => ({
    pafi: vent.indiceKirby.ok ? vent.indiceKirby.valor : null,
    driving: vent.drivingPressure.ok ? vent.drivingPressure.valor : null,
    pam: pam.ok ? pam.valor : null,
    sofa: sofa.total,
    vexus: vex.ok ? vex.valor : null,
    ppc: neuro.ppc.ok ? neuro.ppc.valor : null,
  }), [vent, pam, sofa, vex, neuro])
  const lecturaActual = useMemo(() => aplanarLectura(v, computados), [v, computados])
  const cambios = useMemo(() => (lecturas.length ? compararLecturas(lecturas[lecturas.length - 1].m, lecturaActual) : []), [lecturas, lecturaActual])
  const correlacion = useMemo(() => correlacionTemporal(lecturas), [lecturas])
  /**
   * ESCRITURA DOBLE durante la transición (ICU-003).
   *
   * Se guarda en `localStorage` EXACTAMENTE como antes y ADEMÁS en el servidor.
   * El orden importa: primero lo local —que no puede fallar y es lo que el
   * médico ve al instante— y después la red. Si la red falla, el panel no se
   * entera: no se pierde la lectura ni se interrumpe el pase de visita.
   *
   * Quitar el respaldo local es una decisión POSTERIOR, cuando haya semanas de
   * datos en el servidor. Hoy sería cambiar una pérdida conocida por una
   * dependencia de red en el peor momento posible.
   */
  const guardarLectura = () => {
    const ahora = Date.now()
    const arr = [...lecturas, { t: ahora, m: lecturaActual }].slice(-24)
    setLecturas(arr)
    try { localStorage.setItem(claveLecturas, JSON.stringify(arr)) } catch { /* */ }

    if (!clinicId || !internamientoId) return   // modo calculadora: nada que persistir
    const iso = new Date(ahora).toISOString()
    guardarToma(clinicId, internamientoId, {
      medidoEn: iso,
      registradoEn: iso,
      estado: 'CONFIRMED',
      // `por` lo sella `guardarToma` desde la sesión: mandar aquí el nombre del
      // médico TRATANTE firmaba la lectura con quien no la hizo.
      por: '',
      fuente: 'panel-uci',
      medidas: lecturaActual as unknown as Record<string, unknown>,
    })
      .then(() => setTomasEnServidor(n => (n ?? 0) + 1))
      .catch(() => {
        // No se interrumpe al médico: la lectura YA está guardada localmente.
        // El contador se queda como estaba y el aviso de la UI lo delata.
        toast('La lectura se guardó en este dispositivo, pero no se pudo enviar al expediente', 'error')
      })
  }
  /**
   * El médico elige con qué motor razona el Copilot, igual que en la nota.
   *
   * ⚡ un modelo veloz (1 crédito) · ⭐ un modelo de razonamiento (3) ·
   * 💎 dos modelos en paralelo con sus desacuerdos a la vista (7).
   *
   * Lo que se paga de más no es «un modelo mejor»: es un SEGUNDO CEREBRO, y eso
   * vale para el caso difícil y sobra para confirmar que un postoperatorio va
   * bien. Antes no se podía elegir: todo pase costaba lo del caso difícil.
   */
  const [motorCopilot, setMotorCopilot] = useState<ClaveMotor>('estandar')

  const pedirCopilot = async () => {
    setCopilotCargando(true); setCopilotError(''); setCopilot(null); setFeedbackDado(null)
    try {
      const res = await fetchAutenticado('/api/uci/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generar', motor: motorCopilot, campos: v, discusion: discusionTxt || undefined, tendencias: resumenCambios(cambios) || undefined, internamientoId }),
      })
      const j = await res.json()
      if (!res.ok) { setCopilotError(j?.error || 'No se pudo generar la síntesis'); return }
      setCopilot(j as FusionCopilot)
    } catch { setCopilotError('Error de red al llamar al Copilot') }
    finally { setCopilotCargando(false) }
  }
  const enviarFeedback = async (rating: 'up' | 'down') => {
    setFeedbackDado(rating)
    try {
      await fetchAutenticado('/api/uci/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // SEGURIDAD/PHI: se envía SOLO el rating. NUNCA el cuadro clínico del
        // paciente — antes se mandaba el resumen y se reinyectaba en OTROS pacientes.
        body: JSON.stringify({ action: 'feedback', internamientoId, feedback: { rating } }),
      })
    } catch { /* no-bloqueante */ }
  }

  // ── Calculadora de infusión: dosis ↔ mL/h con dilución estándar por fármaco ──
  const infFarmaco = useMemo(() => farmacoPorKey(v.infFarmaco || 'norepinefrina'), [v.infFarmaco])
  const infDilIdx = Number(v.infDil ?? 0) || 0
  const infusion = useMemo(() => {
    // Dilución PERSONALIZADA: el médico captura lo que preparó (mg o U en la bolsa
    // y el volumen) → se calcula la concentración y manda sobre la estándar.
    const cant = Number(n('infCantBolsa')), ml = Number(n('infMlBolsa'))
    const concNum = (Number.isFinite(cant) && Number.isFinite(ml) && ml > 0 && cant > 0)
      ? (infFarmaco?.unidadConc === 'U/mL' ? cant / ml : (cant * 1000) / ml)
      : undefined
    // E0-05 — FRONTERA: la concentración preparada adquiere aquí su unidad, que es
    // la que el propio catálogo declara para ese fármaco (U/mL o µg/mL). El número
    // es el mismo que antes; lo que ya no puede pasar es que se cruce con la otra.
    const customConc = concNum === undefined ? undefined
      : infFarmaco?.unidadConc === 'U/mL'
        ? cantidad(concNum, 'U/mL', 'concentracion_actividad')
        : cantidad(concNum, 'µg/mL', 'concentracion_masa')
    // La dosis se etiqueta con la unidad DEL FÁRMACO (µg/kg/min, µg/min o U/min):
    // es exactamente lo que el panel muestra al lado del campo.
    const uDosis = infFarmaco?.unidad ?? 'µg/kg/min'
    const dosisCant = uDosis === 'µg/kg/min' ? cantidadDesde(n('infDosis'), 'µg/kg/min', 'tasa_dosis_peso')
      : uDosis === 'U/min' ? cantidadDesde(n('infDosis'), 'U/min', 'tasa_actividad')
      : cantidadDesde(n('infDosis'), 'µg/min', 'tasa_dosis')
    const base = {
      farmacoKey: v.infFarmaco || 'norepinefrina',
      /**
       * Orden: lo tecleado AQUÍ > el peso fijado de la estancia > el de CKRT.
       * Antes caía directo al de CKRT, así que dos calculadoras del mismo
       * paciente podían dosificar con pesos distintos (charter §16).
       */
      pesoKg: cantidadDesde(n('infPeso') ?? pesoParaCalcular(pesoFijado) ?? n('ckrtPeso'), 'kg', 'masa'),
      dilucionIdx: infDilIdx, concentracion: customConc,
    }
    return (v.infDir === 'rate')
      ? rateADosis({ ...base, rateMlH: cantidadDesde(n('infRate'), 'mL/h', 'tasa_volumen') })
      : dosisARate({ ...base, dosis: dosisCant })
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * La infusión que se está calculando, en la forma del REGISTRO del §13.
   *
   * No se persiste todavía: se arma para que el revisor estructural
   * (`revisarInfusion`) pueda mirarla y decir qué le falta ANTES de que se
   * vuelva una orden. `verificada: false` es honesto — nadie la ha confirmado.
   */
  const infusionRegistro = useMemo(() => {
    const vel = n('infRate')
    if (!v.infFarmaco && vel === undefined) return null
    const peso = n('infPeso') ?? pesoParaCalcular(pesoFijado) ?? n('ckrtPeso')
    return {
      id: 'en-curso',
      medicamento: infFarmaco?.nombre ?? String(v.infFarmaco ?? ''),
      velocidad: Number(vel ?? 0),
      unidadVelocidad: 'mL/h' as const,
      pesoKg: peso !== undefined ? Number(peso) : undefined,
      iniciadaEn: new Date().toISOString(),
      fuente: 'teclado' as const,   // se captura en el panel; si viene de voz, la extracción lo marcará
      verificada: false,
    }
  }, [v, infFarmaco]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── La nota se ARMA en vivo mientras dictas/capturas (por sistemas) ──
  /**
   * Narrativa o lista. Se recuerda entre pases: es preferencia de quien escribe.
   *
   * No cambia NI UNA palabra ni una cifra — cada dato ya es una oración completa
   * y la narrativa sólo las une en párrafo. Las advertencias van aparte a
   * propósito: enterrar un aviso de seguridad a media frase es cómo se deja de
   * leer.
   */
  const [formatoNota, setFormatoNota] = useState<FormatoNota>('narrativa')
  /**
   * El plan que propuso el Copilot, sólo si el médico lo pidió.
   *
   * No se pega solo al generar la síntesis: hay un botón. Nada que escribió una
   * máquina entra en una nota que se firma sin que alguien lo decida.
   */
  const [planCopilot, setPlanCopilot] = useState('')

  /**
   * ¿Este paciente tiene CKRT / ECMO?
   *
   * El Dr., viendo el panel: «siento que es algo confuso y debe ayudar al médico,
   * no confundirlo». Tenía razón, y la causa no era falta de IA: eran TREINTA
   * campos vacíos y tres «bloqueado» de un soporte que este paciente NO LLEVA.
   *
   * Un panel que pregunta por el flujo del dializado de alguien que no está
   * dializado no está pidiendo un dato: está ocupando la pantalla.
   *
   * Se muestra el formulario cuando el soporte está DECLARADO en el episodio o
   * cuando ya hay algún dato suyo capturado — porque si el médico lo dictó, lo
   * quiere ver aunque nadie haya marcado la casilla.
   */
  const hayDato = useCallback((prefijo: string) =>
    Object.entries(v).some(([k, val]) => k.startsWith(prefijo) && String(val ?? '').trim() !== ''), [v])
  const usaCkrt = (soportes?.includes('ckrt') ?? false) || hayDato('ckrt') || hayDato('ciCa')
  const usaEcmo = (soportes?.includes('ecmo') ?? false) || hayDato('ecmo')
  useEffect(() => {
    try { const g = localStorage.getItem('nx.uci.formatoNota'); if (g === 'lista' || g === 'narrativa') setFormatoNota(g) } catch { /* */ }
  }, [])
  const cambiarFormato = (f: FormatoNota) => {
    setFormatoNota(f)
    try { localStorage.setItem('nx.uci.formatoNota', f) } catch { /* */ }
  }

  /**
   * Los laboratorios que el médico DICTÓ en el pase.
   *
   * Se leen del mismo texto del pase y se filtran contra el catálogo de
   * analitos: a la nota va sólo lo que está fuera de rango, abreviado. Lo normal
   * no se pierde — sigue completo abajo, en el apartado de laboratorio, que es el
   * MISMO al que llegan los PDF que subes. Un solo sitio para los dos caminos.
   */
  const labsDictados = useMemo(() => {
    const out: LabMedido[] = []
    for (const a of ANALITOS) {
      const m = discusionTxt.match(new RegExp(`${a.patron.source}\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)`, 'i'))
      if (!m) continue
      const n = Number(String(m[m.length - 1]).replace(',', '.'))
      if (Number.isFinite(n) && valorPlausible(a.clave, n)) out.push({ clave: a.clave, valor: n })
    }
    return out
  }, [discusionTxt])
  const labs = useMemo(() => resumenLabs(labsDictados), [labsDictados])

  const notaCruda = useMemo(() => construirSeccionesUCI(v, { discusion: discusionTxt || undefined, labs: labs.linea || undefined, labsCapturados: labsDictados, planPropuesto: planCopilot || undefined }), [v, discusionTxt, labs.linea, labsDictados, planCopilot])
  const notaSecciones = useMemo(() => formatear(notaCruda, formatoNota), [notaCruda, formatoNota])
  const notaLlenas = notaSecciones.filter(s => s.value.trim() !== '')

  // ── Pasar la nota YA generada al expediente para revisar y FIRMAR ──
  const pasarANota = () => {
    if (!inter || !internamientoId) return
    /**
     * LA NOTA DE UCI DEJA DE NACER HUÉRFANA.
     *
     * La semilla llevaba **sólo las secciones**. Consecuencia medida en el
     * código de la consulta: un pase DICTADO se firmaba como
     * `fuenteGeneracion: 'manual'`, sin `transcripcionCruda` y sin
     * `dialogoDiarizado` — y, como casi todas las defensas exigen que exista
     * `voz.transcripcion`, se apagaban **todas a la vez**: el motor de
     * negaciones, las palabras a verificar, la compuerta de evidencia, la
     * segunda opinión y el manifiesto de procedencia.
     *
     * O sea: el camino que más nota firmada produce en UCI era el que menos
     * protección tenía. Y no por una decisión: porque el dictado no viajaba.
     *
     * Ahora viaja. Con eso solo, la nota de UCI recupera de golpe todo lo
     * anterior, sin tocar ninguna de esas defensas.
     */
    const semilla = {
      secciones: notaSecciones,
      // El pase tal como quedó (dictado o escrito). Es la fuente de verdad.
      dictado: paseTexto.trim() || audio.transcripcion.trim(),
      // Los turnos, para que la consulta pueda juzgar de quién es cada cita.
      utterances: audio.utterances,
      /**
       * Y el material de ORIGEN: lo que el motor oyó antes del pipeline.
       *
       * Sin esto, el pase de UCI se archivaba con el texto de trabajo en el
       * sitio del original — el defecto que la v996 cerró en la consulta y que
       * seguía abierto aquí, que es donde más se dicta.
       */
      crudo: audio.transcripcionMotor,
    }
    try { sessionStorage.setItem(`nx.uci.seed.${internamientoId}`, JSON.stringify(semilla)) } catch { /* */ }
    router.push(`/consulta/${inter.pacienteId}?tipo=evolucion_uci&internamiento=${internamientoId}&fuente=uci`)
  }

  // Todos los hooks quedan ARRIBA de este punto: el early return no puede
  // saltarse ninguno (reglas de hooks).
  if (!internamientoId && !panelLibre) {
    return <LandingUci alPanelLibre={() => setPanelLibre(true)} />
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 20px 80px', color: 'var(--text)' }}>
      {/* Decisión del Dr. (2026-07-30): /uci es el expediente, no la calculadora.
          Abierto sin paciente, esto es una HERRAMIENTA, y se nombra como tal. */}
      {!internamientoId && (
        <button
          onClick={() => setPanelLibre(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}
        >
          <ArrowLeft size={15} /> Pacientes y camas de UCI
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Activity size={22} style={{ color: 'var(--nexus)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          {internamientoId ? 'Panel de UCI' : 'Herramientas UCI · panel fisiológico'}
        </h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Info size={14} /> Apoyo decisional. El código calcula, el motor verifica; tú revisas y firmas. Si falta un dato, no se inventa.
      </p>

      {internamientoId && (
        <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
          {([['resumen', 'Resumen del pase'], ['panel', 'Panel fisiológico'], ['verificacion', 'Verificación'], ['mar', 'MAR'], ['linea', 'Línea de tiempo'], ['dosis', 'Dosis en crítico']] as const).map(([k, txt]) => (
            <button
              key={k} role="tab" aria-selected={pestana === k}
              onClick={() => setPestana(k)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '9px 14px',
                fontSize: 13, fontWeight: pestana === k ? 700 : 500, minHeight: 40,
                color: pestana === k ? 'var(--nexus,#3d5afe)' : 'var(--text3)',
                borderBottom: `2px solid ${pestana === k ? 'var(--nexus,#3d5afe)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {txt}
            </button>
          ))}
        </div>
      )}

      {/* Paciente ingresado (o aviso de modo calculadora) */}
      {inter ? (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{inter.pacienteNombre}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BedDouble size={13} /> {inter.servicio}{inter.cama ? ` · Cama ${inter.cama}` : ''}</span>
                <span>{inter.diagnosticoIngreso}</span>
              </div>
            </div>
            <button onClick={pasarANota} disabled={notaLlenas.length === 0} title={notaLlenas.length === 0 ? 'Primero dicta o captura datos; la nota se arma sola' : 'Abre la nota ya generada para revisarla y firmarla'} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, opacity: notaLlenas.length === 0 ? 0.55 : 1 }}>
              <FileText size={15} /> Revisar y firmar la nota
            </button>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                Soportes activos
              </span>
              {estanciaUci && (
                <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· {estanciaUci.etiqueta}</span>
              )}
              {guardandoSoportes && <span style={{ fontSize: 11, color: 'var(--text3)' }}>guardando…</span>}
            </div>
            {soportes === null ? (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cargando…</span>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SOPORTES_ACTIVOS.map(sp => {
                    const on = soportes.includes(sp)
                    return (
                      <button
                        key={sp}
                        onClick={() => alternarSoporte(sp)}
                        aria-pressed={on}
                        style={{
                          fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                          minHeight: 30,
                          border: `1px solid ${on ? 'var(--nexus,#3d5afe)' : 'var(--border)'}`,
                          background: on ? 'rgba(61,90,254,0.14)' : 'transparent',
                          color: on ? 'var(--nexus,#3d5afe)' : 'var(--text3)',
                        }}
                      >
                        {SOPORTE_LABEL[sp]}
                      </button>
                    )
                  })}
                </div>
                {soportes.length === 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 7, lineHeight: 1.5 }}>
                    No hay ninguno declarado. El sistema <strong>no los deduce</strong> de las
                    mediciones: que haya una PEEP anotada no prueba que el paciente siga ventilado.
                  </div>
                )}
              </>
            )}
          </div>
          {alergias.lista.length > 0 && !alergias.negadas && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '7px 11px', borderRadius: 9, border: '1px solid color-mix(in srgb, var(--red) 45%, transparent)', background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>ALERGIAS:</span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{alergias.lista.join(' · ')}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: '1px dashed var(--border)', background: 'var(--s2)', color: 'var(--text3)' }}>
          <Calculator size={15} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5 }}>
            Modo calculadora (sin paciente). Para <strong>guardar la nota en el expediente</strong>, abre el panel desde un paciente <button onClick={() => router.push('/hospitalizacion')} style={{ background: 'none', border: 'none', color: 'var(--nexus)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>internado en Hospitalización</button>.
          </span>
        </div>
      )}

      {/* Resumen del pase y línea de tiempo: los motores del charter, en pantalla.
          Sólo con paciente — sin expediente no hay nada que resumir. */}
      {internamientoId && pestana === 'verificacion' && (
        <Verificacion
          campos={v}
          computados={computados as Record<string, number | null>}
          lecturas={lecturas}
          dictado={paseTexto || discusionTxt || undefined}
          avisosVoz={avisosVoz}
          infusion={infusionRegistro}
        />
      )}

      {internamientoId && pestana === 'mar' && (
        <MarPaciente indicaciones={inter?.indicaciones ?? []} graciaMinDeclarada={config.graciaMarMin} />
      )}

      {/*
        EL PESO DE DOSIFICACIÓN (charter §16), arriba de las calculadoras.
        Va aquí porque es de lo que dependen todas: sin él, cada una usa el que
        se teclee en ella y dos pantallas pueden dosificar distinto al mismo
        paciente. No se toma del peso de la nota: ése cambia (edema, balance,
        otra báscula) y movería las dosis sin que nadie lo pidiera.
      */}
      {internamientoId && (pestana === 'dosis' || pestana === 'panel') && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Peso de dosificación
          </div>
          {pesoFijado ? (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>{pesoFijado.valorKg} kg</strong>
              {' · '}{ETIQUETA_TIPO_PESO[pesoFijado.tipo]}
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                Lo fijó {pesoFijado.fijadoPor} el {new Date(pesoFijado.fijadoEn).toLocaleString('es-MX')}.
                No cambia solo: para cambiarlo hay que fijarlo otra vez, y queda a nombre de quien lo haga.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--amber)', lineHeight: 1.6, marginBottom: 8 }}>
              {avisoSinPeso(null)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <input
              type="number" inputMode="decimal" min={0} step="any" placeholder="kg"
              value={pesoBorrador} onChange={e => setPesoBorrador(e.target.value)}
              aria-label="Peso en kilogramos"
              style={{ width: 110, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 14, minHeight: 40 }}
            />
            <select
              value={tipoPesoBorrador} onChange={e => setTipoPesoBorrador(e.target.value as TipoPesoDosificacion)}
              aria-label="Qué peso es"
              style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 14, minHeight: 40 }}
            >
              {TIPOS_PESO.map(t => <option key={t} value={t}>{ETIQUETA_TIPO_PESO[t]}</option>)}
            </select>
            <button
              type="button" className="btn btn-primary btn-sm" disabled={fijandoPeso}
              onClick={async () => {
                if (!clinicId) return
                const quien = auth.currentUser?.email || auth.currentUser?.displayName || ''
                const v = validarPeso(pesoBorrador, tipoPesoBorrador, quien)
                if (!v.ok) { toast(v.mensaje ?? 'Revisa el peso', 'error'); return }
                setFijandoPeso(true)
                try {
                  const e = await fijarPesoDosificacion(
                    clinicId, internamientoId,
                    { valorKg: Number(pesoBorrador), tipo: tipoPesoBorrador },
                    soportes ?? [],
                  )
                  setPesoFijado(e?.pesoDosificacion ?? null)
                  setPesoBorrador('')
                  toast('Peso de dosificación fijado', 'success')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'No se pudo fijar el peso', 'error')
                } finally { setFijandoPeso(false) }
              }}
            >{pesoFijado ? 'Cambiar el peso' : 'Fijar el peso'}</button>
          </div>

          {/*
            LA TALLA, al lado del peso porque comparte destino: de ella salen el
            peso predicho y el VT/PBW. No cambia durante la estancia, así que
            re-teclearla en cada pase es re-arriesgar la meta de ventilación
            protectora cada vez.
          */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Talla{tallaFijada ? <strong style={{ color: 'var(--text)' }}>: {tallaFijada} cm</strong> : ' (para PBW y VT/PBW)'}
            </span>
            <input
              type="number" inputMode="decimal" min={0} step="any" placeholder="cm"
              value={tallaBorrador} onChange={e => setTallaBorrador(e.target.value)}
              aria-label="Talla en centímetros"
              style={{ width: 100, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 14, minHeight: 40 }}
            />
            <button
              type="button" className="btn btn-secondary btn-sm" disabled={fijandoPeso}
              onClick={async () => {
                if (!clinicId) return
                const v = validarTalla(tallaBorrador)
                if (!v.ok) { toast(v.mensaje ?? 'Revisa la talla', 'error'); return }
                setFijandoPeso(true)
                try {
                  const e = await fijarPesoDosificacion(clinicId, internamientoId, null, soportes ?? [], undefined, Number(tallaBorrador))
                  setTallaFijada(e?.tallaCm ?? null)
                  setTallaBorrador('')
                  toast('Talla fijada', 'success')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'No se pudo fijar la talla', 'error')
                } finally { setFijandoPeso(false) }
              }}
            >{tallaFijada ? 'Cambiar' : 'Fijar'}</button>
          </div>
        </div>
      )}

      {pestana === 'dosis' && <DosisMeropenem />}

      {internamientoId && clinicId && (pestana === 'resumen' || pestana === 'linea') && (
        <ResumenPase
          clinicId={clinicId}
          internamientoId={internamientoId}
          vista={pestana === 'linea' ? 'linea' : 'resumen'}
          zonaHoraria={config.zonaHoraria || 'America/Mexico_City'}
          soportes={soportes ?? []}
          cama={inter?.cama?.trim() || null}
          diaUci={estanciaUci?.calendarDayNumber ?? null}
          diaVm={null}
        />
      )}

      {(!internamientoId || pestana === 'panel') && (<>
      {/* Voz del pase de visita (adscritos + residentes) → prellena el panel */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {audio.soportado ? (
            <button onClick={() => (grabando ? audio.detener() : audio.iniciar(opcionesDictadoUci))}
              className={grabando ? 'btn' : 'btn btn-primary'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...(grabando ? { background: '#dc2626', color: '#fff', border: 'none' } : {}) }}>
              {grabando ? <Square size={15} /> : <Mic size={15} />}{grabando ? 'Detener' : 'Dictar pase de visita'}
            </button>
          ) : <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Este dispositivo no soporta grabación.</span>}
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
            {audio.estado === 'grabando' && <span className="nx-pulse" style={{ color: 'var(--red)' }}>● Grabando… {Math.floor(audio.duracion)}s</span>}
            {audio.estado === 'pausado' && 'En pausa'}
            {audio.estado === 'subiendo' && 'Transcribiendo…'}
            {audio.estado === 'listo' && detectados.length > 0 && <span style={{ color: 'var(--nexus)' }}>✓ {detectados.length} valores prellenados — revísalos</span>}
          </span>
        </div>
        {audio.transcripcionParcial && grabando && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)', background: 'var(--s2)', borderRadius: 8, padding: '8px 10px', maxHeight: 80, overflow: 'auto' }}>{audio.transcripcionParcial}<span className="nx-caret">▍</span></div>
        )}
        {/* Cuadro de texto del pase: se llena con el dictado, y también se puede
            escribir/pegar/corregir. "Generar nota" procesa el texto → nota + cálculos. */}
        {!grabando && (
          <div style={{ marginTop: 12 }}>
            <textarea
              value={paseTexto}
              onChange={e => setPaseTexto(e.target.value)}
              placeholder="Dicta con el botón de arriba, o escribe/pega aquí el pase de visita… (p. ej.: «asistido controlado por volumen, FiO₂ 60, PEEP 10, plateau 26, PaO₂ 78 arterial, norepinefrina 0.2, RASS menos 2…»)"
              rows={4}
              style={{ width: '100%', resize: 'vertical', minHeight: 92, fontSize: 13.5, lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => aplicarPase(paseTexto)} disabled={!paseTexto.trim()} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, opacity: paseTexto.trim() ? 1 : 0.5 }}>
                <FileText size={15} /> Generar nota
              </button>
              {paseTexto.trim() && <button onClick={() => { setPaseTexto(''); setAvisoPase(''); procesadoRef.current = '' }} className="btn" style={{ fontSize: 12.5 }}>Limpiar</button>}
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>La nota y los cálculos aparecen abajo. Solo se reporta lo que dictaste/escribiste.</span>
            </div>
            {avisoPase && <div style={{ marginTop: 8, fontSize: 12.5, color: avisoPase.startsWith('✓') ? 'var(--nexus)' : '#d97706' }}>{avisoPase}</div>}
          </div>
        )}
        {ofreceRecovery && audio.estado !== 'grabando' && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.55,
            color: 'var(--text)', background: 'var(--s2)', border: '1px solid var(--border)',
          }}>
            <b>Hay audio de un pase guardado en este dispositivo.</b>{' '}
            Se conservó porque su transcripción no llegó a terminar. Puedes reintentarla, bajarte el
            archivo, o borrarlo.
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-primary"
                onClick={async () => { await audio.recuperarAudio(claveRecovery, opcionesDictadoUci); setOfreceRecovery(false) }}>
                Reintentar la transcripción
              </button>
              <button className="btn btn-sm"
                onClick={async () => { const ok = await audio.descargarAudioGuardado(claveRecovery); if (!ok) setAvisoPase('No se encontró audio guardado.') }}>
                Descargar el audio
              </button>
              <button className="btn btn-sm btn-ghost"
                onClick={async () => { await audio.descartarRecovery(claveRecovery); audio.reset(); setOfreceRecovery(false); setAvisoPase('✓ Audio guardado borrado de este dispositivo.') }}>
                Borrarlo del dispositivo
              </button>
            </div>
          </div>
        )}

        {/*
          LO QUE LA CONSULTA YA AVISABA Y EL PASE DE UCI NO.
          Un pase con tramos perdidos, sin separación de voces o con palabras
          que el audio no entendió se veía EXACTAMENTE IGUAL que uno íntegro.
        */}
        {audio.sinDiarizacion && audio.estado === 'listo' && (
          <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)' }}>
            <b>Sin separación de voces en este pase.</b>{' '}
            {MOTIVO_SIN_DIARIZACION[audio.sinDiarizacion]}{' '}
            Revisa fármacos, dosis y parámetros del ventilador antes de firmar.
          </div>
        )}
        {audio.chunksFallidos > 0 && (
          <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)' }}>
            <b>Faltan {audio.chunksFallidos} tramo(s) en el texto en vivo.</b>{' '}
            La transcripción final usa la grabación completa; lo que ves ahora está incompleto.
          </div>
        )}
        {audio.recorte && audio.estado === 'grabando' && (
          <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)' }}>
            <b>El micrófono está saturando.</b>{' '}
            Bájale el volumen de entrada o sepáralo un palmo.
          </div>
        )}
        {palabrasDudosasPase.palabras.length > 0 && (
          <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)' }}>
            <b>Palabras que el audio no oyó con seguridad.</b>{' '}
            No se corrigieron ni se adivinaron. Vuelve al audio en el minuto indicado si alguna cambia el sentido.
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {palabrasDudosasPase.palabras.map((w, i) => (
                <span key={`${w.texto}-${w.momento}-${i}`} style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', fontSize: 12, background: 'color-mix(in srgb, var(--amber) 18%, transparent)', fontVariantNumeric: 'tabular-nums' }}>
                  «{w.texto}» · {w.momento} · {w.seguridad}%
                </span>
              ))}
            </div>
            {palabrasDudosasPase.ocultas > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: .9 }}>Y {palabrasDudosasPase.ocultas} más, menos dudosas que éstas.</div>
            )}
          </div>
        )}
        {motivosDictado.length > 0 && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
            color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
          }}>
            <b>Conviene confirmar antes de firmar:</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {motivosDictado.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}

        {audio.alertasDictado.length > 0 && (
          <div style={{ marginTop: 10 }}><AlertasDictado alertas={audio.alertasDictado} /></div>
        )}

        {/* Las cifras, unidades y siglas que reescribió el pipeline.
            En un pase de UCI son PARÁMETROS: PEEP, FiO2, dosis de aminas. Que
            se reescriban sin que el intensivista lo vea es peor aquí que en
            ningún otro sitio. Se deshace sobre el cuadro editable del pase. */}
        {audio.cambiosCifras.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <CambiosCifrasPanel
              cambios={audio.cambiosCifras}
              onRevertir={(c) => {
                const re = new RegExp(c.despues.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                setPaseTexto(t => t.replace(re, c.antes))
              }}
            />
          </div>
        )}

        {avisosVoz.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {avisosVoz.map((a, i) => (
              <div key={i} style={{ fontSize: 12, display: 'flex', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)', color: 'var(--text)' }}>
                <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5, color: 'var(--amber)', width: 74, flexShrink: 0, paddingTop: 1 }}>{a.motivo === 'implausible' ? 'No cargado' : 'Confirma'}</span>
                <span>{a.detalle}</span>
              </div>
            ))}
          </div>
        )}
        {discusionTxt && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer' }}>Ver la discusión etiquetada por rol</summary>
            <pre style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{discusionTxt}</pre>
          </details>
        )}
        {audio.error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{audio.error}</div>}
      </div>

      {/* NOTA EN VIVO: se ARMA sola con lo que dictas/capturas. "Pasar a nota" solo
          la abre en el expediente para revisar y firmar (no es un segundo dictado). */}
      {notaLlenas.length > 0 && (
        <details open style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: '4px 16px 14px', marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontWeight: 600, fontSize: 14 }}>
            <FileText size={16} style={{ color: 'var(--nexus)' }} /> Nota de evolución UCI — se genera al dictar ({notaLlenas.length} secciones)
            <span
              style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}
              onClick={e => { e.preventDefault(); e.stopPropagation() }}
            >
              {(['narrativa', 'lista'] as const).map(f => (
                <button
                  key={f} onClick={() => cambiarFormato(f)}
                  title={f === 'narrativa'
                    ? 'Párrafos, más compacta. Mismas palabras y mismas cifras.'
                    : 'Un dato por renglón.'}
                  style={{
                    padding: '3px 9px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
                    border: '1px solid var(--border2)', fontWeight: 500,
                    background: formatoNota === f ? 'var(--teal)' : 'transparent',
                    color: formatoNota === f ? '#fff' : 'var(--text2)',
                  }}
                >{f === 'narrativa' ? 'Narrativa' : 'Lista'}</button>
              ))}
            </span>
          </summary>
          {inter && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 4 }}>Revísala y pulsa “Pasar a nota” para firmarla</div>}
          <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
            {notaLlenas.map(s => (
              <div key={s.key}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* LABORATORIO: el MISMO apartado del expediente. Lo que subes en PDF y lo
          que dictas en el pase caen aquí, y las gráficas salen del conjunto.
          Sin esto había dos sitios para lo mismo y ninguno completo. */}
      {inter?.pacienteId && clinicId && (
        <details style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: '4px 16px 14px', marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontWeight: 600, fontSize: 14 }}>
            <FlaskConical size={16} style={{ color: 'var(--nexus)' }} /> Laboratorio · historial y tendencias
            {labs.omitidos > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)', fontWeight: 400 }}>
                {labs.omitidos} en rango no van en la nota; están aquí
              </span>
            )}
          </summary>
          {labs.aviso && (
            <p style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, margin: '0 0 8px' }}>{labs.aviso}</p>
          )}
          <PanelLaboratorios clinicId={clinicId} patientId={inter.pacienteId} />
        </details>
      )}

      {/* Toggle modo simple ⇄ avanzado: por defecto SIMPLE (solo dictado + nota +
          lo calculado). El grid de ~40 campos manuales queda tras el modo avanzado. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setModoAvanzado(a => !a)} className="btn" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {modoAvanzado ? '← Modo simple (dictado)' : '✎ Editar campos manualmente'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: modoAvanzado ? 'minmax(0,1.4fr) minmax(0,1fr)' : '1fr', gap: 16 }} className="nx-uci-grid">
        {/* Captura — solo en modo avanzado (el muro de campos manuales) */}
        {modoAvanzado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Bloque icon={Wind} titulo="Respiratorio / ventilación">
            <Selector label="Modo ventilatorio" k="modo" v={v} set={set} w={168} opciones={[
              { val: 'AC-VC', txt: 'A/C volumen (VC)' },
              { val: 'AC-PC', txt: 'A/C presión (PC)' },
              { val: 'SIMV', txt: 'SIMV' },
              { val: 'PSV', txt: 'PSV / espontáneo' },
              { val: 'CPAP', txt: 'CPAP' },
              { val: 'APRV', txt: 'APRV / BiVent' },
              { val: 'VNI', txt: 'VNI (BiPAP)' },
              { val: 'AFNC', txt: 'Cánula alto flujo' },
              { val: 'aire', txt: 'Aire ambiente / O₂ suplem.' },
            ]} />
            <Campo label="Sexo (M/F)" k="sexo" v={v} set={set} w={70} />
            <Campo label="Talla" k="talla" v={v} set={set} sufijo="cm" />
            <Campo label="VT" k="vt" v={v} set={set} sufijo="mL" />
            <Campo label="FR" k="fr" v={v} set={set} sufijo="rpm" w={80} />
            <Campo label="FiO₂" k="fio2" v={v} set={set} sufijo="%" />
            <Campo label="PEEP" k="peep" v={v} set={set} sufijo="cmH₂O" />
            <Campo label="Auto-PEEP" k="autoPeep" v={v} set={set} sufijo="cmH₂O" w={100} />
            <Campo label="P. pico" k="ppico" v={v} set={set} sufijo="cmH₂O" w={95} />
            <Campo label="Pplateau" k="pplat" v={v} set={set} sufijo="cmH₂O" />
            <Campo label="P. soporte" k="psoporte" v={v} set={set} sufijo="cmH₂O" w={100} />
            <Campo label="Relación I:E" k="ie" v={v} set={set} w={90} />
            <Campo label="Trigger" k="trigger" v={v} set={set} w={90} />
            <Campo label="PaO₂" k="pao2" v={v} set={set} sufijo="mmHg" />
            <Selector label="Muestra gaso." k="muestra" v={v} set={set} w={120} opciones={[
              { val: 'arterial', txt: 'Arterial' }, { val: 'venosa', txt: 'Venosa' }, { val: 'capilar', txt: 'Capilar' }]} />
            <Selector label="Soporte VM/CPAP" k="soporte" v={v} set={set} w={130} opciones={[
              { val: 'si', txt: 'Sí (VM/CPAP)' }, { val: 'no', txt: 'No' }]} />
            <Campo label="SpO₂" k="spo2" v={v} set={set} sufijo="%" />
          </Bloque>
          <Bloque icon={Droplets} titulo="Gasometría / metabólico">
            <Campo label="pH" k="ph" v={v} set={set} />
            <Campo label="PaCO₂" k="paco2" v={v} set={set} sufijo="mmHg" />
            <Campo label="HCO₃" k="hco3" v={v} set={set} />
            <Campo label="Na" k="na" v={v} set={set} />
            <Campo label="Cl" k="cl" v={v} set={set} />
            <Campo label="Albúmina" k="alb" v={v} set={set} sufijo="g/dL" />
            <Campo label="Lactato" k="lactato" v={v} set={set} />
            <Campo label="Glucosa" k="glucosa" v={v} set={set} sufijo="mg/dL" />
            <Campo label="Potasio" k="k" v={v} set={set} />
          </Bloque>
          <Bloque icon={HeartPulse} titulo="Hemodinámico + SOFA">
            <Campo label="PAS" k="pas" v={v} set={set} />
            <Campo label="PAD" k="pad" v={v} set={set} />
            <Campo label="Norepi" k="norepi" v={v} set={set} sufijo="µg/kg/min" w={110} />
            <Campo label="Dopamina" k="dopa" v={v} set={set} sufijo="µg/kg/min" w={110} />
            <Campo label="Dobutamina" k="dobu" v={v} set={set} sufijo="µg/kg/min" w={110} />
            <Campo label="Epinefrina" k="epi" v={v} set={set} sufijo="µg/kg/min" w={110} />
            <Campo label="Glasgow" k="glasgow" v={v} set={set} />
            <Campo label="Creatinina" k="creat" v={v} set={set} />
            <Campo label="Plaquetas" k="plaquetas" v={v} set={set} sufijo="×10³" />
            <Campo label="Bilirrubina" k="bili" v={v} set={set} />
          </Bloque>
          <Bloque icon={Brain} titulo="Neurocrítico">
            <Campo label="PIC" k="pic" v={v} set={set} sufijo="mmHg" w={85} />
            <Selector label="Pupilas" k="pupilas" v={v} set={set} w={130} opciones={[
              { val: 'isocoricas', txt: 'Isocóricas' }, { val: 'anisocoria', txt: 'Anisocoria' }, { val: 'fijas', txt: 'Fijas' }]} />
            <Campo label="Temp" k="temp" v={v} set={set} sufijo="°C" w={80} />
            <Campo label="Osmolaridad" k="osm" v={v} set={set} sufijo="mOsm/L" w={120} />
            <Selector label="RASS (sedación)" k="rass" v={v} set={set} w={190} opciones={[
              { val: '4', txt: '+4 Combativo' }, { val: '3', txt: '+3 Muy agitado' }, { val: '2', txt: '+2 Agitado' },
              { val: '1', txt: '+1 Inquieto' }, { val: '0', txt: '0 Alerta y tranquilo' }, { val: '-1', txt: '−1 Somnoliento' },
              { val: '-2', txt: '−2 Sedación ligera' }, { val: '-3', txt: '−3 Sedación moderada' },
              { val: '-4', txt: '−4 Sedación profunda' }, { val: '-5', txt: '−5 Sin respuesta' }]} />
          </Bloque>
          <Bloque icon={Waves} titulo="POCUS · ultrasonido a pie de cama">
            <Campo label="VCI" k="vci" v={v} set={set} sufijo="cm" w={80} />
            <Selector label="V. hepática" k="vHep" v={v} set={set} opciones={[{ val: 'normal', txt: 'Normal (S≥D)' }, { val: 'leve', txt: 'Leve (S<D)' }, { val: 'grave', txt: 'Grave (S invertida)' }]} />
            <Selector label="V. porta" k="vPor" v={v} set={set} opciones={[{ val: 'normal', txt: 'Normal (<30%)' }, { val: 'leve', txt: 'Leve (30–49%)' }, { val: 'grave', txt: 'Grave (≥50%)' }]} />
            <Selector label="V. renal" k="vRen" v={v} set={set} opciones={[{ val: 'normal', txt: 'Normal (cont.)' }, { val: 'leve', txt: 'Leve (bifásico)' }, { val: 'grave', txt: 'Grave (solo diast.)' }]} />
            <Campo label="PLR Δ" k="plrDelta" v={v} set={set} sufijo="%" w={80} />
            <Selector label="PLR parámetro" k="plrParam" v={v} set={set} opciones={[{ val: 'CO', txt: 'Gasto (CO)' }, { val: 'SV', txt: 'Vol. sistólico (SV)' }, { val: 'LVOT_VTI', txt: 'LVOT-VTI' }]} w={130} />
            <Campo label="TAPSE" k="tapse" v={v} set={set} sufijo="mm" w={80} />
            <Campo label="VD/VI" k="vdvi" v={v} set={set} w={80} />
            <Campo label="Líneas B/esp." k="lineasB" v={v} set={set} w={100} />
          </Bloque>
        </div>
        )}

        {/* Cálculos + alertas (SEPARADOS de la nota) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Cálculos deterministas</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <Resultado label="PaO₂/FiO₂ (Kirby)" r={vent.indiceKirby} ocultar={!modoAvanzado} />
              <Resultado label="Driving pressure" r={vent.drivingPressure} ocultar={!modoAvanzado} />
              <Resultado label="Compliance estática" r={vent.complianceEstatica} ocultar={!modoAvanzado} />
              <Resultado label="VT/PBW" r={vent.vtPorPbw} ocultar={!modoAvanzado} />
              <Resultado label="PAM" r={pam} ocultar={!modoAvanzado} />
              <div style={{ padding: '8px 10px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>Gasometría</span>
                  <strong>{gaso.ok ? gaso.trastornoPrimario.replace('_', ' ') : '—'}</strong>
                </div>
                {gaso.ok && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{gaso.mixto ? 'MIXTO · ' : ''}{gaso.anionGap.elevado ? 'AG elevado' : ''} {gaso.compensacion.comentario}</div>}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 9, background: 'var(--nexus-soft)', border: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>SOFA</span>
                  <strong>{sofa.total ?? '—'}{sofa.parcial ? ' (parcial)' : ''}</strong>
                </div>
              </div>
            </div>
          </div>

          {(modoAvanzado || vex.ok || plr.ok || tapse.ok || vdvi.ok || lb.ok) && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              <Waves size={16} style={{ color: 'var(--nexus)' }} /> POCUS
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <Resultado label="VExUS-C (congestión)" r={{ ...vex, unidad: vex.ok ? 'grado' : undefined }} ocultar={!modoAvanzado} />
              <Resultado label="PLR (respuesta a líquidos)" r={{ ...plr, unidad: '%' }} ocultar={!modoAvanzado} />
              <Resultado label="TAPSE (VD)" r={{ ...tapse, unidad: 'mm' }} ocultar={!modoAvanzado} />
              <Resultado label="VD/VI" r={vdvi} ocultar={!modoAvanzado} />
              <Resultado label="Líneas B" r={lb} ocultar={!modoAvanzado} />
            </div>
            {modoAvanzado && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.4 }}>
              VExUS-C requiere VCI ≥ 2.0 cm + Doppler venoso. PLR: ≥10 % en gasto/VS/LVOT-VTI = respondedor (la presión de pulso no es criterio válido). Ninguna medida aislada decide conducta.
            </div>}
          </div>
          )}

          {(neuro.ppc.ok || neuro.picEstado || neuro.rass.ok || !neuro.gcsValorable || neuro.banderas.length > 0) && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                <Brain size={16} style={{ color: 'var(--nexus)' }} /> Neurocrítico
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Resultado label="PPC (PAM − PIC)" r={{ ok: neuro.ppc.ok, valor: neuro.ppc.valor, unidad: 'mmHg', motivoBloqueo: neuro.ppc.motivoBloqueo, interpretacion: neuro.ppc.interpretacion.split(':').slice(1).join(':').trim() || 'meta 60–70' }} />
                {neuro.picEstado && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{neuro.picEstado}</div>}
                {!neuro.gcsValorable && <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Paciente intubado: GCS verbal no valorable (reportar “T”). Conciencia/sedación → RASS.</div>}
                {neuro.rass.ok && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}><b>RASS {neuro.rass.valor! > 0 ? '+' : ''}{neuro.rass.valor} · {neuro.rass.etiqueta}</b> — {neuro.rass.interpretacion}</div>}
                {neuro.banderas.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '7px 9px', borderRadius: 8, background: 'var(--s2)', borderLeft: `3px solid ${colorNivel[b.nivel]}` }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: colorNivel[b.nivel], textTransform: 'uppercase', width: 58, flexShrink: 0 }}>{b.nivel}</span>
                    <span>{b.mensaje}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              <ShieldAlert size={16} style={{ color: 'var(--amber)' }} /> Alertas ({alertas.length})
            </div>
            {alertas.length === 0
              ? <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Sin alertas con los datos actuales.</div>
              : <div style={{ display: 'grid', gap: 7 }}>
                  {alertas.map((a, i) => {
                    const fuente = a.fuenteId ? FUENTES[a.fuenteId] : undefined
                    return (
                      <div key={i} style={{ fontSize: 12.5, padding: '7px 9px', borderRadius: 8, background: 'var(--s2)', borderLeft: `3px solid ${colorNivel[a.nivel]}` }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: colorNivel[a.nivel], textTransform: 'uppercase', width: 62, flexShrink: 0 }}>{a.nivel}</span>
                          <span style={{ color: 'var(--text)', flex: 1 }}>{a.mensaje}</span>
                          {fuente && <button onClick={() => setEvidAlerta(evidAlerta === i ? null : i)} style={{ background: 'none', border: 'none', color: 'var(--nexus)', cursor: 'pointer', fontSize: 11, flexShrink: 0, padding: 0 }}>¿Por qué?</button>}
                        </div>
                        {fuente && evidAlerta === i && (
                          <div style={{ marginTop: 6, marginLeft: 70, fontSize: 11, color: 'var(--text3)', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                            {citarFuente(fuente)}{fuente.verified ? '' : ' · (fuente por confirmar contra el documento)'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>}
          </div>
        </div>
      </div>

      {/* ── TENDENCIAS: qué cambió en el tiempo ── */}
      <div style={{ marginTop: 18, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
            <Activity size={16} style={{ color: 'var(--nexus)' }} /> Tendencias · qué cambió {lecturas.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 400 }}>({lecturas.length} lectura{lecturas.length !== 1 ? 's' : ''} guardada{lecturas.length !== 1 ? 's' : ''})</span>}
          </div>
          <button onClick={guardarLectura} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Activity size={14} /> Guardar lectura
          </button>
        </div>
        {lecturas.length === 0
          ? <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '8px 0 0' }}>Guarda una lectura al inicio del pase; en la siguiente verás <b>qué cambió</b> (subió/bajó) por parámetro. Se comparte con el Copilot.</p>
          : cambios.length === 0
            ? <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '8px 0 0' }}>Sin cambios respecto a la última lectura guardada.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                {cambios.map((c, i) => (
                  <span key={i} style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: c.relevante ? 'var(--nexus-soft)' : 'var(--s2)', border: `1px solid ${c.relevante ? 'var(--border2)' : 'var(--border)'}`, color: c.relevante ? 'var(--text)' : 'var(--text3)' }}>
                    {c.label} {c.de}→{c.a} {c.direccion === 'sube' ? '↑' : '↓'}{c.unidad ? ' ' + c.unidad : ''}
                  </span>
                ))}
              </div>}
        {correlacion.asociaciones.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {correlacion.asociaciones.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--amber)', padding: '7px 9px', borderRadius: 8, background: 'var(--s2)', borderLeft: '3px solid #d97706' }}>{a}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── COPILOT IA (dual-model, razona sobre lo determinista) ── */}
      <div style={{ marginTop: 18, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
            <Brain size={17} style={{ color: 'var(--nexus)' }} /> Copilot IA · síntesis por sistemas
          </div>
          {copilot && (() => {
            const prop = planDesdeCopilot(copilot)
            if (!prop.texto) return null
            const yaEsta = planCopilot === prop.texto
            return (
              <button
                onClick={() => setPlanCopilot(yaEsta ? '' : prop.texto)}
                title={yaEsta
                  ? 'Quitar de la nota el análisis propuesto'
                  : 'Lleva el razonamiento del Copilot a la sección «Análisis». El PLAN son indicaciones y lo escribes tú: lo firmas y alguien lo va a ejecutar.'}
                style={{
                  marginRight: 8, padding: '6px 12px', borderRadius: 7, fontSize: 12.5,
                  cursor: 'pointer', fontWeight: 600,
                  border: '1px solid ' + (yaEsta ? 'var(--teal)' : 'var(--border2)'),
                  background: yaEsta ? 'var(--teal)' : 'transparent',
                  color: yaEsta ? '#fff' : 'var(--text2)',
                }}
              >
                {yaEsta
                  ? '✓ Análisis en la nota'
                  : `Pasar el análisis a la nota (${prop.problemas}${prop.divergencias ? ` + ${prop.divergencias}` : ''})`}
              </button>
            )
          })()}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 8 }}>
            {(['rapida', 'estandar', 'maxima'] as const).map(k => {
              const m = MOTORES[k]
              const c = COPILOT_UCI_POR_MOTOR[k]
              return (
                <button
                  key={k} onClick={() => setMotorCopilot(k)}
                  title={`${c.descripcion} · ${c.creditos} ${c.creditos === 1 ? 'crédito' : 'créditos'}`}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: '1px solid var(--border2)',
                    background: motorCopilot === k ? 'var(--teal)' : 'transparent',
                    color: motorCopilot === k ? '#fff' : 'var(--text2)',
                  }}
                >{m.emoji} {m.nombre} · {c.creditos}</button>
              )
            })}
          </div>
          <button onClick={pedirCopilot} disabled={copilotCargando} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, opacity: copilotCargando ? 0.7 : 1 }}>
            <Sparkles size={15} />{copilotCargando ? 'Razonando…' : copilot ? 'Regenerar' : 'Generar síntesis'}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '8px 0 0', display: 'flex', gap: 5, alignItems: 'center' }}>
          <Info size={12} /> Razona con Anthropic + OpenAI SOBRE los cálculos deterministas (no recalcula escalas). Sugiere qué verificar/decidir; no da órdenes. Tú decides y firmas.
        </p>
        {copilotError && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--red)' }}>{copilotError}</div>}
        {copilot?.primario && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {copilot.primario.resumen && <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{copilot.primario.resumen}</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              {copilot.primario.problemas.map((p, i) => {
                const c = p.prioridad === 'alta' ? '#dc2626' : p.prioridad === 'media' ? '#d97706' : 'var(--text3)'
                return (
                  <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderLeft: `3px solid ${c}`, borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: c }}>{p.prioridad}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.sistema.replace(/_/g, ' ')}</span>
                      <strong style={{ fontSize: 13.5 }}>{p.titulo}</strong>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, display: 'grid', gap: 2 }}>
                      {p.cambio && <div><b>Cambió:</b> {p.cambio}</div>}
                      {p.porque && <div><b>Por qué:</b> {p.porque}</div>}
                      {p.soporte && <div><b>Soporte:</b> {p.soporte}</div>}
                      {p.faltante && <div style={{ color: 'var(--amber)' }}><b>Falta para decidir:</b> {p.faltante}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            {copilot.primario.faltantesClave.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text2)' }}><b>Datos clave que faltan:</b> {copilot.primario.faltantesClave.join(' · ')}</div>
            )}
            {copilot.primario.seguridad.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--red)' }}><b>Seguridad:</b> {copilot.primario.seguridad.join(' · ')}</div>
            )}
            {copilot.divergencias.length > 0 && (
              <details>
                <summary style={{ fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer' }}>2ª opinión ({copilot.modelos.segunda}) añade {copilot.divergencias.length} punto(s) que el primario no tocó</summary>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {copilot.divergencias.map((p, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', padding: '7px 9px', background: 'var(--s2)', borderRadius: 8 }}>
                      <b>{p.sistema.replace(/_/g, ' ')}:</b> {p.titulo} — {p.cambio || p.porque}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, fontSize: 11.5, color: 'var(--text3)' }}>
              <span>Modelos: {[copilot.modelos.primario, copilot.modelos.segunda].filter(Boolean).join(' + ') || '—'}</span>
              <span style={{ marginLeft: 'auto' }}>¿Útil?</span>
              <button onClick={() => enviarFeedback('up')} disabled={!!feedbackDado} title="Marcar como útil (solo señal; no guarda datos del paciente)" style={{ background: 'none', border: 'none', cursor: feedbackDado ? 'default' : 'pointer', color: feedbackDado === 'up' ? 'var(--nexus)' : 'var(--text3)' }}><ThumbsUp size={15} /></button>
              <button onClick={() => enviarFeedback('down')} disabled={!!feedbackDado} title="No útil" style={{ background: 'none', border: 'none', cursor: feedbackDado ? 'default' : 'pointer', color: feedbackDado === 'down' ? '#dc2626' : 'var(--text3)' }}><ThumbsDown size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── CALCULADORA DE INFUSIÓN: dosis ↔ mL/h ── */}
      <details style={{ marginTop: 18, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: '4px 16px 16px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeartPulse size={16} style={{ color: 'var(--nexus)' }} /> Calculadora de infusión · dosis ↔ mL/h (vasopresores · inotrópicos)
        </summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Selector label="Fármaco" k="infFarmaco" v={v} set={set} w={180} opciones={CATALOGO_INFUSIONES.map(f => ({ val: f.key, txt: f.nombre }))} />
          <Selector label="Dilución estándar" k="infDil" v={v} set={set} w={175} opciones={(infFarmaco?.diluciones ?? []).map((d, i) => ({ val: String(i), txt: `${d.label} (${d.concentracion} ${d.unidadConc})` }))} />
          <span style={{ fontSize: 11.5, color: 'var(--text3)', alignSelf: 'center' }}>o tu dilución →</span>
          <Campo label={`En bolsa (${infFarmaco?.unidadConc === 'U/mL' ? 'U' : 'mg'})`} k="infCantBolsa" v={v} set={set} w={100} />
          <Campo label="Volumen" k="infMlBolsa" v={v} set={set} sufijo="mL" w={95} />
          {infFarmaco?.porKg && <Campo label="Peso" k="infPeso" v={v} set={set} sufijo="kg" w={85} />}
          <Selector label="Convertir" k="infDir" v={v} set={set} w={150} opciones={[{ val: 'dose', txt: `Dosis → mL/h` }, { val: 'rate', txt: `mL/h → Dosis` }]} />
          {v.infDir === 'rate'
            ? <Campo label="Velocidad" k="infRate" v={v} set={set} sufijo="mL/h" w={100} />
            : <Campo label={`Dosis (${infFarmaco?.unidad ?? 'µg/kg/min'})`} k="infDosis" v={v} set={set} w={150} />}
        </div>
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: infusion.ok ? 'var(--nexus-soft)' : 'var(--s2)', border: '1px solid var(--border2)' }}>
          {infusion.ok
            ? <>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {/* E0-05: la unidad ya no viaja en un campo paralelo — sale de la
                      propia cantidad, así que no puede desincronizarse del número. */}
                  {v.infDir === 'rate'
                    ? <>{infusion.dosis?.valor} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)' }}>{infusion.dosis?.unidad}</span></>
                    : <>{infusion.rateMlH?.valor} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)' }}>mL/h</span></>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{infusion.interpretacion}</div>
                {infusion.advertencias.map((a, i) => <div key={i} style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>⚠ {a}</div>)}
              </>
            : <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{infusion.motivoBloqueo}</div>}
          {infFarmaco?.nota && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>{infFarmaco.nota}</div>}
        </div>
      </details>

      {/* ── SOPORTES EXTRACORPÓREOS: CKRT / PRISMA · ECMO ── */}
      <details style={{ marginTop: 18, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: '4px 16px 16px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Waves size={16} style={{ color: 'var(--nexus)' }} /> Soportes extracorpóreos · CKRT / PRISMA · ECMO
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }} className="nx-uci-grid">
          {/* CKRT — sólo si el paciente la lleva. Ver `usaCkrt`. */}
          {!usaCkrt ? (
            <SoporteApagado
              icon={Droplets} titulo="CKRT / PRISMA"
              descripcion="Este paciente no tiene terapia continua registrada."
              onEncender={() => alternarSoporte('ckrt')}
            />
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Bloque icon={Droplets} titulo="CKRT / PRISMA">
              <Selector label="Modalidad" k="ckrtMod" v={v} set={set} w={130} opciones={[
                { val: 'CVVHDF', txt: 'CVVHDF' }, { val: 'CVVHD', txt: 'CVVHD' }, { val: 'CVVH', txt: 'CVVH' }, { val: 'SCUF', txt: 'SCUF' }]} />
              <Campo label="Peso" k="ckrtPeso" v={v} set={set} sufijo="kg" w={80} />
              <Campo label="Qb" k="ckrtQb" v={v} set={set} sufijo="mL/min" w={95} />
              <Campo label="Dializado" k="ckrtDial" v={v} set={set} sufijo="mL/h" w={100} />
              <Campo label="Repo. pre" k="ckrtPre" v={v} set={set} sufijo="mL/h" w={100} />
              <Campo label="Repo. post" k="ckrtPost" v={v} set={set} sufijo="mL/h" w={100} />
              <Campo label="UF neta" k="ckrtUf" v={v} set={set} sufijo="mL/h" w={95} />
              <Campo label="Hto" k="ckrtHto" v={v} set={set} sufijo="%" w={70} />
              <Campo label="Horas activas/24h" k="ckrtHoras" v={v} set={set} sufijo="h" w={130} />
            </Bloque>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 8 }}>
              <Resultado label="Efluente" r={{ ok: ckrt.ok, valor: ckrt.efluenteMlH, unidad: 'mL/h', motivoBloqueo: ckrt.motivoBloqueo, interpretacion: ckrt.modalidad ?? '' }} />
              <Resultado label="Dosis (entregada/prescrita)" r={{ ok: ckrt.dosisPrescritaMlKgH != null, valor: ckrt.dosisEntregadaMlKgH ?? ckrt.dosisPrescritaMlKgH, unidad: 'mL/kg/h', motivoBloqueo: 'sin peso/tiempo', interpretacion: ckrt.dosisEntregadaMlKgH != null ? 'entregada' : 'prescrita' }} />
              <Resultado label="Fracción de filtración" r={{ ok: ckrt.fraccionFiltracionPct != null, valor: ckrt.fraccionFiltracionPct, unidad: '%', motivoBloqueo: 'requiere Qb + Hto (CVVH/CVVHDF)', interpretacion: 'meta < 25%' }} />
              {ckrt.advertencias.map((a, i) => <div key={i} style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ {a}</div>)}
              {citrato.ratioCaTotalIonico != null && <div style={{ fontSize: 12.5, color: citrato.patronAcumulacion ? '#dc2626' : 'var(--text3)' }}>Citrato · ratio Ca total/iónico {citrato.ratioCaTotalIonico}{citrato.patronAcumulacion ? ' — patrón de acumulación (verificar)' : ''}</div>}
            </div>
            <Bloque icon={Droplets} titulo="Citrato (anticoagulación regional)">
              <Campo label="iCa sistémico" k="ciCaSis" v={v} set={set} sufijo="mmol/L" w={120} />
              <Campo label="iCa postfiltro" k="ciCaPost" v={v} set={set} sufijo="mmol/L" w={120} />
              <Campo label="Ca total" k="ciCaTot" v={v} set={set} sufijo="mmol/L" w={110} />
            </Bloque>
          </div>
          )}

          {/* ECMO — sólo si el paciente lo lleva. */}
          {!usaEcmo ? (
            <SoporteApagado
              icon={HeartPulse} titulo="ECMO / ECLS"
              descripcion="Este paciente no tiene soporte extracorpóreo registrado."
              onEncender={() => alternarSoporte('ecmo')}
            />
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Bloque icon={HeartPulse} titulo="ECMO / ECLS">
              <Selector label="Configuración" k="ecmoConf" v={v} set={set} w={130} opciones={[
                { val: 'VA', txt: 'VA' }, { val: 'VV', txt: 'VV' }, { val: 'VAV', txt: 'V-AV' }]} />
              <Campo label="P. pre-oxi" k="ecmoPre" v={v} set={set} sufijo="mmHg" w={100} />
              <Campo label="P. post-oxi" k="ecmoPost" v={v} set={set} sufijo="mmHg" w={100} />
              <Campo label="ΔP basal" k="ecmoBasal" v={v} set={set} sufijo="mmHg" w={95} />
              <Campo label="Hb libre" k="ecmoPfhb" v={v} set={set} sufijo="mg/dL" w={100} />
              <Campo label="LDH" k="ecmoLdh" v={v} set={set} sufijo="U/L" w={85} />
              <Campo label="Haptoglob." k="ecmoHapto" v={v} set={set} sufijo="mg/dL" w={105} />
              {(v.ecmoConf === 'VV' || v.ecmoConf === 'VAV') && <>
                <Campo label="Flujo" k="ecmoFlujo" v={v} set={set} sufijo="L/min" w={90} />
                <Campo label="Gasto (CO)" k="ecmoCo" v={v} set={set} sufijo="L/min" w={100} />
                <Campo label="SaO₂ pac." k="ecmoSao2" v={v} set={set} sufijo="%" w={95} />
                <Campo label="SvO₂ pre-oxi" k="ecmoSvo2" v={v} set={set} sufijo="%" w={110} />
                <Campo label="Sweep" k="ecmoSweep" v={v} set={set} sufijo="L/min" w={95} />
                <Campo label="PaCO₂" k="ecmoPaco2" v={v} set={set} sufijo="mmHg" w={95} />
              </>}
              {(v.ecmoConf === 'VA' || v.ecmoConf === 'VAV') && <>
                <Campo label="SpO₂ mano der." k="ecmoSpD" v={v} set={set} sufijo="%" w={120} />
                <Campo label="SpO₂ inferior" k="ecmoSpI" v={v} set={set} sufijo="%" w={110} />
                <Campo label="PAS" k="ecmoPas" v={v} set={set} sufijo="mmHg" w={90} />
                <Campo label="PAD" k="ecmoPad" v={v} set={set} sufijo="mmHg" w={90} />
                <Selector label="Válvula Ao abre" k="ecmoValv" v={v} set={set} w={120} opciones={[{ val: 'si', txt: 'Sí' }, { val: 'no', txt: 'No' }]} />
                <Selector label="Edema pulmonar" k="ecmoEdema" v={v} set={set} w={120} opciones={[{ val: 'si', txt: 'Sí' }, { val: 'no', txt: 'No' }]} />
              </>}
            </Bloque>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Vigilancia ECMO {ecmo.oxigenador.ok ? `· ΔP ${ecmo.oxigenador.deltaP} mmHg` : ''}</div>
              {ecmo.señales.length === 0
                ? <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Sin señales con los datos actuales.</div>
                : <div style={{ display: 'grid', gap: 7 }}>
                    {ecmo.señales.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '7px 9px', borderRadius: 8, background: 'var(--s2)', borderLeft: `3px solid ${colorNivel[s.nivel]}` }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: colorNivel[s.nivel], textTransform: 'uppercase', width: 58, flexShrink: 0 }}>{s.nivel}</span>
                        <span>{s.mensaje}</span>
                      </div>
                    ))}
                  </div>}
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.4 }}>
                El motor detecta cambios vs basal y patrones (recirculación, hipoxia diferencial, distensión de VI, hemólisis) y pide verificación. NO autodiagnostica trombosis del oxigenador ni ejecuta descarga/venting.
              </div>
            </div>
          </div>
          )}
        </div>
      </details>
      </>)}

      <style>{`@media (max-width: 820px){ .nx-uci-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  )
}

/**
 * Un soporte que este paciente NO lleva.
 *
 * En vez de treinta campos vacíos y tres «bloqueado», una línea que dice lo que
 * pasa y un botón para encenderlo si hace falta. El panel deja de preguntar por
 * el flujo del dializado de alguien que no está dializado.
 */
function SoporteApagado({ icon: Icon, titulo, descripcion, onEncender }: {
  icon: typeof Droplets
  titulo: string
  descripcion: string
  onEncender: () => void
}) {
  return (
    <div style={{
      background: 'var(--s1)', border: '1px dashed var(--border2)', borderRadius: 14,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13.5, color: 'var(--text2)' }}>
        <Icon size={15} style={{ color: 'var(--text3)' }} /> {titulo}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>{descripcion}</div>
      <button
        onClick={onEncender}
        style={{
          alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 7, fontSize: 12.5,
          border: '1px solid var(--border2)', background: 'transparent',
          color: 'var(--text2)', cursor: 'pointer',
        }}
      >Activar {titulo.split(' ')[0]}</button>
    </div>
  )
}
