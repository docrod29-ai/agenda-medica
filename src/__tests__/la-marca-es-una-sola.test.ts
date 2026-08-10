/**
 * LA MARCA ES UNA SOLA — y el nombre viejo no puede volver a colarse.
 *
 * ── QUÉ PASÓ ────────────────────────────────────────────────────────────────
 *
 * El 10-ago-2026 el dueño renombró el producto: **NexusMED → Ausculta**. El
 * nombre estaba escrito a mano en ~400 sitios de `src/` —metadatos, manifiesto,
 * páginas de marketing, términos, aviso de privacidad, prompts, correos,
 * `aria-label`s— y en ninguno derivaba de nada.
 *
 * Renombrar fue barrido con revisión archivo a archivo. Lo caro no es el
 * barrido: es que un solo sitio se quede atrás y el producto enseñe **dos
 * nombres a la vez** en la misma sesión. Un pie de página con el nombre viejo
 * en la pantalla de pago es de las cosas que un comprador nota y nadie de
 * dentro ve, porque de dentro nadie lee el pie de página.
 *
 * Familia `depende_de_recordar`: el dato existe y N sitios lo repiten a mano.
 * Este archivo es la compuerta que lo convierte en derivado.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * En `src/` no puede aparecer el nombre anterior **salvo** en la lista blanca
 * de abajo, y cada excepción está ahí por una razón escrita:
 *
 *  · `src/lib/marca.ts` — es quien declara los dos nombres.
 *  · Nombres de **archivos entregados por el dueño**
 *    (`NexusMED_CLINICAL_ASR_PIPELINE_V1`, `NexusMED_Antibacterial_Dosing_…`).
 *    Son artefactos reales con ese nombre: renombrarlos en una cita rompería
 *    la trazabilidad de la fuente.
 *  · **Citas textuales** del dueño. No se le corrigen las palabras a alguien
 *    que ya las dijo.
 *  · `VERSION_AVISO` — el aviso de privacidad explica *por qué* subió de
 *    versión, y para explicarlo tiene que nombrar el cambio.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Los identificadores.** `nexusmed.mx` (dominio y correos de soporte),
 *   `nexomed-agenda` (proyecto de Firebase), `nexusmed.app` (`appId` de
 *   Capacitor), `nexusmed-vNNN` (caché del service worker) y `nexusmed.theme`
 *   (`localStorage`) **siguen igual a propósito**: son llaves, no texto.
 *   Cambiarlas manda al médico a un dominio que nadie ha comprado, convierte la
 *   actualización en otra app, tira la caché y borra el tema que eligió. El
 *   porqué de cada una vive en `src/lib/marca.ts`.
 * - **La documentación histórica.** El ledger, los checkpoints y las
 *   especificaciones conservan el nombre con el que se escribieron. Un registro
 *   que se reescribe deja de ser un registro.
 * - **El logotipo.** El mark es una «N» geométrica y el producto ya no empieza
 *   por N. Está declarado en `OWNER_DECISIONS_REQUIRED.md`: dibujar una marca
 *   nueva es decisión de diseño del dueño, no un barrido de texto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { MARCA, MARCA_ANTERIOR } from '@/lib/marca'

const RAIZ = process.cwd()
const EXT = ['.ts', '.tsx', '.css']

/**
 * Lo que puede seguir diciendo el nombre viejo, y por qué. La clave es la ruta;
 * el valor, cuántas apariciones se aceptan hoy. Que sea un número y no un
 * `true` es a propósito: una excepción que crece sola deja de ser una
 * excepción.
 */
