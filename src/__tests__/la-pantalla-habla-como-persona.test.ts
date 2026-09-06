/**
 * LA PANTALLA HABLA COMO PERSONA, NO COMO MÁQUINA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Cuatro familias del mismo defecto, encontradas por auditores distintos del
 * Panel de Lujo (6-sep-2026) y confirmadas una a una por el equipo rojo:
 *
 *   C-020  45 avisos que empiezan por «Error…», y uno que dice sólo «Error».
 *          El equipo rojo contó: el auditor había dicho 28 y se quedó corto.
 *   C-021  14 avisos interpolan `e.message` o `String(e)`, así que al médico le
 *          llega «Missing or insufficient permissions», que es inglés y no dice
 *          qué hacer.
 *   C-022  login y registro imprimen el código `auth/…` de Firebase.
 *   ZC-021 el aviso de configuración remata con «Detalle técnico:
 *          permission-denied».
 *   ZC-024 en la DEMO PÚBLICA, cuando PubMed falla, al visitante se le enseña
 *          `String(e)` — «TypeError: Failed to fetch».
 *   ZC-011 «3 resultado(s)», y en otras pantallas «1 cobros».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Lente 2 del Panel de Lujo («¿el texto habla como persona?»), auditores
 * `C-programador`, `D-diseno` y la oleada de cierre `Z-cierre-componentes`.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * No había ningún sitio donde estuviera escrito CÓMO se le dice a alguien que
 * algo no se pudo hacer. Sin ese sitio, cada `catch` inventa su frase, y la
 * frase barata es interpolar el error. Lo mismo con el plural: la forma correcta
 * («1 episodio» / «2 episodios») ya existía copiada a mano en un componente, así
 * que cada pantalla nueva volvía a elegir entre las tres formas.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `src/lib/texto-es.ts` es el único sitio donde se decide cómo suena el
 * producto en español de México. La fórmula del aviso es «qué NO pasó · qué
 * hacer», y nunca empieza por «Error». El detalle técnico no se borra: deja de
 * ser el mensaje y pasa a ser lo que se registra.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · El trinquete de abajo NO exige cero avisos «Error…»: exige que no suban.
 *   Los que quedan viven en archivos de OTRAS rebanadas de la reparación
 *   (consulta, citas, pacientes, expediente, lista de espera, reseñas,
 *   cumplimiento, asistente) y tocarlos desde aquí produciría conflictos de
 *   fusión más caros que el defecto. Están en `handoff-UI-CONFIG.md`.
 * · No comprueba la ORTOGRAFÍA ni el tono de cada frase, sólo su forma.
 * · `enEspanolLlano` no adivina: un código que no conoce cae en la frase
 *   genérica. Esta prueba fija eso como conducta deseada, no como carencia.
 * · No mira las pantallas del paciente (`/mi`), que son de otra rebanada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  plural, enEspanolLlano, noSePudo, codigoDeError, FRASE_GENERICA, FRASE_SIN_RED,
} from '@/lib/texto-es'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('plural — «1 cobro», no «1 cobros» ni «1 cobro(s)»', () => {
  it('el singular no lleva la ese', () => {
    expect(plural(1, 'cobro', 'cobros')).toBe('1 cobro')
    expect(plural(1, 'resultado', 'resultados')).toBe('1 resultado')
    expect(plural(1, 'episodio', 'episodios')).toBe('1 episodio')
  })

  it('el cero y el plural sí la llevan', () => {
    /* En español el cero va en plural: «0 cobros», no «0 cobro». */
    expect(plural(0, 'cobro', 'cobros')).toBe('0 cobros')
    expect(plural(2, 'cobro', 'cobros')).toBe('2 cobros')
    expect(plural(11, 'episodio', 'episodios')).toBe('11 episodios')
  })

  it('nunca produce el paréntesis del programador', () => {
    for (const n of [0, 1, 2, 7]) {
      expect(plural(n, 'resultado', 'resultados')).not.toContain('(s)')
    }
  })
})

describe('enEspanolLlano — de código de máquina a frase de persona', () => {
  it('traduce el código de Firestore que más se ve', () => {
    const dicho = enEspanolLlano({ code: 'permission-denied' })
    expect(dicho).toMatch(/no tiene permiso/i)
    /* Y dice QUÉ HACER, que es lo que faltaba. */
    expect(dicho).toMatch(/vuelve a entrar/i)
    expect(dicho).not.toContain('permission-denied')
  })

  it('traduce el mensaje inglés del SDK aunque no venga el código', () => {
    const dicho = enEspanolLlano(new Error('Missing or insufficient permissions.'))
    expect(dicho).toMatch(/no tiene permiso/i)
    expect(dicho).not.toMatch(/insufficient/i)
  })

  it('el fallo de red del navegador no llega como «TypeError» (ZC-024)', () => {
    const dicho = enEspanolLlano(new TypeError('Failed to fetch'))
    expect(dicho).toBe(FRASE_SIN_RED)
    expect(dicho).not.toMatch(/TypeError|fetch/i)
  })

  it('el código de Google no llega a la pantalla (C-022)', () => {
    for (const code of [
      'auth/popup-closed-by-user',
      'auth/network-request-failed',
      'auth/account-exists-with-different-credential',
    ]) {
      const dicho = enEspanolLlano({ code })
      expect(dicho, code).not.toContain('auth/')
      expect(dicho, code).not.toBe(FRASE_GENERICA)
    }
  })

  it('también lo pesca cuando viene metido en el mensaje', () => {
    /* Firebase v9 formatea así: «Firebase: Error (auth/too-many-requests).» */
    const dicho = enEspanolLlano(new Error('Firebase: Error (auth/too-many-requests).'))
    expect(dicho).toMatch(/demasiados intentos/i)
  })

  it('lo que no conoce cae en una frase que TAMBIÉN dice qué hacer', () => {
    /* No adivinar es la conducta correcta; quedarse mudo no lo es. */
    const dicho = enEspanolLlano(new Error('algo rarísimo que nadie mapeó'))
    expect(dicho).toBe(FRASE_GENERICA)
    expect(dicho).toMatch(/vuelve a intentarlo/i)
  })

  it('ninguna frase empieza por «Error» (C-020)', () => {
    const casos: unknown[] = [
      { code: 'permission-denied' }, { code: 'unavailable' }, { code: 'auth/invalid-email' },
      new TypeError('Failed to fetch'), new Error('desconocido'), 'unauthenticated', undefined,
    ]
    for (const c of casos) expect(enEspanolLlano(c)).not.toMatch(/^Error/)
  })

  it('el código sigue disponible para el reporte, aunque no se pinte', () => {
    /* El detalle técnico no se borra: deja de ser el MENSAJE. */
    expect(codigoDeError({ code: 'permission-denied' })).toBe('permission-denied')
    expect(codigoDeError(new Error('sin código'))).toBe('')
  })
})

