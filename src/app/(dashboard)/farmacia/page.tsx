'use client'
/**
 * Inventario de farmacia interna del consultorio.
 *
 * Permite al médico/asistente:
 *  - Listar medicamentos, muestras, material y consumibles
 *  - Ver alertas: bajo stock, próximo a caducar, caducado
 *  - Registrar entradas (compras) y salidas (dispensación)
 *  - Buscar por nombre/lote/proveedor
 */
import { useEffect, useState, useMemo } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useBusquedaDePacientes } from '@/hooks/useBusquedaDePacientes'
import { getPatient } from '@/lib/firestore'
import { useToast } from '@/context/ToastContext'
import { noSePudo } from '@/lib/texto-es'
import {
  listarItems, crearItem, actualizarItem, borrarItem, registrarMovimiento, listarMovimientos,
  CATEGORIA_LABEL,
  bajoMinimo, caducaEnDias, estaCaducado, caducaPronto,
  type FarmaciaItem, type FarmaciaCategoria, type MovimientoFarmacia,
} from '@/lib/farmacia'
import {
  Pill, Search, Plus, AlertTriangle, Clock, Edit2, Trash2,
  Package, ArrowUpCircle, ArrowDownCircle, MapPin, History, X,
} from 'lucide-react'
import { Button, EmptyState, Spinner, Modal } from '@/components/ui'
import { describirVacioDeUnaLista, type RestriccionDeLista } from '@/lib/ui/vacio-de-una-lista'
import { alergiasDe } from '@/lib/seguridad/alergias'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'

/**
 * ¿LA ALERGIA DE ESTE PACIENTE CHOCA CON LO QUE SE VA A DISPENSAR? — MI-013.
 *
 * Cero motores nuevos: se leen las alergias del paciente con `alergiasDe` —el
 * mismo lector que usa la receta, que ya sabe leer el campo estructurado y el
 * texto libre— y se cruzan con `validarAlergiasVsMedicamentos`, el motor
 * determinista que la firma de la nota ya usa. Aquí sólo se conectan.
 *
 * Un fallo de LECTURA no se traga: si no se pudo leer la ficha del paciente,
 * devuelve la marca `NO_SE_PUDO_LEER` y el llamador avisa. Devolver «no hay
 * alergias» porque falló la red sería la mentira de siempre, en el sitio donde
 * más cara sale.
 */
export const NO_SE_PUDO_LEER = 'NO_SE_PUDO_LEER'

async function alergiasQueChocan(clinicId: string, patientId: string, nombreDelItem: string): Promise<string[]> {
  let paciente: Awaited<ReturnType<typeof getPatient>> | null = null
  try {
    paciente = await getPatient(clinicId, patientId)
  } catch {
    return [NO_SE_PUDO_LEER]
  }
  if (!paciente) return []
  const alergias = alergiasDe(paciente as { alergias?: string })
  if (alergias.length === 0) return []
  const alertas = validarAlergiasVsMedicamentos(alergias, [{ nombre: nombreDelItem }])
  return alertas.length ? alergias.map(a => a.alergeno) : []
}

