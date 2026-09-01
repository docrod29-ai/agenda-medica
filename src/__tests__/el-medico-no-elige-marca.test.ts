/**
 * EL MÉDICO NO ELIGE MARCA — guardián del contrato de ruteo (#345, PR #357).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `src/lib/planes-ia.ts` exportaba, como campo del TIPO `Motor`, la cadena
 * `modelos`: 'Haiku 4.5' · 'Sonnet 5 + separación de voces' ·
 * 'Opus 4.8 + GPT-5 + 2ª opinión'. Tres pantallas la pintaban —/precios, la
 * tabla de niveles y el selector de la consulta—, así que el médico elegía el
 * cómputo de su nota por nombre de proveedor.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de producto del Board #296 contra su propia regla: «el médico no
 * elige modelos ni niveles. Router automático usa el modelo mínimo suficiente
 * para cada tarea y escala sólo cuando complejidad/riesgo lo exige».
 *
 * ── LA CAUSA RAÍZ NO ERA EL COPY ─────────────────────────────────────────────
 *
 * Era el CAMPO. Mientras `Motor.modelos` existiera, limpiar el texto de una
 * pantalla no arreglaba nada: la siguiente pantalla que leyera `Motor` volvía a
 * traer la marca, y con razón —el tipo se la ofrecía—. Por eso el arreglo quita
 * el campo del dominio, y por eso este guardián comprueba el TIPO y no sólo las
 * cadenas. Un guardián que sólo mirara el copy habría dado verde el día que
 * alguien añadiera un cuarto `<div>{m.modelos}</div>`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El médico expresa INTENCIÓN CLÍNICA (rutinario · complejo · caso difícil) y
 * latencia. El router traduce esa intención a cómputo por `perfil`, y el
 * proveedor/modelo real sobrevive ENTERO del lado interno
 * (`src/lib/ia/procedencia-motor.ts`) para procedencia, auditoría y costos.
 *
 * Por eso este archivo prueba las dos direcciones. Borrar la procedencia interna
 * también rompe estos casos: «quitar la marca» no puede degenerar en «perder de
 * qué modelo salió la nota que el médico firmó», que es materia medicolegal.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · La PROCEDENCIA mostrada al médico (el Consultor pinta «Razonado por …» y la
 *   consulta guarda `_modelo` en `provenanceIA`). Eso es deliberado y correcto:
 *   decir de dónde salió un texto ya escrito no es pedirle que elija cómputo.
 * · El aviso de configuración `ANTHROPIC_API_KEY` de la consulta: es un error de
 *   operación dirigido a quien configura el despliegue, no un control clínico.
 *   Se declara abajo en `EXCEPCIONES`; si su texto cambia, el guardián falla.
 * · Hospital/UCI (`COPILOT_UCI_POR_MOTOR`, `uci/page.tsx`): fuera del alcance de
 *   este slice por decisión del dueño. Su selector sigue vivo y sin auditar aquí;
 *   la exención está declarada abajo en `FUERA_DE_ALCANCE`, no escondida en el
 *   regex, y el propio guardián falla si esa región desaparece sin quitarla.
 * · Que el router ELIJA bien el modelo mínimo suficiente. Esto vigila el
 *   contrato, no la calidad del ruteo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MOTORES, motorPorClave, motorPorDefecto, type ClaveMotor } from '@/lib/planes-ia'
import { PROCEDENCIA_POR_MOTOR, procedenciaDe } from '@/lib/ia/procedencia-motor'

/** Marcas de proveedor/modelo que nunca deben ser contrato del médico. */
const MARCA = /haiku|sonnet|\bopus\b|gpt-?\s?\d|openai|anthropic|assemblyai|whisper/i

/** Superficies donde el médico ELIGE o COMPRA nivel de IA. */
const SUPERFICIES = [
  'src/lib/planes-ia.ts',
  'src/components/TablaNivelesIA.tsx',
  'src/app/precios/page.tsx',
]

/**
 * Único texto de marca tolerado, y por qué: no es un control clínico sino el
 * aviso de que falta configurar la llave en el despliegue. Nombrar al proveedor
 * ahí es lo que lo hace accionable para quien tiene que arreglarlo.
 */
const EXCEPCIONES = ['Falta configurar la API key de Claude en Vercel']

