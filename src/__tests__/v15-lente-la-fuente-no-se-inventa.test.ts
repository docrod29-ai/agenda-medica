/**
 * LA LENTE CONTEXTUAL — Capa 4 de §5 — y la regla de que la fuente NO se inventa.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos cosas, y la segunda es peor que la primera.
 *
 * 1. **La Capa 4 no existía.** §5 del Master Loop V15 define cuatro capas de
 *    shell; este repositorio tenía tres. `V15-SHELL-GREYBOX-001` se cerró sin la
 *    lente, y desde entonces cada documento que la nombraba la daba por futura:
 *    `V15-MARCO-DE-PAGINA.md` llega a reservarle el sitio físico («qué vive en
 *    el ancho que queda a la derecha… es el sitio de la Capa 4, que no existe
 *    todavía como pieza»). Sin ella, §21 —Source Reveal, que la especificación
 *    llama «interacción de firma» del producto— no tenía dónde ocurrir.
 *
 * 2. **`/pendientes` AFIRMABA que sí existía.** Su comentario de continuidad
 *    decía, literalmente, que el tramo «→ Source» era «Source Reveal (§21):
 *    revelación en el flujo, sin ruta que coreografiar». No había ninguna
 *    revelación. El comentario describía una pieza que nadie había escrito —
 *    familia «escrito y sin conectar», cometida sobre la propia documentación,
 *    que es la clase de mentira que sobrevive años porque nadie relee un
 *    comentario buscando si es verdad.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * La auditoría independiente `V15-ORIGINALITY-INDEPENDENT-GATE-001` (sobre el
 * árbol inmutable b72378d) declaró la Capa 4 **genuinamente ausente** como P1
 * bloqueante, y añadió que ni los bloques embebidos ni los cambios de ruta son
 * equivalentes a ella. Al ir a construirla apareció lo segundo, leyendo el
 * comentario que decía que ya estaba hecha.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * No había ningún sitio donde un hecho clínico pudiera contar de dónde salió sin
 * que el médico perdiera la pantalla. El dato SÍ existía —`TareaClinica.notaId`
 * lleva desde su primer día documentado como «de qué consulta salió; es la traza
 * hacia atrás»— y no se pintaba en ninguna parte. Es «el dato tiene que LLEGAR»:
 * escrito, guardado, y sin ningún lector.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **La fuente no se inventa.** `citaDeOrigen` cita lo que la NOTA dice, no lo
 *    que el pendiente dice de sí mismo. Si el estudio ya no aparece en la orden
 *    de esa nota, se declara — no se rellena con el título de la tarea. Éste es
 *    el sitio exacto donde una lente mal escrita fabricaría procedencia: basta
 *    devolver `t.titulo` para que todo «tenga fuente».
 * 2. **Se falla cerrado.** Sin `notaId` no hay nota, y se dice por qué.
 * 3. **«No consta» y «no se pudo leer» son estados distintos** y se pintan
 *    distinto. Fundirlos convierte un error de red en la afirmación clínica «no
 *    consta procedencia», que es una afirmación que nadie hizo. Es `sin-leer`
 *    frente a `sin-pendientes` de `estado-clinico.ts`, otra vez.
 * 4. **El límite no se reata en silencio.** Una nota que dice pertenecer a otro
 *    paciente NO se enseña, y cambiar de ruta CIERRA la lente en vez de
 *    reatarla al paciente nuevo. Familia «paciente equivocado» (REG-312).
 * 5. **La lente no navega.** Volver tiene que devolver al médico al píxel donde
 *    estaba: sin `router.push`, sin cambio de ruta, sin remontar la pantalla.
 * 6. **No flota.** En escritorio es una columna hermana del lienzo, no un panel
 *    que flota sobre el trabajo — RTC-32 sacó del shell todo lo que flotaba y
 *    esta pieza no es excepción de nada.
 *
 * Probado al revés (cada reversión se aplicó y se comprobó que muerde):
 *  · devolver `tarea.titulo` como literal cuando la nota no lo tiene → caso 2;
 *  · fundir `sin-fuente` con `no-se-pudo-leer` en un solo estado → caso 11;
 *  · aceptar una nota cuyo `pacienteId` es otro → caso 6;
 *  · quitar el cierre por cambio de ruta del proveedor → caso 12;
 *  · meter un `router.push` en la lente → caso 13;
 *  · pintar el plano con `position: fixed` en escritorio → caso 15.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide el score §29.** Que exista la Capa 4 no baja un número: eso se
 *   vuelve a puntuar en navegador y lo juzga un revisor independiente, que es
 *   justo lo que la auditoría dejó dicho.
 * · **No cubre render ni layout**: esta suite corre en `node` y sin
 *   testing-library. El foco que vuelve, la hoja móvil, el ancho de la columna y
 *   la cadena entera abrir→inspeccionar→cerrar se verifican en navegador real
 *   (`scripts/design/medir-lente-contextual-v15.mjs`) — un guardián de texto no
 *   puede afirmar que el foco volvió.
 * · **No cubre los llamadores que NO se construyeron.** La lente se cablea en
 *   tres sitios (pendientes, pacientes, banda de alergias); consulta y la
 *   historia clínica quedan declaradas y sin lente.
 * · No juzga si la procedencia que enseña es clínicamente suficiente: enseña la
 *   que consta, y de la que no consta dice que no consta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  citaDeOrigen, claveDelHecho, fuenteDeclarada, laNotaEsDeEstePaciente,
  limiteDelHecho, mismoLimite, tituloDelHecho,
  type HechoInspeccionable, type NotaParaCitar,
} from '@/lib/lente/modelo'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8')

/**
 * EL CÓDIGO SIN SUS COMENTARIOS — porque un guardián mide conducta, no prosa.
 *
 * La primera versión del caso 13 se puso roja contra el árbol correcto: casó
 * con la frase «No hay `router.push`» de la cabecera del propio módulo. O sea,
 * el guardián que prohíbe navegar se disparó con la línea que EXPLICA que no se
 * navega, y habría obligado a borrar la explicación para pasar la prueba.
 *
 * Es la familia de RTC-02 y de RTC-20 —el instrumento que no mide lo que dice
 * medir— cazada esta vez sobre el propio instrumento. En un repositorio con esta
 * densidad de comentario, cualquier guardián que busque una cadena en el fuente
 * tiene que quitarlos antes o acabará prohibiendo hablar del defecto.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const tarea = (extra: Partial<TareaClinica> = {}): TareaClinica => ({
  clinicId: 'c1',
  patientId: 'p1',
  patientNombre: 'Refugio Alcántara',
  tipo: 'estudio_pendiente',
  titulo: 'Biometría hemática',
  prioridad: 'normal',
  estado: 'solicitada',
  creadaEn: '2026-08-01T10:00:00.000Z',
  origen: 'nota',
  notaId: 'n1',
  ...extra,
})

const hechoTarea = (t: TareaClinica): HechoInspeccionable =>
  ({ clase: 'tarea', clinicId: 'c1', patientId: 'p1', tarea: t })

describe('la fuente no se inventa', () => {
  it('1 · cita LITERAL el estudio tal como quedó escrito en la orden de la nota', () => {
    const nota: NotaParaCitar = { estudiosOrden: ['Biometría hemática', 'Química de 6'] }
    const cita = citaDeOrigen(tarea(), nota)
    expect(cita.literal).toBe('Biometría hemática')
    expect(cita.campo).toBe('Estudios solicitados')
    expect(cita.porQue).toBeNull()
  })

  it('2 · si el estudio YA NO está en la orden, lo declara — no lo rellena con el título de la tarea', () => {
    /*
      LA REVERSIÓN QUE ESTE CASO MATA. Basta con que `citaDeOrigen` devuelva
      `tarea.titulo` para que todo pendiente «tenga fuente» y la lente parezca
      funcionar perfectamente. Lo que enseñaría entonces no es lo que dice la
      nota: es lo que dice el propio pendiente, presentado como su procedencia.
      Y la discrepancia —alguien editó la tarea, o cuelga de la nota equivocada—
      quedaría invisible para siempre.
    */
    const nota: NotaParaCitar = { estudiosOrden: ['Química de 6'] }
    const cita = citaDeOrigen(tarea(), nota)
    expect(cita.literal).toBeNull()
    expect(cita.porQue).toMatch(/ya no aparece/i)
    expect(cita.porQue).not.toContain('Biometría hemática')
  })

  it('3 · una orden vacía se dice como orden vacía, no como discrepancia', () => {
    const cita = citaDeOrigen(tarea(), { estudiosOrden: [] })
    expect(cita.literal).toBeNull()
    expect(cita.porQue).toMatch(/ningún estudio/i)
  })

  it('4 · los tipos que NO salen de una línea de la nota lo dicen en vez de citar su propio detalle', () => {
    const t = tarea({
      tipo: 'reconciliacion_medicamento',
      titulo: 'Reconciliar losartán',
      detalle: 'El paciente dijo: «el losartán ya lo dejé».',
    })
    const cita = citaDeOrigen(t, { estudiosOrden: ['Biometría hemática'] })
    expect(cita.literal).toBeNull()
    // El detalle del pendiente NO se presenta como cita de la nota: sería
    // enseñar el pendiente como su propia fuente.
    expect(cita.porQue).not.toContain('losartán ya lo dejé')
    expect(cita.porQue).toMatch(/no sale de una línea concreta/i)
  })

  it('5 · la receta cita los medicamentos de la nota, y sin ellos lo declara', () => {
    const t = tarea({ tipo: 'receta_por_entregar', titulo: 'Entregar receta (2 medicamentos)' })
    expect(citaDeOrigen(t, { medicamentos: [{ nombre: 'Losartán' }, { nombre: 'Metformina' }] }).literal)
      .toBe('Losartán · Metformina')
    expect(citaDeOrigen(t, { medicamentos: [] }).porQue).toMatch(/no tiene medicamentos/i)
  })
})

