/**
 * GOLDEN — una guía es un objeto con edición, no una cadena muda.
 *
 * ── QUÉ HABÍA ───────────────────────────────────────────────────────────────
 *
 * Las guías se citan como texto fijo dentro de los motores clínicos:
 * `'KDIGO 2020'`, `'ESC 2024'`, `'IDSA 2026 AMR'`, `'Surviving Sepsis 2026'`.
 * Son 112 campos `referencia` en el registro de motores, y el médico los lee tal
 * cual en la pantalla de cumplimiento, bajo «De dónde salen sus reglas».
 *
 * ── EL PROBLEMA, QUE NO ES DE FORMATO ───────────────────────────────────────
 *
 * Una cadena no puede decir **si esa edición sigue siendo la vigente**.
 *
 * Las guías se sustituyen. Un motor que cita `KDIGO 2020` lo seguirá citando
 * igual el día que salga la edición siguiente, y la pantalla lo enseñará con el
 * mismo aspecto: una referencia, sin más. Ni el médico ni el sistema pueden
 * distinguir la actual de una superada.
 *
 * ── LA LÍNEA QUE ESTE TRABAJO NO CRUZA, Y ES LO MÁS IMPORTANTE ──────────────
 *
 * **No se declara qué guía está vigente.** Cuál es la edición actual de KDIGO,
 * si la anterior sigue siendo aceptable, o cuál de dos guías válidas manda
 * cuando discrepan, son **hechos clínicos**, y la regla 1 prohíbe inventarlos
 * igual que prohíbe inventar una dosis.
 *
 * Rellenar esa tabla de memoria sería el fallo más caro posible: no rompe nada,
 * no falla ninguna prueba, y sale impreso al lado de una recomendación con
 * aspecto de haber sido comprobado. Por eso **toda guía nace `no_verificada`** y
 * no hay ningún camino en el módulo para que una cita de texto salga `vigente`.
 *
 * Lo que sí aporta hoy: que el hueco **se vea**. El médico lee «el sistema NO
 * verifica si esa edición sigue vigente» en vez de una referencia muda.
 *
 * ── LO QUE CASI SALE MAL, Y POR QUÉ ESTÁ ESCRITO AQUÍ ───────────────────────
 *
 * El primer lector de citas usaba un `RegExp` construido con plantilla y se
 * escapó de más: **no reconocía ni una sola de las citas reales del árbol**.
 * Habría pasado por un módulo «conectado» que nunca dispara — la forma más
 * silenciosa de que una compuerta no proteja. Por eso el primer caso de este
 * golden ejercita el lector contra las cadenas **que de verdad están en el
 * registro**, y no contra ejemplos inventados para la prueba.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No dice qué guía está vigente**, y no lo dirá hasta que un médico lo
 *   verifique guía por guía, con fuente y fecha. Es la razón de que
 *   `WS-07.guias` siga PARTIAL.
 * · **No reestructura los 112 campos `referencia`.** Muchos son prosa —el
 *   fundamento entero de un algoritmo— y convertirlos en citas fabricaría guías
 *   que nadie citó. El lector es estricto a propósito.
 * · **La tabla de discrepancias está VACÍA.** El modelo existe; qué hacer cuando
 *   ESC y ACC/AHA discrepan es criterio clínico y fijarlo aquí sería fijar
 *   política clínica, que está prohibido sin autorización del dueño.
 * · **No prueba la pantalla.** Que el médico VEA el aviso depende del render;
 *   aquí se comprueba que la página lo pide y que sólo aparece donde toca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  leerCitaDeGuia, guiaDesdeCita, vigenciaRespaldada, avisoDeVigencia,
  ORGANIZACIONES, DISCREPANCIAS, GUIAS_VERIFICADAS,
  POR_QUE_NINGUNA_ESTA_VIGENTE, POR_QUE_LA_CADENA_NO_BASTA, LO_QUE_FALTA_PARA_CERRARLO,
  type Guia,
} from '@/lib/clinical/guias'
import { CLINICAL_ENGINE_REGISTRY } from '@/lib/clinical/registry'

/** Cadenas tal cual están hoy en `clinical/registry.ts` y en `inmuno/`. */
const CITAS_REALES = [
  'KDIGO AKI 2012 + dosis de efluente mL/kg/h',
  'Lip GYH et al. Chest 2010 · ESC 2024',
  'AST IDCOP 2019; KDIGO 2020',
  'KDIGO 2020 (mención); etiqueta del fármaco',
  'Etiquetado adulto estándar + IDSA 2026 AMR',
]