export default function FarmaciaPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const [items, setItems] = useState<FarmaciaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<FarmaciaCategoria | 'todas' | 'alertas'>('todas')
  const [editando, setEditando] = useState<FarmaciaItem | null>(null)
  const [creando, setCreando] = useState(false)
  const [moviendo, setMoviendo] = useState<{ item: FarmaciaItem; tipo: 'entrada' | 'salida' } | null>(null)
  /** Para poder decir a QUIÉN se dispensó (trazabilidad lote → paciente). */
  /** El libro de movimientos de un ítem, que hasta ahora no se podía abrir. */
  const [verMovimientos, setVerMovimientos] = useState<FarmaciaItem | null>(null)

  const recargar = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      /**
       * SÓLO LOS ACTIVOS.
       *
       * Se pedía `soloActivos = false`, justo lo contrario de lo que asume
       * `borrarItem` («baja lógica… listarItems ya filtra por activo==true»). Se
       * borraba un ítem, salía el toast «Ítem eliminado», y tras recargar seguía
       * en la lista — y sus existencias seguían contando en los tres badges.
       */
      const i = await listarItems(clinicId)
      setItems(i)
    } finally { setLoading(false) }
  }

  useEffect(() => { recargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clinicId])

  /**
   * REG-351 — AQUÍ YA NO SE PRECARGA «EL DIRECTORIO».
   *
   * Esto llenaba un `<select>` con todos los pacientes del consultorio. Dos
   * defectos, y el segundo es el grave:
   *
   *  · un desplegable con miles de opciones no se puede usar;
   *  · desde REG-341 la lista viene **recortada**, así que en un consultorio
   *    grande el paciente al que se le está dispensando **no aparecía entre las
   *    opciones**. Y en un controlado el campo es OBLIGATORIO: quien dispensa
   *    tiene delante un desplegable sin la persona que tiene enfrente, y la
   *    salida se registra a nombre de otro o sin nombre. Ese libro es
   *    exactamente lo que se exhibe en una revisión (NOM-220).
   *
   * Ahora se busca en el servidor. El nombre del paciente ya elegido se guarda
   * al elegirlo, así que el libro de movimientos lo sigue pudiendo pintar sin
   * un directorio en memoria.
   */

  // Filtrar + buscar
  const visibles = useMemo(() => {
    let r = items
    if (categoriaFiltro === 'alertas') {
      r = r.filter(i => bajoMinimo(i) || estaCaducado(i) || caducaPronto(i))
    } else if (categoriaFiltro !== 'todas') {
      r = r.filter(i => i.categoria === categoriaFiltro)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(i =>
        i.nombre.toLowerCase().includes(q) ||
        i.lote?.toLowerCase().includes(q) ||
        i.proveedor?.toLowerCase().includes(q)
      )
    }
    return r
  }, [items, search, categoriaFiltro])

  /**
   * RTC-30 — QUÉ DICE EL INVENTARIO CUANDO NO ENSEÑA NINGUNA FILA.
   *
   * Decía «Sin resultados con esos filtros» sobre una ilustración de página
   * entera: describe la consulta, no el inventario, y con 24 ítems dentro se
   * lee igual que una farmacia recién abierta. Sin ningún control: para volver
   * a ver el inventario había que acordarse de vaciar el buscador Y de volver
   * el desplegable a «Todas las categorías».
   *
   * La decisión vive fuera de la pantalla; esto sólo la pinta.
   */
  const vacio = useMemo(() => {
    const r: RestriccionDeLista[] = []
    if (categoriaFiltro !== 'todas') r.push({
      id: 'categoria',
      frase: categoriaFiltro === 'alertas'
        ? 'sólo se están mirando los que tienen alertas'
        : `sólo se está mirando la categoría ${CATEGORIA_LABEL[categoriaFiltro]}`,
      gesto: 'Todas las categorías',
    })
    if (search.trim()) r.push({
      id: 'busqueda',
      frase: `ninguno coincide con «${search.trim()}»`,
      gesto: 'Limpiar la búsqueda',
    })
    return describirVacioDeUnaLista({
      total: items.length,
      sustantivo: ['ítem', 'ítems'],
      restricciones: r,
      registroVacio: {
        titulo: 'Aún no tienes ítems en farmacia',
        descripcion: 'Registra tu inventario para controlar existencias, lotes y caducidades.',
        gesto: 'Agregar',
      },
    })
  }, [items.length, search, categoriaFiltro])

  // Conteos para badges
  const alertas = items.filter(i => bajoMinimo(i) || estaCaducado(i) || caducaPronto(i)).length
  const caducados = items.filter(estaCaducado).length
  const bajoStock = items.filter(bajoMinimo).length

  return (
    <div className="nx-canvas">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pill size={22} color="var(--teal)" />
          <h1 className="t-h1" style={{ margin: 0 }}>Farmacia</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {items.length} ítems</span>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setCreando(true)}>Agregar</Button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="nx-stat-grid" style={{ marginBottom: 16 }}>
        <ResumenTarjeta titulo="Total ítems" valor={items.length} color="var(--text)" icon={<Package size={14} />} />
        <ResumenTarjeta titulo="Bajo stock" valor={bajoStock} color={bajoStock > 0 ? 'var(--amber)' : 'var(--text3)'} icon={<AlertTriangle size={14} />} />
        <ResumenTarjeta titulo="Caducados" valor={caducados} color={caducados > 0 ? 'var(--red)' : 'var(--text3)'} icon={<Clock size={14} />} />
      </div>

      {/* Buscador + filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, lote o proveedor…"
            // El `placeholder` desaparece en cuanto se escribe: no es un nombre.
            aria-label="Buscar en el inventario"
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--s2)',
              color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value as typeof categoriaFiltro)}
          aria-label="Filtrar el inventario por categoría"
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--s2)',
            color: 'var(--text)', fontSize: 13, cursor: 'pointer',
          }}
        >
          <option value="todas">Todas las categorías</option>
          {alertas > 0 && <option value="alertas">Con alertas ({alertas})</option>}
          {(Object.keys(CATEGORIA_LABEL) as FarmaciaCategoria[]).map(k => (
            <option key={k} value={k}>{CATEGORIA_LABEL[k]}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <Spinner center label="Cargando inventario…" />
      ) : visibles.length === 0 ? (
        <EmptyState
          variante={vacio.variante}
          icon={vacio.variante === 'hero' ? <Package size={22} /> : undefined}
          title={vacio.titulo}
          description={vacio.descripcion}
          action={
            /* El gesto sale de la CAUSA. Nunca «Agregar» sobre lo que un filtro
               esconde: es como nace un segundo lote del mismo medicamento — y
               por eso el módulo sólo devuelve el gesto de alta cuando el
               inventario entero está vacío. */
            vacio.clase === 'registro-vacio' ? (
              <Button icon={<Plus size={14} />} onClick={() => setCreando(true)}>Agregar</Button>
            ) : vacio.gestos.length > 0 ? (
              <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                {vacio.gestos.map(g => (
                  <Button key={g.id} variant="ghost" size="sm"
                    icon={g.id === 'busqueda' ? <X size={14} /> : <Package size={14} />}
                    onClick={() => g.id === 'busqueda' ? setSearch('') : setCategoriaFiltro('todas')}>
                    {g.etiqueta}
                  </Button>
                ))}
              </span>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visibles.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onEditar={() => setEditando(item)}
              onMovimientos={() => setVerMovimientos(item)}
              onEntrada={() => setMoviendo({ item, tipo: 'entrada' })}
              onSalida={() => setMoviendo({ item, tipo: 'salida' })}
              onBorrar={async () => {
                if (!clinicId || !item.id) return
                if (!(await confirm(`¿Eliminar "${item.nombre}"?`, { peligro: true, confirmar: 'Eliminar' }))) return
                await borrarItem(clinicId, item.id)
                toast('Ítem eliminado', 'info')
                recargar()
              }}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {(creando || editando) && (
        <ModalItem
          item={editando}
          onClose={() => { setCreando(false); setEditando(null) }}
          onGuardar={async (data) => {
            if (!clinicId) return
            try {
              if (editando?.id) {
                await actualizarItem(clinicId, editando.id, data)
                toast('Actualizado', 'success')
              } else {
                await crearItem(clinicId, {
                  ...data,
                  activo: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  creadoPor: user?.uid ?? '',
                })
                toast('Agregado', 'success')
              }
              setCreando(false); setEditando(null)
              recargar()
            } catch (e) { toast(noSePudo('guardar el medicamento', e), 'error') }
          }}
        />
      )}

      {verMovimientos && clinicId && (
        <ModalHistorial
          clinicId={clinicId}
          item={verMovimientos}
          onClose={() => setVerMovimientos(null)}
        />
      )}

      {/* Modal de movimiento (entrada/salida) */}
      {moviendo && (
        <ModalMovimiento
          clinicId={clinicId}
          item={moviendo.item}
          tipo={moviendo.tipo}
          onClose={() => setMoviendo(null)}
          onConfirmar={async (cantidad, motivo, extra) => {
            if (!clinicId) return
            try {
              const aplicada = await registrarMovimiento(clinicId, moviendo.item, {
                itemId: moviendo.item.id!,
                // La clase real de la salida: dispensada, caducada o merma. Para
                // el inventario bajan las tres; para una revisión no son lo mismo.
                tipo: extra.tipoReal,
                cantidad,
                motivo,
                ...(extra.patientId ? { patientId: extra.patientId } : {}),
                realizadoPor: user?.uid ?? '',
              })
              // Refleja la cantidad REALMENTE aplicada (puede ser menor por falta de
              // stock): antes decía "-10" aunque solo salieran 3 → engañaba la
              // trazabilidad, crítico en controlados.
              const ajustado = aplicada < cantidad
              toast(
                `${moviendo.tipo === 'entrada' ? '+' : '-'}${aplicada} registrado${ajustado ? ` (se solicitaron ${cantidad}, solo había ${aplicada})` : ''}`,
                ajustado ? 'info' : 'success',
              )
              setMoviendo(null)
              recargar()
            } catch (e) { toast(noSePudo('registrar la salida', e), 'error') }
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ResumenTarjeta({ titulo, valor, color, icon }: { titulo: string; valor: number; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: 12, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {icon}{titulo}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{valor}</div>
    </div>
  )
}

function ItemRow({
  item, onEditar, onEntrada, onSalida, onBorrar, onMovimientos,
}: {
  item: FarmaciaItem
  onEditar: () => void
  onEntrada: () => void
  onSalida: () => void
  onBorrar: () => void
  onMovimientos: () => void
}) {
  const dias = caducaEnDias(item)
  const caducado = estaCaducado(item)
  const pronto = caducaPronto(item)
  const bajo = bajoMinimo(item)

  // Color del borde según severidad
  const borderColor = caducado || (bajo && item.cantidad === 0)
    ? 'color-mix(in srgb, var(--red) 40%, transparent)'
    : (pronto || bajo) ? 'color-mix(in srgb, var(--amber) 40%, transparent)' : 'var(--border)'

  return (
    <div style={{
      padding: '12px 14px', background: 'var(--s)', border: `1px solid ${borderColor}`,
      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{item.nombre}</span>
          {item.controlado && (
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--purple) 15%, transparent)', color: 'var(--purple)', border: '1px solid color-mix(in srgb, var(--purple) 30%, transparent)' }}>
              CONTROLADO
            </span>
          )}
          {caducado && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--red) 15%, transparent)', color: 'var(--red)' }}>
              CADUCADO
            </span>
          )}
          {!caducado && pronto && dias !== null && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--amber) 15%, transparent)', color: 'var(--amber)' }}>
              Caduca en {dias}d
            </span>
          )}
          {bajo && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--amber) 15%, transparent)', color: 'var(--amber)' }}>
              Bajo stock
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>
          {CATEGORIA_LABEL[item.categoria]}
          {item.presentacion && ` · ${item.presentacion}`}
          {item.ubicacion && <> · <MapPin size={11} className="ds-icon" style={{ display: 'inline' }} /> {item.ubicacion}</>}
          {item.lote && ` · Lote ${item.lote}`}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 18, fontWeight: 700,
          color: item.cantidad === 0 ? 'var(--red)' : bajo ? 'var(--amber)' : 'var(--text)',
        }}>
          {item.cantidad}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{item.unidadMedida ?? 'unidades'}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onEntrada} title="Entrada" style={btnIcon('var(--green)')}>
          <ArrowUpCircle size={14} />
        </button>
        <button onClick={onSalida} title="Salida" style={btnIcon('var(--amber)')}>
          <ArrowDownCircle size={14} />
        </button>
        {/* El libro de movimientos existía y no había forma de abrirlo: era una
            colección de sólo escritura, justo lo contrario de para qué sirve. */}
        <button onClick={onMovimientos} title="Ver movimientos" style={btnIcon('var(--text3)')}>
          <History size={13} />
        </button>
        <button onClick={onEditar} title="Editar" style={btnIcon('var(--text3)')}>
          <Edit2 size={13} />
        </button>
        <button onClick={onBorrar} title="Eliminar" style={btnIcon('var(--red)')}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

