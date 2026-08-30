/**
 * GOLDEN — la misma intención, el mismo documento: ARCO y fotos clínicas.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Las dos escrituras clínicas de Practice que el inventario de REG-412 dejó
 * nombradas y sin cerrar. Las dos con `addDoc`, o sea con nombre aleatorio.
 *
 * · **ARCO.** El formulario del portal es público y lo llena una persona desde su
 *   teléfono, con la conexión que tenga. Si el commit sale y la respuesta se
 *   pierde, ve un error, vuelve a pulsar «Enviar», y quedan DOS solicitudes del
 *   mismo derecho: dos folios, dos plazos legales de respuesta (Art. 32 LFPDPPP)
 *   y dos procesos que el consultorio tiene que contestar por separado.
 * · **Fotos.** Una foto duplicada entra al expediente y sale en el informe.
 *
 * ── LA DIFERENCIA ENTRE LAS DOS, QUE ES LO INTERESANTE ──────────────────────
 *
 * En ARCO la clave se acuña al ABRIR el formulario, como en la dispensación de
 * farmacia: hay un momento anterior al envío donde la intención ya existe.
 *
 * En fotos **no lo hay**. El flujo entero —leer el archivo, subirlo a Storage,
 * escribir el documento— ocurre dentro de un solo manejador que arranca al
 * elegir el archivo. Cuando la escritura falla, el usuario vuelve a elegir **el
 * mismo archivo**: para la interfaz eso es un intento nuevo, y una clave acuñada
 * ahí sería nueva también.
 *
 * Así que la identidad sale del ARCHIVO: nombre, tamaño, fecha de modificación,
 * paciente y región. Dos subidas del mismo archivo a la misma región del mismo
 * paciente son la misma foto. Dos fotos distintas de la misma herida son dos
 * archivos distintos —otros bytes, otra marca de tiempo— y no colapsan.
 *
 * Elegir mal aquí tiene coste en las dos direcciones: una clave por intento no
 * protege de nada, y una clave demasiado amplia —paciente + región, sin el
 * archivo— borraría la segunda foto de una evolución.
 *
 * ── LA REGLA COMÚN ──────────────────────────────────────────────────────────
 *
 * Si el documento ya existe, **no se pisa**. La solicitud anterior lleva su
 * `fechaSolicitud` —desde la que corre el plazo legal— y la foto lleva su
 * `fecha`, que es dato clínico. Reescribirlas para «actualizar» perdería justo el
 * dato que hace falta conservar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El objeto huérfano en Storage.** El segundo intento de una foto ya subió el
 *   archivo antes de llegar aquí: converge el expediente, no el bucket. Cuesta
 *   espacio y no cuesta expediente, que es la mitad que importaba.
 * · **Sin clave, las dos se comportan como antes**, a propósito.
 * · **No cubre dos personas rellenando el mismo formulario a la vez**: son dos
 *   intenciones y son dos solicitudes, que es lo correcto.
 * · **No prueba el render.**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { idIdempotente } from '@/lib/idempotencia'
import { claveDeLaFoto } from '@/lib/expediente/fotos-clinicas'

const PORTAL = readFileSync('src/app/privacidad/[clinicId]/page.tsx', 'utf8')
const FOTOS_UI = readFileSync('src/components/FotosClinicas.tsx', 'utf8')
const ARCO = readFileSync('src/lib/arco.ts', 'utf8')
const FOTOS = readFileSync('src/lib/expediente/fotos-clinicas.ts', 'utf8')

const archivo = (over: Partial<{ name: string; size: number; lastModified: number }> = {}) =>
  ({ name: 'herida.jpg', size: 120_345, lastModified: 1_700_000_000_000, ...over })

describe('la foto se identifica por la foto, no por el intento', () => {
  it('el mismo archivo, mismo paciente y misma región dan la MISMA clave', () => {
    /**
     * AL REVÉS del estado anterior: con `addDoc`, dos intentos del mismo archivo
     * eran dos documentos, y el segundo salía porque el primero pareció fallar.
     */
    const a = claveDeLaFoto({ file: archivo(), patientId: 'p1', region: 'Pie derecho' })
    const b = claveDeLaFoto({ file: archivo(), patientId: 'p1', region: 'Pie derecho' })
    expect(a).toBe(b)
  })

  it('pero OTRO archivo da otra clave — una evolución no se colapsa', () => {
    /**
     * El caso que impide pasarse de frenada. Dos fotos de la misma herida en dos
     * días son dos archivos distintos, y colapsarlas borraría la evolución: el
     * expediente diría que sólo se fotografió una vez.
     */
    const hoy = claveDeLaFoto({ file: archivo(), patientId: 'p1', region: 'Pie derecho' })
    const manana = claveDeLaFoto({
      file: archivo({ name: 'herida-2.jpg', size: 130_000, lastModified: 1_700_086_400_000 }),
      patientId: 'p1', region: 'Pie derecho',
    })
    expect(manana).not.toBe(hoy)
  })

  it('y el mismo archivo en otra REGIÓN o de otro PACIENTE, tampoco', () => {
    const base = { file: archivo(), patientId: 'p1', region: 'Pie derecho' }
    expect(claveDeLaFoto({ ...base, region: 'Pie izquierdo' })).not.toBe(claveDeLaFoto(base))
    expect(claveDeLaFoto({ ...base, patientId: 'p2' })).not.toBe(claveDeLaFoto(base))
  })

  it('el tamaño y la fecha entran en la clave, no sólo el nombre', () => {
    /* Dos capturas seguidas se llaman igual en muchos teléfonos («IMG_0001»). */
    const base = { file: archivo(), patientId: 'p1', region: 'Pie derecho' }
    expect(claveDeLaFoto({ ...base, file: archivo({ size: 1 }) })).not.toBe(claveDeLaFoto(base))
    expect(claveDeLaFoto({ ...base, file: archivo({ lastModified: 1 }) })).not.toBe(claveDeLaFoto(base))
  })

  it('la pantalla la calcula del archivo que acaba de elegir', () => {
    /* «El dato tiene que LLEGAR»: una función que acepta la clave y una pantalla
       que no se la pasa no protegen nada. */
    expect(FOTOS_UI).toMatch(/claveDeLaFoto\(\{ file, patientId, region \}\)/)
  })

  it('y si ya existe NO se pisa: la `fecha` de la foto es dato clínico', () => {
    expect(FOTOS).toMatch(/if \(!previa\.exists\(\)\) await setDoc\(ref, limpio\)/)
  })
})

