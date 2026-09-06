/**
 * REP-017 · MC-004 (M-cirujano) — la carta de referencia no se guarda en
 * ninguna parte: se imprime y desaparece.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/referencia/[patientId]/page.tsx:35-44`: todo el estado
 * (tipo, destino, institución, motivo, urgencia, resumen…) vive en `useState`;
 * las únicas salidas son `descargarPDF` (:46-61) e `imprimirElemento` (:141).
 * Cero escrituras, cero `logAudit`, ninguna colección declarada en rules,
 * matriz ni respaldo. Al recargar, todo vacío; ante un perito, no hay
 * constancia de la interconsulta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-cirujano, MC-004; equipo rojo confirmado P1: grep de
 * `referencia|interconsulta|derivaci` en src/lib y src/app/api sin colección
 * ni evento; `print-element.ts` y `pdf-download.ts` no llaman a logAudit.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La pantalla se construyó como formulario de impresión, no como documento del
 * expediente.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md invariantes: un expediente longitudinal, una bitácora de auditoría.
 * NOM-004: la nota de referencia es parte del expediente que se conserva.
 * security-tenant: toda colección nueva se declara en TRES sitios.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL declarado: la pantalla es un componente cliente con Next,
 * contextos y Firestore; no se monta en node. Se exige que el archivo invoque
 * alguna persistencia o bitácora. Es un guardián barato y grueso a propósito:
 * el día que exista la escritura, la prueba de los tres sitios la sustituye.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No exige una colección concreta ni su forma (eso lo decide el diseño de la
 * reparación). No cubre la contrarreferencia recibida ni el envío electrónico.
 * No comprueba que el dato LLEGUE a Firestore (el-dato-tiene-que-llegar).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../../../..')
const pagina = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx'), 'utf8')

const PERSISTE_O_REGISTRA = /\b(logAudit|setDoc|addDoc|updateDoc|runTransaction|writeBatch)\s*\(|fetch\(\s*[`'"]\/api\//

describe('REP-017 · la carta de referencia deja rastro en el expediente', () => {
  it('la pantalla sigue siendo la que imprime (control: el archivo es el correcto)', () => {
    expect(pagina).toMatch(/imprimirElemento\(/)
    expect(pagina).toMatch(/descargarComoPDF\(/)
  })

  it('la pantalla invoca alguna persistencia o bitácora (logAudit / setDoc / addDoc / fetch a /api)', () => {
    const m = pagina.match(PERSISTE_O_REGISTRA)
    expect(m, 'la carta de referencia no escribe ni registra nada').not.toBeNull()
  })
})
