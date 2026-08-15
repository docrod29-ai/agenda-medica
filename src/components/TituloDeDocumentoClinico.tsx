'use client'
/**
 * EL ENCABEZADO DE UN DOCUMENTO CLÍNICO — V15-FINAL-COHERENCE-001.
 *
 * ── EL DEFECTO DE COHERENCIA QUE REPARA ─────────────────────────────────────
 *
 * Medido en navegador real, 1440×900 y 390×844, sobre datos sintéticos
 * (`scripts/design/medir-coherencia-de-producto-v15.mjs`, acta en
 * `docs/design/capturas/v15-coherencia/acta-coherencia.json`):
 *
 * | superficie  | qué nombra el `<h1>`   | voz más fuerte del paciente |
 * |---|---|---|
 * | expediente  | **al paciente**        | 20px/600 (ancla)            |
 * | consulta    | **al paciente**        | 20px/700 (h1)               |
 * | nota        | **nada — no hay h1**   | 14px/600 (franja)           |
 * | receta      | «Generador de Receta»  | 14px/600 (franja)           |
 * | orden       | «Orden Médica»         | 14px/600 (franja)           |
 *
 * Dicho en una frase: **en las dos superficies donde el médico LEE sobre el
 * paciente, el nombre del paciente es la voz más fuerte de la pantalla; en las
 * tres donde EMITE un documento que afecta su tratamiento, el nombre cae a
 * 14px de cromo periférico y la voz más fuerte nombra la HERRAMIENTA.** El
 * degradado ocurre justo en las superficies consecuentes, que es al revés de
 * lo que pediría la seguridad.
 *
 * §7 del encargo de Coherencia Final lo nombra exactamente: «un paciente no
 * puede ser identidad prominente en una superficie y metadato diminuto en
 * otra». §17: «nombres de herramienta donde debería dominar el paciente o el
 * trabajo». Y la vista previa impresa de la propia receta ya lo tenía bien —
 * el papel sabe que el sujeto es el paciente; la pantalla de trabajo, no.
 *
 * ── POR QUÉ ESTO SÍ ES UN COMPONENTE Y NO TRES BLOQUES COPIADOS ─────────────
 *
 * §22 prohíbe inventar abstracciones para «hacer las cosas consistentes». La
 * prueba que sí pasa: hay TRES usos reales y **una invariante de dominio**, no
 * un parecido visual —
 *
 *     en una superficie que emite un documento clínico, el encabezado
 *     dominante nombra AL PACIENTE; el tipo de documento es subordinado;
 *     y el nombre NUNCA se inventa mientras carga.
 *
 * Esa última cláusula es la que obliga a tener un dueño: es la misma regla que
 * ya cumplen `InstrumentStrip` («nunca enseña el nombre del paciente ANTERIOR
 * mientras carga el siguiente») y el ancla del expediente. Repetida a mano en
 * tres archivos, se rompe en el cuarto y nadie se entera.
 *
 * ── LO QUE NO TOCA, Y ES DELIBERADO ─────────────────────────────────────────
 *
 *  · **El documento impreso.** Este encabezado vive en la barra `no-print` de
 *    la pantalla de trabajo. El PDF, la impresión y el Word salen exactamente
 *    igual que antes — son artefactos medicolegales y V15 congela su
 *    contenido (§23 del encargo, §1 del master loop).
 *  · **`/referencia`.** Su `<h1>` («CARTA DE REFERENCIA») está DENTRO del
 *    papel, centrado, como título del propio oficio — no es cromo de pantalla.
 *    Cambiarlo cambiaría el documento emitido. Es una diferencia de contexto
 *    clínico legítima, de las que §7 prohíbe aplanar, y queda declarada como
 *    deuda NO pagada en el acta de la iteración.
 */
import type { ReactNode } from 'react'

/** Qué documento se está emitiendo. El rótulo subordinado, tal cual se lee. */
export type ClaseDeDocumento = 'receta' | 'orden' | 'nota'

export const ROTULO_DE_DOCUMENTO: Record<ClaseDeDocumento, string> = {
  receta: 'Receta',
  orden: 'Orden médica',
  nota: 'Nota médica',
}

/**
 * El texto del encabezado dominante.
 *
 * PURA y probada al revés: con nombre devuelve el NOMBRE; sin nombre —null,
 * vacío o sólo espacios— devuelve el rótulo del documento. Nunca fabrica una
 * identidad ni conserva la del paciente anterior: quien la llama le pasa el
 * `patient` de ESTA ruta, y mientras no haya cargado el encabezado dice qué
 * documento es, que es cierto, en vez de a quién pertenece, que todavía no se
 * sabe.
 */
export function tituloDominante(
  nombreDelPaciente: string | null | undefined,
  clase: ClaseDeDocumento,
): string {
  const limpio = (nombreDelPaciente ?? '').trim()
  return limpio || ROTULO_DE_DOCUMENTO[clase]
}

/**
 * ¿Se pinta el rótulo subordinado? Sólo cuando el `<h1>` NO lo está diciendo
 * ya — sin esto, una receta sin paciente cargado leería «Receta / Receta».
 */
export function seMuestraElRotulo(
  nombreDelPaciente: string | null | undefined,
  clase: ClaseDeDocumento,
): boolean {
  return tituloDominante(nombreDelPaciente, clase) !== ROTULO_DE_DOCUMENTO[clase]
}

export function TituloDeDocumentoClinico({ nombreDelPaciente, clase, children }: {
  nombreDelPaciente: string | null | undefined
  clase: ClaseDeDocumento
  /** Señal opcional de estado (p. ej. «BORRADOR»), subordinada al nombre. */
  children?: ReactNode
}) {
  const titulo = tituloDominante(nombreDelPaciente, clase)
  return (
    <div className="nx-titulo-documento" style={{ minWidth: 0, textAlign: 'center' }}>
      {/* Mismo tamaño y peso que tenían los `<h1>` de /receta y /orden antes de
          esta reparación (20/700): lo que cambia es QUÉ dice, no cuánto pesa.
          Así la jerarquía medida de la familia no se mueve y la comparación
          antes/después del acta aísla una sola variable. */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, overflowWrap: 'anywhere' }}>
        {titulo}
      </h1>
      {seMuestraElRotulo(nombreDelPaciente, clase) && (
        <div className="nx-meta" style={{ marginTop: 2 }}>{ROTULO_DE_DOCUMENTO[clase]}</div>
      )}
      {children}
    </div>
  )
}