describe('un derecho ejercido una vez es un expediente', () => {
  it('la clave nace con el FORMULARIO, no con el envío', () => {
    /**
     * `useState(claveDeIntento)` y no `useState(claveDeIntento())`: la forma
     * perezosa acuña UNA vez en el primer render. Con la llamada directa se
     * evaluaría en cada render — la misma clave nueva de siempre, disfrazada.
     */
    const declaracion = PORTAL.split('\n').find(l => l.includes('const [claveSolicitud]')) ?? ''
    expect(declaracion, 'no se localizó la declaración de la clave').not.toBe('')
    expect(declaracion).toMatch(/useState\(claveDeIntento\)/)
    /* Se mira la LÍNEA y no el archivo: el comentario de al lado cita la forma
       equivocada para explicarla, y buscarla en todo el fichero la encuentra ahí. */
    expect(declaracion).not.toMatch(/claveDeIntento\(\)/)
  })

  it('y LLEGA a la escritura', () => {
    expect(PORTAL).toMatch(/\}, claveSolicitud\)/)
  })

  it('si la solicitud ya existe NO se pisa: el plazo legal corre desde su fecha', () => {
    /**
     * Reescribirla movería `fechaSolicitud`, que es exactamente el día desde el
     * que cuentan los 20 días hábiles del Art. 32. Un reintento no puede
     * regalarle tiempo al consultorio.
     */
    expect(ARCO).toMatch(/if \(!previa\.exists\(\)\) await setDoc\(r, payload\)/)
    expect(ARCO).toMatch(/plazo legal/)
  })

  it('sin clave sigue comportándose como antes', () => {
    /* Un llamador que todavía no la pase no puede quedarse sin registrar la
       solicitud: perder el ejercicio de un derecho es peor que duplicarlo. */
    expect(ARCO).toMatch(/: await addDoc\(col, payload\)/)
  })
})

describe('los dos ámbitos están declarados, no son texto libre', () => {
  it('«arco» y «foto» derivan ids con la forma sellada', () => {
    expect(idIdempotente('c1', 'arco', 'k')).toMatch(/^arco__[0-9a-f]{32}$/)
    expect(idIdempotente('c1', 'foto', 'k')).toMatch(/^foto__[0-9a-f]{32}$/)
  })

  it('y el consultorio va dentro: una clave prestada no aterriza en otro', () => {
    expect(idIdempotente('c1', 'arco', 'k')).not.toBe(idIdempotente('c2', 'arco', 'k'))
    expect(idIdempotente('c1', 'foto', 'k')).not.toBe(idIdempotente('c2', 'foto', 'k'))
  })
})
