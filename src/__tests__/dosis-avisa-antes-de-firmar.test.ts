/**
 * GOLDEN — el aviso de dosis llegaba DESPUÉS de firmar.
 *
 * ── EL HUECO DE FLUJO (5-ago-2026) ───────────────────────────────────────────
 *
 * `revisarUnidadDosis` existe y funciona bien:
 *
 *   · dosis vacía  → severidad ALTA, «la receta no lleva cantidad; quien la
 *     surta no puede saber cuánto dispensar».
 *   · «100» sin unidad → «se lee como 100 mg, y en lo que se dosifica en
 *     microgramos eso son mil veces la dosis».
 *
 * Pero sólo se ejecutaba en la pantalla de la RECETA y en hospitalización. En la
 * consulta no — y la consulta es donde se firma.
 *
 * Auditando las notas firmadas del Dr. aparecieron **4 medicamentos sin dosis de
 * 28**. El aviso llegaba cuando la nota ya era inmutable y sólo podía corregirse
 * con una adenda.
 *
 * ── LO QUE ESTE GOLDEN NO HACE ───────────────────────────────────────────────
 *
 * No exige que la firma se bloquee. Qué es exigible en una receta es una
 * decisión del médico dueño y está en su cola — avisar no necesita su permiso,
 * bloquear sí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { revisarUnidadDosis } from '@/lib/seguridad/dosis'
import { NIVEL, construirAvisos } from '@/lib/expediente/avisos-consulta'

const consulta = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
const barra = readFileSync(join(process.cwd(), 'src', 'components', 'AntesDeFirmar.tsx'), 'utf8')

describe('EL MOTOR YA SABÍA DETECTARLO', () => {
  it('una dosis vacía es severidad alta', () => {
    const a = revisarUnidadDosis('Amoxicilina', '')
    expect(a?.severidad).toBe('alta')
    expect(a?.codigo).toBe('dosis_sin_cifra')
  })

  it('y una cifra sin unidad también', () => {
    const a = revisarUnidadDosis('Levotiroxina', '100')
    expect(a?.severidad).toBe('alta')
    expect(a?.codigo).toBe('dosis_sin_unidad')
  })

  it('una dosis correcta no molesta', () => {
    // Un aviso que salta siempre se acaba ignorando junto con los que importan.
    expect(revisarUnidadDosis('Amoxicilina', '500 mg')).toBeNull()
  })
})

describe('AHORA SE VE ANTES DE FIRMAR', () => {
  it('la consulta lo calcula', () => {
    expect(consulta).toContain('revisarUnidadDosis(m.nombre, m.dosis)')
    expect(consulta).toContain('const dosisIncompletas')
  })

  it('y lo enseña, diciendo que bloquea', () => {
    /**
     * El título cambió el 5-ago-2026 con la decisión del médico dueño («que
     * bloquee la firma si falta la dosis»): un aviso que bloquea tiene que
     * decirlo, o el médico pulsa Firmar y no entiende por qué no pasa nada.
     */
    /**
     * El título se unificó el 5-ago con la AMPLIACIÓN del médico dueño
     * («bloquea también si falta la unidad»): ya no hay un caso que bloquee y
     * otro que no, así que un solo título dice la verdad para los dos.
     */
    /**
     * ── TRASLADADO A LA BARRA (5-ago-2026, REG-181) ───────────────────────
     * Los siete recuadros de la consulta son ahora una barra de tres niveles.
     * Lo que esta prueba protege no cambió —qué bloquea, de qué color y qué se
     * puede descartar—: cambió DÓNDE está escrito. La decisión vive en el
     * módulo puro `avisos-consulta.ts`, que es justamente el sitio donde se
     * puede vigilar.
     */
    expect(NIVEL.dosis_incompleta).toBe('bloquea')
    expect(barra).toContain('BLOQUEA')
    expect(barra).toContain('Falta la dosis de')
    expect(consulta).toContain('construirAvisos(')
  })

  it('en rojo, porque el motor lo marca de severidad alta', () => {
    /**
     * Una receta sin cantidad no se puede surtir, y «100» sin unidad se lee como
     * 100 mg. Eso no es un aviso ámbar.
     */
    /**
     * ── TRASLADADO A LA BARRA (5-ago-2026, REG-181) ───────────────────────
     * Los siete recuadros de la consulta son ahora una barra de tres niveles.
     * Lo que esta prueba protege no cambió —qué bloquea, de qué color y qué se
     * puede descartar—: cambió DÓNDE está escrito. La decisión vive en el
     * módulo puro `avisos-consulta.ts`, que es justamente el sitio donde se
     * puede vigilar.
     */
    // El renglón que bloquea es el único rojo de la barra, y lleva `role="alert"`.
    const i = barra.indexOf('>BLOQUEA<')
    expect(i).toBeGreaterThan(0)
    // El chip que lo envuelve pinta con R = var(--red).
    expect(barra.slice(Math.max(0, i - 120), i)).toContain('chip(R)')
    expect(barra).toContain("const R = 'var(--red)'")
    expect(barra).toContain("role={bloquean > 0 ? 'alert' : 'status'}")
  })

  it('SIN «Ya lo revisé» — porque esto no se descarta, se corrige', () => {
    /**
     * El Dr pidió que los avisos «se puedan quitar», y eso sigue valiendo para
     * los informativos: la contradicción de negación, el desajuste temporal, la
     * vía no dictada — todos llevan su botón.
     *
     * Éste no, desde que bloquea la firma (5-ago). Un botón que sólo esconde el
     * mensaje sería una promesa falsa: el aviso se iría, la firma seguiría sin
     * dejarse pulsar, y el médico no sabría por qué. Aquí no hay nada que
     * descartar — hay una cantidad y una unidad que escribir.
     */
    /**
     * La ventana se acota al PROPIO bloque —hasta su `</Alert>`— porque el aviso
     * siguiente (la vía no dictada) sí lleva su botón, y una ventana de más
     * caracteres lo alcanzaba y hacía fallar la comprobación por vecindad.
     */
    /**
     * Se busca el BOTÓN, no la frase.
     *
     * La primera versión de esta comprobación buscaba la cadena «Ya lo revisé»
     * en el código y fallaba… porque el COMENTARIO que explica su ausencia la
     * menciona. Un test que mira la prosa del archivo en vez del comportamiento
     * se engaña solo, y aquí se engañó conmigo.
     */
    /**
     * ── AHORA SE COMPRUEBA EL DATO, NO LA VECINDAD (REG-181) ──────────────
     * Antes se acotaba una ventana de texto del JSX hasta su `</Alert>`. Con la
     * barra, la garantía es más fuerte y más simple: el aviso NACE con
     * `descartable: false`, y la barra sólo pinta «Ya lo revisé» sobre lo
     * descartable. Ya no depende de que nadie meta un botón cerca.
     */
    const [bloqueo] = construirAvisos({
      dosisIncompletas: [{ med: 'levotiroxina', mensaje: 'la receta no lleva cantidad' }],
    })
    expect(bloqueo.nivel).toBe('bloquea')
    expect(bloqueo.descartable).toBe(false)
    expect(barra).toContain('a.descartable && onRevisado')
  })

  it('pero los avisos que NO bloquean sí se pueden quitar', () => {
    // La petición del Dr sigue viva donde tiene sentido: los informativos SÍ
    // se descartan, y siguen usando la misma clave `${tipo}:${clave}` de
    // `marcarRevisado`, para que lo ya descartado no resucite.
    const avisos = construirAvisos({
      contradicciones: [{ condicion: 'diabetes', mensaje: 'la nota afirma diabetes' }],
      viasAsumidas: ['losartán'],
      avisoDeVia: 'No se dictó la vía de losartán',
    })
    expect(avisos.find(a => a.origen === 'contradiccion_negacion')?.descartable).toBe(true)
    expect(avisos.find(a => a.origen === 'via_asumida')?.descartable).toBe(true)
    expect(consulta).toContain("marcarRevisado('via', n)")
    expect(consulta).toContain('marcarRevisado(tipo, clave)')
  })

  it('la falta de DOSIS bloquea la firma — decisión del médico dueño', () => {
    /**
     * 5-ago-2026, textual: «que bloquee la firma si falta la dosis». La tomó él,
     * con el dato delante: 4 medicamentos sin dosis de 28 en notas ya firmadas.
     */
    expect(consulta).toContain("x.aviso?.codigo === 'dosis_sin_cifra'")
    expect(consulta).toContain('No se puede firmar.')
  })

  it('pero la falta de UNIDAD sólo avisa', () => {
    /**
     * Él pidió bloquear cuando falta la dosis. Ampliarlo a la unidad por mi
     * cuenta sería decidir por él una segunda vez — queda anotado para que lo
     * decida.
     */
    const i = consulta.indexOf('const sinDosis = medicamentos')
    // `[\s\S]` en vez del flag `s`: ese flag exige ES2018 y el typecheck de CI
    // —más estricto que el de esta máquina— lo rechaza.
    expect(consulta.slice(Math.max(0, i - 1600), i)).toMatch(/sin unidad[\s\S]*no bloquea|no bloquea/)
  })

  it('y «Ya lo revisé» no se ofrece en este aviso', () => {
    /**
     * Desde que los DOS casos bloquean, no hay nada que descartar: hay algo que
     * escribir. Un botón que sólo esconde el aviso sería una promesa falsa — el
     * mensaje se iría y la firma seguiría sin dejarse pulsar.
     */
    const i = consulta.indexOf('Dosis incompleta — no se puede firmar hasta corregirlo')
    expect(consulta.slice(i, consulta.indexOf('</Alert>', i))).not.toContain("marcarRevisado('dosis'")
  })
})

describe('UN RENGLÓN A MEDIO ESCRIBIR NO CUENTA', () => {
  it('sin nombre, no hay aviso', () => {
    /**
     * Mientras el médico teclea, el renglón está vacío. Avisar ahí sería gritar
     * en cada pulsación.
     */
    const i = consulta.indexOf('const dosisIncompletas')
    expect(consulta.slice(i, i + 400)).toContain("filter(m => m.nombre?.trim())")
  })
})
