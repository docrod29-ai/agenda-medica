/**
 * EL DIÁLOGO NO ESCONDE SUS BOTONES — REG-517.
 *
 * QUÉ FALLABA. El dueño, probando la app en su iPhone antes de firmar una nota:
 * «no se ven los botones de hasta abajo». La compuerta previa a firmar llega a
 * listar VEINTIÚN avisos, y el diálogo de confirmación no tenía alto máximo ni
 * desbordamiento: crecía más que la ventana y «Los revisé, firmar» y «Volver a
 * la nota» quedaban fuera de la pantalla.
 *
 * POR QUÉ NO ERA UN DETALLE. Es un diálogo MODAL: mientras está abierto no hay
 * otra cosa que tocar. Un modal cuyos botones no se alcanzan no es incómodo —
 * es una pantalla de la que no se puede salir por el camino previsto. Y la que
 * bloqueaba era, justamente, la de firmar.
 *
 * CÓMO SE DESCUBRIÓ. Usándolo en un teléfono real. Ninguna prueba lo cazó, y no
 * por descuido: el arnés corre en Chromium a 390 px, donde `100vh` sí es lo que
 * se ve. En Safari de iPhone `100vh` incluye lo que tapa la barra de
 * direcciones, que es exactamente el trozo donde caían los botones.
 *
 * LA REGLA QUE LO HACE SEGURO. El diálogo es una columna con tope de alto: el
 * TEXTO scrollea y la fila de botones queda FUERA de ese scroll. Así el mensaje
 * puede crecer lo que quiera sin volver a esconder la salida. El tope se mide en
 * `dvh`, no en `vh`.
 *
 * LO QUE NO CUBRE, dicho:
 *  · Es una prueba de FUENTE. Que en el aparato se vean los botones lo dice el
 *    teléfono, y este arnés no corre en uno.
 *  · No revisa los demás modales del producto (`AppointmentModal`, `CobrarModal`
 *    y compañía). Pueden tener la misma herida; no se auditaron y queda dicho
 *    en vez de insinuar que se revisaron todos.
 *  · No arregla el `100vh` que queda en otras pantallas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { comoSeDicenAlFirmar } from '@/lib/expediente/cuando-avisar'

const src = readFileSync(join(process.cwd(), 'src/context/ToastContext.tsx'), 'utf8')

describe('REG-517 · el diálogo de confirmación en un teléfono', () => {
  it('EL CASO: el panel tiene tope de alto, o crece hasta esconder sus botones', () => {
    expect(src, 'el panel volvió a no tener alto máximo').toMatch(/maxHeight: 'calc\(100dvh/)
  })

  it('y el tope se mide en dvh, no en vh', () => {
    /**
     * En Safari de iPhone `100vh` incluye lo que tapa la barra de direcciones.
     * Un tope en `vh` deja el diálogo más alto que lo visible y devuelve el
     * defecto entero.
     */
    expect(src).not.toMatch(/maxHeight: 'calc\(100vh/)
  })

  it('lo que scrollea es el TEXTO, no el diálogo entero', () => {
    const desc = src.slice(src.indexOf('id="nx-confirm-desc"'))
    expect(desc.slice(0, 400), 'el cuerpo del mensaje dejó de poder scrollear')
      .toMatch(/overflowY: 'auto'/)
  })

  it('y la fila de botones se queda FUERA de ese scroll', () => {
    // Si los botones entran en el área que scrollea, vuelven a poder quedar
    // debajo del pliegue: es el mismo defecto con otra forma.
    const fila = src.slice(src.indexOf("justifyContent: 'flex-end', marginTop: 20"))
    expect(fila.slice(0, 300)).toMatch(/flex: '0 0 auto'/)
  })

  it('el telón respeta el área segura del teléfono', () => {
    // `padding: 20` a secas ignora la muesca y la barra inferior de Safari.
    expect(src).toMatch(/paddingBottom: 'max\(20px, env\(safe-area-inset-bottom\)\)'/)
  })
})

/**
 * La segunda mitad de REG-517: aunque los botones ya se alcancen, ocho párrafos
 * de texto legal antes de firmar no se leen — se saltan. Un aviso que nadie lee
 * no protege a nadie.
 */
describe('REG-517 · el diálogo de firmar no es un informe', () => {
  const aviso = (i: number, origen: string, texto: string) => ({
    id: `${origen}:${i}`, origen, nivel: 'aviso', texto,
  }) as unknown as Parameters<typeof comoSeDicenAlFirmar>[0][number]

  it('EL CASO: veintiún avisos del mismo origen se resumen en UNA línea', () => {
    const avisos = Array.from({ length: 21 }, (_, i) =>
      aviso(i, 'sin_respaldo_en_el_dictado', `Esto no salió del dictado: «frase ${i}». Nadie dijo: x, y, z.`))
    const msg = comoSeDicenAlFirmar(avisos)
    expect(msg).toContain('21 frases de la nota no salieron del dictado')
    // Lo que importa: ya no es un muro. Antes eran ocho párrafos + «y 13 más».
    expect(msg.split('\n').filter(l => l.startsWith('·'))).toHaveLength(1)
  })

  it('la CUENTA total sigue siendo la real: no se descarta ni un aviso', () => {
    const avisos = Array.from({ length: 21 }, (_, i) =>
      aviso(i, 'sin_respaldo_en_el_dictado', `frase ${i}`))
    expect(comoSeDicenAlFirmar(avisos)).toContain('21 cosas por revisar')
  })

  it('lo ÚNICO se sigue diciendo entero: cada uno dice algo distinto', () => {
    const msg = comoSeDicenAlFirmar([
      aviso(1, 'alergia_medicamento', 'Alergia a penicilina y se receta amoxicilina'),
      aviso(2, 'dosis_incompleta', 'Levotiroxina sin dosis'),
    ])
    expect(msg).toContain('Alergia a penicilina y se receta amoxicilina')
    expect(msg).toContain('Levotiroxina sin dosis')
  })

  it('dos del mismo origen NO se resumen: verlos enteros todavía informa', () => {
    const msg = comoSeDicenAlFirmar([
      aviso(1, 'sin_respaldo_en_el_dictado', 'primera frase huérfana'),
      aviso(2, 'sin_respaldo_en_el_dictado', 'segunda frase huérfana'),
    ])
    expect(msg).toContain('primera frase huérfana')
    expect(msg).toContain('segunda frase huérfana')
  })
})