const btnIcon = (color: string): React.CSSProperties => ({
  background: 'var(--s2)', border: '1px solid var(--border)', color,
  borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
})

function ModalItem({ item, onClose, onGuardar }: {
  item: FarmaciaItem | null
  onClose: () => void
  onGuardar: (data: Omit<FarmaciaItem, 'id' | 'createdAt' | 'updatedAt' | 'creadoPor' | 'activo'>) => Promise<void>
}) {
  const [f, setF] = useState({
    nombre: item?.nombre ?? '',
    categoria: item?.categoria ?? 'medicamento' as FarmaciaCategoria,
    presentacion: item?.presentacion ?? '',
    unidadMedida: item?.unidadMedida ?? 'caja',
    cantidad: String(item?.cantidad ?? 0),
    cantidadMinima: String(item?.cantidadMinima ?? ''),
    lote: item?.lote ?? '',
    caducidad: item?.caducidad ?? '',
    costoUnitario: String(item?.costoUnitario ?? ''),
    proveedor: item?.proveedor ?? '',
    ubicacion: item?.ubicacion ?? '',
    notas: item?.notas ?? '',
    controlado: item?.controlado ?? false,
  })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const guardar = async () => {
    if (!f.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    setSaving(true)
    try {
      await onGuardar({
        nombre: f.nombre.trim(),
        categoria: f.categoria,
        presentacion: f.presentacion.trim() || undefined,
        unidadMedida: f.unidadMedida.trim() || undefined,
        cantidad: Math.max(0, parseInt(f.cantidad) || 0),
        cantidadMinima: f.cantidadMinima ? Math.max(0, parseInt(f.cantidadMinima)) : undefined,
        lote: f.lote.trim() || undefined,
        caducidad: f.caducidad || undefined,
        costoUnitario: f.costoUnitario ? parseFloat(f.costoUnitario) : undefined,
        proveedor: f.proveedor.trim() || undefined,
        ubicacion: f.ubicacion.trim() || undefined,
        notas: f.notas.trim() || undefined,
        controlado: f.controlado,
      })
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Editar ítem' : 'Agregar al inventario'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>{item ? 'Guardar cambios' : 'Agregar'}</Button>
        </>
      )}
    >
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Nombre *" value={f.nombre} onChange={(v) => setF({ ...f, nombre: v })} placeholder="Amoxicilina 500mg cápsulas" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Categoría</label>
              <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as FarmaciaCategoria })} style={inp}>
                {(Object.keys(CATEGORIA_LABEL) as FarmaciaCategoria[]).map(k => (
                  <option key={k} value={k}>{CATEGORIA_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <Field label="Presentación" value={f.presentacion} onChange={(v) => setF({ ...f, presentacion: v })} placeholder="Caja con 12" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {item ? (
              // En EDICIÓN las existencias no se teclean: se cambian con + / − (que
              // pasan por el ledger). Teclearlas aquí revertía dispensaciones.
              <div>
                <label style={lbl}>Existencias</label>
                <div style={{ ...inp, display: 'flex', alignItems: 'center', color: 'var(--text3)' }} title="Usa las flechas + / − de la lista para mover existencias">
                  {item.cantidad} · usa + / −
                </div>
              </div>
            ) : (
              <Field label="Cantidad inicial" value={f.cantidad} onChange={(v) => setF({ ...f, cantidad: v })} type="number" />
            )}
            <Field label="Mínimo" value={f.cantidadMinima} onChange={(v) => setF({ ...f, cantidadMinima: v })} type="number" placeholder="3" />
            <Field label="Unidad" value={f.unidadMedida} onChange={(v) => setF({ ...f, unidadMedida: v })} placeholder="caja" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Lote" value={f.lote} onChange={(v) => setF({ ...f, lote: v })} />
            <Field label="Caducidad" value={f.caducidad} onChange={(v) => setF({ ...f, caducidad: v })} type="date" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Costo unitario" value={f.costoUnitario} onChange={(v) => setF({ ...f, costoUnitario: v })} type="number" placeholder="MXN" />
            <Field label="Proveedor" value={f.proveedor} onChange={(v) => setF({ ...f, proveedor: v })} />
          </div>
          <Field label="Ubicación física" value={f.ubicacion} onChange={(v) => setF({ ...f, ubicacion: v })} placeholder="Gabinete 2, repisa A" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--s2)', borderRadius: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.controlado} onChange={(e) => setF({ ...f, controlado: e.target.checked })} style={{ width: 14, height: 14, accentColor: 'var(--teal)' }} />
            <span style={{ fontSize: 12 }}>Es medicamento controlado (requiere receta especial)</span>
          </label>
          <div>
            <label style={lbl}>Notas</label>
            <textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        </div>
    </Modal>
  )
}

function ModalMovimiento({ clinicId, item, tipo, onClose, onConfirmar }: {
  clinicId: string | null
  item: FarmaciaItem
  tipo: 'entrada' | 'salida'
  onClose: () => void
  onConfirmar: (cantidad: number, motivo: string | undefined, extra: { patientId?: string; tipoReal: MovimientoFarmacia['tipo'] }) => Promise<void>
}) {
  const [cantidad, setCantidad] = useState('1')
  const [motivo, setMotivo] = useState('')
  /**
   * A QUIÉN SE LE DIO — el dato que la NOM-220 pide y que nadie escribía.
   *
   * `MovimientoFarmacia.patientId` existía en el tipo desde el principio, el
   * encabezado del módulo invoca la trazabilidad lote→paciente… y ninguna
   * pantalla lo llenaba: el campo iba SIEMPRE vacío. Un libro de movimientos que
   * no dice a quién se le dio no sirve para lo único que se le pide.
   */
  const [patientId, setPatientId] = useState('')
  /**
   * Quién se eligió, con su nombre. Se guarda el NOMBRE y no sólo el id porque
   * ya no hay un directorio en memoria del que sacarlo (REG-351).
   */
  const [pacienteElegido, setPacienteElegido] = useState<{ id: string; nombre: string } | null>(null)
  const [buscaPac, setBuscaPac] = useState('')
  const busquedaPac = useBusquedaDePacientes(clinicId, buscaPac)
  /**
   * QUÉ CLASE DE SALIDA ES.
   *
   * El tipo ya distinguía `salida`, `caducidad`, `merma` y `ajuste`, y el modal
   * sólo ofrecía entrada/salida: tirar un lote vencido quedaba indistinguible de
   * dispensarlo a un paciente. Para el inventario da igual —bajan las dos— pero
   * para una revisión de controlados no: una es una merma y la otra es una
   * persona que se llevó el medicamento.
   */
  const [claseSalida, setClaseSalida] = useState<'salida' | 'caducidad' | 'merma'>('salida')
  const [saving, setSaving] = useState(false)
  const { toast, confirm } = useToast()

  const tipoReal: MovimientoFarmacia['tipo'] = tipo === 'entrada' ? 'entrada' : claseSalida
  const esDispensacion = tipoReal === 'salida'

  const confirmar = async () => {
    const n = parseInt(cantidad)
    if (!n || n <= 0) { toast('Cantidad inválida', 'error'); return }
    // Un CONTROLADO que sale hacia un paciente tiene que decir hacia CUÁL: es el
    // registro que se exhibe en una revisión, y sin él la salida no se sostiene.
    if (esDispensacion && item.controlado && !patientId) {
      toast('Es un medicamento controlado: indica a qué paciente se dispensa.', 'error')
      return
    }
    if (tipo === 'salida' && n > item.cantidad) {
      if (!(await confirm(`Estás sacando ${n} pero solo tienes ${item.cantidad}. ¿Continuar?`))) return
    }
    // Dispensar un lote CADUCADO no se hacía notar en ninguna parte — solo un
    // badge en la lista. Aquí, en el acto de la salida, se exige confirmación.
    if (tipo === 'salida' && estaCaducado(item)) {
      if (!(await confirm(`⚠ Este lote está CADUCADO${item.caducidad ? ` (venció ${new Date(item.caducidad).toLocaleDateString('es-MX')})` : ''}. Dispensar medicamento caducado es un riesgo. ¿Continuar de todos modos?`))) return
    }

    /**
     * LA ALERGIA SE CRUZA TAMBIÉN AQUÍ — Panel de Lujo MI-013.
     *
     * ── QUÉ FALLABA ────────────────────────────────────────────────────────
     *
     * El lote caducado era la ÚNICA guarda clínica de la salida: este archivo no
     * importaba `alergias`, ni `alergiasDe`, ni `validarAlergiasVsMedicamentos`.
     * El camino normal —dispensar contra una receta— sí cruza alergias en la
     * receta, así que el hueco es el camino excepcional: la salida directa desde
     * la farmacia del consultorio, que es la que esta pantalla ofrece.
     *
     * Mismo trato que el lote caducado, y a propósito: se AVISA, se puede
     * continuar, y queda registrado. Bloquear la dispensación sería fijar
     * política clínica, que no me toca.
     */
    if (esDispensacion && patientId && clinicId) {
      const choques = await alergiasQueChocan(clinicId, patientId, item.nombre)
      if (choques[0] === NO_SE_PUDO_LEER) {
        /* No se pudo comprobar ≠ no hay alergia. Se dice, y se deja decidir. */
        const ok = await confirm(
          `No se pudieron leer las alergias de este paciente, así que «${item.nombre}» sale SIN cruzar alergias. ¿Dispensar de todos modos?`,
          { peligro: true, confirmar: 'Dispensar sin comprobar' },
        )
        if (!ok) return
      } else if (choques.length > 0) {
        const ok = await confirm(
          `⚠ ${pacienteElegido?.nombre ?? 'Este paciente'} tiene registrada alergia a ${choques.join(', ')}, ` +
          `y «${item.nombre}» puede chocar con ella. ¿Dispensar de todos modos?`,
          { peligro: true, confirmar: 'Dispensar de todos modos' },
        )
        if (!ok) return
      }
    }
    setSaving(true)
    try {
      await onConfirmar(n, motivo.trim() || undefined, { patientId: patientId || undefined, tipoReal })
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} loading={saving}>Confirmar</Button>
        </>
      )}
    >
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
          {item.nombre} · Actual: <strong>{item.cantidad}</strong> {item.unidadMedida ?? 'unidades'}
        </div>
        <Field label="Cantidad" value={cantidad} onChange={setCantidad} type="number" />

        {tipo === 'salida' && (
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Qué clase de salida</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { v: 'salida' as const, t: 'Se dispensó', a: 'Se le dio a un paciente' },
                { v: 'caducidad' as const, t: 'Caducó', a: 'Se retiró por fecha' },
                { v: 'merma' as const, t: 'Merma', a: 'Se rompió, se perdió' },
              ]).map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setClaseSalida(o.v)}
                  style={{
                    flex: '1 1 130px', textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: claseSalida === o.v ? 'var(--s2)' : 'transparent',
                    border: `1px solid ${claseSalida === o.v ? 'var(--teal)' : 'var(--border)'}`,
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{o.a}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {esDispensacion && (
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>
              A qué paciente {item.controlado
                ? <span style={{ color: 'var(--red)' }}>· obligatorio, es controlado</span>
                : <span style={{ color: 'var(--text3)' }}>(opcional)</span>}
            </label>
            {pacienteElegido ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{pacienteElegido.nombre}</span>
                <button
                  type="button"
                  onClick={() => { setPacienteElegido(null); setPatientId('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--nexus)', cursor: 'pointer', fontSize: 12, minHeight: 44, padding: '0 6px' }}
                >Cambiar</button>
              </div>
            ) : (
              <>
                <input
                  value={buscaPac}
                  onChange={e => setBuscaPac(e.target.value)}
                  placeholder="Busca por nombre o teléfono…"
                  aria-label="Buscar al paciente al que se dispensa"
                  style={inp}
                />
                {busquedaPac.resultados.slice(0, 6).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPacienteElegido({ id: String(p.id), nombre: p.nombre }); setPatientId(String(p.id)); setBuscaPac('') }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s1)', color: 'var(--text)', cursor: 'pointer', marginTop: 4, minHeight: 44 }}
                  >{p.nombre}</button>
                ))}
                {!busquedaPac.textoCorto && busquedaPac.resultados.length === 0 && (
                  <div style={{ fontSize: 12, marginTop: 6, color: busquedaPac.sePudoPreguntar ? 'var(--text3)' : 'var(--amber)' }}>
                    {busquedaPac.buscando
                      ? 'Buscando…'
                      : busquedaPac.sePudoPreguntar
                        ? 'Sin coincidencias. La búsqueda es por el principio del nombre o del teléfono.'
                        : 'No se pudo consultar el directorio: esto NO significa que el paciente no exista.'}
                  </div>
                )}
                {busquedaPac.truncada && (
                  <div role="status" style={{ fontSize: 12, marginTop: 6, color: 'var(--amber)' }}>
                    Hay más coincidencias de las que caben aquí; escribe más letras.
                  </div>
                )}
              </>
            )}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 }}>
              Queda en el libro de movimientos: es la trazabilidad lote → paciente que se exhibe en una revisión.
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Motivo (opcional)</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tipo === 'entrada' ? 'Compra a proveedor X' : 'Dispensado a paciente Juan'}
            style={inp}
          />
        </div>
    </Modal>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, boxSizing: 'border-box',
}

