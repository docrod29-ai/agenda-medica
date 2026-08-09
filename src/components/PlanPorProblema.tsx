'use client'
/**
 * EL PLAN, POR PROBLEMA — REG-243.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * Suki lo llama *problem-based charting*: cada problema con su código y, debajo,
 * el plan de ESE problema. Aquí la nota tenía una lista de diagnósticos y otra
 * de medicamentos, sin relación. Con dos problemas y cinco fármacos, quién es de
 * quién quedaba en la cabeza del médico — y en la del que lea la nota después,
 * que no estuvo.
 *
 * ── LA DIFERENCIA, Y ES LA IMPORTANTE ───────────────────────────────────────
 *
 * No se **infiere** el vínculo. «Moxifloxacino es antibiótico, hay una neumonía,
 * luego es de la neumonía» es razonamiento clínico, y con dos infecciones
 * simultáneas acierta por suerte.
 *
 * Se ata **sólo lo que el médico dijo**, en el mismo tramo del dictado, y se
 * enseña la frase que lo prueba. Lo que no consta aparece **sin asignar**, a la
 * vista. Un hueco visible es información; un vínculo inventado es un error que
 * se lee como un acierto.
 *
 * ── POR QUÉ NO HAY BOTÓN PARA «ARREGLARLO» ──────────────────────────────────
 *
 * Porque el sitio donde se corrige un plan es el plan, no un panel de resumen.
 * Un segundo lugar donde editar lo mismo es la receta para que las dos versiones
 * se separen — y ya pasó en esta aplicación más de una vez.
 */
import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { planPorProblema } from '@/lib/expediente/plan-por-problema'

export interface PlanPorProblemaProps {
  diagnosticos?: readonly unknown[]
  medicamentos?: readonly { nombre?: unknown }[]
  dictado?: unknown
}

export function PlanPorProblema(p: PlanPorProblemaProps) {
  const grupos = useMemo(() => planPorProblema(p), [p])

  /* Con un solo diagnóstico agrupar no dice nada que no se vea ya. */
  const atados = grupos.filter(g => g.diagnostico).length
  if (atados < 1 || grupos.length < 2) return null

  return (
    <section style={{
      border: '1px solid var(--border)', borderRadius: 11,
      background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Layers size={15} style={{ color: 'var(--text3)' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Qué es de qué
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          atado sólo donde usted lo dijo
        </span>
      </header>

      <div style={{ padding: '4px 14px 14px' }}>
        {grupos.map((g, i) => (
          <div key={g.diagnostico ?? '__sin__'} style={{ marginTop: i === 0 ? 12 : 16 }}>
            <h4 style={{
              margin: 0, fontSize: 13.5, fontWeight: 700,
              color: g.diagnostico ? 'var(--text)' : 'var(--amber)',
            }}>
              {g.diagnostico ?? 'Sin asignar a un problema'}
            </h4>

            {!g.diagnostico && (
              /* Se explica el hueco: que no conste no lo vuelve un error. */
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>
                No consta en el dictado de qué problema son. No significa que
                estén mal — significa que no se dijo.
              </p>
            )}

            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {g.medicamentos.map(m => (
                <li key={m.nombre} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                  {m.nombre}
                  {m.evidencia && (
                    <span style={{
                      display: 'block', fontSize: 12.5, color: 'var(--text3)',
                      lineHeight: 1.5, paddingLeft: 10, marginTop: 2,
                      borderLeft: '2px solid var(--border2)',
                    }}>
                      «{m.evidencia.texto}»
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export const POR_QUE_NO_HAY_BOTON_DE_ARREGLAR =
  'El sitio donde se corrige un plan es el plan. Un segundo lugar donde editar ' +
  'lo mismo es la receta para que las dos versiones se separen.'

export const POR_QUE_NO_SE_ENSENA_CON_UN_SOLO_GRUPO =
  'Con un único diagnóstico, agrupar no dice nada que no se vea ya en la lista.'
