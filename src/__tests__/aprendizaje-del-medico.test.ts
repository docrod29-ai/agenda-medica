/**
 * GOLDEN — LEARN: lo que el médico corrige a mano deja de perderse.
 *
 * ── LO QUE FALTABA ───────────────────────────────────────────────────────────
 *
 * El sistema no aprendía del médico. Tenía un diccionario fijo de confusiones
 * —el mismo para todos— y cargaba el vocabulario del paciente. Pero cuando el
 * médico corregía «sefriaxona» → «ceftriaxona» en el editor, esa corrección **se
 * perdía**: al día siguiente el motor cometía el mismo error, con el mismo
 * médico, en la misma palabra.
 *
 * ── DE DÓNDE SALE LA EVIDENCIA ───────────────────────────────────────────────
 *
 * La nota guarda **las dos versiones** desde la v996: lo que el reconocedor oyó
 * y el texto de trabajo que el médico pudo editar. La diferencia entre ambas
 * **es** la corrección. No hay que pedirle que enseñe nada: ya lo hizo al
 * escribir.
 *
 * ── LAS TRES REGLAS QUE LO HACEN SEGURO ──────────────────────────────────────
 *
 * 1. Nada que toque una cifra, una unidad o un par prohibido — se reutiliza la
 *    política crítica que ya existe, **no se escribe un criterio nuevo**.
 * 2. Una sola vez no enseña nada.
 * 3. Sólo una palabra por una palabra.
 *
 * Y lo aprendido **sólo sesga** al reconocedor. No reescribe: el corrector y su
 * guardián siguen decidiendo con las reglas de siempre.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLAVES_DE_SESGO_DEL_PACIENTE } from '@/hooks/useGrabacionAudio'
import {
  esAprendible, paresDeUnaNota, loAprendido, MINIMO_REPETICIONES, identidadDe,
  POR_QUE_NO_SE_APRENDEN_CIFRAS, POR_QUE_HACEN_FALTA_DOS, POR_QUE_SOLO_SESGA,
  POR_QUE_NO_SE_ALINEA_SI_CAMBIA_EL_LARGO,
} from '@/lib/asr/aprendizaje'
import { PARES_PROHIBIDOS } from '@/lib/asr/politica-critica'
import { construir } from '@/lib/asr/lexicon'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/**
 * ── DESDE H-19 (27-ago-2026) EL FILTRO EXIGE SABER A QUIÉN PROTEGE ──────────
 *
 * Estas pruebas llamaban sin identidad y el módulo lo leía como «no hay nada
 * que proteger». Esa omisión ERA el defecto: la pantalla también llamaba así,
 * sin querer, y el apellido del paciente acababa en el vocabulario del
 * consultorio. Ahora sin identidad conocida no se aprende nada, así que aquí se
 * pasa un paciente SINTÉTICO — que además comprueba que el filtro es
 * quirúrgico: quita la identidad, no la consulta entera.
 */
const YO = identidadDe('Ernestina Quintanilla Robledo')

describe('EL CASO DEL DR., QUE ES EL QUE LO PIDIÓ', () => {
  it('«sefriaxona» → «ceftriaxona» se aprende tras verlo dos veces', () => {
    const notas = [
      ['le doy sefriaxona un gramo', 'le doy ceftriaxona un gramo'],
      ['iniciamos sefriaxona hoy mismo', 'iniciamos ceftriaxona hoy mismo'],
    ]
    const pares = notas.flatMap(([a, b]) => paresDeUnaNota(a, b, YO))
    const r = loAprendido(pares, undefined, YO)
    expect(r).toHaveLength(1)
    expect(r[0].palabra).toBe('ceftriaxona')
    expect(r[0].veces).toBe(2)
    expect(r[0].oidoComo).toEqual(['sefriaxona'])
  })

  it('con una sola vez todavía no se cree nada', () => {
    // Puede ser un error de dedo o una frase reescrita por estilo.
    expect(loAprendido(paresDeUnaNota('le doy sefriaxona', 'le doy ceftriaxona', YO), undefined, YO)).toEqual([])
    expect(MINIMO_REPETICIONES).toBeGreaterThanOrEqual(2)
  })
})

