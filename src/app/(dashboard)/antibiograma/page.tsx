'use client'
/**
 * Herramienta de antibiograma inteligente — apoyo decisional PROA.
 * El médico captura organismo + sitio + panel S/I/R (con CMI opcional);
 * el motor DETERMINISTA infiere fenotipos, MECANISMO molecular
 * (β-lactamasas/porinas/bombas/carbapenemasas), terapia dirigida por clase,
 * conflictos de resistencia intrínseca y una explicación didáctica citada.
 * Superficie independiente: no toca el flujo de la nota/consulta.
 */
import { useState, useRef, useMemo, useEffect } from 'react'
import { resumenParaNota } from '@/lib/expediente/antibiograma/resumen-nota'
import {
  interpretarAntibiograma, sitioDesdeMuestra, pruebasDesdeReporte,
  CATALOGO_ATB, ATB_FRECUENTES,
  type SIR, type SitioInfeccion, type InterpretacionAntibiograma, type EntradaAntibiograma,
  type PruebasConfirmatorias, type ResultadoPrueba,
} from '@/lib/expediente/antibiograma'
import { parseCMI } from '@/lib/expediente/antibiograma/cmi'
import { ESTANDAR_DEL_MOTOR, EDICION_DEL_MOTOR, type ProcedenciaAntibiograma, type Estandar, type MetodoAST } from '@/lib/expediente/antibiograma/procedencia'
import { fetchAutenticado } from '@/lib/auth-client'

// Pruebas confirmatorias que traen los reportes automatizados / el laboratorio.
const PRUEBAS_CONF: { k: keyof PruebasConfirmatorias; t: string; hint: string }[] = [
  { k: 'cefoxitinaScreen', t: 'Tamiz cefoxitina (MRSA)', hint: 'mecA — pos = MRSA' },
  { k: 'dTest', t: 'D-test (clindamicina inducible)', hint: 'pos = clindamicina R' },
  { k: 'esbl', t: 'BLEE (confirmatoria)', hint: 'sinergia con clavulanato' },
  { k: 'carbapenemasa', t: 'Carbapenemasa (mCIM/Carba NP)', hint: 'pos = productor' },
  { k: 'betaLactamasa', t: 'β-lactamasa (nitrocefina)', hint: 'pos = penicilina R' },
  { k: 'hlar', t: 'HLAR (alto nivel aminoglucósidos)', hint: 'pierde sinergia' },
]
import {
  FlaskConical, Plus, Trash2, AlertTriangle, ShieldAlert, Activity, Info, Bug,
  Dna, Target, BookOpen, Microscope, Pencil, Camera, Loader2, TestTube, Brain,
} from 'lucide-react'

interface CeldaVision { antibiotico?: string; interpretacion?: string | null; cmi?: number | null; cmi_texto?: string | null; conf?: string; needs_review?: boolean }
/** Metadatos del reporte extraídos de la foto (muestra, método, sistema…). */
interface MetaReporte {
  muestra?: string; recuento?: string; fecha?: string; metodo?: string
  sistema?: string; gram?: string; otros?: string[]; observaciones?: string
}

// Catálogo COMPLETO (clásicos → aprobados 2026) agrupado por clase; los frecuentes van de atajo.

const SITIOS: { v: SitioInfeccion; t: string }[] = [
  { v: 'otro', t: 'General' }, { v: 'sangre', t: 'Sangre' }, { v: 'orina', t: 'Orina' },
  { v: 'respiratorio', t: 'Respiratorio' }, { v: 'snc', t: 'SNC/meningitis' },
  { v: 'piel-partes-blandas', t: 'Piel/partes blandas' }, { v: 'intraabdominal', t: 'Intraabdominal' },
  { v: 'hueso-articulacion', t: 'Hueso/articulación' },
]

interface Fila { antibiotico: string; interpretacion: SIR; cmi: string }
const nuevaFila = (antibiotico = ''): Fila => ({ antibiotico, interpretacion: 'S', cmi: '' })

/**
 * La lectura de la CMI vive en `antibiograma/cmi.ts`, no aquí.
 *
 * Estaba en este archivo, y por eso el camino de la FOTO —que corre en la
 * librería, no en la pantalla— nunca la usaba: reenviaba el número pelado y
 * jamás asignaba `cmiCensurada`. El mismo reporte daba S por foto e I tecleado.
 * Una implementación por camino garantiza que vuelvan a divergir.
 */

/**
 * Herramienta de antibiograma.
 *
 * Se exporta como COMPONENTE además de como página para poder embeberla en la
 * consulta: era la herramienta principal del médico y su conclusión había que
 * reescribirla a mano en la nota, porque vivía en una pantalla aparte.
 */
