/**
 * GUARDIÁN — la automatización ayuda, pero no firma.
 *
 * ── QUÉ VIGILA, Y POR QUÉ NO HABÍA NADA ─────────────────────────────────────
 *
 * La regla del programa dice qué puede hacer la automatización —borradores,
 * contexto, recordatorios, seguimiento, sugerencias, trámites— y qué **no puede
 * hacer nunca por su cuenta**:
 *
 *   diagnóstico confirmado · orden final · receta final · firma del médico
 *
 * Se auditó el árbol y **la regla se cumple hoy**: de las 21 rutas de `/api` que
 * corren sin sesión de médico —crons con `Bearer`, webhooks con HMAC, rutas
 * públicas con límite de tasa— ninguna escribe estado clínico autoritativo. La
 * única que toca `notas` es el portal del paciente, y lo hace con `.get()`.
 *
 * El defecto no era una violación: era que **nada impedía la primera**. Un cron
 * al que mañana se le añade «y de paso marca la nota como firmada» no rompería
 * ninguna prueba. Esta familia de defectos —«el charter existía sin encarnar»—
 * es la que este archivo cierra.
 *
 * ── EL INVARIANTE MÁS FUERTE, Y POR QUÉ ES ÉSE ──────────────────────────────
 *
 * **Ninguna ruta del servidor pone una nota en `firmada`.** Ninguna, ni siquiera
 * con sesión de médico.
 *
 * Firmar ocurre desde el cliente, y `firestore.rules` exige allí que el autor
 * declarado sea quien firma: «nadie firma con la cédula de otro». Pero las rutas
 * de `/api` usan el **SDK admin, que ignora las reglas**. Una ruta que escribiera
 * `estado: 'firmada'` saltaría esa regla entera sin que nada lo notara — es
 * exactamente el modo de fallo de REG-160, donde el importador escribía por un
 * camino que no pasaba por la validación.
 *
 * Por eso el guardián no se limita a los caminos automáticos: la firma es un acto
 * personal y el servidor no la ejecuta **nunca**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Es estático.** Lee el árbol, no ejecuta las rutas. Una escritura armada en
 *   tiempo de ejecución a partir de cadenas se le escapa; lo que caza es la forma
 *   en que este defecto se escribe de verdad.
 * · **No cubre lo que el modelo REDACTA.** Que la IA no invente una firma en el
 *   texto es otro problema, y vive en WS-12.
 * · **No sustituye a las reglas.** Las reglas protegen al cliente; esto protege
 *   el camino que las reglas no ven.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'

/** Guardias que implican una PERSONA con sesión de médico o dueño detrás. */
const CON_MEDICO = [
  'verificarMiembro', 'verificarMedico', 'verificarCapacidad',
  'verificarModuloIA', 'verificarModuloYCapacidad', 'verificarSuperadmin',
  'verificarUsuario', 'exigeCapacidad',
]

/**
 * Las marcas de estado clínico AUTORITATIVO. No es «datos clínicos»: es el acto
 * que sólo un médico puede hacer.
 */
