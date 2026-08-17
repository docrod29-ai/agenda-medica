/**
 * V15-WORKFLOW-BENCHMARK-001 (WF-10) — el respaldo local se escribía, se
 * conservaba y NO LLEGABA al médico.
 *
 * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
 *
 * No leyendo código: haciendo el trabajo. WF-10 del banco de flujos
 * (`scripts/design/medir-flujos-clinicos-v15.mjs`) recorre la interrupción del
 * teléfono a mitad del encuentro. Abre `/consulta/pac-luzmaria-cervantes?nota=
 * nota-luzmaria-borrador`, teclea en la nota, espera a que pase el debounce de
 * 1 500 ms del respaldo local, y recarga — que es lo que hace un teléfono que
 * se queda sin memoria mientras el médico atiende una llamada.
 *
 * Lo medido en el navegador, antes de tocar nada:
 *
 *   claves de respaldo local tras teclear:  ["nx.consulta.bkp.pac-luzmaria-cervantes"]
 *   ¿el texto sobrevive a la recarga?       false
 *   ¿se ofrece restaurar?                   false
 *   respaldo local tras recargar:           ["nx.consulta.bkp.pac-luzmaria-cervantes"]
 *
 * El respaldo estaba ahí, en disco, intacto, las dos veces. La pantalla no lo
 * ofrecía. Y el autoguardado a Firestore corre cada 30 s, así que la ventana de
 * pérdida silenciosa era de hasta medio minuto de nota dictada o tecleada.
 *
 * El control negativo se midió en la misma corrida: el MISMO gesto **sin**
 * `?nota=` sí conserva lo escrito (`¿sobrevive sin ?nota=? true`). O sea que la
 * red de seguridad funcionaba — sólo que nunca en el caso que la necesita.
 *
 * ── LA CAUSA RAÍZ: una condición haciendo dos trabajos ────────────────────
 *
 * «Aplicarlo solo» y «ofrecerlo» estaban gobernados por la misma prueba: que el
 * formulario estuviera VACÍO.
 *
 *   · Para APLICAR SOLO es la prueba correcta y no se toca — no se pisa en
 *     silencio lo que el médico ve escrito (regla 3 de seguridad clínica).
 *   · Para OFRECER es la prueba equivocada: al reabrir una nota concreta el
 *     formulario **nunca** está vacío, porque trae la nota. La única rama capaz
 *     de enseñar el respaldo se apagaba exactamente en el caso para el que
 *     existe.
 *
 * Es la familia de `.claude/rules/el-dato-tiene-que-llegar.md`: el dato se
 * escribe del lado correcto y se lee con la pregunta equivocada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ───────────────────────────────────────────
 *
 * `queHacerConElRespaldoLocal` (en `@/lib/mobile/local-drafts`, que ya era el
 * dueño de la clave y del pestillo anti-resurrección) devuelve UNA de tres
 * cosas, y las dos ramas de la pantalla la comparten para que no puedan
 * divergir:
 *
 *   APLICAR_SOLO  sólo si no se abrió ninguna nota concreta y no hay nada que
 *                 pisar. Conducta idéntica a la de antes.
 *   OFRECER       visible y reversible. Nunca aplica nada por su cuenta.
 *   CALLAR        si el respaldo es de OTRO encuentro, si no puede demostrar de
 *                 cuál es, o si la nota abierta ya está firmada (inmutable,
 *                 NOM-024).
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 *  · NO compara marcas de tiempo. Un respaldo más VIEJO que lo que hay en
 *    Firestore también se ofrece — a propósito: la decisión de cuál vale es del
 *    médico, y el aviso enseña la hora a la que se guardó para que pueda
 *    tomarla. Aplicarlo automáticamente por ser más nuevo sería volver a la
 *    corrección silenciosa que la regla 3 prohíbe.
 *  · NO prueba que `restaurarRespaldo` reponga bien cada campo: eso ya lo
 *    cubren las pruebas del ida y vuelta del borrador.
 *  · NO prueba el caso multi-pestaña: dos pestañas sobre la misma nota siguen
 *    gobernadas por el testigo de concurrencia, que es otra pieza.
 *  · La clave del respaldo es POR PACIENTE, así que esto no es —ni prueba
 *    nada sobre— la familia «paciente equivocado». Lo que cierra es la familia
 *    «encuentro equivocado».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  queHacerConElRespaldoLocal,
  type EstadoDelRespaldoLocal,
} from '@/lib/mobile/local-drafts'

const base: EstadoDelRespaldoLocal = {
  hayRespaldo: true,
  respaldoNotaId: null,
  notaAbierta: null,
  notaFirmada: false,
  formularioVacio: true,
}
const con = (p: Partial<EstadoDelRespaldoLocal>) => queHacerConElRespaldoLocal({ ...base, ...p })

describe('el respaldo local del encuentro LLEGA al médico', () => {
  /* ── EL DEFECTO, dicho como caso ───────────────────────────────────────── */

  it('EL CASO DE WF-10: se reabre la nota por ?nota=, hay respaldo de ESA nota y el formulario trae contenido → SE OFRECE', () => {
    expect(con({
      respaldoNotaId: 'nota-luzmaria-borrador',
      notaAbierta: 'nota-luzmaria-borrador',
      formularioVacio: false,
    })).toBe('OFRECER')
  })

  it('y se sigue ofreciendo aunque el formulario esté vacío: abrir una nota concreta nunca autoaplica', () => {
    expect(con({
      respaldoNotaId: 'nota-luzmaria-borrador',
      notaAbierta: 'nota-luzmaria-borrador',
      formularioVacio: true,
    })).toBe('OFRECER')
  })

  /* ── LO QUE NO PUEDE CAMBIAR (control de no regresión) ─────────────────── */

  it('encuentro nuevo y nada escrito → se repone solo, como siempre', () => {
    expect(con({ notaAbierta: null, formularioVacio: true })).toBe('APLICAR_SOLO')
  })

  it('encuentro nuevo pero YA hay algo escrito → se ofrece, no se pisa', () => {
    expect(con({ notaAbierta: null, formularioVacio: false })).toBe('OFRECER')
  })

  /* ── LAS TRES BOCAS QUE HAY QUE CERRAR ────────────────────────────────── */

  it('el respaldo es de OTRO encuentro del mismo paciente → CALLAR', () => {
    expect(con({
      respaldoNotaId: 'nota-luzmaria-1',
      notaAbierta: 'nota-luzmaria-borrador',
      formularioVacio: false,
    })).toBe('CALLAR')
  })

  it('el respaldo no dice de qué nota es y se abrió una concreta → CALLAR (ausencia de dato no es dato de pertenencia)', () => {
    expect(con({ respaldoNotaId: null, notaAbierta: 'nota-luzmaria-borrador' })).toBe('CALLAR')
  })

  it('la nota abierta ya está FIRMADA → CALLAR, es inmutable', () => {
    expect(con({
      respaldoNotaId: 'nota-aurelio-1',
      notaAbierta: 'nota-aurelio-1',
      notaFirmada: true,
      formularioVacio: false,
    })).toBe('CALLAR')
  })

  it('firmada manda incluso sobre el encuentro nuevo y vacío', () => {
    expect(con({ notaAbierta: null, notaFirmada: true, formularioVacio: true })).toBe('CALLAR')
  })

  it('sin respaldo no hay nada que decidir', () => {
    expect(con({ hayRespaldo: false, formularioVacio: false })).toBe('CALLAR')
  })

  /* ── QUE LA PANTALLA LA USE DE VERDAD ─────────────────────────────────────
     Sin esto la función podría estar perfecta y la pantalla seguir con su
     condición vieja: es justo el defecto que se está arreglando, escrito una
     vez más. Se comprueba en el archivo real, no en un mock. */

  const consulta = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
    'utf8',
  )

  it('la consulta importa la decisión en vez de escribirse la suya', () => {
    expect(consulta).toMatch(/import \{[^}]*queHacerConElRespaldoLocal[^}]*\} from '@\/lib\/mobile\/local-drafts'/)
  })

  it('las DOS ramas la llaman — la que aplica y la que ofrece', () => {
    const llamadas = consulta.match(/queHacerConElRespaldoLocal\(/g) ?? []
    expect(llamadas.length).toBeGreaterThanOrEqual(2)
  })

  it('el aviso ya NO se decide con «el formulario está vacío» a pelo', () => {
    /* La condición vieja, literal. Si vuelve, el respaldo se vuelve a quedar
       encerrado en disco. */
    expect(consulta).not.toMatch(
      /respaldoDisponible && !firmada && !resumen\.trim\(\) && !secciones\.some/,
    )
  })

  it('el aviso dice que restaurar REEMPLAZA lo que se ve: reversible, pero avisado', () => {
    expect(consulta).toMatch(/Restaurarlo reemplaza lo que ves/)
  })
})