describe('el lector reconoce las citas QUE DE VERDAD ESTÁN en el árbol', () => {
  it('las reconoce todas — y este caso existe porque la primera versión no reconocía ninguna', () => {
    /**
     * El lector anterior construía su expresión con plantilla y se escapó de
     * más: devolvía `reconocida: false` para todo. Un módulo conectado que
     * nunca dispara es la forma más silenciosa de que una compuerta no proteja,
     * así que esto se prueba contra cadenas copiadas del registro, no contra
     * ejemplos escritos para que pasen.
     */
    for (const cita of CITAS_REALES) {
      const l = leerCitaDeGuia(cita)
      expect(l.reconocida, `no reconoció: ${cita}`).toBe(true)
    }
  })

  it('y saca la organización y el año, sin adivinar', () => {
    const l = leerCitaDeGuia('AST IDCOP 2019; KDIGO 2020')
    expect(l.reconocida).toBe(true)
    if (!l.reconocida) return
    expect(ORGANIZACIONES).toContain(l.organizacion)
    expect(l.version).toMatch(/^(19|20)\d{2}$/)
  })

  it('el registro de motores tiene citas que el lector encuentra', () => {
    /* Si mañana nadie cita una guía, este caso avisa de que el lector dejó de
       tener trabajo — que puede ser correcto, pero hay que mirarlo. */
    const conCita = CLINICAL_ENGINE_REGISTRY.filter(m => leerCitaDeGuia(m.referencia).reconocida)
    expect(conCita.length, 'ningún motor cita una guía reconocible').toBeGreaterThan(0)
  })
})

describe('lo que NO es una cita no se convierte en una', () => {
  it('un estadio no es una edición', () => {
    /* «estadio KDIGO G1–G5» nombra la organización y no cita ninguna guía. */
    expect(leerCitaDeGuia('estadio KDIGO G1–G5').reconocida).toBe(false)
  })

  it('un artículo tampoco', () => {
    expect(leerCitaDeGuia('Wells PS et al. Lancet 1997').reconocida).toBe(false)
    expect(leerCitaDeGuia('Teasdale G, Jennett B. Lancet 1974').reconocida).toBe(false)
  })

  it('ni un párrafo que la menciona de paso', () => {
    /**
     * El año tiene que estar CERCA de la organización. Un fundamento de dos
     * líneas que nombra IDSA al principio y una fecha al final no es una cita, y
     * tratarlo como tal fabricaría una guía que nadie citó.
     */
    const prosa = 'consenso ACCP/BSAC/ESCMID/IDSA/SCCM/SIDP sobre infusiones prolongadas, '
      + 'simulaciones de PTA en ARC y datos PIRRT recogidos a lo largo de 2026'
    expect(leerCitaDeGuia(prosa).reconocida).toBe(false)
  })

  it('y el texto vacío se dice, no se rompe', () => {
    expect(leerCitaDeGuia('').reconocida).toBe(false)
    expect(leerCitaDeGuia(undefined).reconocida).toBe(false)
    expect(leerCitaDeGuia(null).reconocida).toBe(false)
  })
})