const MARCAS_AUTORITATIVAS: readonly { patron: RegExp; que: string }[] = [
  { patron: /estado:\s*'firmada'/, que: 'poner una nota en firmada' },
  { patron: /tipoOrigen:\s*'medico'/, que: 'declarar que el médico eligió el tipo del diagnóstico (REG-372)' },
  { patron: /firma:\s*\{/, que: 'escribir el bloque de firma de la nota' },
]

const rutas = execSync('find src/app/api -name route.ts', { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)

const fuente = (r: string) => limpiarComentarios(readFileSync(r, 'utf8'))

/** ¿Detrás de esta ruta hay una persona con sesión clínica? */
function tieneMedico(src: string): boolean {
  return CON_MEDICO.some(g => src.includes(`${g}(`))
}

/**
 * ¿Escribe sobre la subcolección de notas?
 *
 * Se mira una ventana después de cada `collection('notas')` porque las cadenas
 * del SDK admin se parten en varias líneas. Leer (`.get()`) es legítimo —el
 * portal del paciente lo hace— y escribir no.
 */
function escribeNotas(src: string): boolean {
  for (const m of src.matchAll(/collection\('notas'\)/g)) {
    const ventana = src.slice(m.index ?? 0, (m.index ?? 0) + 400)
    if (/\.(set|update|add|delete)\(/.test(ventana)) return true
  }
  return false
}

function marcasEn(src: string): string[] {
  return MARCAS_AUTORITATIVAS.filter(m => m.patron.test(src)).map(m => m.que)
}

describe('ninguna ruta sin médico detrás escribe estado clínico autoritativo', () => {
  const automaticas = rutas.filter(r => !tieneMedico(fuente(r)))

  it('el lector encuentra rutas automáticas de verdad (si no, pasaría vacío)', () => {
    /* El modo de fallo de este guardián es no clasificar ninguna ruta como
       automática y declarar victoria sobre el conjunto vacío. */
    expect(automaticas.length).toBeGreaterThanOrEqual(10)
    expect(automaticas.some(r => r.includes('cron/'))).toBe(true)
    expect(automaticas.some(r => r.includes('whatsapp/webhook'))).toBe(true)
  })

  it('ninguna escribe en la subcolección de notas', () => {
    const culpables = automaticas.filter(r => escribeNotas(fuente(r)))
    expect(
      culpables,
      'una ruta sin médico detrás escribe notas clínicas: documentar es acto del médico',
    ).toEqual([])
  })

  it('ninguna pone una marca autoritativa', () => {
    const culpables = automaticas
      .map(r => ({ r, marcas: marcasEn(fuente(r)) }))
      .filter(x => x.marcas.length > 0)
      .map(x => `${x.r}: ${x.marcas.join(', ')}`)
    expect(culpables).toEqual([])
  })
})

describe('la firma no la ejecuta el servidor — ninguna ruta, nunca', () => {
  it('ni una sola ruta de /api pone `estado: firmada`', () => {
    /**
     * Las rutas usan el SDK admin, que **ignora `firestore.rules`**. La regla que
     * exige que el autor declarado sea quien firma vive allí, así que una ruta
     * que escribiera esto se la saltaría entera sin que nada lo notara.
     */
    const culpables = rutas.filter(r => /estado:\s*'firmada'/.test(fuente(r)))
    expect(
      culpables,
      'firmar es un acto personal del médico; el servidor no lo ejecuta',
    ).toEqual([])
  })

  it('leer notas firmadas SÍ es legítimo, y se sigue haciendo', () => {
    /**
     * Sin este caso el anterior podría pasar porque nadie toca las notas en
     * absoluto — y entonces no estaría protegiendo nada. Se comprueba que el
     * producto sigue **filtrando** por nota firmada, que es lo que distingue
     * «no se escribe» de «no se usa».
     */
    const lectores = rutas.filter(r => /where\('estado',\s*'==',\s*'firmada'\)/.test(fuente(r)))
    expect(lectores.length, 'nadie filtra ya por nota firmada: el caso anterior dejó de significar algo').toBeGreaterThan(0)
  })
})

describe('el detector detecta (probado al revés, sin tocar el árbol)', () => {
  /**
   * Un guardián estático se rompe en silencio: basta con que la expresión deje de
   * casar. Se le pasan fuentes sintéticas con el defecto dentro y se comprueba
   * que las caza — así el rojo del caso real significa algo.
   */
  it('caza una nota firmada desde el servidor', () => {
    expect(marcasEn("await ref.set({ estado: 'firmada' })")).toContain('poner una nota en firmada')
  })

  it('caza la autoridad del médico falsificada', () => {
    expect(marcasEn("dx.push({ descripcion: x, tipoOrigen: 'medico' })"))
      .toContain('declarar que el médico eligió el tipo del diagnóstico (REG-372)')
  })

  it('caza una escritura sobre notas aunque la cadena vaya en varias líneas', () => {
    const src = `
      await adminDb.collection('clinics').doc(c)
        .collection('patients').doc(p)
        .collection('notas').doc(n)
        .update({ algo: 1 })
    `
    expect(escribeNotas(src)).toBe(true)
  })

  it('y NO confunde una lectura con una escritura', () => {
    const src = `const s = await adminDb.collection('notas').where('estado','==','firmada').get()`
    expect(escribeNotas(src)).toBe(false)
  })

  it('la clasificación de «sin médico» distingue de verdad', () => {
    expect(tieneMedico("const a = await verificarMedico(req, clinicId)")).toBe(true)
    expect(tieneMedico("const t = verificarTokenPaciente(body.token)")).toBe(false)
  })
})
