'use client'
/**
 * LA VÍA DE URGENCIA DEL PORTAL — arriba, completa y pulsable.
 *
 * ── QUÉ SUSTITUYE ───────────────────────────────────────────────────────────
 *
 * Un párrafo dentro de la tarjeta de «Preguntar»: 12 px, `--text3`, tercer
 * párrafo de la pantalla, y el número escrito como texto muerto. Medido en el
 * navegador, era **el texto más pequeño y más apagado de todo el portal**, y
 * axe daba las veinte combinaciones limpias. Ver el golden.
 *
 * ── POR QUÉ ASÍ Y NO DE OTRA MANERA ─────────────────────────────────────────
 *
 * · **Arriba y en todos los destinos.** El paciente no llega siempre a la misma
 *   pestaña, y quien tiene un síntoma grave no navega buscando dónde estaba el
 *   aviso. §6 de `patient-facing-ai.md`: la urgencia gana a todo lo demás.
 *
 * · **Ámbar, no rojo.** En este producto el rojo dice «riesgo clínico» dentro
 *   de la nota del médico, y una franja roja permanente en las cinco pantallas
 *   se deja de ver a la tercera visita. El objetivo es que se LEA, no que grite.
 *
 * · **Un botón de teléfono de verdad.** Es la diferencia entre una instrucción
 *   y una acción: con dolor torácico, «llama al 911» escrito es un número que
 *   hay que memorizar y teclear. `tel:` lo marca de un toque.
 *
 * · **La lista sale de `MOTIVO_LABEL`, no de la prosa.** La copia a mano del
 *   portal nombraba tres de los cuatro motivos: faltaba **ingesta accidental o
 *   sobredosis**, que es justo el caso que la puerta de `evals/patient-ai/`
 *   cazó en las doce preguntas del §0 («me tomé por accidente la medicina de
 *   otra persona»). Una lista de seguridad copiada a mano se queda atrás sin
 *   que nadie lo note. Lo demostró PL-C9: el vocabulario pasó de cuatro motivos
 *   a once y esta pantalla los enseñó todos sin tocar una línea de prosa.
 *
 * · **En lista, y no en una frase con comas.** Con cuatro motivos cabía una
 *   línea; con once, una frase corrida es un muro que nadie lee — y esta caja
 *   existe para leerse a las dos de la mañana. Cada motivo, un renglón.
 *
 * · **Y dice lo que NO vigila** (`LO_QUE_NO_SE_VIGILA`). Es la recomendación
 *   por omisión del dueño para PL-C9: mientras el vocabulario definitivo no
 *   esté firmado por especialidad, el portal tiene que decir qué se queda
 *   fuera. Una lista de seguridad que se presenta como completa es peor que
 *   ninguna.
 *
 * · **Dice que aquí no hay nadie leyendo.** Es lo que ya dice
 *   `mensajeDeUrgencia()` por WhatsApp. Prometer atención en un canal que
 *   nadie mira es lo que hace que el paciente se quede esperando.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No triaja, no clasifica lo que el paciente escribió, no aconseja y no decide
 * gravedad. Enseña la vía y la hace pulsable. Y la lista es **vocabulario, no
 * criterio** (`clinical-safety.md` §5): que un cuadro no esté nombrado aquí
 * significa que no se nombra, no que sea benigno — por eso el texto no dice
 * «sólo si» sino «si tienes algo de esto **o cualquier otro malestar grave**».
 */
import { Phone, Siren } from 'lucide-react'
import { MOTIVO_LABEL, TELEFONO_EMERGENCIAS, LO_QUE_NO_SE_VIGILA } from '@/lib/paciente/urgencia'

const MOTIVOS = Object.values(MOTIVO_LABEL)

export default function ViaDeUrgencia({ telefonoConsultorio }: { telefonoConsultorio?: string }) {
  const tel = String(telefonoConsultorio ?? '').trim()
  return (
    <aside
      aria-label="Qué hacer en una urgencia"
      style={{
        border: '1px solid color-mix(in srgb, var(--amber) 42%, transparent)',
        background: 'color-mix(in srgb, var(--amber) var(--tinte), var(--s1))',
        borderRadius: 'var(--r-lg)',
        padding: 14,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Siren size={18} aria-hidden="true" style={{ color: 'var(--amber-texto)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--amber-texto)', lineHeight: 1.45 }}>
            Si es una urgencia, no esperes por aquí
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>
            Nadie está leyendo esta pantalla ahora mismo. Marca el {TELEFONO_EMERGENCIAS} si
            tienes algo de esto — o cualquier otro malestar grave:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
            {MOTIVOS.map(m => <li key={m}>{m}</li>)}
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
            {LO_QUE_NO_SE_VIGILA}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <a href={`tel:${TELEFONO_EMERGENCIAS}`} className="btn btn-primary btn-sm">
          <Siren size={14} aria-hidden="true" /> Llamar al {TELEFONO_EMERGENCIAS}
        </a>
        {/* El consultorio sólo se ofrece cuando HAY teléfono: un botón que marca
            una cadena vacía es peor que ningún botón el día que urge. */}
        {tel && (
          <a href={`tel:${tel}`} className="btn btn-secondary btn-sm">
            <Phone size={14} aria-hidden="true" /> Llamar al consultorio
          </a>
        )}
      </div>
    </aside>
  )
}
