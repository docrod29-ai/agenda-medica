'use client'
import { useState } from 'react'
import { PageHeader, Button, Spinner } from '@/components/ui'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { fetchAutenticado } from '@/lib/auth-client'
import { recorrerPacientes, createPatient } from '@/lib/firestore'
import { edadEnAnios } from '@/lib/expediente/pediatria'
import type { Patient } from '@/types'
import {
  pacientesACsv, parseCsv, mapearEncabezados, construirFilas, clasificarFilas,
  normalizarTel, type FilaImport, type EstadoFila,
} from '@/lib/csv-pacientes'
import { Download, Upload, Users, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { CORREO_SOPORTE } from '@/lib/contacto'

type Clasificada = { fila: FilaImport; estado: EstadoFila }

export default function MigracionPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast, confirm } = useToast()

  const [exportando, setExportando] = useState(false)
  const [dominioEnCurso, setDominioEnCurso] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [clasificadas, setClasificadas] = useState<Clasificada[] | null>(null)
  const [importando, setImportando] = useState(false)
  const [reporte, setReporte] = useState<{ creados: number; duplicados: number; errores: number } | null>(null)

  /* ─── Exportar ─── */
  const exportar = async () => {
    if (!clinicId) return
    setExportando(true)
    try {
      /**
       * REG-351 — UN EXPORT INCOMPLETO QUE SE LLAMA «MIS PACIENTES» ES UNA
       * MENTIRA SOBRE LA PORTABILIDAD.
       *
       * Esto usaba `getPatients`, que desde REG-341 devuelve como mucho 500. En
       * un consultorio grande el CSV salía recortado y el toast decía
       * «Exportados 500 pacientes» con toda naturalidad — el número parece un
       * recuento y es un techo. El argumento de esta pantalla es «tu
       * información es tuya»; media información no lo cumple.
       *
       * Se recorre entero, página a página. Si aun así se toca el techo, se
       * DICE: un archivo incompleto que se cree completo es peor que no tenerlo.
       */
      const { pacientes, incompleto, techo } = await recorrerPacientes(clinicId)
      if (!pacientes.length) { toast('No hay pacientes para exportar', 'info'); return }
      if (incompleto) {
        const seguir = await confirm(
          `Tu directorio supera los ${techo.toLocaleString('es-MX')} pacientes y la descarga se quedaría corta. Si continúas, el archivo NO contendrá a todos. ¿Descargarlo de todas formas?`,
          { peligro: true, confirmar: 'Descargar incompleto' },
        )
        if (!seguir) return
      }
      const csv = pacientesACsv(pacientes)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const hoy = new Date().toISOString().slice(0, 10)
      a.href = url; a.download = `pacientes_${hoy}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast(
        incompleto
          ? `Descargados ${pacientes.length} pacientes. El archivo está INCOMPLETO: no es tu directorio entero.`
          : `Exportados ${pacientes.length} pacientes`,
        incompleto ? 'error' : 'success',
      )
    } catch {
      toast('No se pudo exportar', 'error')
    } finally {
      setExportando(false)
    }
  }

  /**
   * EXPORTACIÓN CLÍNICA POR DOMINIO.
   *
   * El botón de al lado descarga once columnas de demografía. Esta pantalla se
   * llama «Migración» y el argumento que la sostiene es «no te secuestro tus
   * datos»: un competidor abre ese CSV en una demo y gana la reunión sin decir
   * una palabra.
   *
   * Esto no sustituye al respaldo completo (`clinic/exportar`, NDJSON, para
   * RECONSTRUIR): es lo que se abre en una hoja de cálculo para mirarlo,
   * contarlo o dárselo al contador.
   */
  const exportarDominio = async (dominio: string) => {
    if (!clinicId || dominioEnCurso) return
    setDominioEnCurso(dominio)
    try {
      const res = await fetchAutenticado(`/api/clinic/exportar-csv?clinicId=${encodeURIComponent(clinicId)}&dominio=${dominio}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast(d.error || 'No se pudo exportar', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const hoy = new Date().toISOString().slice(0, 10)
      a.href = url; a.download = `${dominio}_${hoy}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast('Descargado. La última fila dice cuántas filas trae.', 'success')
    } catch {
      toast('No se pudo conectar para exportar', 'error')
    } finally {
      setDominioEnCurso(null)
    }
  }

  /**
   * EL LIBRO DE EXCEL — una descarga en vez de seis.
   *
   * Los seis botones de arriba bajan seis CSV que hay que pegar a mano en una
   * hoja de cálculo. Esto baja el mismo contenido ya montado, con una pestaña
   * por dominio y una de RESUMEN delante que dice qué trae y qué le falta.
   */
  const exportarLibro = async () => {
    if (!clinicId || dominioEnCurso) return
    setDominioEnCurso('__libro__')
    try {
      const res = await fetchAutenticado(`/api/clinic/exportar-excel?clinicId=${encodeURIComponent(clinicId)}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast(d.error || 'No se pudo exportar', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `ausculta_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast('Descargado. La primera pestaña dice qué trae y si falta algo.', 'success')
    } catch {
      toast('No se pudo conectar para exportar', 'error')
    } finally {
      setDominioEnCurso(null)
    }
  }

  const cargarArchivo = (f: File) => {
    const r = new FileReader()
    r.onload = () => setTexto(String(r.result ?? ''))
    r.readAsText(f, 'utf-8')
  }

  /* ─── Analizar (previsualizar + deduplicar) ─── */
  const analizar = async () => {
    if (!clinicId || !texto.trim()) return
    setAnalizando(true); setReporte(null)
    try {
      const csv = parseCsv(texto)
      if (csv.length < 2) { toast('El archivo no tiene filas de datos', 'error'); return }
      const mapeo = mapearEncabezados(csv[0])
      if (!mapeo.includes('nombre')) {
        toast('No se encontró una columna de "Nombre". Revisa el encabezado.', 'error'); return
      }
      const filas = construirFilas(csv, mapeo)
      /**
       * REG-351 — CONTRA QUÉ SE DECIDE SI UNA FILA ES «NUEVA».
       *
       * Esto comparaba contra `getPatients`, que desde REG-341 devuelve como
       * mucho 500. En un consultorio grande **todo el que quedara fuera del
       * recorte se clasificaba como `nuevo`**, y el botón de importar duplicaba
       * el consultorio de un clic — cada duplicado con su mitad de la historia,
       * sus alergias y su medicación repartidas entre dos expedientes.
       *
       * Es el peor sitio del producto para mirar sólo una parte, así que aquí se
       * recorre entero. Y si el recorrido no llega hasta el final, **no se
       * clasifica**: decir «nuevo» sin haber podido mirar a todos es
       * exactamente el error caro.
       */
      const { pacientes: existentes, incompleto } = await recorrerPacientes(clinicId)
      if (incompleto) {
        toast(
          'No se pudo revisar el directorio completo, así que no se puede decir con seguridad quién es nuevo. Importar ahora duplicaría expedientes.',
          'error',
        )
        return
      }
      setClasificadas(clasificarFilas(filas, existentes))
    } catch {
      toast('No se pudo leer el CSV', 'error')
    } finally {
      setAnalizando(false)
    }
  }

  /* ─── Importar (solo los nuevos) ─── */
  const importar = async () => {
    if (!clinicId || !clasificadas) return
    const nuevos = clasificadas.filter(c => c.estado === 'nuevo')
    if (!nuevos.length) { toast('No hay pacientes nuevos para importar', 'info'); return }
    setImportando(true)
    let creados = 0, errores = 0
    for (const { fila } of nuevos) {
      try {
        const data: Omit<Patient, 'id'> = {
          nombre: fila.nombre.trim(),
          telefono: normalizarTel(fila.telefono),
          whatsapp: fila.whatsapp ? normalizarTel(fila.whatsapp) : undefined,
          email: fila.email?.trim() || undefined,
          fechaNacimiento: fila.fechaNacimiento?.trim() || undefined,
          // Derivar la EDAD de la fecha de nacimiento: sin esto, un niño importado
          // quedaba con edad=undefined y NO se le mostraban las herramientas
          // pediátricas (ni las gineco por edad), porque el gate usa `edad`.
          edad: edadEnAnios(fila.fechaNacimiento?.trim()) ?? undefined,
          sexo: fila.sexo === 'Masculino' || fila.sexo === 'Femenino' || fila.sexo === 'Otro' ? fila.sexo : undefined,
          curp: fila.curp?.trim() || undefined,
          seguroMedico: fila.seguroMedico?.trim() || undefined,
          alergias: fila.alergias?.trim() || undefined,
          notas: fila.notas?.trim() || undefined,
          noShowCount: 0, cancelacionCount: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          creadoPor: user?.email ?? 'importación',
        }
        await createPatient(clinicId, data)
        creados++
      } catch {
        errores++
      }
    }
    const duplicados = clasificadas.filter(c => c.estado !== 'nuevo').length
    setReporte({ creados, duplicados, errores })
    setClasificadas(null); setTexto('')
    setImportando(false)
    toast(`Importación lista: ${creados} nuevos${errores ? `, ${errores} con error` : ''}`, errores ? 'info' : 'success')
  }

  const conteo = clasificadas
    ? {
        nuevo: clasificadas.filter(c => c.estado === 'nuevo').length,
        duplicado: clasificadas.filter(c => c.estado === 'duplicado').length,
      }
    : null

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      <PageHeader title="Migración y exportación" subtitle="Tu información es tuya. Tráete tus pacientes de otro sistema o llévate una copia cuando quieras." />

      {/* Exportar */}
      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--nexus-soft)', display: 'grid', placeItems: 'center', color: 'var(--nexus)', flexShrink: 0 }}>
            <Download size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Exportar mis pacientes</div>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', margin: '4px 0 14px', lineHeight: 1.5 }}>
              Descarga la lista completa de tus pacientes en CSV (se abre en Excel). Sin secuestro de datos.
            </div>
            <Button onClick={exportar} loading={exportando} icon={<FileSpreadsheet size={16} />}>
              Descargar pacientes (CSV)
            </Button>

            {/*
              LO CLÍNICO, QUE ES LO QUE FALTABA.

              El botón de arriba son once columnas de demografía: nombre,
              teléfono, correo… Cero contenido clínico. Esta pantalla dice «tu
              información es tuya» y entregaba una agenda de contactos.
            */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Y lo clínico, por si lo quieres en una hoja de cálculo
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
                Una fila por elemento —un diagnóstico, un medicamento, un analito— con la nota
                de la que salió. Para reconstruir el consultorio entero está el respaldo
                completo en Pacientes; esto es para leerlo, contarlo o dárselo a tu contador.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* El libro va PRIMERO: es lo que casi todo el mundo quiere, y los
                    seis CSV sueltos son para quien necesite uno en concreto. */}
                <Button variant="primary" size="sm"
                  onClick={exportarLibro}
                  loading={dominioEnCurso === '__libro__'}
                  disabled={!!dominioEnCurso && dominioEnCurso !== '__libro__'}
                  icon={<Download size={14} />}>
                  Todo en Excel (.xlsx)
                </Button>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>o suelto en CSV:</span>
                {([
                  ['consultas', 'Consultas'], ['diagnosticos', 'Diagnósticos'],
                  ['medicamentos', 'Medicamentos'], ['laboratorios', 'Laboratorios'],
                  ['citas', 'Citas'], ['cobros', 'Cobros'],
                ] as const).map(([clave, etiqueta]) => (
                  <Button key={clave} variant="secondary" size="sm"
                    onClick={() => exportarDominio(clave)}
                    loading={dominioEnCurso === clave}
                    disabled={!!dominioEnCurso && dominioEnCurso !== clave}
                    icon={<Download size={14} />}>
                    {etiqueta}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Importar */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--nexus-soft)', display: 'grid', placeItems: 'center', color: 'var(--nexus)', flexShrink: 0 }}>
            <Upload size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Importar pacientes</div>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', margin: '4px 0 14px', lineHeight: 1.5 }}>
              Sube un CSV o Excel exportado desde tu sistema actual (o desde Google Contactos). Detectamos las
              columnas automáticamente y <strong>omitimos los que ya tienes</strong>. Una familia que comparte
              teléfono se importa entera: para omitir a alguien tiene que parecerse el <strong>nombre</strong>,
              no sólo el número. Solo necesitas una columna de <strong>Nombre</strong>.
            </div>

            <label className="btn btn-secondary btn-sm" style={{ marginBottom: 12, cursor: 'pointer' }}>
              <Upload size={15} /> Elegir archivo CSV
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) cargarArchivo(f) }} />
            </label>

            <textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); setClasificadas(null) }}
              placeholder={'…o pega aquí el contenido del CSV.\nEjemplo:\nNombre,Teléfono,Email\nMaría López,6641234567,maria@correo.com'}
              rows={5}
              style={{
                width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12.5,
                padding: 12, borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--s2)', color: 'var(--text)', resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button onClick={analizar} loading={analizando} disabled={!texto.trim()} variant="secondary">
                Analizar y previsualizar
              </Button>
              {conteo && conteo.nuevo > 0 && (
                <Button onClick={importar} loading={importando} icon={<CheckCircle2 size={16} />}>
                  Importar {conteo.nuevo} nuevo{conteo.nuevo !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            {/* Previsualización */}
            {analizando && <div style={{ marginTop: 14 }}><Spinner label="Analizando…" /></div>}
            {conteo && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 12%, transparent)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>
                    {conteo.nuevo} nuevos
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>
                    {conteo.duplicado} duplicados (se omiten)
                  </span>
                </div>
                {/*
                  LOS OMITIDOS SE ENSEÑAN SIEMPRE, AUNQUE LA LISTA SE CORTE.
                  Una fila marcada como duplicada NO se importa, y el reporte final
                  la cuenta como un acierto. Si además queda fuera del recorte de la
                  vista previa, el paciente se pierde sin que nadie pueda verlo. Los
                  nuevos son los que sobran si hay que recortar algo.
                */}
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  {[...clasificadas!.filter(c => c.estado !== 'nuevo'),
                    ...clasificadas!.filter(c => c.estado === 'nuevo')].slice(0, 200).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', opacity: c.estado === 'nuevo' ? 1 : 0.55 }}>
                      {c.estado === 'nuevo'
                        ? <CheckCircle2 size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                        : <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fila.nombre}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{c.fila.telefono || '—'}</span>
                    </div>
                  ))}
                  {clasificadas!.length > 200 && (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                      …y {clasificadas!.length - 200} más (se importarán todas)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reporte */}
            {reporte && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Users size={16} style={{ color: 'var(--nexus)' }} /> Reporte de migración
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  ✅ {reporte.creados} pacientes creados<br />
                  ⏭️ {reporte.duplicados} duplicados omitidos<br />
                  {reporte.errores > 0 && <>⚠️ {reporte.errores} con error (revisa el formato)<br /></>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16, lineHeight: 1.5 }}>
        ¿Tienes miles de expedientes en otro sistema o en PDF? Escríbenos a {CORREO_SOPORTE} y te ayudamos
        con la migración asistida — nosotros movemos tus pacientes, tú sigues consultando.
      </p>
    </div>
  )
}