describe('el límite clínico no se reata en silencio', () => {
  it('6 · una nota que dice pertenecer a OTRO paciente no se enseña', () => {
    const limite = { clinicId: 'c1', patientId: 'p1' }
    expect(laNotaEsDeEstePaciente({ pacienteId: 'p1' }, limite)).toBe(true)
    expect(laNotaEsDeEstePaciente({ pacienteId: 'p2' }, limite)).toBe(false)
    expect(laNotaEsDeEstePaciente(null, limite)).toBe(false)
    // Sin `pacienteId` se acepta: la RUTA por la que se leyó ya está dentro del
    // expediente de este paciente. Lo que no se acepta es que declare OTRO.
    expect(laNotaEsDeEstePaciente({}, limite)).toBe(true)
  })

  it('7 · el límite sale del hecho, nunca se deduce', () => {
    const h = hechoTarea(tarea())
    expect(limiteDelHecho(h)).toEqual({ clinicId: 'c1', patientId: 'p1' })
    expect(mismoLimite(limiteDelHecho(h), { clinicId: 'c1', patientId: 'p2' })).toBe(false)
    expect(mismoLimite(limiteDelHecho(h), { clinicId: 'c2', patientId: 'p1' })).toBe(false)
  })

  it('8 · dos hechos distintos tienen claves distintas, y el mismo hecho la conserva', () => {
    const a = hechoTarea(tarea({ id: 't1' }))
    const b = hechoTarea(tarea({ id: 't2' }))
    expect(claveDelHecho(a)).not.toBe(claveDelHecho(b))
    expect(claveDelHecho(a)).toBe(claveDelHecho(hechoTarea(tarea({ id: 't1' }))))
    // Y un hecho de otra clase sobre el mismo paciente tampoco colisiona: si
    // colisionara, inspeccionar las alergias reusaría la resolución del estado.
    const c: HechoInspeccionable = {
      clase: 'estado-clinico', clinicId: 'c1', patientId: 'p1',
      pacienteNombre: 'Refugio Alcántara', tareas: [],
    }
    expect(claveDelHecho(c)).not.toBe(claveDelHecho(a))
  })
})