/**
 * REGIONES FUERA DEL ALCANCE DE ESTE SLICE, recortadas antes de escanear.
 *
 * `COPILOT_UCI_POR_MOTOR` lleva banderas de ejecución `anthropic`/`openai` que el
 * router de UCI consume para decidir cuántos modelos corren en paralelo. Son
 * configuración de ejecución, no texto de pantalla —la UCI sólo pinta `emoji`,
 * `nombre` y `creditos`—, pero nombran proveedores en el dominio y el dueño dejó
 * Hospital/UCI explícitamente fuera de este PR.
 *
 * Se recorta CON NOMBRE Y RAZÓN, no ablandando la expresión regular: el día que
 * se reactive Hospital/UCI, borrar esta entrada devuelve el guardián entero sobre
 * ese bloque. Una exención declarada se revisa; un regex indulgente no se ve.
 */
const FUERA_DE_ALCANCE: Record<string, RegExp[]> = {
  'src/lib/planes-ia.ts': [/export const COPILOT_UCI_POR_MOTOR[\s\S]*?\n}\n/],
}

const RAIZ = process.cwd()
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8')

/**
 * Copy VISIBLE: sin bloques /* *\/ y sin comentarios de línea (incluidos los
 * que van al final de una línea de código, que es donde vive la contabilidad
 * interna de costos del dueño — deliberadamente exenta).
 */
function copyVisible(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(?<!:)\/\/.*$/, ''))
    .join('\n')
}

const CLAVES: ClaveMotor[] = ['rapida', 'estandar', 'maxima']

describe('el médico elige intención clínica, nunca una marca (#345)', () => {
  it('el tipo Motor ya no expone un campo de modelos/proveedor', () => {
    const src = leer('src/lib/planes-ia.ts')
    // El campo del tipo: `modelos: string` dentro de `interface Motor`.
    const iface = src.slice(src.indexOf('export interface Motor'))
    expect(/^\s*modelos\s*:/m.test(iface.slice(0, iface.indexOf('}'))), 'el campo `modelos` volvió al tipo Motor').toBe(false)
    for (const k of CLAVES) {
      expect(Object.keys(MOTORES[k]), `MOTORES.${k} volvió a llevar modelos`).not.toContain('modelos')
    }
  })

  it('ningún valor de MOTORES contiene una marca de proveedor', () => {
    for (const k of CLAVES) {
      for (const [campo, valor] of Object.entries(MOTORES[k])) {
        const texto = Array.isArray(valor) ? valor.join(' · ') : String(valor)
        expect(MARCA.test(texto), `marca en MOTORES.${k}.${campo}: "${texto}"`).toBe(false)
      }
    }
  })

  it('las superficies donde el médico elige/compra IA no nombran proveedores', () => {
    for (const archivo of SUPERFICIES) {
      let t = copyVisible(leer(archivo))
      for (const r of FUERA_DE_ALCANCE[archivo] ?? []) {
        expect(r.test(t), `la región exenta de ${archivo} ya no existe: quita su entrada de FUERA_DE_ALCANCE`).toBe(true)
        t = t.replace(r, '')
      }
      for (const e of EXCEPCIONES) t = t.split(e).join('')
      const linea = t.split('\n').find(l => MARCA.test(l))
      expect(linea, `marca visible en ${archivo}: ${linea}`).toBeUndefined()
    }
  })

  it('el selector de la consulta no rehace un catálogo con marcas', () => {
    const src = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    const decl = src.slice(src.indexOf('const MOTORES_UI'))
    const bloque = decl.slice(0, decl.indexOf('\n\n'))
    expect(MARCA.test(bloque), `marca en el selector de nota: ${bloque}`).toBe(false)
    // Y deriva de la fuente única, en vez de escribir su propia tabla a mano.
    expect(bloque).toContain('MOTORES[k]')
  })

  it('lo que el médico sí elige es intención clínica', () => {
    expect(MOTORES.rapida.usoRecomendado).toMatch(/rutinaria|simple|seguimiento/i)
    expect(MOTORES.estandar.usoRecomendado).toMatch(/compleja/i)
    expect(MOTORES.maxima.usoRecomendado).toMatch(/difícil/i)
    for (const k of CLAVES) expect(MOTORES[k].capacidad.length).toBeGreaterThan(8)
  })
})

