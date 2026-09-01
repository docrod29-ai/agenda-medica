/**
 * GOLDEN — el borrador no depende de que alguien se acuerde, y no se calla.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos cosas distintas, con la misma raíz: la decisión de guardar vivía dentro de
 * la pantalla, copiada.
 *
 *  1. **La regla estaba escrita cinco veces** en `consulta/[patientId]/page.tsx`:
 *     el autoguardado al servidor (30 s), el respaldo local (1,5 s), el espejo en
 *     memoria, el volcado al salir y el oyente de `nx:guardar-todo`. REG-300 ya
 *     había pagado esta familia —`proximoSeguimiento` entró en unas copias y no
 *     en otras, y **la fecha de la próxima consulta se perdía**— y unificó tres.
 *
 *  2. **Las dos escrituras a `localStorage` acababan en `catch { }`** con el
 *     comentario «almacenamiento lleno: no es crítico». No era cierto: sin cuota,
 *     el respaldo local deja de escribirse, el médico sigue dictando, la pantalla
 *     no cambia, y la copia que le salvaría la consulta tras una recarga ya no
 *     existe.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Trabajando `TR-BORRADORES.cero-perdidos`, que pedía prueba de los caminos de
 * fallo. Al buscar dónde probarlos apareció que **el guardián de REG-300 exigía
 * exactamente tres llamadas a `hayContenido(e)`** — las tres que aquel arreglo
 * había unificado. Las otras dos copias, que son justo las que deciden si el
 * trabajo del médico se guarda, pasaban en verde.
 *
 * ── LA CAUSA RAÍZ, Y LA LECCIÓN SOBRE LAS COMPUERTAS ────────────────────────
 *
 * Una compuerta que **cuenta las copias reparadas** certifica el arreglo, no la
 * propiedad. La reparación de esa familia nunca es volver a copiar bien: es
 * DERIVAR de una sola declaración y poner la compuerta sobre la propiedad — aquí,
 * «en la pantalla no queda ninguna reconstrucción de la regla».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una lista, `CAMPOS_DEL_BORRADOR`. De ella salen a la vez qué se persiste y qué
 * cuenta como contenido. Añadir un campo es añadirlo ahí, y entra en los dos.
 *
 * Y **nada cambia en silencio** (seguridad clínica §3): cuando el respaldo no se
 * puede escribir, se devuelve por qué, para que la pantalla lo diga.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba el navegador.** Recarga, cambio de ruta y `pagehide` son de e2e;
 *   aquí se prueba la decisión y el camino de fallo del almacenamiento, que es
 *   lo que nunca se pudo provocar porque estaba dentro del componente.
 * · **No prueba que el toast se pinte.** Que la pantalla llame al aviso se
 *   comprueba; que se vea es de la revisión visual.
 * · **No cubre el autoguardado al servidor**, que tiene su propio camino
 *   (`guardarBorrador`) y sus propias pruebas. Aquí sólo se unifica la pregunta
 *   de si hay algo que guardar.
 * · **`cambiarTipo` tiene su propia condición y NO se unificó**: contesta otra
 *   pregunta —«¿cambiar de modalidad destruirá algo?»— y mezclarlas haría que
 *   una fecha de seguimiento bloqueara un cambio de modalidad que no la toca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CAMPOS_DEL_BORRADOR, hayAlgoQuePerder, cuerpoDelRespaldo, guardarRespaldoLocal,
  esFaltaDeEspacio, signosConValor, AVISO_SIN_ESPACIO, POR_QUE_NO_SE_CALLA,
  POR_QUE_UNA_SOLA_LISTA, type EstadoDelBorrador,
} from '@/lib/expediente/el-borrador-no-se-pierde'

const VACIO: EstadoDelBorrador = {}

describe('qué cuenta como «hay algo que perder»', () => {
  it('una nota de verdad vacía no dispara un respaldo', () => {
    expect(hayAlgoQuePerder(VACIO)).toBe(false)
    expect(hayAlgoQuePerder({ resumen: '   ', secciones: [{ value: '' }], diagnosticos: [] })).toBe(false)
  })

  it('CADA campo que cuenta, por sí solo, basta', () => {
    /**
     * El caso que impide que la familia vuelva. Si alguien añade un campo a la
     * lista y se olvida de su `cuenta`, o lo pone y no funciona, cae aquí — sin
     * que haya que acordarse de escribir un caso nuevo.
     */
    const soloEsteCampo: Record<string, EstadoDelBorrador> = {
      resumen: { resumen: 'algo' },
      secciones: { secciones: [{ value: 'algo' }] },
      signos: { signos: { fc: '80' } },
      diagnosticos: { diagnosticos: [{}] },
      medicamentos: { medicamentos: [{}] },
      estudiosOrden: { estudiosOrden: [{}] },
      preop: { preop: { riesgo: 'bajo' } },
      proximoSeguimiento: { proximoSeguimiento: '2026-09-15' },
      transcripcion: { transcripcion: 'el paciente refiere…' },
    }
    for (const campo of CAMPOS_DEL_BORRADOR) {
      if (!campo.cuenta) continue
      const e = soloEsteCampo[campo.nombre]
      expect(e, `falta un ejemplo para «${campo.nombre}» — añádelo aquí`).toBeDefined()
      expect(hayAlgoQuePerder(e), `«${campo.nombre}» sola no basta para guardar`).toBe(true)
    }
  })

  it('la fecha de seguimiento sola SÍ se guarda — es el campo de REG-300', () => {
    /**
     * El defecto original, escrito como caso: la copia que no miraba este campo
     * decía que la nota estaba vacía y el respaldo se saltaba. Alimenta la tarea
     * «agendar el seguimiento» y el contador de seguimientos vencidos.
     */
    expect(hayAlgoQuePerder({ proximoSeguimiento: '2026-09-15' })).toBe(true)
  })

  it('elegir la modalidad NO es contenido, pero SÍ se persiste', () => {
    /* Sin `tipo` en el respaldo, restaurar pierde la modalidad de la nota; con
       `tipo` contando, abrir la pantalla y no tocar nada crearía un borrador. */
    expect(hayAlgoQuePerder({ tipo: 'primera-vez' })).toBe(false)
    expect(Object.keys(cuerpoDelRespaldo({ tipo: 'primera-vez' }, { notaId: null, ts: 0 })))
      .toContain('tipo')
  })

  it('un signo vital en cero cuenta; una cadena en blanco no', () => {
    /* Una FC de 0 es un dato clínico —y uno grave—; tratarla como vacío por
       falsedad de JavaScript borraría justo la nota que más importa. */
    expect(signosConValor({ fc: 0 })).toBe(true)
    expect(signosConValor({ fc: '', ta: '   ' })).toBe(false)
    expect(signosConValor(null)).toBe(false)
  })
})

