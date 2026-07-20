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
import { useToast } from '@/context/ToastContext'
import {
  listarItems, crearItem, actualizarItem, borrarItem, registrarMovimiento,
  CATEGORIA_LABEL,
  bajoMinimo, caducaEnDias, estaCaducado, caducaPronto,
  type FarmaciaItem, type FarmaciaCategoria,
} from '@/lib/farmacia'
import {
  Pill, Search, Plus, AlertTriangle, Clock, Edit2, Trash2,
  Package, ArrowUpCircle, ArrowDownCircle, MapPin,
} from 'lucide-react'
import { Button, EmptyState, Spinner, Modal } from '@/components/ui'
import { SinResultados } from '@/components/brand/EmptyArt'

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

  const recargar = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const i = await listarItems(clinicId, false)
      setItems(i)
    } finally { setLoading(false) }
  }

  useEffect(() => { recargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clinicId])

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

  // Conteos para badges
  const alertas = items.filter(i => bajoMinimo(i) || estaCaducado(i) || caducaPronto(i)).length
  const caducados = items.filter(estaCaducado).length
  const bajoStock = items.filter(bajoMinimo).length

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <ResumenTarjeta titulo="Total ítems" valor={items.length} color="var(--text)" icon={<Package size={14} />} />
        <ResumenTarjeta titulo="Bajo stock" valor={bajoStock} color={bajoStock > 0 ? '#f59e0b' : 'var(--text3)'} icon={<AlertTriangle size={14} />} />
        <ResumenTarjeta titulo="Caducados" valor={caducados} color={caducados > 0 ? '#ef4444' : 'var(--text3)'} icon={<Clock size={14} />} />
      </div>

      {/* Buscador + filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, lote o proveedor…"
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
        items.length === 0 ? (
          <EmptyState
            icon={<Package size={22} />}
            title="Aún no tienes ítems en farmacia"
            description="Registra tu inventario para controlar existencias, lotes y caducidades."
            action={<Button icon={<Plus size={14} />} onClick={() => setCreando(true)}>Agregar</Button>}
          />
        ) : (
          <EmptyState illustration={<SinResultados />} title="Sin resultados con esos filtros" />
        )
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visibles.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onEditar={() => setEditando(item)}
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
            } catch { toast('Error al guardar', 'error') }
          }}
        />
      )}

      {/* Modal de movimiento (entrada/salida) */}
      {moviendo && (
        <ModalMovimiento
          item={moviendo.item}
          tipo={moviendo.tipo}
          onClose={() => setMoviendo(null)}
          onConfirmar={async (cantidad, motivo) => {
            if (!clinicId) return
            try {
              await registrarMovimiento(clinicId, moviendo.item, {
                itemId: moviendo.item.id!,
                tipo: moviendo.tipo,
                cantidad,
                motivo,
                realizadoPor: user?.uid ?? '',
              })
              toast(`${moviendo.tipo === 'entrada' ? '+' : '-'}${cantidad} registrado`, 'success')
              setMoviendo(null)
              recargar()
            } catch { toast('Error al registrar', 'error') }
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
  item, onEditar, onEntrada, onSalida, onBorrar,
}: {
  item: FarmaciaItem
  onEditar: () => void
  onEntrada: () => void
  onSalida: () => void
  onBorrar: () => void
}) {
  const dias = caducaEnDias(item)
  const caducado = estaCaducado(item)
  const pronto = caducaPronto(item)
  const bajo = bajoMinimo(item)

  // Color del borde según severidad
  const borderColor = caducado || (bajo && item.cantidad === 0)
    ? 'rgba(239,68,68,0.4)'
    : (pronto || bajo) ? 'rgba(245,158,11,0.4)' : 'var(--border)'

  return (
    <div style={{
      padding: '12px 14px', background: 'var(--s)', border: `1px solid ${borderColor}`,
      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{item.nombre}</span>
          {item.controlado && (
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
              CONTROLADO
            </span>
          )}
          {caducado && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              CADUCADO
            </span>
          )}
          {!caducado && pronto && dias !== null && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              Caduca en {dias}d
            </span>
          )}
          {bajo && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
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
          color: item.cantidad === 0 ? '#ef4444' : bajo ? '#f59e0b' : 'var(--text)',
        }}>
          {item.cantidad}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{item.unidadMedida ?? 'unidades'}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onEntrada} title="Entrada" style={btnIcon('#10b981')}>
          <ArrowUpCircle size={14} />
        </button>
        <button onClick={onSalida} title="Salida" style={btnIcon('#f59e0b')}>
          <ArrowDownCircle size={14} />
        </button>
        <button onClick={onEditar} title="Editar" style={btnIcon('var(--text3)')}>
          <Edit2 size={13} />
        </button>
        <button onClick={onBorrar} title="Eliminar" style={btnIcon('#ef4444')}>
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

function ModalMovimiento({ item, tipo, onClose, onConfirmar }: {
  item: FarmaciaItem
  tipo: 'entrada' | 'salida'
  onClose: () => void
  onConfirmar: (cantidad: number, motivo?: string) => Promise<void>
}) {
  const [cantidad, setCantidad] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast, confirm } = useToast()

  const confirmar = async () => {
    const n = parseInt(cantidad)
    if (!n || n <= 0) { toast('Cantidad inválida', 'error'); return }
    if (tipo === 'salida' && n > item.cantidad) {
      if (!(await confirm(`Estás sacando ${n} pero solo tienes ${item.cantidad}. ¿Continuar?`))) return
    }
    // Dispensar un lote CADUCADO no se hacía notar en ninguna parte — solo un
    // badge en la lista. Aquí, en el acto de la salida, se exige confirmación.
    if (tipo === 'salida' && estaCaducado(item)) {
      if (!(await confirm(`⚠ Este lote está CADUCADO${item.caducidad ? ` (venció ${new Date(item.caducidad).toLocaleDateString('es-MX')})` : ''}. Dispensar medicamento caducado es un riesgo. ¿Continuar de todos modos?`))) return
    }
    setSaving(true)
    try { await onConfirmar(n, motivo.trim() || undefined) } finally { setSaving(false) }
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
