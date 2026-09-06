/**
 * Genera docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md desde el catálogo.
 *
 * POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO: una tabla legal escrita a mano se
 * desincroniza del código en la primera revisión, y entonces el documento dice
 * que UpToDate está pendiente mientras el código ya lo habilitó (o al revés).
 * De las dos, la peligrosa es la segunda: el dueño decidiría un gasto leyendo
 * una tabla que ya no describe el sistema.
 *
 * Uso:
 *   node scripts/evidence/matriz-proveedores.mjs            → escribe el .md
 *   node scripts/evidence/matriz-proveedores.mjs --verificar → falla si está desincronizado
 *
 * El modo `--verificar` es el que corre en CI a través de su prueba.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export const DESTINO = 'docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md'

/**
 * Los proveedores que de verdad se instancian. Se copian aquí porque este script
 * es JS puro y no puede importar el módulo TS — pero NO se cree a nadie: hay un
 * guardián (`evidence-integrations-matriz-doc`) que compara esta lista contra
 * `PROVEEDORES_INSTANCIADOS` y falla si se separan.
 */
export const INSTANCIADOS = ['pubmed', 'uptodate', 'openevidence', 'cochrane', 'perplexity', 'conocimiento_personal']

/**
 * Fuentes que SÍ se consultan pero **fuera del contrato de adaptadores**: las
 * llama a mano `api/consultor-evidencia/route.ts` (openFDA en `dosisFDA`, PMC en
 * `textoCompletoPMC`).
 *
 * Se distinguen a propósito y no se meten en el saco de «sin adaptador», que
 * sería mentir en la otra dirección. Pero tampoco son un «sí» limpio: al no
 * pasar por `planDeConsulta` **no producen aviso**, así que si openFDA se cae
 * el médico no puede leer «no se consultó». Existen para él sólo cuando
 * funcionan, que es la definición de una fuente en la que no se puede confiar.
 */
export const FUERA_DEL_CONTRATO = ['pmc', 'fda_dailymed']

/**
 * ── POR QUÉ `generarMatriz` SE EXPORTA ──────────────────────────────────────
 *
 * Para que la prueba de sincronía (src/__tests__/evidence-integrations-*.test.ts)
 * pueda llamarla EN PROCESO, importando el catálogo TypeScript directamente con
 * vitest, sin lanzar un subproceso ni depender de `tsx` —que no es dependencia
 * del repo y tendría que bajarse de la red en cada CI—.
 *
 * Un gate de documentación que depende de una descarga se cae un martes
 * cualquiera, se marca `continue-on-error` y deja de proteger. Es el mismo modo
 * de fallo que describe el encabezado de scripts/lint-trinquete.mjs.
 */
