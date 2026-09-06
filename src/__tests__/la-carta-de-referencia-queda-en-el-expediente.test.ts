/**
 * GOLDEN — la carta de referencia deja rastro: no se imprime y desaparece.
 *
 * Reproducción REP-017 del Panel de Lujo (hallazgo MC-004, auditor M-cirujano,
 * P1), movida aquí con el arreglo y ampliada con el comportamiento del módulo
 * que compone lo que se asienta.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/referencia/[patientId]/page.tsx` — todo el estado de la
 * carta (tipo, destino, institución, motivo, urgencia, resumen, diagnósticos,
 * tratamiento, estudios) vivía en `useState`, y las únicas salidas eran
 * `descargarComoPDF` e `imprimirElemento`. Cero escrituras, cero `logAudit`,
 * ninguna colección declarada. Al recargar, la pantalla salía vacía; al volver
 * al expediente, no había rastro de que se hubiera referido al paciente, a
 * quién ni por qué.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditoría Panel de Lujo, sep-2026: auditor M-cirujano, hallazgo MC-004;
 * equipo rojo CONFIRMADO en P1 — grep de `referencia|interconsulta|derivaci` en
 * `src/lib` y `src/app/api` sin colección ni evento; `print-element.ts` y
 * `pdf-download.ts` no llaman a `logAudit`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La pantalla se construyó como formulario de impresión, no como documento del
 * expediente. Nadie tuvo que decidir NO guardarla: simplemente no había dónde.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md, invariantes: un expediente longitudinal, una bitácora de
 * auditoría. La nota de referencia es parte del expediente que se conserva; sin
 * asiento, ante un perito no hay constancia de la interconsulta.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Dos capas:
 *   (a) COMPORTAMIENTO sobre `referencia-carta.ts`, que es puro: qué texto se
 *       asienta y cuándo NO hay nada que asentar.
 *   (b) CONTRATO TEXTUAL declarado sobre la pantalla: es un componente cliente
 *       con contextos y Firestore, no se monta en node. Se exige que invoque
 *       persistencia (`agregarAdenda`) Y bitácora (`logAudit`), y que el evento
 *       exista en el catálogo — que es donde se rompería «el dato tiene que
 *       LLEGAR» si alguien inventara un evento suelto.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No comprueba que el documento QUEDE ESCRITO en Firestore (eso exige el
 * emulador; la regla «el dato tiene que llegar» se cierra mirando el documento
 * real, no aquí). No cubre la contrarreferencia que RECIBE el consultorio ni el
 * envío electrónico. No decide si la carta merece colección propia: hoy cuelga
 * de `adendas`, que ya está declarada en los tres sitios; la forma exacta de la
 * regla para una colección `referencias` está en el handoff de seguridad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { textoDeLaCarta, motivoDeLaCarta, cartaTieneContenido } from '@/lib/referencia-carta'
import { EVENTO_LABEL } from '@/lib/expediente/audit-eventos'

const raiz = process.cwd()
const pagina = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx'), 'utf8')

const CARTA = {
  tipo: 'referencia' as const,
  urgencia: 'Prioritario',
  destino: 'Dr(a). Sintético / Cardiología',
  institucion: 'Hospital Sintético',
  motivo: 'Valoración y manejo de motivo sintético',
  resumen: 'Resumen sintético de la consulta.',
  diagnosticos: 'Diagnóstico sintético',
  tratamiento: 'Tratamiento sintético',
  estudios: '',
}

describe('MC-004 · lo que se asienta cuando se emite la carta', () => {
  it('el texto lleva el acto, la urgencia y cada bloque que el médico llenó', () => {
    const t = textoDeLaCarta(CARTA)
    expect(t).toContain('Carta de referencia emitida')
    expect(t).toContain('urgencia: Prioritario')
    expect(t).toContain('Dirigida a: Dr(a). Sintético / Cardiología')
    expect(t).toContain('Motivo: Valoración y manejo de motivo sintético')
  })

  it('un bloque vacío no ocupa un renglón que diga nada', () => {
    expect(textoDeLaCarta(CARTA)).not.toContain('Estudios:')
  })

  it('el motivo de la adenda nombra el acto y cabe en el límite del campo', () => {
    expect(motivoDeLaCarta(CARTA)).toBe('Referencia emitida — Dr(a). Sintético / Cardiología')
    expect(motivoDeLaCarta({ tipo: 'contrarreferencia', destino: '  ' })).toBe('Contrarreferencia emitida')
    const largo = motivoDeLaCarta({ tipo: 'referencia', destino: 'x'.repeat(900) })
    expect(largo.length).toBeLessThanOrEqual(500)
  })

  it('una carta en blanco no es un acto clínico: no hay nada que asentar', () => {
    const vacia = { ...CARTA, destino: '', institucion: '', motivo: '', resumen: '', diagnosticos: '', tratamiento: '', estudios: '' }
    expect(cartaTieneContenido(vacia)).toBe(false)
    expect(cartaTieneContenido(CARTA)).toBe(true)
  })
})

describe('MC-004 · la pantalla escribe y registra', () => {
  it('control: sigue siendo la pantalla que imprime y descarga', () => {
    expect(pagina).toMatch(/imprimirElemento\(/)
    expect(pagina).toMatch(/descargarComoPDF\(/)
  })

  it('persiste la carta en el expediente (adenda) y no sólo en el papel', () => {
    expect(pagina, 'la carta no escribe nada en el expediente').toContain('agregarAdenda(')
  })

  it('deja asiento en la bitácora con un evento que existe en el catálogo', () => {
    expect(pagina).toContain("evento: 'referencia_emitida'")
    expect(EVENTO_LABEL.referencia_emitida, 'el evento no está etiquetado').toBeTruthy()
  })

  it('el asiento va DESPUÉS de imprimir, no antes (ZL-002)', () => {
    // Si la ventana emergente está bloqueada no hay carta, y por tanto tampoco
    // asiento: la bitácora acredita emisión, no intención.
    expect(pagina).toContain("resultado === 'abierta'")
  })

  it('la bitácora no lleva el contenido clínico de la carta, sólo su huella', () => {
    expect(pagina).toContain('huella: huellaContenido(')
    expect(pagina, 'el motivo clínico no puede viajar en la bitácora').not.toMatch(/meta:\s*\{[^}]*\bmotivo\b/)
  })
})