describe('lo que se persiste sale de la misma lista', () => {
  it('el cuerpo lleva TODOS los campos declarados, más notaId y ts', () => {
    const cuerpo = cuerpoDelRespaldo({ resumen: 'x' }, { notaId: 'n1', ts: 42 })
    for (const c of CAMPOS_DEL_BORRADOR) {
      expect(Object.keys(cuerpo), `«${c.nombre}» no viaja en el respaldo`).toContain(c.nombre)
    }
    expect(cuerpo.notaId).toBe('n1')
    expect(cuerpo.ts).toBe(42)
  })

  it('`notaId` viaja — sin él el respaldo creaba una segunda nota', () => {
    /* Restaurar sin `notaId` dejaba `notaIdRef` en null y el siguiente
       autoguardado CREABA otra nota con el mismo contenido. */
    expect(cuerpoDelRespaldo(VACIO, { notaId: 'n7', ts: 1 }).notaId).toBe('n7')
  })

  it('no se cuela nada más: el respaldo es la lista y sus dos extras', () => {
    const cuerpo = cuerpoDelRespaldo({ resumen: 'x' }, { notaId: null, ts: 0 })
    const esperados = new Set([...CAMPOS_DEL_BORRADOR.map(c => c.nombre), 'notaId', 'ts'])
    for (const k of Object.keys(cuerpo)) expect(esperados.has(k as never), `sobra «${k}»`).toBe(true)
  })
})