describe('la procedencia interna SOBREVIVE al arreglo', () => {
  it('cada nivel conserva proveedor, etiqueta de auditoría y perfil reales', () => {
    for (const k of CLAVES) {
      const p = PROCEDENCIA_POR_MOTOR[k]
      expect(p, `sin procedencia para ${k}`).toBeTruthy()
      expect(p.proveedores.length, `${k} se quedó sin proveedor declarado`).toBeGreaterThan(0)
      // La etiqueta interna SÍ debe nombrar el modelo: es el dato medicolegal.
      expect(MARCA.test(p.etiquetaAuditoria), `${k} perdió su etiqueta de auditoría`).toBe(true)
    }
  })

  it('la procedencia no se desincroniza del perfil que consume el router', () => {
    for (const k of CLAVES) expect(PROCEDENCIA_POR_MOTOR[k].perfil).toBe(MOTORES[k].perfil)
  })

  it('sólo el nivel máximo declara segunda opinión', () => {
    expect(PROCEDENCIA_POR_MOTOR.maxima.segundaOpinion).toBe(true)
    expect(PROCEDENCIA_POR_MOTOR.rapida.segundaOpinion).toBe(false)
    expect(PROCEDENCIA_POR_MOTOR.estandar.segundaOpinion).toBe(false)
  })

  it('la procedencia cae a estándar igual que motorPorClave (mismo contrato)', () => {
    expect(procedenciaDe('inventado')).toBe(PROCEDENCIA_POR_MOTOR.estandar)
    expect(procedenciaDe(undefined)).toBe(PROCEDENCIA_POR_MOTOR.estandar)
    expect(motorPorClave('inventado').clave).toBe('estandar')
  })

  /**
   * EL DATO TIENE QUE LLEGAR (`.claude/rules/el-dato-tiene-que-llegar.md`).
   *
   * Conservar la procedencia en un módulo que nadie lee no es conservarla: es
   * escribirla y perderla, con la prueba en verde. El guardián de módulos
   * huérfanos cazó exactamente eso en el primer intento de este arreglo, así
   * que aquí se comprueba el otro lado: que la etiqueta viaja hasta el panel
   * de superadmin y que hay quien la pinte.
   */
  it('la procedencia LLEGA al panel de costos de superadmin', () => {
    const ruta = leer('src/app/api/superadmin/simulador/route.ts')
    expect(ruta).toContain('procedencia-motor')
    // Sobre la RESPUESTA, no sobre el archivo: `procedencia-motor` aparece en el
    // import y en los comentarios, así que buscarlo en todo el texto pasaría
    // aunque el campo nunca saliera del servidor.
    const respuesta = ruta.split('\n').filter(l => l.includes('NextResponse.json({ ok: true')).join('\n')
    expect(respuesta, 'la respuesta de la ruta ya no lleva `procedencia`').toMatch(/[{,]\s*procedencia\s*[,}]/)
    const panel = leer('src/app/superadmin/simulador/page.tsx')
    expect(panel, 'el panel dejó de pintar la procedencia').toContain('d.procedencia')
  })

  it('ninguna pantalla del médico importa la procedencia interna', () => {
    const pantallas = [
      'src/components/TablaNivelesIA.tsx',
      'src/app/precios/page.tsx',
      'src/app/(dashboard)/consulta/[patientId]/page.tsx',
    ]
    for (const p of pantallas) {
      expect(leer(p).includes('procedencia-motor'), `${p} importa la procedencia interna`).toBe(false)
    }
  })
})

describe('el router y la contabilidad no cambian', () => {
  it('el perfil sigue siendo la metadata canónica del router', () => {
    expect(MOTORES.rapida.perfil).toBe('live')
    expect(MOTORES.estandar.perfil).toBe('pro')
    expect(MOTORES.maxima.perfil).toBe('premium')
  })

  it('el costo en créditos de cada nivel es el mismo que antes del arreglo', () => {
    expect(MOTORES.rapida.creditos).toBe(1)
    expect(MOTORES.estandar.creditos).toBe(3)
    expect(MOTORES.maxima.creditos).toBe(10)
  })

  it('el default por plan no se movió (Pro→Máxima, Clínica→Estándar)', () => {
    expect(motorPorDefecto('premium').clave).toBe('maxima')
    expect(motorPorDefecto('pro').clave).toBe('estandar')
  })
})