describe('LO QUE NUNCA SE APRENDE — la parte que protege', () => {
  it('ningún par prohibido por la política crítica, en ninguna dirección', () => {
    /**
     * mg↔mcg, mL↔L, derecha↔izquierda… Aprender uno de éstos sería enseñarle al
     * motor a equivocarse con más confianza, y son exactamente los errores que
     * cambian una dosis por mil.
     */
    for (const p of PARES_PROHIBIDOS) {
      expect(esAprendible({ oido: p.a, corregido: p.b }, YO), `${p.a}→${p.b}`).toBe(false)
      expect(esAprendible({ oido: p.b, corregido: p.a }, YO), `${p.b}→${p.a}`).toBe(false)
    }
  })

  it('nada que traiga una cifra', () => {
    expect(esAprendible({ oido: '500', corregido: '5000' }, YO)).toBe(false)
    expect(esAprendible({ oido: 'dosis500', corregido: 'dosis5000' }, YO)).toBe(false)
  })

  it('nada de una sola palabra a un párrafo', () => {
    // Un párrafo reescrito no es vocabulario, y metería basura en el sesgo.
    expect(esAprendible({ oido: 'tos', corregido: 'tos seca de tres días' }, YO)).toBe(false)
  })

  it('ni palabras demasiado cortas', () => {
    // «con»→«sin» invierte el sentido y cabe en tres letras.
    expect(esAprendible({ oido: 'con', corregido: 'sin' }, YO)).toBe(false)
  })

  it('ni un cambio que no cambia nada', () => {
    expect(esAprendible({ oido: 'ceftriaxona', corregido: 'ceftriaxona' }, YO)).toBe(false)
    expect(esAprendible({ oido: '', corregido: 'ceftriaxona' }, YO)).toBe(false)
  })

  it('y si el médico añadió o quitó texto, no se aprende NADA de esa nota', () => {
    /**
     * Las posiciones se desplazan y cualquier «par» sería una coincidencia. Se
     * prefiere no aprender a aprender ruido: el sesgo es lo único que cambia lo
     * que el motor OYE.
     */
    expect(paresDeUnaNota('le doy sefriaxona', 'le doy ceftriaxona un gramo', YO)).toEqual([])
  })

  it('están escritas las razones', () => {
    expect(POR_QUE_NO_SE_APRENDEN_CIFRAS).toMatch(/Ni una vez, ni mil/)
    expect(POR_QUE_HACEN_FALTA_DOS).toMatch(/una sola infusión/)
    expect(POR_QUE_SOLO_SESGA).toMatch(/no es permiso para/)
    expect(POR_QUE_NO_SE_ALINEA_SI_CAMBIA_EL_LARGO).toMatch(/aprender ruido/)
  })
})

describe('LO APRENDIDO VA PRIMERO EN EL VOCABULARIO', () => {
  it('antes incluso que los fármacos del paciente', () => {
    /**
     * El presupuesto son 224 tokens y el orden ES la política. Lo aprendido se
     * ganó con evidencia sobre ESTE médico; el catálogo es un supuesto.
     */
    const lex = construir({
      modulo: 'consulta',
      aprendidas: ['ceftriaxona'],
      medicamentos: ['metformina'],
    })
    expect(lex.terminos[0].toLowerCase()).toBe('ceftriaxona')
  })

  it('sin nada aprendido, el vocabulario es el de siempre', () => {
    // Esto sólo puede añadir: un médico nuevo no pierde nada.
    const sin = construir({ modulo: 'consulta', medicamentos: ['metformina'] })
    expect(sin.terminos[0].toLowerCase()).toBe('metformina')
  })
})

describe('ESTÁ CONECTADO DE PUNTA A PUNTA', () => {
  it('la consulta lo deriva de las notas FIRMADAS del paciente', () => {
    // De un borrador a medio escribir se aprendería de un trabajo sin terminar.
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain("filter(n => n.estado === 'firmada')")
    // H-19 movió la derivación a su propio efecto, porque dentro del `.then` de
    // `getNotas` el paciente todavía no había cargado y el filtro de identidad
    // corría ciego. Aquí se ata lo que importa: se derivan las FIRMADAS, y se
    // derivan con la identidad del paciente, no sin ella.
    expect(page).toContain("motor: n.transcripcionMotor ?? '', crudo: n.transcripcionCruda ?? ''")
    expect(page).toContain('paresDeUnaNota(d.motor, d.crudo, identidad)')
    expect(page).toContain('const identidad = useMemo(() => identidadDe(patient?.nombre), [patient?.nombre])')
    expect(page).toContain('fusionar(deEstePaciente, delConsultorio)')
  })

  it('y lo manda en las opciones de la grabación', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('aprendidas: aprendido.map(a => a.palabra)')
  })

  it('el hook lo envía en cada trozo y en el final', () => {
    // REG-516: los cuatro puntos de envío recorren UNA lista compartida. Aquí se
    // comprueba que `aprendidas` esté en la lista y que el final
    // (`anexarContexto`) y los trozos (`flushChunks`) pasen por el ayudante.
    expect(CLAVES_DE_SESGO_DEL_PACIENTE).toContain('aprendidas')
    const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')
    expect(hook).toContain('anexarSesgoDelPaciente(fd, c)')
    expect(hook).toContain('anexarSesgoDelPaciente(fd, contextoRef.current)')
  })

  it('y las dos rutas lo leen', () => {
    for (const r of ['transcribir', 'transcribir-chunk']) {
      const ruta = leer('src', 'app', 'api', 'expediente', r, 'route.ts')
      expect(ruta, r).toContain("aprendidas: leerLista('aprendidas')")
    }
  })
})