describe('se falla cerrado', () => {
  it('9 · sin notaId no hay nota, y el porqué distingue quién la creó', () => {
    expect(fuenteDeclarada(hechoTarea(tarea())).tipo).toBe('nota')

    const delLab = fuenteDeclarada(hechoTarea(tarea({ notaId: undefined, origen: 'laboratorio' })))
    expect(delLab.tipo).toBe('ninguna')
    expect(delLab.tipo === 'ninguna' && delLab.porQue).toMatch(/al llegar el resultado/i)

    const aMano = fuenteDeclarada(hechoTarea(tarea({ notaId: undefined, origen: 'manual' })))
    expect(aMano.tipo === 'ninguna' && aMano.porQue).toMatch(/a mano/i)

    // Un origen desconocido no se adorna: se dice la verdad literal.
    const raro = fuenteDeclarada(hechoTarea(tarea({ notaId: '   ', origen: 'quien-sabe' })))
    expect(raro.tipo === 'ninguna' && raro.porQue).toMatch(/no quedó registrada/i)
  })

  it('10 · los hechos cuya procedencia ya viaja dentro no disparan ninguna lectura', () => {
    const alergias: HechoInspeccionable = {
      clase: 'alergias', clinicId: 'c1', patientId: 'p1',
      pacienteNombre: 'Refugio Alcántara', alergenos: ['sulfas'],
      textoLibre: 'Niega penicilina. Alérgico a sulfas',
    }
    expect(fuenteDeclarada(alergias).tipo).toBe('en-memoria')
    expect(tituloDelHecho(alergias)).toContain('Refugio Alcántara')
  })

  it('11 · «no consta» y «no se pudo leer» se PINTAN distinto', () => {
    /*
      El caso que la reversión mata: fundir los dos en un solo estado. La lente
      seguiría compilando y pareciendo correcta, y un fallo de red se leería en
      pantalla como «no consta procedencia» — una afirmación clínica que nadie
      hizo. Aquí se exige que existan las dos piezas y que no sean la misma.
    */
    const src = leer('src/components/lente/contenido.tsx')
    expect(src).toMatch(/function NoConsta\b/)
    expect(src).toMatch(/function NoSePudoLeer\b/)
    expect(src).toMatch(/estado === 'sin-fuente'[\s\S]{0,120}<NoConsta>/)
    expect(src).toMatch(/estado === 'no-se-pudo-leer'[\s\S]{0,120}<NoSePudoLeer>/)

    const css = leer('src/app/globals.css')
    // Y distinto no es «con otras palabras»: el hueco del registro es ámbar y
    // el fallo de lectura es rojo. Si compartieran color, el canal no informa.
    expect(css).toMatch(/\.nx-lente-hueco\s*\{[^}]*--amber/)
    expect(css).toMatch(/\.nx-lente-fallo\s*\{[^}]*--red/)
  })
})

