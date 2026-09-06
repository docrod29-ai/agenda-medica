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
  columnasDescartadas, fechaDeArchivoEsAmbigua, ORDEN_DE_FECHA_POR_OMISION,
  normalizarTel, type FilaImport, type OrdenDeFecha, type FilaClasificada,
} from '@/lib/csv-pacientes'
import { Download, Upload, Users, CheckCircle2, AlertTriangle, FileSpreadsheet, Info } from 'lucide-react'
import { CORREO_SOPORTE } from '@/lib/contacto'
import Link from 'next/link'

type Clasificada = FilaClasificada

/** Una fila que no se pudo crear, con su motivo. Se enseña y se puede bajar. */
type FilaFallida = { nombre: string; telefono: string; motivo: string }

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
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null)
  const [reporte, setReporte] = useState<{ creados: number; duplicados: number; fallidas: FilaFallida[] } | null>(null)
  /**
   * ASE-003 — LA FECHA AMBIGUA SE PREGUNTA, NO SE ADIVINA.
   *
   * «03/04/1975» es el 3 de abril o el 4 de marzo según de qué sistema venga el
   * archivo, y de esa fecha cuelgan la edad, la dosis pediátrica y el motor de
   * duplicados. Se pregunta UNA VEZ por archivo —no por fila— y con es-MX
   * puesto de salida, que es lo que el médico va a tener el 99 % de las veces.
   */
  const [ordenDeFecha, setOrdenDeFecha] = useState<OrdenDeFecha>(ORDEN_DE_FECHA_POR_OMISION)
  const [fechasAmbiguas, setFechasAmbiguas] = useState(0)
  /** Columnas del archivo con dato que no alimentan ningún campo (ASE-004). */
  const [descartadas, setDescartadas] = useState<{ encabezado: string; ejemplo: string }[]>([])
  /** Filas que el médico decidió importar aunque el motor las marcara repetidas. */
  const [forzadas, setForzadas] = useState<Set<number>>(new Set())
  /** El archivo ya troceado, para poder reanalizar sin volver a pedirlo. */
  const [csvCrudo, setCsvCrudo] = useState<string[][] | null>(null)
  const [existentes, setExistentes] = useState<Patient[] | null>(null)

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

  /**
   * ASE-008 — EL .XLSX SE RECHAZA DICIENDO CÓMO CONVERTIRLO.
   *
   * El texto prometía «CSV o Excel» y el lector hace `readAsText`: un .xlsx es
   * un ZIP, así que salía convertido en ruido y el error final era «No se
   * encontró una columna de Nombre», que manda a mirar el encabezado de un
   * archivo que está perfecto. Aquí se dice la verdad y el gesto que resuelve.
   */
  const cargarArchivo = (f: File) => {
    if (/\.(xlsx|xls|numbers|ods)$/i.test(f.name)) {
      toast(
        'Todavía no leemos archivos de Excel. Ábrelo en Excel y usa Archivo → Guardar como → CSV UTF-8; ese archivo sí entra.',
        'error',
      )
      return
    }
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
      const filas = construirFilas(csv, mapeo, { ordenDeFecha })
      /**
       * ASE-004 — LO QUE EL ARCHIVO TRAE Y NO SE VA A GUARDAR, ANTES DE GUARDAR.
       * El hueco de los apellidos no dolió por el mapeo: dolió porque nadie lo
       * veía. Estas dos listas son lo que la vista previa tiene que enseñar.
       */
      setDescartadas(columnasDescartadas(csv, mapeo).map(c => ({ encabezado: c.encabezado, ejemplo: c.ejemplo })))
      const colFecha = mapeo.indexOf('fechaNacimiento')
      setFechasAmbiguas(colFecha < 0 ? 0 : csv.slice(1).filter(f => fechaDeArchivoEsAmbigua(f[colFecha] ?? '')).length)
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
      const { pacientes: existentesAhora, incompleto } = await recorrerPacientes(clinicId)
      const existentes = existentesAhora
      if (incompleto) {
        toast(
          'No se pudo revisar el directorio completo, así que no se puede decir con seguridad quién es nuevo. Importar ahora duplicaría expedientes.',
          'error',
        )
        return
      }
      setCsvCrudo(csv)
      setExistentes(existentes)
      setForzadas(new Set())
      setClasificadas(clasificarFilas(filas, existentes))
    } catch {
      toast('No se pudo leer el CSV', 'error')
    } finally {
      setAnalizando(false)
    }
  }

  /* ─── Importar (los nuevos, más los que el médico decidió forzar) ─── */
  const importar = async () => {
    if (!clinicId || !clasificadas) return
    const nuevos = clasificadas.filter((c, i) => c.estado === 'nuevo' || forzadas.has(i))
    if (!nuevos.length) { toast('No hay pacientes nuevos para importar', 'info'); return }
    setImportando(true)
    setProgreso({ hechos: 0, total: nuevos.length })
    let creados = 0
    /**
     * ASE-006 — LA FILA QUE FALLA SE NOMBRA.
     *
     * El `catch` sólo subía un contador: «⚠️ 2 con error (revisa el formato)»
     * sin decir cuáles, y el textarea se vaciaba en la misma sentencia, así que
     * reintentar sólo las que fallaron era imposible sin volver a subir todo.
     */
    const fallidas: FilaFallida[] = []
    for (const { fila } of nuevos) {
      try {
        const data: Omit<Patient, 'id'> = {
          nombre: fila.nombre.trim(),
          telefono: normalizarTel(fila.telefono),
          whatsapp: fila.whatsapp ? normalizarTel(fila.whatsapp) : undefined,
          email: fila.email?.trim() || undefined,
          // La fecha llega YA en ISO desde `construirFilas` (ASE-003): lo que
          // no se pudo traducir no llega hasta aquí, llega vacío y declarado.
          fechaNacimiento: fila.fechaNacimiento || undefined,
          // Derivar la EDAD de la fecha de nacimiento: sin esto, un niño importado
          // quedaba con edad=undefined y NO se le mostraban las herramientas
          // pediátricas (ni las gineco por edad), porque el gate usa `edad`.
          edad: edadEnAnios(fila.fechaNacimiento) ?? undefined,
          sexo: fila.sexo === 'Masculino' || fila.sexo === 'Femenino' || fila.sexo === 'Otro' ? fila.sexo : undefined,
          // El CURP ya pasó por `validarCURP` (A-013/ASE-005): o tiene forma de
          // CURP, o `construirFilas` lo dejó fuera y lo anotó como reparo.
          curp: fila.curp || undefined,
          seguroMedico: fila.seguroMedico?.trim() || undefined,
          alergias: fila.alergias?.trim() || undefined,
          notas: fila.notas?.trim() || undefined,
          noShowCount: 0, cancelacionCount: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          creadoPor: user?.email ?? 'importación',
        }
        await createPatient(clinicId, data)
        creados++
      } catch (e) {
        fallidas.push({
          nombre: fila.nombre,
          telefono: fila.telefono ?? '',
          motivo: (e as { message?: string })?.message || 'No se pudo crear el expediente.',
        })
      }
      setProgreso(p => (p ? { ...p, hechos: p.hechos + 1 } : p))
    }
    const duplicados = clasificadas.filter((c, i) => c.estado !== 'nuevo' && !forzadas.has(i)).length
    setReporte({ creados, duplicados, fallidas })
    setClasificadas(null)
    // ASE-006: el archivo NO se tira cuando algo falló — es lo único con lo que
    // se puede corregir y reintentar. Reanalizar reclasifica lo ya importado
    // como duplicado, así que no hay riesgo de crearlo dos veces.
    if (!fallidas.length) { setTexto(''); setCsvCrudo(null) }
    setImportando(false)
    setProgreso(null)
    toast(`Importación lista: ${creados} nuevos${fallidas.length ? `, ${fallidas.length} con error` : ''}`, fallidas.length ? 'info' : 'success')
  }

  /** Las filas que fallaron, en un CSV que se puede corregir y volver a subir. */
  const descargarFallidas = (fallidas: FilaFallida[]) => {
    const cabecera = 'Nombre,Teléfono,Motivo'
    const cuerpo = fallidas.map(f => [f.nombre, f.telefono, f.motivo].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob(['\ufeff' + [cabecera, ...cuerpo].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `no_se_pudieron_importar_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  /** Rehace la vista previa con otro orden de fecha, sin volver a leer el directorio. */
  const cambiarOrdenDeFecha = (orden: OrdenDeFecha) => {
    setOrdenDeFecha(orden)
    if (!csvCrudo || !existentes) return
    const mapeo = mapearEncabezados(csvCrudo[0])
    setClasificadas(clasificarFilas(construirFilas(csvCrudo, mapeo, { ordenDeFecha: orden }), existentes))
  }

  const conteo = clasificadas
    ? {
        nuevo: clasificadas.filter((c, i) => c.estado === 'nuevo' || forzadas.has(i)).length,
        duplicado: clasificadas.filter((c, i) => c.estado === 'duplicado' && !forzadas.has(i)).length,
        conReparos: clasificadas.filter(c => (c.fila.reparos?.length ?? 0) > 0).length,
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
                de la que salió. Para reconstruir el consultorio entero está el{' '}
                <Link href="/operaciones" style={{ color: 'var(--nexus)', textDecoration: 'underline' }}>
                  respaldo completo, en Operaciones
                </Link>; esto es para leerlo, contarlo o dárselo a tu contador.
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
              Sube un <strong>CSV</strong> exportado desde tu sistema actual (o desde Google Contactos).
              Si lo que tienes es un Excel, ábrelo y usa <em>Archivo → Guardar como → CSV UTF-8</em>.
              Detectamos las columnas automáticamente, te enseñamos cuáles reconocimos antes de
              escribir nada y <strong>omitimos los que ya tienes</strong>. Una familia que comparte
              teléfono se importa entera: para omitir a alguien tiene que parecerse el <strong>nombre</strong>,
              no sólo el número. Solo necesitas una columna de <strong>Nombre</strong> (o «Nombre» y
              «Apellido paterno» por separado: también las juntamos).
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
              {/* ASE-027: importar 1 200 pacientes son 1 200 altas. Al menos se
                  dice por dónde va: una barra parada en «cargando» durante seis
                  minutos se lee como que se colgó, y cerrar la pestaña a mitad
                  deja media importación. */}
              {progreso && (
                <span role="status" style={{ alignSelf: 'center', fontSize: 12.5, color: 'var(--text2)' }}>
                  {progreso.hechos} de {progreso.total} · no cierres esta pestaña
                </span>
              )}
            </div>

            {/* Previsualización */}
            {analizando && <div style={{ marginTop: 14 }}><Spinner label="Analizando…" /></div>}
            {conteo && (
              <div style={{ marginTop: 16 }}>
                {/*
                  ASE-004 — LAS COLUMNAS QUE SE VAN A TIRAR, ANTES DE TIRARLAS.

                  Un Excel con «Apellido paterno» y «Apellido materno» importaba
                  a todo el mundo con su nombre de pila y sin decir nada. Ahora
                  esas columnas se reconocen; y si queda alguna con dato que no
                  alimenta ningún campo, se enseña aquí — con un ejemplo, que es
                  lo que permite reconocerla de un vistazo.
                */}
                {descartadas.length > 0 && (
                  <div style={{
                    marginBottom: 12, padding: '10px 13px', borderRadius: 10,
                    border: '1px solid var(--amber)', background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                      <AlertTriangle size={15} style={{ color: 'var(--amber)' }} />
                      {descartadas.length === 1
                        ? 'Hay 1 columna del archivo que no vamos a guardar'
                        : `Hay ${descartadas.length} columnas del archivo que no vamos a guardar`}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {descartadas.map(c => (
                        <li key={c.encabezado}><strong>{c.encabezado}</strong> — por ejemplo «{c.ejemplo}»</li>
                      ))}
                    </ul>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
                      Si alguna de ellas es parte del nombre, renómbrala en el archivo a «Apellido paterno»
                      o «Apellidos» y vuelve a analizarlo: entonces sí entra.
                    </div>
                  </div>
                )}

                {/*
                  ASE-003 — LA FECHA AMBIGUA SE PREGUNTA (clinical-safety §6).

                  «03/04/1975» es el 3 de abril o el 4 de marzo según el sistema
                  del que venga el archivo. Se pregunta una vez, no por fila, y
                  la respuesta rehace la vista previa en el momento.
                */}
                {fechasAmbiguas > 0 && (
                  <div style={{
                    marginBottom: 12, padding: '10px 13px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--s2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                      <Info size={15} style={{ color: 'var(--nexus)' }} />
                      ¿Cómo vienen las fechas de este archivo?
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 8 }}>
                      {fechasAmbiguas === 1
                        ? 'Hay 1 fecha que puede leerse de dos maneras'
                        : `Hay ${fechasAmbiguas} fechas que pueden leerse de dos maneras`}
                      {' '}(«03/04/1975» es el 3 de abril o el 4 de marzo). De la fecha de nacimiento salen la
                      edad, la dosis pediátrica y la detección de expedientes repetidos, así que no la adivinamos.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {([
                        ['dia-primero', 'día / mes / año (lo normal en México)'],
                        ['mes-primero', 'mes / día / año'],
                      ] as const).map(([clave, etiqueta]) => (
                        <button key={clave} type="button" onClick={() => cambiarOrdenDeFecha(clave)}
                          aria-pressed={ordenDeFecha === clave}
                          className="nx-chip nx-chip--relleno"
                          style={{
                            padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                            color: ordenDeFecha === clave ? '#fff' : 'var(--text2)',
                            border: `1px solid ${ordenDeFecha === clave ? 'var(--nexus-solido)' : 'var(--border)'}`,
                          }}>{etiqueta}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 12%, transparent)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>
                    {conteo.nuevo} nuevos
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>
                    {conteo.duplicado} ya los tienes (se omiten)
                  </span>
                  {conteo.conReparos > 0 && (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', background: 'var(--s2)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>
                      {conteo.conReparos} entran con algo sin guardar
                    </span>
                  )}
                </div>
                {/*
                  LOS OMITIDOS SE ENSEÑAN SIEMPRE, AUNQUE LA LISTA SE CORTE.
                  Una fila marcada como duplicada NO se importa, y el reporte final
                  la cuenta como un acierto. Si además queda fuera del recorte de la
                  vista previa, el paciente se pierde sin que nadie pueda verlo. Los
                  nuevos son los que sobran si hay que recortar algo.
                */}
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  {clasificadas!
                    .map((c, indice) => ({ c, indice }))
                    .sort((a, b) => Number(a.c.estado === 'nuevo') - Number(b.c.estado === 'nuevo'))
                    .slice(0, 200)
                    .map(({ c, indice }) => {
                      const forzada = forzadas.has(indice)
                      const entra = c.estado === 'nuevo' || forzada
                      return (
                        <div key={indice} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', opacity: entra ? 1 : 0.7 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {entra
                              ? <CheckCircle2 size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                              : <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fila.nombre}</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{c.fila.telefono || '—'}</span>
                          </div>
                          {/*
                            ASE-007 — CON QUIÉN CHOCÓ, Y LA SALIDA.
                            «N duplicados (se omiten)» no decía contra quién ni
                            dejaba forzar: el hijo homónimo del padre, sin fecha
                            de nacimiento en el archivo, no entraba nunca y nadie
                            podía verlo. La decisión vuelve a ser del médico.
                          */}
                          {c.estado === 'duplicado' && c.coincide && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, marginLeft: 25 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                                {forzada ? 'Se va a crear igual. ' : 'Se omite: '}
                                coincide con <strong style={{ color: 'var(--text2)' }}>{c.coincide.nombre || 'otra fila de este mismo archivo'}</strong>
                                {' '}— {c.coincide.motivo.toLowerCase()}
                                {c.coincide.certeza === 'seguro' && <strong style={{ color: 'var(--amber)' }}> · muy probable</strong>}
                              </span>
                              <button type="button" onClick={() => setForzadas(prev => {
                                const s2 = new Set(prev)
                                if (s2.has(indice)) s2.delete(indice); else s2.add(indice)
                                return s2
                              })} style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                                fontSize: 11.5, color: 'var(--text3)', textDecoration: 'underline',
                              }}>
                                {forzada ? 'Mejor omitirla' : 'Es otra persona — impórtala'}
                              </button>
                            </div>
                          )}
                          {/*
                            ASE-003/005/A-013 — LO QUE NO SE PUDO GUARDAR DE ESTA
                            FILA. Descartar un CURP mal formado o una fecha
                            ilegible es correcto; hacerlo en silencio no lo es
                            (regla 3 de seguridad clínica).
                          */}
                          {(c.fila.reparos?.length ?? 0) > 0 && (
                            <ul style={{ margin: '4px 0 0 25px', padding: 0, listStyle: 'none' }}>
                              {c.fila.reparos!.map((r, k) => (
                                <li key={k} style={{ fontSize: 11.5, color: r.gravedad === 'descartado' ? 'var(--amber)' : 'var(--text3)', lineHeight: 1.5 }}>
                                  {r.gravedad === 'descartado' ? '⚠️' : 'ℹ️'} {r.campo === 'fechaNacimiento' ? 'Fecha de nacimiento' : r.campo === 'curp' ? 'CURP' : 'Sexo'}
                                  {' «'}{r.valor}{'» — '}{r.motivo}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
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
                  ⏭️ {reporte.duplicados} omitidos por estar ya en tu directorio<br />
                </div>
                {/*
                  ASE-006 — LAS QUE FALLARON, CON NOMBRE.
                  «2 con error (revisa el formato)» no dice cuáles ni deja
                  reintentar. Aquí se nombran, se dice por qué, y se pueden bajar
                  para corregirlas y volver a subir sólo esas.
                */}
                {reporte.fallidas.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 6 }}>
                      {reporte.fallidas.length === 1
                        ? 'Este expediente no se pudo crear:'
                        : `Estos ${reporte.fallidas.length} expedientes no se pudieron crear:`}
                    </div>
                    <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {reporte.fallidas.slice(0, 20).map((f, i) => (
                        <li key={i}><strong>{f.nombre}</strong>{f.telefono ? ` · ${f.telefono}` : ''} — {f.motivo}</li>
                      ))}
                      {reporte.fallidas.length > 20 && <li>…y {reporte.fallidas.length - 20} más (están en el archivo)</li>}
                    </ul>
                    <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => descargarFallidas(reporte.fallidas)}>
                      Descargar las que fallaron (CSV)
                    </Button>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
                      El contenido que pegaste sigue arriba: corrígelo y vuelve a analizar. Lo que ya se
                      importó saldrá marcado como repetido, así que no se creará dos veces.
                    </div>
                  </div>
                )}
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
