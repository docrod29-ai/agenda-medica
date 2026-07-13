'use client'
import { useState } from 'react'
import { PageHeader, Button, Spinner } from '@/components/ui'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { getPatients, createPatient } from '@/lib/firestore'
import type { Patient } from '@/types'
import {
  pacientesACsv, parseCsv, mapearEncabezados, construirFilas, clasificarFilas,
  normalizarTel, type FilaImport, type EstadoFila,
} from '@/lib/csv-pacientes'
import { Download, Upload, Users, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'

type Clasificada = { fila: FilaImport; estado: EstadoFila }

export default function MigracionPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()

  const [exportando, setExportando] = useState(false)
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
      const pacientes = await getPatients(clinicId)
      if (!pacientes.length) { toast('No hay pacientes para exportar', 'info'); return }
      const csv = pacientesACsv(pacientes)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const hoy = new Date().toISOString().slice(0, 10)
      a.href = url; a.download = `pacientes_${hoy}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast(`Exportados ${pacientes.length} pacientes`, 'success')
    } catch {
      toast('No se pudo exportar', 'error')
    } finally {
      setExportando(false)
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
      const existentes = await getPatients(clinicId)
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
              columnas automáticamente y <strong>omitimos los pacientes duplicados</strong> por teléfono. Solo
              necesitas una columna de <strong>Nombre</strong>.
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
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.12)', padding: '4px 10px', borderRadius: 100 }}>
                    {conteo.nuevo} nuevos
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '4px 10px', borderRadius: 100 }}>
                    {conteo.duplicado} duplicados (se omiten)
                  </span>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  {clasificadas!.slice(0, 200).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', opacity: c.estado === 'nuevo' ? 1 : 0.55 }}>
                      {c.estado === 'nuevo'
                        ? <CheckCircle2 size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                        : <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0 }} />}
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
        ¿Tienes miles de expedientes en otro sistema o en PDF? Escríbenos a soporte@nexusmed.mx y te ayudamos
        con la migración asistida — nosotros movemos tus pacientes, tú sigues consultando.
      </p>
    </div>
  )
}