function leerCatalogoConTsx() {
  const guion = `
    import { CATALOGO_DE_EVIDENCIA, CAMPOS_DE_LA_MATRIZ, REVISADO_EN, UNVERIFIABLE } from './src/lib/evidence-integrations/catalogo.ts'
    import { HOSTS_DE_EVIDENCIA } from './src/lib/evidence-integrations/de-donde-se-baja.ts'
    const salida = {
      revisadoEn: REVISADO_EN,
      hosts: HOSTS_DE_EVIDENCIA,
      campos: CAMPOS_DE_LA_MATRIZ,
      entradas: Object.values(CATALOGO_DE_EVIDENCIA).map(e => ({
        id: e.id, nombre: e.nombre, clase: e.clase, rol: e.rol, licencia: e.licencia,
        proveedorCanonico: e.proveedorCanonico ?? null,
        porQue: e.porQue, decisionPendiente: e.decisionPendiente,
        matriz: Object.fromEntries(CAMPOS_DE_LA_MATRIZ.map(c => [
          c, e.matriz[c] === UNVERIFIABLE ? null : { valor: e.matriz[c].valor, nota: e.matriz[c].nota },
        ])),
      })),
    }
    process.stdout.write(JSON.stringify(salida))
  `
  const json = execFileSync('npx', ['tsx', '--eval', guion], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
  return JSON.parse(json)
}

export const ETIQUETA_CAMPO = {
  viaOficial: 'Vía oficial de integración',
  clasesDeDatoPermitidas: 'Clases de dato permitidas',
  admitePhi: 'Admite PHI',
  modeloDeCredencial: 'Modelo de credencial',
  derechoDeCache: 'Derecho de caché',
  derechoDeMostrar: 'Derecho de mostrar',
  citaProfunda: 'Cita profunda al original',
  exponeFrescura: 'Expone versión/frescura',
  limitesYSla: 'Límites y SLA',
  precio: 'Precio',
  semanticaDeFallo: 'Semántica de fallo',
  reusoGenerativo: 'Reuso en sistema generativo',
}

function celda(v) {
  if (v === null) return '**UNVERIFIABLE**'
  const valor = Array.isArray(v.valor) ? v.valor.join(', ') : String(v.valor)
  return `${valor} — ${v.nota}`
}

/**
 * @param cat    el catálogo de proveedores
 * @param hosts  `HOSTS_DE_EVIDENCIA`. OBLIGATORIO a propósito: si fuera opcional,
 *               un llamador que lo olvidara generaría el documento SIN la
 *               sección y el guardián de sincronía lo daría por bueno — la
 *               tabla desaparecería sin que nada se pusiera rojo.
 */
export function generarMatriz(cat, hosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    throw new Error('generarMatriz: faltan los hosts de evidencia; ver de-donde-se-baja.ts')
  }
  const L = []
  L.push('# Matriz de calificación de proveedores de evidencia (#314)')
  L.push('')
  L.push('> **GENERADO. No editar a mano.**')
  L.push('> Fuente de verdad: `src/lib/evidence-integrations/catalogo.ts`.')
  L.push('> Regenerar: `node scripts/evidence/matriz-proveedores.mjs`.')
  L.push('')
  L.push(`Última revisión del catálogo: **${cat.revisadoEn}**.`)
  L.push('')
  L.push('## Qué significa UNVERIFIABLE')
  L.push('')
  L.push('**No se ha verificado desde este repositorio.** No significa «no», y no')
  L.push('significa «probablemente sí». Significa que nadie con acceso al portal del')
  L.push('proveedor lo ha confirmado, y por tanto **no se puede construir nada')
  L.push('encima**. Es el equivalente legal de `NEEDS_CLINICAL_REVIEW`.')
  L.push('')
  L.push('Esta tabla se llenó **sin acceso a portales de licenciamiento, sin')
  L.push('credenciales y sin contactar a ningún proveedor**. Por eso casi todo lo')
  L.push('comercial de UpToDate, OpenEvidence y Cochrane está sin verificar: es el')
  L.push('estado real del conocimiento, no una tarea a medias.')
  L.push('')
  L.push('**Este documento no es asesoría legal.**')
  L.push('')

  L.push('## Resumen')
  L.push('')
  L.push('| Proveedor | Rol | Licencia | ¿Se consulta hoy? | Campos sin verificar |')
  L.push('|---|---|---|---|---|')
  for (const e of cat.entradas) {
    const sinVerificar = cat.campos.filter(c => e.matriz[c] === null).length
    /**
     * REG-345 — TRES ESTADOS, NO DOS.
     *
     * Esta columna decía «sí» con sólo tener `proveedorCanonico`, que es una
     * propiedad del TIPO. El resultado: la tabla afirmaba que ClinicalTrials.gov,
     * la OMS y los CDC «pueden citar hoy: sí» cuando ninguno de los tres tiene
     * adaptador y ninguno se instancia. Y ésta es la tabla que un dueño lee para
     * decidir un gasto.
     *
     * Ahora se cruza con `PROVEEDORES_INSTANCIADOS`, que se DERIVA del código
     * que de verdad crea los adaptadores.
     */
    const instanciado = INSTANCIADOS.includes(e.proveedorCanonico) || INSTANCIADOS.includes(e.id)
    const aMano = FUERA_DEL_CONTRATO.includes(e.id)
    const puedeCitar = !e.proveedorCanonico
      ? 'no — sin licencia'
      : instanciado ? '**sí**'
      : aMano ? 'sí — **pero fuera del contrato**: no avisa si falla'
      : 'no — **sin adaptador**'
    L.push(`| ${e.nombre} | \`${e.rol}\` | \`${e.licencia}\` | ${puedeCitar} | ${sinVerificar}/${cat.campos.length} |`)
  }
  L.push('')
  L.push('«¿Se consulta hoy?» cruza DOS cosas, y hacen falta las dos:')
  L.push('')
  L.push('- **`proveedorCanonico` en el catálogo.** Sin él no se puede construir un')
  L.push('  `Source`, y sin `Source` no hay `Passage` ni `Claim`: la falta de licencia')
  L.push('  bloquea el respaldo por construcción, no por un guardián que alguien pueda')
  L.push('  quitar.')
  L.push('- **Un adaptador instanciado en `recuperacion-consultor.ts`.** Una fila del')
  L.push('  catálogo sin adaptador no se consulta, no aparece en los avisos, y el médico')
  L.push('  **no puede leer «no se consultó»** — para él esa fuente sencillamente no')
  L.push('  existe.')
  L.push('')
  L.push('Hay un tercer caso, y se dice aparte porque mezclarlo sería mentir en la otra')
  L.push('dirección: **PMC y openFDA sí se consultan**, pero los llama a mano la ruta')
  L.push('(`textoCompletoPMC`, `dosisFDA`) sin pasar por el contrato. Funcionan — y al')
  L.push('no pasar por `planDeConsulta` **no producen aviso**: si openFDA se cae, el')
  L.push('médico no lee «no se consultó», lee una respuesta más pobre y no puede')
  L.push('distinguirla de una completa.')
  L.push('')
  L.push('Antes esta columna sólo miraba lo primero, y por eso decía «sí» de fuentes que')
  L.push('nadie ha construido (REG-345).')
  L.push('')

  L.push('## Decisiones que esperan al dueño')
  L.push('')
  const pendientes = cat.entradas.filter(e => e.decisionPendiente)
  if (pendientes.length === 0) L.push('_Ninguna._')
  for (const e of pendientes) {
    L.push(`### ${e.nombre}`)
    L.push('')
    L.push(e.decisionPendiente)
    L.push('')
  }

  L.push('## Ficha por proveedor')
  L.push('')
  for (const e of cat.entradas) {
    L.push(`### ${e.nombre}`)
    L.push('')
    L.push(`- **id**: \`${e.id}\``)
    L.push(`- **clase**: \`${e.clase}\``)
    L.push(`- **rol**: \`${e.rol}\``)
    L.push(`- **licencia**: \`${e.licencia}\``)
    L.push(`- **proveedor canónico**: ${e.proveedorCanonico ? `\`${e.proveedorCanonico}\`` : '_ninguno — no puede producir un `Source` citable_'}`)
    L.push('')
    L.push(`${e.porQue}`)
    L.push('')
    L.push('| Campo | Estado |')
    L.push('|---|---|')
    for (const c of cat.campos) L.push(`| ${ETIQUETA_CAMPO[c] ?? c} | ${celda(e.matriz[c])} |`)
    L.push('')
  }
  /**
   * ── DE DÓNDE SE BAJA, Y DE DÓNDE NO SE BAJA NADA (WS-06) ─────────────────
   *
   * Va en ESTE documento y no en otro porque es la otra mitad de la misma
   * pregunta: la tabla de arriba dice qué permite la licencia de cada
   * proveedor, y esto dice por qué vía se llega a él. Una sin la otra deja al
   * dueño decidiendo un gasto sin saber cómo entra el material.
   */
  L.push('## De dónde se baja evidencia, y de dónde no se baja nada')
  L.push('')
  L.push('> Fuente de verdad: `src/lib/evidence-integrations/de-donde-se-baja.ts`.')
  L.push('> Un host que aparezca en el árbol y no esté aquí rompe el CI.')
  L.push('')
  L.push('**Enlazar no es recuperar, y es casi lo contrario.** Un enlace manda al médico al')
  L.push('sitio del editor, bajo los términos del editor. Bajar esa misma URL desde el')
  L.push('servidor y quedarse con el HTML es tomar el material sin pasar por donde el editor')
  L.push('pone sus condiciones. La URL es la misma y el acto es el contrario.')
  L.push('')
  L.push('| Host | Qué se hace | Qué | Por qué se puede |')
  L.push('|---|---|---|---|')
  for (const h of hosts) {
    L.push(`| \`${h.host}\` | ${ETIQUETA_USO[h.comoSeUsa] ?? h.comoSeUsa} | ${h.que} | ${h.baseLegal} |`)
  }
  L.push('')

  return L.join('\n') + '\n'
}

