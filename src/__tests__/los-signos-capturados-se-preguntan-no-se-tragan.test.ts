/**
 * LO QUE SE TECLEA EN SIGNOS VITALES: NI SE TRAGA NI SE DA POR BUENO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * · ASN-005 — el campo de peso descartaba en SILENCIO todo lo que no fuera
 *   cifra: «154 lb» quedaba «154», la unidad sólo existía como marcador de
 *   posición (que desaparece al primer dígito) y ese número entraba como kilos
 *   a la verificación mg/kg de la consulta y de la receta.
 * · ASN-002 — la única validación era sintáctica (`/^\d*\.?\d*$/`), así que
 *   TA 400/300, T 45 °C y SpO₂ 9 % se aceptaban, se guardaban y el copiloto los
 *   trataba como hipotensión e hipoxemia reales: «Todo a la nota» escribía
 *   «TA 40/300 mmHg» en el expediente. Nadie preguntaba «¿lo capturaste bien?».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, auditor AS-enfermería (ASN-002 y ASN-005). El equipo
 * rojo ejecutó el `onChange` real tecla a tecla con jiti: «154 lb» → «154»,
 * «1.70» → «1.70» (metros guardados como centímetros). Y comprobó que no hay
 * cota de plausibilidad en NINGUNA capa del camino: ni el `onChange`, ni
 * `signosNum`, ni el copiloto, ni el tipo.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La captura no tenía voz: podía rechazar una tecla, pero no decir por qué, y
 * no tenía con qué comparar el número. El patrón sí existía en el repositorio
 * —los topes fisiológicos de la voz de UCI (REG-031/REG-036) y las bandas de
 * `parser-clinico`— y nunca se había llevado a Practice.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * clinical-safety §3 (nada cambia en silencio: lo descartado se dice), §5
 * (señalar de menos, nunca de más: lo que no tiene banda se declara NO
 * vigilado) y §6 (ante la duda se pregunta, no se adivina: esto avisa, no
 * corrige ni bloquea). Ninguna cifra se inventa: cada banda cita el sitio del
 * repositorio de donde se copió.
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * UNITARIA sobre el módulo puro que la pantalla usa
 * (`consulta/[patientId]/signos-que-se-capturan.ts`), más un caso al revés: con
 * valores normales no puede haber ni un aviso (una compuerta que señala siempre
 * deja de significar algo y se ignora en dos días).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No cubre el DOM: que el selector de unidad se pinte y que el aviso se vea lo
 * mide `el-peso-de-signos-pasa-por-la-guarda-de-unidad.test.ts` por contrato de
 * texto, y sólo la pantalla en vivo lo demuestra del todo. No cubre la
 * frecuencia cardiaca: no hay banda con procedencia y por eso NO se vigila
 * (NEEDS_CLINICAL_REVIEW, el rango por edad lo fija el dueño; la pregunta ya
 * está abierta en `registry.ts:1293`). No juzga si un valor dentro de banda es
 * clínicamente correcto: para eso está el médico.
 */
import { describe, it, expect } from 'vitest'
import {
  avisosDeCaptura, avisosDeTensionArterial, fueraDeLoPosible, leerCifraTecleada,
  pareceLibras, pareceKilos, tallaPareceEnMetros,
  RANGOS_PLAUSIBLES, SIN_RANGO_DECLARADO, POR_QUE_LA_FC_NO_SE_VIGILA,
} from '../app/(dashboard)/consulta/[patientId]/signos-que-se-capturan'