export function AntibiogramaTool({ embebido, onAgregarANota }: {
  embebido?: boolean
  onAgregarANota?: (texto: string) => void
} = {}) {
  const [organismo, setOrganismo] = useState('')
  const [sitio, setSitio] = useState<SitioInfeccion>('otro')
  const [filas, setFilas] = useState<Fila[]>([nuevaFila('Ceftriaxona'), nuevaFila('Meropenem')])
  const [pruebas, setPruebas] = useState<PruebasConfirmatorias>({})
  /**
   * PROCEDENCIA DEL REPORTE — decisión 3 del Dr.
   *
   * Sin esto, la decisión 3 estaba implementada y no se podía disparar nunca:
   * el motor sólo edita una categoría discordante con los ocho campos
   * verificados, y dos de ellos —estándar y edición— no vienen impresos en la
   * mayoría de los reportes. Una regla que no puede cumplirse es una regla
   * escrita y sin conectar.
   *
   * Nace VACÍA a propósito: rellenarla con «CLSI, edición vigente» por omisión
   * sería declarar por el médico justo lo que la decisión exige comprobar.
   */
  const [procedencia, setProcedencia] = useState<ProcedenciaAntibiograma>({})
  const [cargandoFoto, setCargandoFoto] = useState(false)
  const [avisoFoto, setAvisoFoto] = useState<string[]>([])
  const [meta, setMeta] = useState<MetaReporte | null>(null)
  const [version, setVersion] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Versión viva (la expone el service worker) para confirmar el despliegue.
  useEffect(() => {
    const v = (window as unknown as { __AUSCULTA_VERSION?: string }).__AUSCULTA_VERSION
    if (v) setVersion(v)
    else { const t = setTimeout(() => setVersion((window as unknown as { __AUSCULTA_VERSION?: string }).__AUSCULTA_VERSION || ''), 1500); return () => clearTimeout(t) }
  }, [])

  // REACTIVO: se recalcula SOLO al cambiar organismo, panel, sitio o pruebas.
  // Ya no hace falta volver a picar "Interpretar" — es dinámico.
  const res: InterpretacionAntibiograma | null = useMemo(() => {
    if (!organismo.trim()) return null
    const resultados = filas
      .filter(f => f.antibiotico.trim())
      .map(f => {
        const cmi = parseCMI(f.cmi)
        return {
          antibiotico: f.antibiotico.trim(),
          interpretacion: f.interpretacion,
          ...(cmi != null ? { cmi: cmi.valor, ...(cmi.censurada ? { cmiCensurada: cmi.censurada } : {}) } : {}),
        }
      })
    return interpretarAntibiograma({ organismo: organismo.trim(), resultados, sitio, pruebas, procedencia })
  }, [organismo, filas, sitio, pruebas, procedencia])

  /** La misma entrada que consumió el motor, para poder resumirla a la nota. */
  const entradaActual: EntradaAntibiograma | null = useMemo(() => {
    if (!organismo.trim()) return null
    return {
      organismo: organismo.trim(),
      sitio,
      pruebas,
      procedencia,
      resultados: filas.filter(f => f.antibiotico.trim()).map(f => {
        const cmi = parseCMI(f.cmi)
        return {
          antibiotico: f.antibiotico.trim(),
          interpretacion: f.interpretacion,
          ...(cmi != null ? { cmi: cmi.valor, ...(cmi.censurada ? { cmiCensurada: cmi.censurada } : {}) } : {}),
        }
      }),
    }
  }, [organismo, filas, sitio, pruebas, procedencia])

  const setPrueba = (k: keyof PruebasConfirmatorias, v: ResultadoPrueba | undefined) =>
    setPruebas(p => { const n = { ...p }; if (v) (n[k] as ResultadoPrueba | undefined) = v; else delete n[k]; return n })

  // Razonamiento con IA sobre el motor determinista.
  const [razonando, setRazonando] = useState(false)
  const [razonamiento, setRazonamiento] = useState<{ texto: string; segunda?: string; contradicciones?: { agente: string; motivo: string }[]; contradiccionesSegunda?: { agente: string; motivo: string }[]; omite?: boolean; omiteSegunda?: boolean } | null>(null)
  const [errorRaz, setErrorRaz] = useState('')

  const razonarIA = async () => {
    setRazonando(true); setErrorRaz(''); setRazonamiento(null)
    try {
      const resultados = filas.filter(f => f.antibiotico.trim()).map(f => {
        const cmi = parseCMI(f.cmi)
        // La CMI va como NÚMERO (cmi.valor), no como el objeto {valor,censurada}: el
        // motor del servidor exige typeof === 'number' o descarta TODA la lógica de CMI
        // (VRSA/VISA/HLAR-por-CMI/SDD) y la IA premium razonaría sobre un panel mutilado.
        return {
          antibiotico: f.antibiotico.trim(), interpretacion: f.interpretacion,
          ...(cmi != null ? { cmi: cmi.valor, ...(cmi.censurada ? { cmiCensurada: cmi.censurada } : {}) } : {}),
        }
      })
      const resp = await fetchAutenticado('/api/expediente/antibiograma-razonar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organismo: organismo.trim(), resultados, sitio, pruebas, procedencia, motor: 'maxima' }),
      })
      const data = await resp.json().catch(() => null)
      if (!data?.ok) { setErrorRaz(data?.error || `No se pudo razonar (HTTP ${resp.status})`); return }
      /**
       * `contradiccionesSegundaOpinion` YA viajaba desde el servidor y el cliente
       * la tiraba (E0-15a): la segunda opinión se mostraba sin su caja roja
       * aunque el validador hubiera detectado que contradice al motor.
       */
      setRazonamiento({
        texto: data.razonamiento,
        segunda: data.segundaOpinion,
        contradicciones: data.contradicciones,
        contradiccionesSegunda: data.contradiccionesSegundaOpinion,
        /* REG-259 — lo que el texto se CALLÓ, no sólo lo que contradice. */
        omite: data.omiteAlertasCriticas,
        omiteSegunda: data.omiteAlertasCriticasSegundaOpinion,
      })
    } catch (e) {
      setErrorRaz('Error de red: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setRazonando(false)
    }
  }

  const setFila = (i: number, patch: Partial<Fila>) =>
    setFilas(fs => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const quitar = (i: number) => setFilas(fs => fs.filter((_, j) => j !== i))
  const agregar = (nombre = '') => setFilas(fs => [...fs, nuevaFila(nombre)])

  const onFoto = async (file: File) => {
    setCargandoFoto(true); setAvisoFoto([])
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result)); fr.onerror = () => reject(new Error('lectura'))
        fr.readAsDataURL(file)
      })
      const resp = await fetchAutenticado('/api/expediente/antibiograma-vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen: dataUrl, sitio }),
      })
      const data = await resp.json()
      if (!data.ok) { setAvisoFoto([data.error || `No se pudo leer la foto (HTTP ${resp.status})`]); return }
      const perfil = data.perfil || {}
      if (perfil.organismo) setOrganismo(String(perfil.organismo))

      // Panel S/I/R — conserva la CMI TAL CUAL (con su símbolo: "≤0.5", ">16", "2/38").
      const celdas: CeldaVision[] = Array.isArray(perfil.resultados) ? perfil.resultados : []
      // SEGURIDAD DEL PACIENTE: una celda que la IA no pudo leer (null, vacío, "ND")
      // NO se asume Sensible. Antes caía por defecto en 'S', se pintaba en verde
      // igual que una lectura real y el motor la consumía como sensible: podía
      // recomendarse un antibiótico al que el organismo es resistente.
      const esValida = (x: unknown): x is 'S' | 'I' | 'R' => x === 'S' || x === 'I' || x === 'R'
      const legibles = celdas.filter(c => c.antibiotico && esValida(c.interpretacion))
      // SDD (sensible dosis-dependiente, p. ej. cefepime CMI 4-8): SÍ se leyó, pero el
      // panel trabaja en S/I/R. NO es "ilegible" — se separa para no dar un aviso falso
      // de "no se pudo leer" sobre algo que el laboratorio sí reportó.
      const sdd = celdas.filter(c => c.antibiotico && c.interpretacion === 'SDD').map(c => String(c.antibiotico))
      const ilegibles = celdas.filter(c => c.antibiotico && !esValida(c.interpretacion) && c.interpretacion !== 'SDD')
                             .map(c => String(c.antibiotico))
      const nuevas: Fila[] = legibles.map(c => ({
        antibiotico: String(c.antibiotico),
        interpretacion: c.interpretacion as 'S' | 'I' | 'R',
        cmi: c.cmi_texto ? String(c.cmi_texto) : c.cmi != null ? String(c.cmi) : '',
      }))
      if (nuevas.length) setFilas(nuevas)

      // AUTO-LLENADO: la MUESTRA define el sitio (cambia breakpoints, p. ej. neumococo meníngeo).
      const sitioAuto = sitioDesdeMuestra(perfil.muestra)
      if (sitioAuto) setSitio(sitioAuto)
      // AUTO-LLENADO: pruebas confirmatorias YA IMPRESAS en el reporte.
      const pruebasAuto = pruebasDesdeReporte(perfil.pruebasReportadas)
      if (Object.keys(pruebasAuto).length) setPruebas(p => ({ ...p, ...pruebasAuto }))
      // Metadatos del reporte para mostrarlos.
      setMeta({
        muestra: perfil.muestra, recuento: perfil.recuento, fecha: perfil.fecha,
        metodo: perfil.metodo, sistema: perfil.sistema, gram: perfil.gram,
        otros: Array.isArray(perfil.organismosAdicionales) ? perfil.organismosAdicionales : undefined,
        observaciones: perfil.observaciones,
      })

      const avisos: string[] = []
      if (data._schemaWarning) avisos.push('Parte del reporte no se pudo estructurar por completo; revisa las filas y complétalas a mano donde falte.')
      if (Array.isArray(perfil.avisos)) perfil.avisos.forEach((a: string) => avisos.push(a))
      if (sdd.length) {
        avisos.push('ℹ Reportados como SDD (sensible dosis-dependiente): ' + sdd.join(', ') +
          '. El panel usa S/I/R; captúralos a mano según el punto de corte de DOSIS ALTA (p. ej. cefepime CMI 4-8).')
      }
      if (ilegibles.length) {
        avisos.push('⚠ NO se pudo leer la interpretación de: ' + ilegibles.join(', ') +
          '. Se dejaron FUERA del panel a propósito, para no darlos por sensibles. Captúralos a mano si los necesitas.')
      }
      const rev = celdas.filter(c => c.needs_review || c.conf === 'baja').map(c => c.antibiotico).filter(Boolean)
      if (rev.length) avisos.push('⚠ Lectura dudosa (revisa a mano): ' + rev.join(', '))
      if (sitioAuto) avisos.push(`Sitio ajustado automáticamente a «${SITIOS.find(s => s.v === sitioAuto)?.t ?? sitioAuto}» por la muestra reportada.`)
      const etiquetasPruebas = Object.keys(pruebasAuto)
        .map(k => PRUEBAS_CONF.find(p => p.k === k)?.t)   // nombre legible, no la clave interna
        .filter((t): t is string => Boolean(t))
      if (etiquetasPruebas.length) avisos.push(`Pruebas confirmatorias tomadas del reporte: ${etiquetasPruebas.join(', ')}.`)
      if (Array.isArray(perfil.organismosAdicionales) && perfil.organismosAdicionales.length) {
        avisos.push(`⚠ Cultivo POLIMICROBIANO: también se reportó ${perfil.organismosAdicionales.join(', ')}. Interpreta un aislamiento a la vez.`)
      }
      avisos.push('La IA solo TRANSCRIBE. Verifica organismo, muestra y S/I/R antes de interpretar — tú confirmas.')
      setAvisoFoto(avisos)
    } catch (e) {
      setAvisoFoto(['Error al leer la foto: ' + (e instanceof Error ? e.message : String(e))])
    } finally {
      setCargandoFoto(false)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 60px' }}>
      <style>{'.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <FlaskConical size={22} color="var(--teal)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Antibiograma inteligente — PROA</h1>
        {version && <span title="Versión desplegada" style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: 'var(--teal)', background: 'color-mix(in srgb, var(--nexus) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)', borderRadius: 'var(--r-pill)', padding: '2px 9px' }}>{version.replace('ausculta-', '')}</span>}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.5 }}>
        Captura organismo, sitio y panel S/I/R (con CMI si la tienes). El motor infiere fenotipos,
        <b> mecanismo molecular</b>, terapia dirigida y notificación NOM-045, con explicación citada.
        <b> Apoyo decisional — no sustituye el juicio clínico.</b>
      </p>

      {/* Modo FOTO: la IA transcribe el perfil, el motor razona */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 18, background: 'var(--s1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Camera size={16} color="var(--teal)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Leer desde una foto</span>
          <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>(la IA transcribe el S/I/R; tú confirmas y el motor razona)</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFoto(f); e.target.value = '' }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={cargandoFoto}
          style={{ ...cta, marginTop: 0, opacity: cargandoFoto ? 0.6 : 1, cursor: cargandoFoto ? 'wait' : 'pointer', background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          {cargandoFoto ? <><Loader2 size={16} className="spin" /> Leyendo la foto…</> : <><Camera size={16} /> Subir / tomar foto del antibiograma</>}
        </button>
        {meta && (meta.muestra || meta.metodo || meta.sistema || meta.recuento || meta.fecha || meta.gram) && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {meta.muestra && <span style={metaChip}><b>Muestra:</b> {meta.muestra}</span>}
            {meta.recuento && <span style={metaChip}><b>Recuento:</b> {meta.recuento}</span>}
            {meta.metodo && <span style={metaChip}><b>Método:</b> {meta.metodo}</span>}
            {meta.sistema && <span style={metaChip}><b>Sistema:</b> {meta.sistema}</span>}
            {meta.gram && <span style={metaChip}><b>Gram:</b> {meta.gram}</span>}
            {meta.fecha && <span style={metaChip}><b>Fecha:</b> {meta.fecha}</span>}
          </div>
        )}
        {meta?.observaciones && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
            <b>Observaciones del laboratorio:</b> {meta.observaciones}
          </div>
        )}
        {avisoFoto.length > 0 && (
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {avisoFoto.map((a, i) => <li key={i} style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>)}
          </ul>
        )}
      </div>

      {/* Organismo + sitio */}
      <label style={label} htmlFor="atb-organismo">Organismo</label>
      <input id="atb-organismo" value={organismo} onChange={e => setOrganismo(e.target.value)}
        placeholder="p. ej. Escherichia coli, Klebsiella pneumoniae, Pseudomonas aeruginosa, S. aureus"
        style={{ ...input, marginBottom: 14 }} />

      <label style={label}>Sitio de infección (afina la lectura, p. ej. neumococo meníngeo)</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {SITIOS.map(s => (
          <button key={s.v} type="button" onClick={() => setSitio(s.v)}
            style={{ ...chip, ...(sitio === s.v ? { background: 'var(--nexus-solido)', color: '#fff', borderColor: 'var(--teal)' } : {}) }}>
            {s.t}
          </button>
        ))}
      </div>

      {/* Panel */}
      <label style={label}>Panel de sensibilidad</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {filas.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={f.antibiotico} onChange={e => setFila(i, { antibiotico: e.target.value })}
              placeholder="Antibiótico" list="ab-comunes" style={{ ...input, flex: 1 }} />
            <div style={{ display: 'flex', gap: 3 }}>
              {(['S', 'I', 'R'] as SIR[]).map(v => (
                <button key={v} type="button" onClick={() => setFila(i, { interpretacion: v })}
                  style={sirBtn(f.interpretacion === v, v)}>{v}</button>
              ))}
            </div>
            <input value={f.cmi} onChange={e => setFila(i, { cmi: e.target.value })}
              placeholder="CMI" inputMode="decimal" style={{ ...input, width: 66, textAlign: 'center' }} />
            <button type="button" onClick={() => quitar(i)} style={delBtn} aria-label="Quitar"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      {/* Autocompletado con el catálogo COMPLETO, etiquetado por clase */}
      <datalist id="ab-comunes">
        {CATALOGO_ATB.map(g => g.agentes.map(a => <option key={`${g.clase}-${a}`} value={a} label={g.clase} />))}
      </datalist>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => agregar()} style={addBtn}><Plus size={14} /> Fila</button>
        {ATB_FRECUENTES.slice(0, 12).map(a => (
          <button key={a} type="button" onClick={() => agregar(a)} style={chip}>{a}</button>
        ))}
      </div>

      {/*
        PROCEDENCIA DEL REPORTE — desbloquea la decisión 3 del Dr.
        Mientras estos campos no se declaren, el motor NUNCA edita una categoría
        discordante: sólo la señala y bloquea las conclusiones que dependan de
        ella. Es la conducta conservadora, y es la correcta por omisión.
      */}
      <label style={{ ...label, marginTop: 20 }}>Procedencia del reporte (desbloquea la corrección por CMI)</label>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
        Si la CMI y la categoría del laboratorio no coinciden, el motor sólo puede corregirla cuando
        sabe con qué estándar se interpretó. Sin esto NO corrige nada — lo señala y te dice qué falta.
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Estándar</div>
          <select value={procedencia.estandar ?? ''} style={input}
            onChange={e => setProcedencia(p => ({ ...p, estandar: (e.target.value || undefined) as Estandar | undefined }))}>
            <option value="">Sin declarar</option>
            {(['CLSI', 'FDA', 'EUCAST', 'otro'] as const).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Edición</div>
          <input value={procedencia.edicion ?? ''} placeholder={EDICION_DEL_MOTOR} style={input}
            onChange={e => setProcedencia(p => ({ ...p, edicion: e.target.value || undefined }))} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Método</div>
          <select value={procedencia.metodo ?? ''} style={input}
            onChange={e => setProcedencia(p => ({ ...p, metodo: (e.target.value || undefined) as MetodoAST | undefined }))}>
            <option value="">Sin declarar</option>
            <option value="mic">CMI (microdilución)</option>
            <option value="automatizado">Automatizado</option>
            <option value="gradiente">Gradiente / E-test</option>
            <option value="disco">Difusión en disco</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Unidad de la CMI</div>
          <select value={procedencia.unidad ?? ''} style={input}
            onChange={e => setProcedencia(p => ({ ...p, unidad: e.target.value || undefined }))}>
            <option value="">Sin declarar</option>
            <option value="mg/L">mg/L (µg/mL)</option>
          </select>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
        El motor interpreta con <b>{ESTANDAR_DEL_MOTOR} {EDICION_DEL_MOTOR}</b>. Si tu laboratorio usa
        otro estándar u otra edición, el motor no corrige: te lo dice y conserva las dos lecturas.
      </div>

      {/* Pruebas confirmatorias del reporte automatizado (opcionales) */}
      <label style={{ ...label, marginTop: 20 }}>Pruebas confirmatorias del reporte (opcional)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {PRUEBAS_CONF.map(p => (
          <div key={p.k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{p.t}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{p.hint}</div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['pos', 'neg'] as ResultadoPrueba[]).map(v => {
                const on = pruebas[p.k] === v
                const color = v === 'pos' ? 'var(--red)' : 'var(--green)'
                return (
                  <button key={v} type="button" onClick={() => setPrueba(p.k, on ? undefined : v)}
                    style={{ minWidth: 44, height: 30, borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      border: '1px solid ' + (on ? color : 'var(--border)'), background: on ? color : 'var(--s2)', color: on ? '#fff' : 'var(--text3)' }}>
                    {v === 'pos' ? 'POS' : 'NEG'}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--nexus) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 25%, transparent)', color: 'var(--teal)', fontSize: 12.5, fontWeight: 600 }}>
        <FlaskConical size={15} />
        {organismo.trim()
          ? 'Interpretación en vivo — se actualiza sola al cambiar organismo, S/I/R, CMI o pruebas.'
          : 'Escribe el organismo para interpretar (en vivo).'}
      </div>

      {res && <Resultado res={res} />}

      {/* Razonamiento del modelo SOBRE el motor determinista; la atribución
          de qué modelo razonó vive en el panel de resultados, no en el botón
          (§25: la acción es un verbo, la procedencia va con el contenido). */}
      {res && (res.fenotipos.length > 0 || res.categoriasCMI.length > 0 || organismo.trim()) && (
        <div style={{ marginTop: 18 }}>
          <button type="button" onClick={razonarIA} disabled={razonando}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, cursor: razonando ? 'wait' : 'pointer', opacity: razonando ? 0.7 : 1 }}>
            {razonando ? <><Loader2 size={16} className="spin" /> Interpretando el cultivo…</> : <><Brain size={16} /> Interpretar el cultivo</>}
          </button>
          {errorRaz && <div style={{ ...box, marginTop: 8, borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)' }}>{errorRaz}</div>}
          {razonamiento && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--teal)' }}>
                  <Brain size={15} /><span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase' }}>Razonamiento clínico (IA sobre el motor)</span>
                </div>
                {/*
                  El motor es la autoridad sobre los HECHOS. Si el texto de la IA
                  recomienda algo que el panel reporta R, que el motor marcó como
                  "evitar" o a lo que la especie es intrínsecamente resistente, se
                  anota AQUÍ en vez de censurar el razonamiento: quitar el texto
                  entero por una frase le costaría al médico el resto del análisis.
                */}
                {!!razonamiento.contradicciones?.length && (
                  <div style={{
                    background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
                    borderRadius: 10, padding: '11px 13px', marginBottom: 12,
                    fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)',
                  }}>
                    <strong>Ojo: el texto de abajo contradice al motor.</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {razonamiento.contradicciones.map((c, i) => (
                        <li key={i}><strong>{c.agente}</strong> — {c.motivo}.</li>
                      ))}
                    </ul>
                    <div style={{ color: 'var(--text3)', marginTop: 6, fontSize: 12 }}>
                      Los puntos de corte y el fenotipo los calcula el motor determinista; la IA solo razona sobre ellos.
                    </div>
                  </div>
                )}
                {/*
                  LO QUE EL TEXTO SE CALLÓ (REG-259).

                  La caja de arriba avisa de lo que el texto CONTRADICE. Ésta,
                  de lo que OMITE — el otro modo de fallo, y el más silencioso:
                  el motor detecta una carbapenemasa, el texto no la menciona,
                  y se lee un razonamiento impecable que no dice lo único que
                  había que decir.

                  Se avisa, no se completa: las alertas del motor están arriba,
                  enteras. Rellenar el razonamiento del modelo por su cuenta
                  sería inventar juicio clínico.
                */}
                {razonamiento.omite && (
                  <div style={{
                    background: 'color-mix(in srgb, var(--amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
                    borderRadius: 10, padding: '11px 13px', marginBottom: 12,
                    fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)',
                  }}>
                    <strong>El texto de abajo no menciona las alertas críticas del motor.</strong>
                    <div style={{ color: 'var(--text3)', marginTop: 6, fontSize: 12 }}>
                      No las contradice: las omite. Léelas arriba antes de decidir.
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{razonamiento.texto}</p>
              </div>
              {razonamiento.segunda && (
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.03em' }}>Segunda opinión (GPT-5)</div>
                  {!!razonamiento.contradiccionesSegunda?.length && (
                    <div style={{
                      background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
                      borderRadius: 10, padding: '11px 13px', marginBottom: 10,
                      fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)',
                    }}>
                      <strong>Ojo: la segunda opinión contradice al motor.</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {razonamiento.contradiccionesSegunda.map((c, i) => (
                          <li key={i}><strong>{c.agente}</strong> — {c.motivo}.</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{razonamiento.segunda}</p>
                </div>
              )}
              <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>
                La IA razona sobre los hechos del motor determinista (no inventa puntos de corte). Apoyo a la decisión — el juicio clínico es tuyo.
              </p>
            </div>
          )}
        </div>
      )}

      {/*
        La conclusión del antibiograma se lleva a la nota de un clic. Antes había
        que reescribirla a mano: la herramienta vivía en su propia pantalla, fuera
        de la consulta.
      */}
      {onAgregarANota && res && entradaActual && (
        <button
          type="button"
          onClick={() => onAgregarANota(resumenParaNota(entradaActual, res))}
          className="lift"
          style={{
            marginTop: 16, background: 'var(--nexus-solido)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          }}>
          → Agregar el antibiograma a la nota
        </button>
      )}
    </div>
  )
}

export default function AntibiogramaPage() {
  return <AntibiogramaTool />
}

function Resultado({ res }: { res: InterpretacionAntibiograma }) {
  const badge = (c: string) => c === 'confirmado' ? { bg: 'color-mix(in srgb, var(--red) 15%, transparent)', fg: '#f87171' }
    : c === 'probable' ? { bg: 'color-mix(in srgb, var(--amber) 15%, transparent)', fg: '#f59e0b' }
    : { bg: 'rgba(148,163,184,.15)', fg: 'var(--text3)' }

  const conflictos = res.resistenciaIntrinseca.filter(n => n.tipo === 'conflicto')
  const alertasClinicas = res.resistenciaIntrinseca.filter(n => n.tipo === 'alerta_clinica')

  return (
    <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {res.notificacionObligatoria && (
        <div style={{ ...box, borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)' }}>
          <ShieldAlert size={16} /> <b>Notificación epidemiológica obligatoria (NOM-045).</b>
          {res.aislamiento && <span style={{ color: 'var(--text2)' }}> · {res.aislamiento}</span>}
        </div>
      )}

      {conflictos.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Conflicto con resistencia intrínseca" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conflictos.map((n, i) => (
              <div key={i} style={{ ...box, borderColor: 'color-mix(in srgb, var(--amber) 40%, transparent)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)', color: 'var(--amber)' }}>
                <span><b>{n.antibiotico}:</b> {n.mensaje}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {alertasClinicas.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Alerta clínica — no reportar como utilizable" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertasClinicas.map((n, i) => (
              <div key={i} style={{ ...box, borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)' }}>
                <span><b>{n.antibiotico}:</b> {n.mensaje}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.fenotipos.length === 0
        ? <div style={{ ...box, color: 'var(--text3)' }}><Info size={15} /> Sin fenotipos de resistencia detectados en el panel capturado.</div>
        : (
          <div>
            <SecTitle icon={<Bug size={15} />} t="Fenotipos de resistencia" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {res.fenotipos.map((f, i) => {
                const b = badge(f.confianza)
                return (
                  <div key={i} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{f.nombre}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: b.bg, color: b.fg }}>{f.confianza}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>{f.base}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {res.mecanismos.length > 0 && (
        <div>
          <SecTitle icon={<Dna size={15} />} t="Mecanismo molecular inferido" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {res.mecanismos.map((m, i) => (
              <div key={i} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{m.nombre}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'var(--s2)', color: 'var(--text3)' }}>{m.categoria}{m.ambler ? ` · clase ${m.ambler}` : ''}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 5px', lineHeight: 1.5 }}>{m.explicacion}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>{m.referencia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.terapiaDirigida.length > 0 && (
        <div>
          <SecTitle icon={<Target size={15} />} t="Terapia dirigida por mecanismo" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.terapiaDirigida.map((t, i) => (
              <div key={i} style={{ ...box, ...terapiaEstilo(t.linea) }}>
                <span><b>{etiquetaLinea(t.linea)} · {t.agente}</b> — {t.razon}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.algoritmo.length > 0 && (
        <div>
          <SecTitle icon={<Target size={15} />} t="Algoritmo de diagnóstico de resistencia" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.algoritmo.map(p => {
              const c = p.estado === 'hecho' ? '#10b981' : p.estado === 'pendiente' ? '#f59e0b' : 'var(--text3)'
              const et = p.estado === 'hecho' ? '✓' : p.estado === 'pendiente' ? '→' : '·'
              return (
                <div key={p.n} style={{ ...box, alignItems: 'flex-start', opacity: p.estado === 'na' ? 0.6 : 1 }}>
                  <span style={{ color: c, fontWeight: 800, minWidth: 34 }}>{et} {p.n}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ color: 'var(--text)' }}>{p.titulo}</b>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{p.detalle}</div>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {res.categoriasCMI.length > 0 && (
        <div>
          <SecTitle icon={<Microscope size={15} />} t="Interpretación de CMI (puntos de corte CLSI M100)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.categoriasCMI.map((c, i) => {
              // NO APLICABLE: no se pinta la categoría en verde/color. Gris + motivo.
              // Evita que una «S» se lea como utilizable fuera de su indicación validada.
              if (c.noAplicable) {
                return (
                  <div key={i} style={{ ...box, color: 'var(--text3)' }}>
                    <span>
                      <b style={{ color: 'var(--text2)' }}>{c.antibiotico}</b> · CMI {c.cmi} µg/mL → <b style={{ color: 'var(--text3)' }}>No aplicable</b>
                      {c.motivoNoAplicable && <span> · {c.motivoNoAplicable}</span>}
                    </span>
                  </div>
                )
              }
              /**
               * EDITADA POR REGLA EXPERTA: la categoría del punto de corte NO se
               * pinta en verde. Un levofloxacino con CMI 0.5 es «S» en la tabla
               * del CLSI, y esta tarjeta lo pintaba VERDE —el color de «úsalo»—
               * en la misma pantalla donde el panel de arriba ya decía R por
               * cross-resistencia EUCAST. El verde es la parte que se lee sin
               * leer: el mismo trato que `noAplicable`, por la misma razón.
               */
              const col = c.editadaPorReglaExperta ? 'var(--text3)'
                : c.categoriaCLSI === 'S' ? '#10b981'
                : c.categoriaCLSI === 'SDD' ? '#3b82f6'
                : c.categoriaCLSI === 'I' ? '#f59e0b' : '#f87171'
              const etiqueta = c.categoriaCLSI === 'SDD' ? 'SDD (dependiente de dosis)' : c.categoriaCLSI
              const resaltar = c.concuerda === false || c.conflictoConEdicion
              return (
                <div key={i} style={{ ...box, ...(resaltar ? { borderColor: 'color-mix(in srgb, var(--amber) 50%, transparent)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)' } : {}) }}>
                  <span style={{ color: 'var(--text2)' }}>
                    <b>{c.antibiotico}</b> · CMI {c.cmi} µg/mL → <b style={{ color: col }}>{etiqueta}</b> (CLSI)
                    {c.categoriaCLSI === 'SDD' && <span style={{ color: 'var(--text3)' }}> · usa el esquema de dosis alto (no la dosis estándar)</span>}
                    {c.soloUTI && <span style={{ color: 'var(--text3)' }}> · solo IVU no complicada</span>}
                    {c.concuerda === false && <span style={{ color: 'var(--amber)' }}> · ⚠ discrepa del reporte ({c.categoriaReportada})</span>}
                    {c.editadaPorReglaExperta && (
                      <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
                        {' '}· ⚠ la interpretación que MANDA es <b>{c.interpretacionEfectiva}</b> (regla experta)
                        {c.conflictoConEdicion && <span style={{ fontWeight: 400 }}> — no lo elijas por esta CMI</span>}
                      </span>
                    )}
                  </span>
                  {c.editadaPorReglaExperta && c.edicionRazon && (
                    <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                      {c.edicionRazon}{c.edicionReferencia ? ` · ${c.edicionReferencia}` : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {res.pruebasSugeridas.length > 0 && (
        <div>
          <SecTitle icon={<TestTube size={15} />} t="Pruebas microbiológicas sugeridas (CLSI M100)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {res.pruebasSugeridas.map((p, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{p.nombre}</div>
                <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '0 0 4px', lineHeight: 1.5 }}><b>Cuándo:</b> {p.cuando}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '0 0 4px', lineHeight: 1.5 }}><b>Método:</b> {p.metodo}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: '0 0 5px', lineHeight: 1.5 }}><b>Interpretación:</b> {p.interpretacion}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>{p.referencia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/**
        * Lo que se recorta se dice. Estas pruebas SÍ correspondían al fenotipo,
        * pero su resultado ya viene en el reporte capturado, así que no se piden
        * de nuevo. Sin este bloque, desaparecerían de la lista y no habría forma
        * de distinguir «no aplicaba» de «ya estaba hecha».
        */}
      {(res.pruebasYaReportadas?.length ?? 0) > 0 && (
        <div>
          <SecTitle icon={<TestTube size={15} />} t="Ya vienen en el reporte (no se piden de nuevo)" />
          <div style={{ ...card, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            {res.pruebasYaReportadas!.map(p => p.nombre).join(' · ')}
          </div>
        </div>
      )}

      {res.alertas.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Alertas clínicas" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.alertas.map((a, i) => (
              <div key={i} style={{ ...box, ...alertaEstilo(a.nivel) }}>{a.mensaje}</div>
            ))}
          </div>
        </div>
      )}

      {res.edicionesInterpretativas.length > 0 && (
        <div>
          <SecTitle icon={<Pencil size={15} />} t="Ediciones interpretativas (EUCAST)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.edicionesInterpretativas.map((e, i) => (
              <div key={i} style={{ ...box, borderColor: 'color-mix(in srgb, var(--amber) 40%, transparent)', background: 'color-mix(in srgb, var(--amber) 6%, transparent)', color: 'var(--text2)' }}>
                <span><b>{e.antibiotico}: {e.de} → {e.a}</b> — {e.razon}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.advertencias.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Advertencias de stewardship" />
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {res.advertencias.map((a, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {res.didactica.length > 0 && (
        <div>
          <SecTitle icon={<BookOpen size={15} />} t="Aprende: por qué este patrón" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {res.didactica.map((d, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{d.titulo}</div>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 5px', lineHeight: 1.5 }}>{d.texto}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>{d.referencia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.optimizacionPKPD.length > 0 && (
        <div>
          <SecTitle icon={<Activity size={15} />} t="Optimización PK/PD" />
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {res.optimizacionPKPD.map((a, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {res.referencias.length > 0 && (
        <div>
          <SecTitle icon={<Microscope size={15} />} t="Referencias" />
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {res.referencias.map((r, i) => <li key={i} style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{r}</li>)}
          </ol>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
        Motor determinista basado en lectura interpretada del antibiograma (CLSI M100 / EUCAST /
        literatura citada). Herramienta en validación clínica; confirmar mecanismo por método
        fenotípico/molecular cuando aplique.
      </p>
    </div>
  )
}

function SecTitle({ icon, t }: { icon: React.ReactNode; t: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--teal)' }}>
      {icon}<span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase' }}>{t}</span>
    </div>
  )
}

function alertaEstilo(n: 'critica' | 'alta' | 'info'): React.CSSProperties {
  if (n === 'critica') return { borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)' }
  if (n === 'alta') return { borderColor: 'color-mix(in srgb, var(--amber) 40%, transparent)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)', color: 'var(--amber)' }
  return { color: 'var(--text2)' }
}

function terapiaEstilo(l: 'dirigida' | 'alternativa' | 'evitar'): React.CSSProperties {
  if (l === 'dirigida') return { borderColor: 'rgba(16,185,129,.4)', background: 'rgba(16,185,129,.08)', color: 'var(--text2)' }
  if (l === 'evitar') return { borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 6%, transparent)', color: 'var(--text2)' }
  return { color: 'var(--text2)' }
}
function etiquetaLinea(l: 'dirigida' | 'alternativa' | 'evitar'): string {
  return l === 'dirigida' ? '✓ Dirigida' : l === 'evitar' ? '✕ Evitar' : '○ Alternativa'
}

const label: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const input: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 6, flexShrink: 0 }
const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px dashed var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }
const chip: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 'var(--r-pill)', padding: '5px 11px', fontSize: 11.5, cursor: 'pointer' }
const metaChip: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '4px 9px', fontSize: 11 }
const cta: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 600, marginTop: 20, width: '100%' }
const box: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 12.5, lineHeight: 1.5 }
const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }

function sirBtn(activo: boolean, v: SIR): React.CSSProperties {
  // S/I/R es la lectura clínica del antibiograma: tiene que leerse igual en los dos temas.
  const color = v === 'S' ? 'var(--green)' : v === 'I' ? 'var(--amber)' : 'var(--red)'
  return {
    width: 32, height: 34, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: '1px solid ' + (activo ? color : 'var(--border)'),
    background: activo ? color : 'var(--s2)',
    color: activo ? '#fff' : 'var(--text3)',
  }
}