describe('noSePudo — «qué NO pasó · qué hacer»', () => {
  it('nombra la acción concreta que falló', () => {
    const dicho = noSePudo('guardar los horarios', { code: 'unavailable' })
    expect(dicho).toContain('No se pudo guardar los horarios.')
    expect(dicho).toMatch(/revisa tu internet/i)
  })

  it('sin error sigue diciendo algo útil, no «Error»', () => {
    const dicho = noSePudo('desconectar WhatsApp')
    expect(dicho).not.toMatch(/^Error/)
    expect(dicho).toContain(FRASE_GENERICA)
  })
})

/* ════════════════════════════════════════════════════════════════════════ */

/**
 * EL TRINQUETE: los avisos «Error…» sólo pueden bajar.
 *
 * Se prueba AL REVÉS de la única forma que tiene sentido para un trinquete: si
 * alguien añade uno nuevo, el número sube por encima del techo y esto se pone
 * rojo. El techo se baja cuando cada rebanada repare los suyos; nunca se sube.
 */
const RAIZ = join(process.cwd(), 'src')

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) {
      if (nombre === '__tests__') continue
      fuentes(ruta, acc)
    } else if (/\.tsx?$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

/**
 * Techo medido el 6-sep-2026, después de reparar los 20 de la rebanada
 * UI-CONFIG (configuración, farmacia y el panel de laboratorios). Los que
 * quedan son de otras rebanadas y están declarados en el handoff.
 */
const TECHO_AVISOS_ERROR = 25

describe('trinquete de avisos que empiezan por «Error»', () => {
  const ofensores = fuentes(RAIZ)
    .map(f => ({ f, n: (readFileSync(f, 'utf8').match(/toast\((?:'|`)Error/g) ?? []).length }))
    .filter(x => x.n > 0)
  const total = ofensores.reduce((s, x) => s + x.n, 0)

  it(`no sube de ${TECHO_AVISOS_ERROR}`, () => {
    expect(
      total,
      `avisos «Error…» por archivo:\n${ofensores.map(x => `  ${x.n}  ${x.f.replace(process.cwd() + '/', '')}`).join('\n')}`,
    ).toBeLessThanOrEqual(TECHO_AVISOS_ERROR)
  })

  it('ninguno queda ya en las pantallas de esta rebanada', () => {
    /* Configuración, farmacia y el panel de laboratorios: los 20 que sí se
       podían tocar sin pisar el trabajo de otro agente. */
    const mios = ofensores.filter(x =>
      /\/configuracion\/|\/farmacia\/|laboratorio\/PanelLaboratorios/.test(x.f))
    expect(mios.map(x => x.f.replace(process.cwd() + '/', ''))).toEqual([])
  })
})

describe('el error crudo no llega a la pantalla en las piezas reparadas', () => {
  it('el aviso de configuración no imprime el código de Firebase (ZC-021)', () => {
    const src = leer('src/components/AvisoConfigNoCargada.tsx')
    expect(src).toMatch(/enEspanolLlano\(error\)/)
    expect(src).not.toMatch(/Detalle técnico: \{error\}/)
  })

  it('la evidencia en vivo de la demo pública no imprime String(e) (ZC-024)', () => {
    const src = leer('src/components/EvidenciaEnVivo.tsx')
    expect(src).not.toMatch(/setMsg\(String\(e\)/)
    expect(src).toMatch(/setMsg\(enEspanolLlano\(e\)\)/)
    /* Y el detalle sigue existiendo donde sirve: la consola. */
    expect(src).toMatch(/console\.warn\('\[evidencia-en-vivo\]/)
  })

  it('un motor que revienta no se pinta con la palomita del éxito (ZC-020)', () => {
    const src = leer('src/components/motores/QueDiceElMotor.tsx')
    /* La excepción ya no se guarda como si fuera la respuesta del motor. */
    expect(src).not.toMatch(/reventó = true; dice = String\(e\)/)
    expect(src).toMatch(/reventó\s*\n\s*\? <AlertTriangle/)
    /* Y el rótulo deja de afirmar que el motor está corriendo. */
    expect(src).toMatch(/el motor no pudo con esta entrada/)
    /* El detalle técnico existe, pero plegado. */
    expect(src).toMatch(/<summary[^>]*>Detalle técnico<\/summary>/)
  })
})
