/**
 * GUARDIÁN — el botón del backfill de `pesoUrgencia` **no escribe** si nadie lo
 * pide, y no acepta una credencial que su propio SDK no entiende.
 *
 * ── DE DÓNDE SALE ESTE BOTÓN ────────────────────────────────────────────────
 *
 * `scripts/migraciones/peso-de-urgencia.mjs` existe desde P1-14 y **nunca se ha
 * corrido**. No por olvido: pide `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un
 * JSON de cuenta de servicio, y esa credencial vive en los secretos de este
 * repositorio. Correrlo exigía tener a la vez terminal y una copia de la
 * credencial — un reparto que en la práctica no tiene nadie, y por eso el paso
 * llevaba meses pendiente mientras `tareasVivas` cargaba una segunda lectura
 * para compensarlo.
 *
 * El workflow no añade capacidad: mueve la que ya existía al sitio donde la
 * credencial está.
 *
 * ── QUÉ TIENE QUE SER IMPOSIBLE ─────────────────────────────────────────────
 *
 * Que apretar el botón escriba en datos clínicos vivos **sin que alguien lo haya
 * pedido en ese mismo formulario**. El script sólo AÑADE un campo derivado y es
 * idempotente, así que el daño de una escritura de más es pequeño — pero
 * «pequeño» no es la vara: la vara es que el dueño pueda abrir la pantalla, ver
 * qué haría, y decidir después.
 *
 * De ahí las dos mitades que este golden vigila, que son independientes:
 *
 *   1. el input `escribir` nace en `false`;
 *   2. `--escribir` sólo aparece en la rama que comprueba ese input.
 *
 * La segunda no se deduce de la primera. Un `node … $BANDERA` con la bandera
 * interpolada respetaría el valor por defecto y aun así sería frágil: cualquier
 * contenido distinto de vacío se convierte en un argumento. Por eso el comando
 * se escribe dos veces, entero, dentro de un `if` — y por eso hay un caso que lo
 * exige.
 *
 * ── Y UNA TERCERA, QUE ES LA LECCIÓN DE REG-433 APLICADA ANTES ──────────────
 *
 * `deploy-production.yml` acepta cinco credenciales, y una es `FIREBASE_TOKEN`.
 * El CLI de Firebase la entiende; **`firebase-admin` no**: `applicationDefault()`
 * quiere un archivo de cuenta de servicio. Si el environment sólo tuviera el
 * token, este workflow moriría dentro del SDK con un error de autenticación que
 * no nombra la causa — y alguien saldría a buscar el fallo al script, que estaría
 * bien. Es la forma exacta del defecto de REG-433: el mensaje acusando a la
 * pieza sana. Aquí se comprueba antes y se para nombrando lo que falta.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el backfill funcione.** Lee el YAML; que GitHub lo
 *   interprete como se espera se ve en la primera ejecución, y que Firestore
 *   acepte las escrituras se ve del otro lado. `el dato tiene que LLEGAR` sigue
 *   pidiendo mirar el resultado real.
 * · **No comprueba la lógica del script** —los pesos, la paginación, la
 *   idempotencia—: eso vive en el propio script y en el modelo del que lee la
 *   escalera.
 * · **No impide que alguien marque la casilla.** No es su trabajo: escribir es
 *   una decisión del dueño, y el botón existe para que pueda tomarla.
 * · **No vigila los demás workflows.** Sólo éste.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const RUTA = '.github/workflows/backfill-peso-de-urgencia.yml'
const YAML_CRUDO = readFileSync(join(process.cwd(), RUTA), 'utf8')

type Paso = Record<string, unknown>
const WORKFLOW = parse(YAML_CRUDO) as {
  on: { workflow_dispatch: { inputs: Record<string, { type?: string; default?: unknown }> } }
  env: Record<string, string>
  jobs: Record<string, { environment?: string; steps: Paso[] }>
}
const TRABAJO = Object.values(WORKFLOW.jobs)[0]
const paso = (id: string) => TRABAJO.steps.find(p => p.id === id)

/** Sin comentarios: este archivo los tiene, y nombran lo que vigila. */
const SIN_COMENTARIOS = YAML_CRUDO.replace(/^\s*#.*$/gm, '')

describe('el botón del backfill no escribe por defecto', () => {
  it('el input `escribir` existe, es booleano y nace en false', () => {
    const entrada = WORKFLOW.on.workflow_dispatch.inputs?.escribir
    expect(entrada, 'desapareció el input `escribir`: no hay dónde decidir').toBeTruthy()
    expect(entrada.type, '`escribir` dejó de ser una casilla').toBe('boolean')
    expect(
      entrada.default,
      'el botón pasó a ESCRIBIR por defecto: abrirlo para mirar ya escribiría',
    ).toBe(false)
  })

  it('`--escribir` sólo aparece en la rama que comprueba el input', () => {
    const correr = String(paso('backfill')!.run)

    // Toda línea con `--escribir` tiene que estar dentro del `if` del input.
    // Se comprueba partiendo por el `else`: lo de después es la rama de ensayo.
    const [ramaEscritura, ramaEnsayo] = correr.split(/^\s*else\s*$/m)
    expect(ramaEnsayo, 'desapareció la rama de ensayo del comando').toBeTruthy()

    expect(
      ramaEscritura,
      'la rama de escritura dejó de estar guardada por el input',
    ).toContain('if [ "$ESCRIBIR" = "true" ]')
    expect(ramaEnsayo, 'el ENSAYO pasó a escribir').not.toContain('--escribir')
  })

  it('la bandera no se interpola: se escribe entera en su rama', () => {
    // `node … $BANDERA` respetaría el valor por defecto y aun así sería frágil:
    // cualquier contenido distinto de vacío se vuelve un argumento.
    const correr = String(paso('backfill')!.run)
    expect(
      correr,
      'la bandera volvió a interpolarse en la línea de comando',
    ).not.toMatch(/peso-de-urgencia\.mjs[^\n]*\$\{?[A-Z_]+\}?[^\n]*$/m)
  })

  it('el input llega al paso por `env`, no por interpolación en el `run`', () => {
    // Un `${{ inputs.escribir }}` dentro del `run` lo sustituye Actions ANTES de
    // que exista el shell: el texto entra en el script en vez de en una variable.
    const env = paso('backfill')!.env as Record<string, string>
    expect(env?.ESCRIBIR, '`escribir` dejó de llegar por env').toBe('${{ inputs.escribir }}')
    expect(
      String(paso('backfill')!.run),
      'el input volvió a interpolarse dentro del propio comando',
    ).not.toContain('inputs.escribir')
  })
})

describe('el botón no acepta una credencial que su SDK no entiende', () => {
  it('`FIREBASE_TOKEN` no se convierte en un modo utilizable', () => {
    const correr = String(paso('cred')!.run)
    expect(correr, 'dejó de mirarse el caso del token').toContain('FIREBASE_TOKEN')
    expect(
      correr,
      'el token pasó a aceptarse: firebase-admin no lo entiende y el fallo saldría dentro del SDK',
    ).not.toMatch(/modo=token/)
    expect(correr, 'el token dejó de parar la ejecución').toContain('::error::')
  })

  it('la credencial se escribe a un archivo y `GOOGLE_APPLICATION_CREDENTIALS` lo apunta', () => {
    // `applicationDefault()` no lee un secreto: lee esa variable.
    const env = paso('backfill')!.env as Record<string, string>
    expect(
      env?.GOOGLE_APPLICATION_CREDENTIALS,
      'el SDK se quedó sin saber dónde está la credencial',
    ).toContain('firebase-sa.json')
    expect(String(paso('escribir_cred')!.run)).toContain('firebase-sa.json')
  })

  it('y la credencial se borra pase lo que pase', () => {
    const limpieza = TRABAJO.steps.find(p => String(p.run ?? '').includes('rm -f'))
    expect(limpieza, 'desapareció la limpieza de la credencial').toBeTruthy()
    expect(
      String(limpieza!.if ?? ''),
      'la limpieza dejó de correr cuando algo falla, que es justo cuando importa',
    ).toContain('always()')
  })
})

describe('lo que no se puede pegar mal', () => {
  it('el proyecto está fijado en el workflow, no es un input', () => {
    expect(WORKFLOW.env.FIREBASE_PROJECT, 'el proyecto dejó de estar fijado').toBe('nexomed-agenda')
    expect(
      Object.keys(WORKFLOW.on.workflow_dispatch.inputs ?? {}),
      'el proyecto pasó a ser un input: un id mal pegado es lo que cazó la Compuerta 2 del botón de producción',
    ).not.toContain('proyecto')
  })

  it('corre en el environment que guarda la credencial', () => {
    expect(TRABAJO.environment, 'salió del environment production: no vería el secreto').toBe(
      'production',
    )
  })

  it('el acta se escribe en el resumen, que es la pantalla que el dueño mira', () => {
    expect(SIN_COMENTARIOS, 'el acta dejó de llegar al resumen').toContain('GITHUB_STEP_SUMMARY')
  })
})
