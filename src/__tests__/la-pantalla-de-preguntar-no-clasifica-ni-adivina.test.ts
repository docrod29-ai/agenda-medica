/**
 * GOLDEN — LA PANTALLA DE «PREGUNTAR» NO CLASIFICA, Y NO ESCONDE EL AVISO.
 *
 * V9 · `PATIENT-AI-001`, el lado que ve el paciente.
 *
 * ── QUÉ ERA ESTA PANTALLA ────────────────────────────────────────────────────
 *
 * Un cartel. `/mi/[token]` tenía el destino «Preguntar» desde
 * `PATIENT-COMPANION-001` y lo único que hacía era decirle al paciente que
 * llamara al consultorio. Su propio comentario lo declaraba y remitía a esta
 * unidad — «ASK NEXUS todavía no responde, y eso es lo correcto hoy».
 *
 * ── LO QUE ESTE GOLDEN VIGILA ────────────────────────────────────────────────
 *
 * 1. **Que el cliente no clasifique.** La decisión es del servidor (§3: «la
 *    prohibición vive en el servidor, no en la instrucción»). Si la pantalla
 *    importara el clasificador, bastaría con abrir la consola del teléfono para
 *    saltárselo — y peor: dos clasificadores, uno en cada lado, es la familia
 *    «el sistema se contradice a sí mismo» esperando a ocurrir.
 * 2. **Que el aviso urgente vaya PRIMERO.** «Un aviso urgente que llega en el
 *    tercer párrafo no llegó» (§6).
 * 3. **Que el riesgo no se pinte SÓLO con color** (regla de diseño: «nunca
 *    representar riesgo clínico sólo con color»).
 * 4. **Que la procedencia se vea.** Sin ella, una cita del plan de su médico y
 *    una frase de una máquina se leen igual.
 * 5. **Que el campo tenga etiqueta de verdad**, no un `placeholder`: un campo
 *    cuyo único rótulo es el ejemplo se queda mudo en cuanto se escribe la
 *    primera letra.
 *
 * ── LO QUE ESTE GOLDEN NO ES, Y HAY QUE DECIRLO FUERTE ──────────────────────
 *
 * **No aprueba esta interfaz.** La regla de diseño de este repositorio dice,
 * literal: «No se aprueba una interfaz leyendo el código… se lanza el producto,
 * se mira, se recorre el flujo de verdad, se prueba en móvil, se prueba con
 * teclado». Nada de eso ha ocurrido aquí, y no puede ocurrir en este
 * contenedor: `npm run build` muere con `auth/invalid-api-key` porque faltan
 * las variables `NEXT_PUBLIC_FIREBASE_*`.
 *
 * Queda declarado como pendiente en `agent-state/BLOCKERS.md`. Esto comprueba
 * invariantes de ESTRUCTURA — lo que sí se puede afirmar sin navegador — y
 * ninguno de ellos sustituye a abrirla en un teléfono.
 *
 * En particular NO comprueba: contraste real, orden de foco, que el control
 * reciba el toque (`document.elementFromPoint`), ni que nada lo tape. Los tres
 * últimos defectos de la familia «escrito y sin conectar» (REG-425, 426, 427)
 * salieron exactamente de ahí y ninguna prueba de fuente los habría visto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PANTALLA = readFileSync(join(process.cwd(), 'src', 'app', 'mi', '[token]', 'page.tsx'), 'utf8')

/** El bloque del destino «preguntar», para exigirle cosas sólo a él. */
const BLOQUE = /\{destino === 'preguntar' && \(<>[\s\S]*?\{destino === 'cuidado'/.exec(PANTALLA)?.[0] ?? ''

/**
 * EL MISMO CÓDIGO, SIN COMENTARIOS.
 *
 * Hace falta para las comprobaciones en negativo, y la razón merece quedar
 * escrita porque ya mordió dos veces en esta unidad: **un guardián que busca
 * `alert(` en el fuente encuentra el comentario que explica por qué no se usa
 * `alert()`**. Se pone rojo sobre la prosa que lo defiende, y quien lo lea
 * mañana concluirá que el código está mal cuando está bien.
 *
 * Regla: lo que se afirma en negativo se afirma sobre el CÓDIGO.
 */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const CODIGO = sinComentarios(BLOQUE)

describe('LA PANTALLA DEJÓ DE SER UN CARTEL', () => {
  it('el destino «preguntar» existe y tiene cuerpo', () => {
    expect(BLOQUE, 'no se encontró el bloque del destino').not.toBe('')
  })

  it('hay un campo donde escribir, y un botón que envía', () => {
    expect(BLOQUE).toContain('<textarea')
    expect(BLOQUE).toContain('onClick={enviarPregunta}')
  })

  it('y ya no dice que todavía no responde', () => {
    expect(CODIGO).not.toContain('todavía no responde')
  })
})

describe('EL CLIENTE NO CLASIFICA — la decisión es del servidor', () => {
  it('la pantalla no importa el clasificador ni el detector de urgencias', () => {
    expect(PANTALLA).not.toContain('clasificarPregunta')
    expect(PANTALLA).not.toContain('urgenciaDelMensaje')
    expect(PANTALLA).not.toContain("from '@/lib/paciente/pregunta-del-paciente'")
  })

  it('lo que pinta es lo que le devolvió el servidor', () => {
    // Manda `action: 'preguntar'` y pinta `clase`/`respuesta`; no decide nada.
    expect(BLOQUE || PANTALLA).toBeTruthy()
    expect(PANTALLA).toContain("action: 'preguntar'")
    expect(PANTALLA).toContain("p.clase === 'URGENT_REVIEW_REQUIRED'")
  })
})

describe('EL AVISO URGENTE VA PRIMERO Y NO ES SÓLO COLOR', () => {
  it('el aviso se pinta ANTES que la pregunta y que la respuesta', () => {
    const aviso = BLOQUE.indexOf('Esto puede ser una urgencia')
    const pregunta = BLOQUE.indexOf('Preguntaste:')
    const respuesta = BLOQUE.indexOf('{p.respuesta}')
    expect(aviso).toBeGreaterThan(-1)
    expect(aviso, 'el aviso urgente no puede ir después de la pregunta').toBeLessThan(pregunta)
    expect(aviso, 'ni después de la respuesta').toBeLessThan(respuesta)
  })

  it('lleva icono y palabra, no sólo el color del borde', () => {
    /**
     * «Never represent clinical risk only with color» (V9 §ACCESSIBILITY). Un
     * borde rojo no existe para quien no distingue el rojo, ni para quien mira
     * la pantalla a las nueve de la noche con la vista cansada.
     */
    expect(BLOQUE).toContain('<AlertTriangle')
    expect(BLOQUE).toContain('Esto puede ser una urgencia')
  })
})

describe('LO QUE SE CITA ENSEÑA DE DÓNDE SALIÓ', () => {
  it('la procedencia se pinta cuando la hay', () => {
    expect(BLOQUE).toContain('p.procedencia?.fechaConsulta')
    expect(BLOQUE).toContain('lo dejó escrito tu médico')
  })

  it('y la respuesta que se enseña es la CONGELADA, no una recalculada', () => {
    // `p.respuesta` viene del documento guardado aquel día. Si la pantalla
    // recompusiera la respuesta desde el plan de hoy, lo que el paciente leyó
    // el martes cambiaría solo el jueves.
    expect(BLOQUE).toContain('{p.respuesta}')
  })
})

describe('ACCESIBILIDAD — los mínimos que fallan la compuerta', () => {
  it('el campo tiene etiqueta de verdad, no sólo `placeholder`', () => {
    expect(BLOQUE).toContain('<label htmlFor={idPregunta}')
    expect(BLOQUE).toContain('id={idPregunta}')
  })

  it('el envío es un `<button>` con objetivo táctil de 44 px', () => {
    expect(BLOQUE).toContain('type="button"')
    expect(BLOQUE).toContain('minHeight: 44')
    expect(BLOQUE).toContain('minWidth: 44')
  })

  it('el fallo se escribe en la pantalla con `role="alert"`, no en un `alert()`', () => {
    /**
     * Un `alert()` se cierra sin dejar rastro: el paciente toca «Aceptar» y la
     * pantalla queda igual que si hubiera funcionado. Ya pasó tres veces en
     * esta misma pantalla, y por eso el portal no usa ninguno.
     */
    expect(CODIGO).toContain('role="alert"')
    expect(CODIGO, 'sobre el CÓDIGO, no sobre el comentario que lo explica').not.toContain('alert(')
  })
})

describe('NO SE PIERDE LO QUE EL PACIENTE ESCRIBIÓ NI LO QUE YA PREGUNTÓ', () => {
  it('el borrador no se limpia hasta que el servidor confirma', () => {
    const envio = /const enviarPregunta = useCallback\([\s\S]*?\n  \}, \[/.exec(PANTALLA)?.[0] ?? ''
    expect(envio).not.toBe('')
    const limpia = envio.indexOf("setBorrador('')")
    const confirma = envio.indexOf('const d = await r.json()')
    expect(limpia, 'se limpia el borrador antes de saber si se envió').toBeGreaterThan(confirma)
  })

  it('el historial se pide al servidor: una respuesta sobrevive a recargar', () => {
    expect(PANTALLA).toContain("action: 'preguntas'")
  })

  it('y un fallo de red NO se pinta como «nunca he preguntado»', () => {
    /**
     * `preguntas` se queda en `null` —«no se sabe»— y la lista sólo se pinta con
     * `preguntas.length > 0`. Es la misma regla que ya defiende `docsError`: una
     * lista vacía por un fallo de red se lee como una afirmación.
     */
    expect(PANTALLA).toContain('preguntas && preguntas.length > 0')
  })
})