/** Cómo se lee cada clase de uso en la tabla. */
export const ETIQUETA_USO = {
  se_baja: '**se baja**',
  solo_se_enlaza: 'sólo se enlaza',
  no_resuelve: 'no resuelve (pruebas)',
}

// Sólo al ejecutarlo directamente: importarlo desde la prueba no debe escribir
// ni salir con código de error.
if (process.argv[1] && process.argv[1].endsWith('matriz-proveedores.mjs')) {
  const cat = leerCatalogoConTsx()
  const contenido = generarMatriz(cat, cat.hosts)

  if (process.argv.includes('--verificar')) {
    if (!existsSync(DESTINO)) {
      console.error(`FALTA ${DESTINO}. Regenera con: node scripts/evidence/matriz-proveedores.mjs`)
      process.exit(1)
    }
    if (readFileSync(DESTINO, 'utf8') !== contenido) {
      console.error(`${DESTINO} está DESINCRONIZADO del catálogo.`)
      console.error('Regenera con: node scripts/evidence/matriz-proveedores.mjs')
      process.exit(1)
    }
    console.log(`${DESTINO} está sincronizado con el catálogo.`)
  } else {
    writeFileSync(DESTINO, contenido)
    console.log(`Escrito ${DESTINO} (${cat.entradas.length} proveedores).`)
  }
}
