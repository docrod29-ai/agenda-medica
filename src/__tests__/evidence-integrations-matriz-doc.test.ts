/**
 * GUARDIÁN — el documento de la matriz no puede mentir sobre el catálogo (#314).
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md es lo que el dueño va a leer
 * para decidir si contrata UpToDate, y esa decisión cuesta dinero. Una tabla
 * legal escrita a mano se desincroniza del código en la primera revisión.
 *
 * De las dos formas de desincronizarse, la peligrosa NO es que el documento
 * diga «pendiente» mientras el código ya lo habilitó — eso sólo retrasa. Es la
 * contraria: que el documento diga que un campo legal está VERIFICADO cuando el
 * catálogo lo tiene como `UNVERIFIABLE`. Se decidiría un gasto, o peor, una
 * integración, leyendo una certeza que nadie comprobó.
 *
 * ── CÓMO ESTÁ CONSTRUIDO, Y POR QUÉ ASÍ ─────────────────────────────────────
 *
 * La prueba importa el generador del script (`.mjs`) y el catálogo (`.ts`) EN
 * PROCESO, y regenera el markdown para compararlo. NO lanza un subproceso con
 * `npx tsx`: `tsx` no es dependencia del repo y tendría que bajarse de la red en
 * cada CI. Un gate que depende de una descarga se cae un martes cualquiera, se
 * marca `continue-on-error` y deja de proteger — el modo de fallo que describe
 * el encabezado de scripts/lint-trinquete.mjs.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * NO comprueba que los datos del catálogo sean CIERTOS. Nadie puede: son
 * términos comerciales que sólo el proveedor puede confirmar. Comprueba que el
 * documento diga lo mismo que el código, y que lo no verificado SIGA marcado
 * como no verificado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
// El generador es JavaScript suelto (`.mjs`): TypeScript lo resuelve con
// `allowJs` e infiere sus tipos, así que NO hace falta silenciar nada — y poner
// un `@ts-expect-error` de más rompería el build con TS2578.
import { generarMatriz, DESTINO } from '../../scripts/evidence/matriz-proveedores.mjs'
import {
  CATALOGO_DE_EVIDENCIA, CAMPOS_DE_LA_MATRIZ, REVISADO_EN, UNVERIFIABLE,
  estaVerificado,
} from '@/lib/evidence-integrations/catalogo'

/** Misma forma que produce `leerCatalogoConTsx()` en el script. */
function catalogoPlano() {
  return {
    revisadoEn: REVISADO_EN,
    campos: CAMPOS_DE_LA_MATRIZ,
    entradas: Object.values(CATALOGO_DE_EVIDENCIA).map(e => ({
      id: e.id, nombre: e.nombre, clase: e.clase, rol: e.rol, licencia: e.licencia,
      proveedorCanonico: e.proveedorCanonico ?? null,
      porQue: e.porQue, decisionPendiente: e.decisionPendiente,
      matriz: Object.fromEntries(CAMPOS_DE_LA_MATRIZ.map(c => {
        const v = e.matriz[c]
        return [c, estaVerificado(v as never) ? { valor: (v as { valor: unknown }).valor, nota: (v as { nota: string }).nota } : null]
      })),
    })),
  }
}

describe('el documento de la matriz está sincronizado con el catálogo', () => {
  it('existe', () => {
    expect(existsSync(DESTINO), `falta ${DESTINO}: regenera con node scripts/evidence/matriz-proveedores.mjs`).toBe(true)
  })

  it('coincide byte a byte con lo que produce el generador', () => {
    const esperado = generarMatriz(catalogoPlano())
    const real = readFileSync(DESTINO, 'utf8')
    expect(real, `${DESTINO} está DESINCRONIZADO. Regenera con: node scripts/evidence/matriz-proveedores.mjs`).toBe(esperado)
  })

  it('lo NO verificado sigue marcado como tal en el documento', () => {
    // El fallo caro: que el documento afirme una certeza que el código no tiene.
    const doc = readFileSync(DESTINO, 'utf8')
    for (const e of Object.values(CATALOGO_DE_EVIDENCIA)) {
      for (const c of CAMPOS_DE_LA_MATRIZ) {
        if (e.matriz[c] === UNVERIFIABLE) {
          expect(doc, `${e.id}.${c} está UNVERIFIABLE en el catálogo`).toMatch(/\*\*UNVERIFIABLE\*\*/)
        }
      }
    }
    // Y la explicación de qué significa no puede desaparecer del documento.
    expect(doc).toMatch(/No se ha verificado desde este repositorio/)
    expect(doc).toMatch(/no es asesoría legal/i)
  })

  it('el documento avisa de que se genera, para que nadie lo edite a mano', () => {
    expect(readFileSync(DESTINO, 'utf8')).toMatch(/GENERADO\. No editar a mano/)
  })
})
