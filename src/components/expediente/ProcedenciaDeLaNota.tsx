'use client'
/**
 * DE DÓNDE SALIÓ ESTA NOTA — §21 en el expediente, que es donde se pregunta.
 *
 * ── LA REBANADA ─────────────────────────────────────────────────────────────
 *
 * §21 del Master Loop V15 llama a la inspección de la fuente la interacción de
 * firma del producto. Esta pieza la lleva a `/expediente` — la superficie que
 * importa el día de la discusión, porque nadie audita una nota el día que la
 * firma.
 *
 * ── DÓNDE ESTÁ HOY, MEDIDO (D-022, Panel de Lujo 2026-09) ───────────────────
 *
 * Este comentario decía «estaba en 2 de 6 superficies: /consulta y
 * /pendientes», y el equipo rojo lo desmintió con `grep -c`: las tres que lo
 * tienen son `/consulta`, `/expediente` y `/demo/razonamiento`; `/pendientes`
 * NO. Y las tres que faltan son las DOCUMENTALES —la nota firmada
 * (`/nota/[patientId]/[notaId]`), la receta y la orden—, que son justo las que
 * salen impresas con una cédula profesional encima.
 *
 * Lo que falta ahí no es esta pieza: es MONTARLA. El componente no sabe nada
 * del expediente ni de la lista de notas —recibe una `NotaMedica` y decide con
 * `procedenciaDeLaNotaArchivada` qué puede afirmar—, así que las tres
 * superficies documentales pueden montarlo tal cual. Esos tres archivos son de
 * otra rebanada y el cambio va anotado en `handoff-EXPEDIENTES.md`; aquí queda
 * corregido lo que este comentario afirmaba de más.
 *
 * ── NO CONSTRUYE NADA NUEVO: CONECTA ────────────────────────────────────────
 *
 * Las dos piezas ya existían y ya viven en la Capa 4 (`SelloProcedencia` y
 * `DeDondeSalioEsto`, mudadas a la lente el 15-ago). El motor de trazabilidad
 * (`rastrearNota`) tiene corpus oro desde hace versiones. Lo que faltaba era el
 * lector: los campos que la nota archiva para exactamente esto
 * —`transcripcionMotor`, `iaAuditoria.extraction`— no los enseñaba **ninguna
 * pantalla**.
 *
 * Qué se puede afirmar con lo archivado lo decide
 * `lib/expediente/procedencia-de-la-nota-archivada.ts`, y ahí están escritas
 * las tres decisiones que no son de estilo: contra qué se contrasta (el
 * material de origen, no el texto de trabajo, que se pudo editar), por qué sin
 * bloque de extracción no se pinta el sello, y por qué aquí no hay botón de
 * escuchar.
 *
 * ── POR QUÉ ESTÁ DENTRO DE LA NOTA ABIERTA Y NO EN LA CABECERA ──────────────
 *
 * §21 pide que el hecho y su fuente estén cerca: «fact → inspect → source →
 * return exactly where you were». Un revelador en la cabecera del expediente
 * estaría a un viewport de distancia de la frase que se duda —el defecto que
 * la corrida anterior midió en `/consulta` y dejó declarado sin pagar—. Aquí
 * cuelga de la nota concreta, debajo del texto que describe.
 *
 * Y **no empuja nada**: lo que abre aterriza en la lente contextual, no en
 * línea. En una lista de consultas, un acordeón dentro de otro acordeón mueve
 * todas las consultas de abajo.
 */
import { Fingerprint } from 'lucide-react'
import type { NotaMedica } from '@/types/expediente'
import { SelloProcedencia } from '@/components/SelloProcedencia'
import { DeDondeSalioEsto } from '@/components/DeDondeSalioEsto'
import {
  procedenciaDeLaNotaArchivada,
  NOMBRE_DE_LA_FUENTE,
} from '@/lib/expediente/procedencia-de-la-nota-archivada'

export function ProcedenciaDeLaNota({ nota }: { nota: NotaMedica }) {
  const p = procedenciaDeLaNotaArchivada(nota)

  /* Sin dictado y sin bloque de extracción no hay NADA que afirmar sobre el
     origen. Y decirlo con un panel vacío sería peor: dejaría creer que se
     comprobó y no había nada, cuando lo que pasa es que no se guardó. */
  if (!p.fuente && !p.puedeSellar) return null

  return (
    <section className="nx-proc-nota" aria-label="De dónde salió esta nota">
      <h4 className="nx-proc-rotulo">
        <Fingerprint size={12} aria-hidden className="ds-icon" />
        De dónde salió esta nota
      </h4>

      {p.puedeSellar && (
        <SelloProcedencia
          final={p.final}
          extraction={p.extraction}
          aprobados={p.aprobados}
          /* La transcripción permite comprobar que la cita textual EXISTE. Sin
             ella el sello se comporta como antes de REG-213 en vez de degradar
             lo que quizá estaba bien. */
          transcripcion={p.dictado || undefined}
        />
      )}

      {p.fuente && (
        <>
          <DeDondeSalioEsto nota={p.nota} dictado={p.dictado} />
          {/*
            CONTRA QUÉ SE CONTRASTA, DICHO. No es una nota al pie decorativa: en
            una discusión, «la frase está respaldada» significa cosas distintas
            según si el respaldo es el original del reconocedor o un texto que
            el propio médico pudo reescribir. Se dice siempre, incluso cuando la
            respuesta es la buena.
          */}
          <p className="nx-proc-fuente">
            Se contrasta contra {NOMBRE_DE_LA_FUENTE[p.fuente]}.
            {p.trabajoEditado && ' El texto de trabajo se editó después de transcribir; el contraste usa el original.'}
            {p.fuente === 'trabajo' && ' No se archivó el original del reconocedor para esta nota.'}
          </p>
        </>
      )}

      {/*
        LO QUE NO SE PUEDE AFIRMAR, DICHO TAMBIÉN. Regla 4: ausencia de dato no
        es dato de ausencia. Si la nota no archivó dictado, callarlo dejaría
        creer que la nota se escribió a mano.
      */}
      {!p.fuente && (
        <p className="nx-proc-fuente">
          Esta nota no archivó el dictado, así que no se puede contrastar frase
          por frase contra lo que se dijo.
        </p>
      )}
    </section>
  )
}

export const POR_QUE_CUELGA_DE_LA_NOTA =
  '§21 pide que el hecho y su fuente estén cerca. Un revelador en la cabecera ' +
  'del expediente queda a un viewport de la frase que se duda, que es el ' +
  'defecto ya medido en /consulta.'

export const POR_QUE_SE_DICE_CONTRA_QUE_SE_CONTRASTA =
  '«La frase está respaldada» significa cosas distintas según si el respaldo es ' +
  'el original del reconocedor o un texto que el médico pudo reescribir. Se ' +
  'dice siempre, incluso cuando la respuesta es la buena.'