describe('volver es exacto', () => {
  it('12 · el hecho está ATADO a la ruta desde la que se abrió, y se deriva', () => {
    /*
      No basta con «se cierra al cambiar de ruta»: eso lo cumplía la primera
      versión, con un efecto, y dejaba un frame en el que el plano viejo se
      pinta sobre la pantalla nueva. Lo que se exige aquí es que el hecho se
      guarde CON su ruta y se derive al pintar — así el estado inválido no
      llega a existir, en vez de corregirse un tick después.
    */
    const src = sinComentarios(leer('src/components/lente/LenteContextual.tsx'))
    expect(src).toMatch(/useState<\{ hecho: HechoInspeccionable; ruta: string \} \| null>/)
    expect(src).toMatch(/const hecho = abierto && abierto\.ruta === pathname \? abierto\.hecho : null/)
    // Y no vuelve por la puerta de atrás: nada de reponer el hecho en un efecto.
    expect(src).not.toMatch(/useEffect\([\s\S]{0,200}setAbierto\(/)
  })

  it('13 · la lente NO navega: ni router, ni push, ni replace', () => {
    for (const ruta of [
      'src/components/lente/LenteContextual.tsx',
      'src/components/lente/Inspeccionar.tsx',
    ]) {
      const src = sinComentarios(leer(ruta))
      expect(src, ruta).not.toMatch(/useRouter|router\.(push|replace|back)/)
    }
    /*
      `contenido.tsx` sí tiene enlaces —«Abrir la nota completa»—, y eso es
      correcto: irse es un gesto EXPLÍCITO del médico, rotulado como tal. Lo que
      no puede haber es navegación programática, que es la que se lleva al
      médico sin que la haya pedido.
    */
    expect(sinComentarios(leer('src/components/lente/contenido.tsx'))).not.toMatch(/router\.(push|replace)/)
  })

  it('14 · el disparador llega entero al shell, para que el foco pueda volver', () => {
    const disparador = leer('src/components/lente/Inspeccionar.tsx')
    expect(disparador).toMatch(/abrir\(hecho, e\.currentTarget\)/)
    const shell = leer('src/components/lente/LenteContextual.tsx')
    expect(shell).toMatch(/disparadorRef/)
    expect(shell).toMatch(/focus\?\.\(\)/)
  })
})

describe('la Capa 4 es del shell, y no flota', () => {
  it('15 · en escritorio es columna hermana del lienzo, no algo que flota encima', () => {
    const css = leer('src/app/globals.css')
    const bloque = css.slice(css.indexOf('.nx-lente {'), css.indexOf('.nx-lente-telon'))
    expect(bloque).not.toMatch(/position:\s*(fixed|absolute)/)
    // `position: fixed` sólo dentro del bloque móvil, donde la hoja SÍ flota
    // porque a 390px es un diálogo y no una capa del shell.
    const movil = css.slice(css.lastIndexOf('@media (max-width: 768px)'))
    expect(movil).toMatch(/\.nx-lente\s*\{[^}]*position:\s*fixed/)
  })

  it('16 · el plano se monta como hermano de <main>, dentro del área de trabajo', () => {
    const layout = leer('src/app/(dashboard)/layout.tsx')
    expect(layout).toMatch(/<div className="nx-area-de-trabajo">[\s\S]{0,400}<main[\s\S]{0,200}<\/main>[\s\S]{0,120}<PlanoDeLente \/>/)
    // Y `<main>` sigue siendo EL contenedor de scroll: de él dependen todos los
    // `position: sticky` del producto (ancla del paciente, cierre al pulgar).
    expect(layout).toMatch(/<main style=\{\{ flex: 1, overflowY: 'auto' \}\}>/)
  })

  it('17 · el estado vive UNA vez, en el shell — ninguna pantalla guarda su propio panel', () => {
    const layout = leer('src/app/(dashboard)/layout.tsx')
    expect(layout).toMatch(/<LenteProvider>/)
    for (const ruta of [
      'src/app/(dashboard)/pendientes/page.tsx',
      'src/app/(dashboard)/pacientes/page.tsx',
      'src/components/expediente/PatientAnchor.tsx',
    ]) {
      // Los llamadores sólo saben decir «inspecciona esto». Si alguno montara su
      // propio proveedor, tendría su propia lente y su propio criterio de qué
      // hacer al cambiar de paciente — seis paneles que se parecen, no la Capa 4.
      expect(leer(ruta), ruta).not.toMatch(/LenteProvider/)
      expect(leer(ruta), ruta).toMatch(/<Inspeccionar/)
    }
  })

  it('18 · la lente enseña las MISMAS tareas que la fila resumió — un solo filtro', () => {
    const modelo = leer('src/lib/pacientes/estado-clinico.ts')
    // `estadoClinicoDeFila` pasa por `tareasDelPaciente`: si cada uno filtrara
    // por su cuenta, el plano podría explicar algo que la fila no dice.
    expect(modelo).toMatch(/export function tareasDelPaciente/)
    expect(modelo).toMatch(/const suyas = tareasDelPaciente\(patientId, lectura\)/)
    const pagina = leer('src/app/(dashboard)/pacientes/page.tsx')
    expect(pagina).toMatch(/tareas=\{tareasDelPaciente\(p\.id, worklist\)\}/)
  })

  it('19 · el comentario de /pendientes ya no afirma un Source Reveal que no existía', () => {
    const src = leer('src/app/(dashboard)/pendientes/page.tsx')
    // La frase vieja decía que el tramo «→ Source» YA era revelación en el
    // flujo. No lo era. Si alguien la devuelve sin devolver la pieza, muerde.
    expect(src).not.toMatch(/El tramo «→ Source» es\s*\n?\s*\*?\s*Source Reveal \(§21\): revelación en el flujo/)
    expect(src).toMatch(/<Inspeccionar/)
  })
})