const PERMITIDO: Record<string, number> = {
  // Declara los dos nombres: no puede no mencionarlos.
  'src/lib/marca.ts': 2,
  // Este archivo: explica la regla, y para explicarla la nombra.
  'src/__tests__/la-marca-es-una-sola.test.ts': 99,
  // Nombres de archivos que entregó el dueño. Son artefactos reales.
  'src/lib/asr/politica-critica.ts': 1,
  'src/lib/antimicrobianos/v4/catalogo.ts': 1,
  'src/lib/antimicrobianos/v4/tipos.ts': 1,
  'src/lib/dosing/dataset.ts': 1,
  'src/lib/clinical/registry.ts': 3,
  'src/__tests__/asr-guardian-sustituciones.test.ts': 1,
  // Cita textual del dueño sobre la ventaja del producto.
  'src/lib/uci/tendencias.ts': 1,
  // Explica por qué subió la versión del aviso; nombrar el cambio es el punto.
  'src/lib/aviso-privacidad.ts': 1,
  // La cabecera del motor explica qué cambió en v1.1.0, que fue el nombre.
  'src/lib/uci/copilot.ts': 1,
}

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, acc)
    else if (EXT.some(x => e.endsWith(x))) acc.push(p)
  }
  return acc
}

describe('la marca del producto es una sola', () => {
  const fuentes = archivos(join(RAIZ, 'src'))

  it('el barrido encuentra archivos de verdad (si no, pasaría vacío)', () => {
    // Sin esto, un fallo del recorrido daría verde sin comprobar nada.
    expect(fuentes.length).toBeGreaterThan(400)
  })

  it('el nombre nuevo está de verdad en el producto', () => {
    const conMarca = fuentes.filter(f => readFileSync(f, 'utf8').includes(MARCA))
    expect(conMarca.length).toBeGreaterThan(30)
  })

  it('el nombre anterior sólo sobrevive donde está declarado', () => {
    /**
     * Probada al revés: devolviendo un archivo cualquiera de `src/app` al nombre
     * viejo, este caso falla y dice cuál.
     */
    const infractores: string[] = []
    for (const f of fuentes) {
      const rel = relative(RAIZ, f).split('\\').join('/')
      const veces = readFileSync(f, 'utf8').split(MARCA_ANTERIOR).length - 1
      if (veces === 0) continue
      const tope = PERMITIDO[rel] ?? 0
      if (veces > tope) infractores.push(`${rel}: ${veces} (permitidas ${tope})`)
    }
    expect(
      infractores,
      `Vuelve a aparecer «${MARCA_ANTERIOR}» donde no toca:\n  ${infractores.join('\n  ')}\n\n` +
        `Usa MARCA de @/lib/marca. Si la aparición es legítima —una cita, el nombre de un ` +
        `archivo que entregó el dueño— añádela a PERMITIDO con su razón, no subas el número a ciegas.`,
    ).toEqual([])
  })

  it('la lista blanca no guarda entradas que ya no hacen falta', () => {
    // Al revés que el anterior: caza permisos que sobreviven a su motivo y
    // dejarían pasar una reaparición futura sin que nadie se entere.
    const muertas = Object.keys(PERMITIDO).filter(rel => {
      try {
        return !readFileSync(join(RAIZ, rel), 'utf8').includes(MARCA_ANTERIOR)
      } catch {
        return true // el archivo ya no existe
      }
    })
    expect(muertas, `permisos sin motivo vivo: ${muertas.join(', ')}`).toEqual([])
  })

  it('los identificadores NO se renombraron, y eso es la decisión correcta', () => {
    /**
     * Este caso protege lo contrario que los de arriba: que un barrido futuro
     * «termine el trabajo» y toque las llaves. El dominio recibe correo de
     * médicos, el `appId` está instalado en teléfonos, y la llave del tema
     * guarda una preferencia que alguien eligió.
     */
    const capacitor = readFileSync(join(RAIZ, 'capacitor.config.ts'), 'utf8')
    expect(capacitor, 'el appId instalado no se renombra').toContain('nexusmed.app')
    expect(capacitor, 'el nombre visible sí').toContain(`appName: '${MARCA}'`)

    const tema = readFileSync(join(RAIZ, 'src/components/ThemeToggle.tsx'), 'utf8')
    expect(tema, 'la llave del tema guarda una preferencia ya elegida').toContain('nexusmed.theme')
  })
})
