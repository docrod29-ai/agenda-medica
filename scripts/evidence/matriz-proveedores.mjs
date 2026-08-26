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
    const salida = {
      revisadoEn: REVISADO_EN,
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

export function generarMatriz(cat) {
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
  L.push('| Proveedor | Rol | Licencia | ¿Puede citar hoy? | Campos sin verificar |')
  L.push('|---|---|---|---|---|')
  for (const e of cat.entradas) {
    const sinVerificar = cat.campos.filter(c => e.matriz[c] === null).length
    const puedeCitar = e.proveedorCanonico ? '**sí**' : 'no'
    L.push(`| ${e.nombre} | \`${e.rol}\` | \`${e.licencia}\` | ${puedeCitar} | ${sinVerificar}/${cat.campos.length} |`)
  }
  L.push('')
  L.push('«¿Puede citar hoy?» = tiene `proveedorCanonico` en el catálogo. **Sin él no')
  L.push('se puede construir un `Source`, y sin `Source` no hay `Passage` ni `Claim`**:')
  L.push('la falta de licencia bloquea el respaldo por construcción, no por un')
  L.push('guardián que alguien pueda quitar.')
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
  return L.join('\n') + '\n'
}

// Sólo al ejecutarlo directamente: importarlo desde la prueba no debe escribir
// ni salir con código de error.
if (process.argv[1] && process.argv[1].endsWith('matriz-proveedores.mjs')) {
  const cat = leerCatalogoConTsx()
  const contenido = generarMatriz(cat)

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