describe('ninguna guía nace vigente, y ése es el punto', () => {
  it('una cita de texto SIEMPRE sale sin verificar', () => {
    /**
     * No hay camino en el módulo para que salga `vigente`. Si alguna vez lo
     * hubiera, el sistema estaría afirmando un hecho clínico que nadie comprobó.
     */
    for (const cita of CITAS_REALES) {
      const g = guiaDesdeCita(cita)
      expect(g?.vigencia, cita).toBe('no_verificada')
    }
  })

  it('`vigente` y `superada` exigen fuente y fecha', () => {
    const sinRespaldo: Guia = { organizacion: 'KDIGO', version: '2020', vigencia: 'vigente' }
    expect(vigenciaRespaldada(sinRespaldo), 'una vigencia sin fuente es una afirmación clínica sin respaldo').toBe(false)

    const conRespaldo: Guia = {
      organizacion: 'KDIGO', version: '2020', vigencia: 'superada',
      fuente: 'Comprobado por el Dr. contra el sitio de KDIGO', verificadoEn: '2026-08-30',
      superadaPor: 'KDIGO 2024',
    }
    expect(vigenciaRespaldada(conRespaldo)).toBe(true)
  })

  it('y `no_verificada` siempre está respaldada, porque no afirma nada', () => {
    expect(vigenciaRespaldada({ organizacion: 'ESC', version: '2024', vigencia: 'no_verificada' })).toBe(true)
  })

  it('la tabla de discrepancias está VACÍA a propósito', () => {
    /**
     * El modelo existe; el contenido no. Qué hacer cuando dos guías válidas
     * discrepan es criterio clínico, y escribirlo aquí sería fijar política
     * clínica — que está en la lista de prohibiciones del repositorio.
     */
    expect(DISCREPANCIAS).toEqual([])
    expect(POR_QUE_NINGUNA_ESTA_VIGENTE).toMatch(/HECHOS CLÍNICOS/)
    expect(LO_QUE_FALTA_PARA_CERRARLO).toMatch(/verifique/)
  })
})

describe('el médico se entera de que la vigencia no está comprobada', () => {
  it('el aviso dice la edición y qué hacer con ella', () => {
    const a = avisoDeVigencia('KDIGO 2020 (mención); etiqueta del fármaco')
    expect(a).toContain('KDIGO 2020')
    expect(a).toMatch(/NO verifica si esa edición sigue vigente/)
    expect(a).toMatch(/compruébalo/i)
  })

  it('y NO aparece donde no hay cita', () => {
    /* Sobre los campos de prosa larga lo llenaría todo de ruido, y un aviso que
       se ignora no protege a nadie. */
    expect(avisoDeVigencia('estadio KDIGO G1–G5')).toBeNull()
    expect(avisoDeVigencia('Wells PS et al. Lancet 1997')).toBeNull()
  })

  it('la pantalla de motores lo pide, que es donde el médico lo lee', () => {
    const PAGINA = readFileSync('src/app/(dashboard)/cumplimiento/motores/page.tsx', 'utf8')
    expect(PAGINA).toContain("import { avisoDeVigencia } from '@/lib/clinical/guias'")
    expect(PAGINA).toMatch(/avisoDeVigencia\(m\.referencia\)/)
  })

  it('si alguien la verificó, se dice LO VERIFICADO — con su fuente y su fecha', () => {
    /* El camino que existe para el día que el dueño lo compruebe. Hoy la tabla
       está vacía, así que se ejercita pasándole una comprobación. */
    const verificadas = [{
      organizacion: 'KDIGO', version: '2020', vigencia: 'superada' as const,
      superadaPor: 'KDIGO 2024', fuente: 'Comprobado contra el sitio de KDIGO',
      verificadoEn: '2026-08-30',
    }]
    const a = avisoDeVigencia('KDIGO 2020 (mención)', verificadas)
    expect(a).toMatch(/SUPERADA por KDIGO 2024/)
    expect(a).toContain('2026-08-30')
  })

  it('pero una vigencia SIN respaldo no gana al aviso', () => {
    /**
     * El caso que impide el atajo por la puerta de atrás: escribir
     * `vigencia: 'vigente'` en la tabla, sin fuente ni fecha, sería la misma
     * afirmación sin comprobar que este módulo existe para impedir — sólo que
     * con forma de dato.
     */
    const sinRespaldo = [{ organizacion: 'KDIGO', version: '2020', vigencia: 'vigente' as const }]
    expect(avisoDeVigencia('KDIGO 2020', sinRespaldo)).toMatch(/NO verifica/)
  })

  it('y hoy la tabla de verificadas está vacía, que es la verdad', () => {
    expect(GUIAS_VERIFICADAS).toEqual([])
  })

  it('la razón está escrita donde se pueda leer', () => {
    expect(POR_QUE_LA_CADENA_NO_BASTA).toMatch(/no puede decir si esa edición sigue vigente/)
  })
})