describe('lo que se descartó al teclear se dice (ASN-005)', () => {
  it('«154 lb» conserva el 154 y declara que se ignoró «lb»', () => {
    const r = leerCifraTecleada('154 lb')
    expect(r.valor).toBe('154')
    expect(r.descartado).toBe('lb')
    expect(pareceLibras(r.descartado)).toBe(true)
  })

  it('«70,5» sigue normalizándose a punto y sin descartar nada (no se rompe lo que ya funcionaba)', () => {
    expect(leerCifraTecleada('70,5')).toEqual({ valor: '70.5', descartado: '' })
  })

  it('«36.» a medio teclear sigue siendo válido: el punto no se pierde (REG del decimal)', () => {
    expect(leerCifraTecleada('36.').valor).toBe('36.')
  })

  it('«kg» tecleado a mano se reconoce como unidad, no como basura', () => {
    expect(pareceKilos(leerCifraTecleada('70 kg').descartado)).toBe(true)
  })

  it('una tecla sin nada numérico no entra, pero dice qué se ignoró', () => {
    const r = leerCifraTecleada('abc')
    expect(r.valor).toBeNull()
    expect(r.descartado).toBe('abc')
  })
})

describe('lo imposible se pregunta, no se corrige ni se bloquea (ASN-002)', () => {
  it('TA 400/300: las dos cifras salen señaladas', () => {
    const avisos = avisosDeTensionArterial('400/300')
    expect(avisos).toHaveLength(2)
    expect(avisos[0]).toMatch(/Sistólica/)
    expect(avisos[1]).toMatch(/Diastólica/)
  })

  it('TA 120/80 no dice nada (probada al revés: una compuerta que señala siempre no señala)', () => {
    expect(avisosDeTensionArterial('120/80')).toEqual([])
  })

  it('una sistólica menor que la diastólica se pregunta aunque las dos sean posibles', () => {
    expect(avisosDeTensionArterial('80/120').join(' ')).toMatch(/no puede ser menor/)
  })

  it('SpO₂ 9 %, T 45 °C y FR 300 caen fuera de lo posible', () => {
    expect(fueraDeLoPosible('spo2', 9)).toMatch(/fuera de lo habitual/)
    expect(fueraDeLoPosible('temperatura', 45)).toMatch(/fuera de lo habitual/)
    expect(fueraDeLoPosible('fr', 300)).toMatch(/fuera de lo habitual/)
  })

  it('los valores de una consulta normal no producen ni un aviso', () => {
    expect(avisosDeCaptura({ ta: '118/76', fc: '72', fr: '16', temperatura: '36.7', spo2: '97', peso: '68', talla: '170' }))
      .toEqual([])
  })

  it('el lactante de 9 kg NO se señala: la banda de peso es la del consultorio, no la de UCI', () => {
    expect(fueraDeLoPosible('peso', 9)).toBeNull()
    expect(RANGOS_PLAUSIBLES.peso[0]).toBeLessThan(1)
  })

  it('talla 1.70 pregunta si eran metros, en vez de guardarla como 1.7 cm', () => {
    expect(tallaPareceEnMetros(1.7)).toBe(true)
    const avisos = avisosDeCaptura({ talla: '1.70' })
    expect(avisos.some(a => a.sugiereMetros && /metros/.test(a.texto))).toBe(true)
  })

  it('el aviso NO cambia el valor: sólo lo repite tal como se tecleó', () => {
    const [a] = avisosDeCaptura({ spo2: '9' })
    expect(a.valor).toBe('9')
    expect(a.texto).toContain('se guarda tal como lo tecleaste')
  })
})

describe('lo que NO se vigila se declara (clinical-safety §5)', () => {
  it('la frecuencia cardiaca no tiene banda y se dice con todas las letras', () => {
    expect(SIN_RANGO_DECLARADO).toContain('fc')
    expect(RANGOS_PLAUSIBLES.fc).toBeUndefined()
    expect(fueraDeLoPosible('fc', 300)).toBeNull()
    expect(POR_QUE_LA_FC_NO_SE_VIGILA).toMatch(/NEEDS_CLINICAL_REVIEW/)
  })

  it('cada banda dice de dónde se copió: ninguna cifra nace aquí', () => {
    for (const [campo, r] of Object.entries(RANGOS_PLAUSIBLES)) {
      expect(r[2], `la banda de ${campo} no cita su origen`).toMatch(/src\//)
    }
  })
})
