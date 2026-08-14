/**
 * RTC-19 (cierre) — cada literal teal que queda tiene su razón escrita, y una
 * de ellas es una pregunta sin contestar.
 *
 * ── DÓNDE ACABA LA LIMPIEZA ─────────────────────────────────────────────────
 *
 * Se empezó con **83 literales vivos en 28 archivos**. Tras cuatro tandas
 * —cromo persistente, `/configuracion`, superficies clínicas y este barrido
 * final— quedan **quince**, y ninguno es deuda pendiente: cada uno está donde
 * un token **no puede** ir, o donde ponerlo sería otro defecto.
 *
 *   1. `types/index.ts` · `DEFAULT_CONFIG.recetaConfig.colorAccento`
 *      DATO del consultorio. Se guarda en Firestore, se edita en un
 *      `<input type="color">` (que sólo acepta `#rrggbb`) y se IMPRIME.
 *   2. `secciones-recetas.tsx` ×2 · los dos campos que editan ese dato.
 *   3. `RecetaDocumento.tsx` · el respaldo del documento que se imprime.
 *   4. `configuracion/page.tsx` ×4 · los fragmentos que el médico PEGA en el
 *      sitio web de su consultorio, y sus vistas previas. Fuera de la
 *      aplicación no existe `globals.css`.
 *   5. `ServiceWorkerRegister.tsx` · una cadena de CSS para `console.info`.
 *      La consola del navegador no resuelve variables del documento.
 *   6. `DoctorFilter.tsx` ×2 · una **paleta categórica** de cinco colores para
 *      distinguir médicos. Los otros cuatro tampoco son tokens: convertir uno
 *      solo rompería el juego. Que la escala categórica deba vivir en tokens
 *      es una decisión de diseño, no una limpieza.
 *   7. `orden/…` y `receta/…` · dos respaldos PARCIALES de la config de
 *      receta — ver abajo, que es lo que este guardián viene a decir.
 *
 * ── LA PREGUNTA QUE ESTE GUARDIÁN DEJA ABIERTA ──────────────────────────────
 *
 * Buscando esos literales aparecieron **dos copias más** del bloque de
 * defaults de la receta, en las pantallas de orden y de receta, usadas cuando
 * el consultorio todavía no tiene config guardada. No son copias completas:
 * traen subconjuntos distintos. Y **ya divergen del canónico**:
 *
 *     canónico (`DEFAULT_CONFIG`)   mostrarAlergias: true
 *     `/orden/…`                    mostrarAlergias: **false**
 *     `/receta/…`                   mostrarAlergias: true
 *
 * Esto **no se unifica aquí, y es deliberado**: cambiarlo alteraría lo que se
 * IMPRIME en una orden clínica. Puede ser una decisión —una orden de
 * laboratorio no es una receta— o puede ser deriva de haber copiado el bloque.
 * Sólo el dueño puede decir cuál, y mientras tanto lo peligroso sería que
 * nadie supiera que existe.
 *
 * El caso 2 **congela la divergencia**: si alguien la cambia sin decidirla, se
 * pone rojo y obliga a mirar. Un guardián no siempre protege un arreglo; a
 * veces protege una pregunta.
 *
 * Probado al revés: tokenizando el respaldo del documento impreso falla el
 * caso 1; cambiando el `mostrarAlergias` de la orden falla el 2.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No dice qué debe imprimirse en una orden.** Eso es política clínica.
 * · No cubre la paleta categórica de `DoctorFilter`: declarada arriba como
 *   decisión de diseño pendiente.
 * · No mide en navegador: las cuatro tandas tienen sus actas fechadas en
 *   `docs/design/capturas/`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG } from '@/types'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('RTC-19 · cierre — lo que queda no es deuda', () => {
  it('1 · el documento que se IMPRIME conserva su respaldo literal', () => {
    /**
     * `RecetaDocumento` se lleva a papel. Un `var(--nexus)` en el respaldo
     * saldría sin resolver —o no saldría— y la receta perdería su acento sin
     * que nadie viera un error en pantalla.
     */
    expect(leer('src/components/RecetaDocumento.tsx'))
      .toContain("recetaConfig.colorAccento ?? '#14b8a6'")
  })

  it('2 · la divergencia de `mostrarAlergias` está CONGELADA hasta que alguien la decida', () => {
    /**
     * No es un arreglo: es una pregunta con candado. Si el valor cambia sin
     * que nadie lo decida, este caso se pone rojo y obliga a mirar qué se
     * imprime en una orden clínica.
     */
    const orden = leer('src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx')
    const receta = leer('src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx')
    expect(orden, 'cambió lo que una ORDEN imprime sobre alergias: decídelo, no lo edites').toMatch(/mostrarAlergias: false/)
    expect(receta).toMatch(/mostrarAlergias: true/)
    expect(DEFAULT_CONFIG.recetaConfig!.mostrarAlergias).toBe(true)
  })

  it('3 · la cadena de la consola sigue siendo CSS de consola', () => {
    // `console.info('%c…', 'color:#14b8a6')` no vive en el documento: las
    // variables CSS del documento no llegan ahí.
    expect(leer('src/components/ServiceWorkerRegister.tsx')).toMatch(/color:#14b8a6/)
  })

  it('4 · y la paleta de médicos sigue completa, no medio tokenizada', () => {
    /**
     * Cinco colores para distinguir médicos. Convertir uno solo a token
     * rompería el juego: o van todos a una escala categórica del sistema —
     * decisión de diseño— o se quedan los cinco.
     */
    const df = leer('src/components/DoctorFilter.tsx')
    for (const c of ['#14b8a6', '#a78bfa', '#f59e0b', '#3b82f6', '#ec4899']) {
      expect(df, `la paleta categórica perdió ${c}`).toContain(c)
    }
  })
})
