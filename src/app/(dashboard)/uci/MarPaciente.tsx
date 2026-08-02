'use client'
// ══════════════════════════════════════════════════════════════
// VISTA MAR DEL PACIENTE — charter §37.
//
// La unidad ICU-P1-7 se llamaba «Vista MAR» y yo entregué sólo el motor: llegaba
// a pantalla de rebote, a través del turno de enfermería, y no había forma de
// ver el MAR de UN paciente. Esto lo cierra.
//
// Sobre la farmacia que YA EXISTE: lee las `Indicacion` del episodio. No define
// medicamentos, no lleva existencias, no descuenta stock.
// ══════════════════════════════════════════════════════════════
import { useMemo } from 'react'
import { Pill, AlertTriangle, Info } from 'lucide-react'
import { vistaMar, ESTADOS_SIN_ATRASO, type EstadoMar } from '@/lib/uci/mar'
import { graciaMar } from '@/lib/uci/gracia'
import type { Indicacion } from '@/types/hospital'

const COLOR: Record<EstadoMar, string> = {
  atrasado: '#dc2626',
  toca: '#d97706',
  nunca_administrado: '#dc2626',
  horario_no_interpretable: '#7c3aed',
  infusion_continua: '#3d5afe',
  prn: 'var(--text3)',
  al_dia: '#0d9488',
  completado: 'var(--text3)',
  suspendido: 'var(--text3)',
}

const ETIQUETA: Record<EstadoMar, string> = {
  atrasado: 'Atrasado',
  toca: 'Toca',
  nunca_administrado: 'Sin administrar',
  horario_no_interpretable: 'Horario ilegible',
  infusion_continua: 'En infusión',
  prn: 'PRN',
  al_dia: 'Al día',
  completado: 'Completado',
  suspendido: 'Suspendido',
}

export default function MarPaciente(
  { indicaciones, graciaMinDeclarada }: { indicaciones: readonly Indicacion[]; graciaMinDeclarada?: number },
) {
  // Un solo sitio decide el margen: estaba escrito a mano aquí y otra vez en el
  // turno de enfermería, y dos copias de un número operativo son la garantía de
  // que un día dirán cosas distintas del mismo paciente.
  const gracia = graciaMar(graciaMinDeclarada)
  // El instante se congela al montar: recalcularlo en cada render movería los
  // estados bajo los pies de quien está leyendo la lista.
  const ahora = useMemo(() => new Date().toISOString(), [])
  const v = useMemo(() => vistaMar(indicaciones, ahora, gracia), [indicaciones, ahora, gracia])

  if (indicaciones.length === 0) {
    return (
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, fontSize: 13, color: 'var(--text3)' }}>
        No hay indicaciones en el episodio. El MAR lee las órdenes que ya existen; no crea ninguna.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Pill size={16} style={{ color: 'var(--nexus,#3d5afe)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>MAR</span>
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· charter §37</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {v.lineas.map(l => (
            <div key={l.indicacionId} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `1px solid color-mix(in srgb, ${COLOR[l.estado]} 20%, transparent)`, background: COLOR[l.estado] + '0b' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: COLOR[l.estado], minWidth: 104, paddingTop: 2 }}>
                {ETIQUETA[l.estado]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{l.descripcion}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>{l.mensaje}</div>
                {l.omisiones.length > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 5, lineHeight: 1.5 }}>
                    {l.omisiones.length} omisión{l.omisiones.length !== 1 ? 'es' : ''} registrada{l.omisiones.length !== 1 ? 's' : ''}.
                    Una omisión no cuenta como dosis dada, y no desaparece de la vista.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {v.noInterpretables.length > 0 && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 11, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.08)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text2)' }}>
            <strong>{v.noInterpretables.length} orden{v.noInterpretables.length !== 1 ? 'es' : ''} con horario ilegible.</strong>{' '}
            No se calcula atraso sobre ellas: un horario adivinado produce un atraso inventado.
            Hay que corregir la frecuencia en la indicación, no ignorarlas.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 11, background: 'var(--s2)', border: '1px solid var(--border)' }}>
        <Info size={15} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text3)' }}>
          {ESTADOS_SIN_ATRASO.length} estados <strong>nunca se atrasan</strong> por definición
          —infusión continua, PRN, dosis única ya dada, orden suspendida y horario ilegible—
          y por eso no salen en rojo. Si lo hicieran cada hora, el rojo dejaría de significar algo
          y la dosis que sí se pasó se perdería en el ruido.
          El margen antes de marcar una dosis atrasada es de {gracia} min: un valor
          operativo de la unidad, no clínico.
        </div>
      </div>
    </div>
  )
}