describe('cuando el respaldo no se puede escribir, se DICE', () => {
  const lleno = () => { throw Object.assign(new Error('lleno'), { name: 'QuotaExceededError' }) }

  it('sin espacio devuelve `sin_espacio`, no un silencio', () => {
    /**
     * AL REVÉS del código anterior, que se tragaba el error con un `catch`
     * vacío y el comentario «no es crítico». Con esa rama, este caso no podía
     * existir: no había nada que observar.
     */
    const r = guardarRespaldoLocal({ resumen: 'la consulta entera' }, { notaId: null, ts: 0, bloqueado: false }, lleno)
    expect(r).toBe('sin_espacio')
  })

  it('un fallo que no es de cuota TAMBIÉN avisa', () => {
    /* Señalar de menos aquí sería volver al silencio: si no se reconoce la
       forma del error, se avisa igual. */
    const r = guardarRespaldoLocal({ resumen: 'x' }, { notaId: null, ts: 0, bloqueado: false }, () => { throw new Error('vaya') })
    expect(r).toBe('no_se_pudo')
  })

  it('las tres formas en que un navegador dice «no cabe» se reconocen', () => {
    expect(esFaltaDeEspacio(Object.assign(new Error(''), { name: 'QuotaExceededError' }))).toBe(true)
    expect(esFaltaDeEspacio(Object.assign(new Error(''), { name: 'NS_ERROR_DOM_QUOTA_REACHED' }))).toBe(true)
    expect(esFaltaDeEspacio(new Error('cualquier otra cosa'))).toBe(false)
  })

  it('con la sesión cerrada NO se escribe — y eso no es un fallo', () => {
    /**
     * Escribir aquí resucitaría PHI que la purga del cierre de sesión se acaba
     * de llevar. Se distingue de «no se pudo» a propósito: avisar al médico de
     * que no se guardó su nota cuando lo correcto era no guardarla sería un
     * susto inventado.
     */
    let escribio = false
    const r = guardarRespaldoLocal({ resumen: 'x' }, { notaId: null, ts: 0, bloqueado: true }, () => { escribio = true })
    expect(r).toBe('sesion_cerrada')
    expect(escribio).toBe(false)
  })

  it('sin nada que perder no se escribe, y tampoco se avisa', () => {
    let escribio = false
    const r = guardarRespaldoLocal(VACIO, { notaId: null, ts: 0, bloqueado: false }, () => { escribio = true })
    expect(r).toBe('nada_que_guardar')
    expect(escribio).toBe(false)
  })

  it('el camino bueno escribe el cuerpo derivado', () => {
    let visto: Record<string, unknown> | null = null
    const r = guardarRespaldoLocal(
      { resumen: 'hola', proximoSeguimiento: '2026-09-15' },
      { notaId: 'n1', ts: 7, bloqueado: false },
      c => { visto = c },
    )
    expect(r).toBe('guardado')
    expect(visto).not.toBeNull()
    expect((visto as unknown as Record<string, unknown>).proximoSeguimiento).toBe('2026-09-15')
  })
})

describe('y la pantalla lo usa de verdad', () => {
  const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('los dos respaldos locales pasan por la misma puerta', () => {
    /* El del rebote y el volcado al salir. Eran dos literales copiados; el
       segundo reescribía la clave y podía borrar lo que el primero guardó. */
    expect((CONSULTA.match(/guardarRespaldoLocal\(/g) ?? []).length).toBe(2)
  })

  it('ya no queda ningún `catch` que se trague la falta de espacio', () => {
    /**
     * Ésta es la que evita la recaída, y está escrita sobre el texto exacto que
     * había: un `catch` cuyo cuerpo era el comentario «almacenamiento lleno».
     */
    expect(CONSULTA).not.toMatch(/catch \{ \/\* almacenamiento lleno/)
  })

  it('y el aviso que se le enseña al médico es el del módulo', () => {
    expect(CONSULTA).toContain('AVISO_SIN_ESPACIO')
    expect(AVISO_SIN_ESPACIO).toMatch(/almacenamiento de este navegador está lleno/)
    /* Dice qué sigue funcionando y qué hacer: un aviso que sólo asusta no sirve. */
    expect(AVISO_SIN_ESPACIO).toMatch(/servidor/)
    expect(AVISO_SIN_ESPACIO).toMatch(/libera espacio/i)
  })

  it('las razones están escritas donde se puedan leer', () => {
    expect(POR_QUE_NO_SE_CALLA).toMatch(/pérdida silenciosa/)
    expect(POR_QUE_UNA_SOLA_LISTA).toMatch(/certifica el arreglo, no la propiedad/)
  })
})