/**
 * EL LIBRO DE MOVIMIENTOS DE UN ÍTEM.
 *
 * `listarMovimientos` existía desde el principio y **no lo llamaba ninguna
 * pantalla**: la colección era de sólo escritura. Un libro que no se puede leer
 * no sirve para lo único que se le pide —enseñar qué entró, qué salió y a quién—
 * y en controlados es justo lo que se exhibe en una revisión.
 */
function ModalHistorial({ clinicId, item, onClose }: {
  clinicId: string
  item: FarmaciaItem
  onClose: () => void
}) {
  const [movs, setMovs] = useState<MovimientoFarmacia[] | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vivo = true
    listarMovimientos(clinicId, item.id!)
      .then(m => { if (vivo) setMovs(m) })
      // Un fallo de lectura NO es «no hay movimientos»: se dice, en vez de
      // enseñar una lista vacía que se lee como un inventario sin historia.
      .catch(() => { if (vivo) { setMovs([]); setFallo(true) } })
    return () => { vivo = false }
  }, [clinicId, item.id])

  /**
   * A QUIÉN SE LE DIO, RESUELTO POR LOS IDs QUE HAY EN EL LIBRO (REG-351).
   *
   * Antes se buscaba el nombre dentro del directorio en memoria — que venía
   * recortado, así que en un consultorio grande el libro de movimientos pintaba
   * «paciente a1b2c3» en vez del nombre justo en las dispensaciones más
   * antiguas. Un libro de controlados que no dice a quién se le dio no sirve
   * para lo único que se le pide (NOM-220).
   *
   * Se leen sólo los ids que aparecen en ESTE historial: son pocos y acotados
   * por los movimientos del ítem, no por el tamaño del consultorio.
   */
  const [nombres, setNombres] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!movs) return
    const ids = [...new Set(movs.map(m => m.patientId).filter((x): x is string => !!x))]
    if (ids.length === 0) return
    let vivo = true
    Promise.all(ids.map(id => getPatient(clinicId, id).catch(() => null)))
      .then(ps => {
        if (!vivo) return
        const mapa: Record<string, string> = {}
        ps.forEach((p, i) => { if (p?.nombre) mapa[ids[i]] = p.nombre })
        setNombres(mapa)
      })
      .catch(() => { /* sin nombre se pinta el id, que es la verdad disponible */ })
    return () => { vivo = false }
  }, [movs, clinicId])

  const nombreDe = (id?: string) => (id ? nombres[id] : undefined)

  const ETIQUETA: Record<MovimientoFarmacia['tipo'], string> = {
    entrada: 'Entrada', salida: 'Dispensado', ajuste: 'Ajuste', caducidad: 'Caducado', merma: 'Merma',
  }

  return (
    <Modal open onClose={onClose} title={`Movimientos · ${item.nombre}`}>
      {movs === null && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando…</div>}
      {fallo && (
        <div style={{ fontSize: 12.5, color: 'var(--amber)', marginBottom: 10 }}>
          No se pudo leer el historial. Esto <strong>no</strong> significa que no haya movimientos.
        </div>
      )}
      {movs && movs.length === 0 && !fallo && (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Sin movimientos registrados para este ítem.
        </div>
      )}
      {movs && movs.map(m => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {ETIQUETA[m.tipo] ?? m.tipo} · {m.cantidad}
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 11.5, marginTop: 2 }}>
              {m.fecha?.slice(0, 16).replace('T', ' ')}
              {m.patientId ? ` · ${nombreDe(m.patientId) ?? 'paciente ' + m.patientId.slice(0, 6)}` : ''}
              {m.motivo ? ` · ${m.motivo}` : ''}
            </div>
          </div>
        </div>
      ))}
    </Modal>
  )
}
