/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Una nota guardada SIN el bloque `metadata` tumbaba entera la pantalla
 * `/nota/[patientId]/[notaId]` —el visor del documento medicolegal, de donde
 * salen la receta, la orden, el PDF y el Word—. No pintaba un hueco: caía en la
 * frontera de error del tablero y el médico veía «Algo salió mal. Ocurrió un
 * error en esta pantalla», con un único botón «Reintentar» que **no puede
 * funcionar nunca**: un fallo de render determinista da lo mismo todas las
 * veces. El documento seguía íntegro en Firestore y era ilegible desde el
 * producto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No lo encontró una prueba: lo encontró querer MEDIR esa pantalla. El arnés
 * del carril de excelencia no la había abierto nunca, y al sembrar una nota
 * firmada para poder abrirla, la nota se escribió sin `metadata`. El sembrador
 * es un `.mjs`: no pasa por `tsc`, así que `NotaMedica` decía «obligatorio» y
 * nadie lo comprobaba.
 *
 * Y el documento pasó por TRES puertas antes de reventar: el escritor lo
 * aceptó, Firestore lo aceptó, y la ruta del portal del paciente lo leyó sin
 * una queja —sólo mira `estado` y `medicamentos`—. Es «el dato tiene que
 * LLEGAR» entre dos lectores del MISMO documento: que uno lo lea bien no dice
 * nada del otro.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * `normNota` —el normalizador por el que pasa TODO lector de notas— defendía
 * cuatro campos de arreglo (`diagnosticos`, `medicamentos`, `alergias`,
 * `secciones`) y no `metadata`. El visor hace `nota.metadata.establecimiento`
 * sin guarda y en cada render; `nota-word.ts` hace el mismo acceso.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo que el visor desreferencia DURO —`nota.X.` sin `?.` y sin un
 * `nota.X &&` que lo envuelva— lo tiene que defender `normNota`. Es una
 * relación entre dos archivos, y por eso se prueba: ninguno de los dos, leído
 * a solas, enseña que está rota.
 *
 * Y se defiende con el objeto VACÍO, no con valores plausibles. La pantalla ya
 * sabe declarar lo que falta («Falta el nombre del establecimiento. Es dato
 * obligatorio del expediente (NOM-004)», «[FALTA CÉDULA PROFESIONAL]», sello
 * «—»). Rellenar un establecimiento inventado sería peor que la caída: sale
 * impreso. Ausencia de dato no es dato de ausencia.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo mira el visor de la nota. Otras pantallas que lean notas pueden tener
 *   desreferencias duras propias sobre campos que `normNota` tampoco defiende;
 *   esta prueba no las recorre.
 * · El barrido de fuente reconoce como guarda un `nota.X &&` en CUALQUIER punto
 *   del archivo. Un `&&` que estuviera en una rama distinta a la del acceso lo
 *   daría por bueno sin serlo.
 * · No dice nada sobre si los datos que SÍ llegan son correctos: sólo sobre si
 *   la pantalla sobrevive a que falten.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normNota } from '@/lib/expediente/firestore'

const RAIZ = join(__dirname, '..')
const VISOR = join(RAIZ, 'app/(dashboard)/nota/[patientId]/[notaId]/page.tsx')

describe('un documento sin metadata no tumba el visor medicolegal', () => {
  it('normNota devuelve un `metadata` sobre el que se puede leer, aunque el documento no lo traiga', () => {
    // El documento tal y como lo leía la ruta del portal sin protestar.
    const crudo = { estado: 'firmada', medicamentos: [{ nombre: 'X' }] }

    const n = normNota(crudo as Record<string, unknown>, 'nota-1')

    // Ésta es LITERALMENTE la línea del visor que reventaba.
    expect(() => n.metadata.establecimiento).not.toThrow()
    expect(n.metadata).toBeDefined()
  })

  it('no inventa el establecimiento: lo deja ausente para que la pantalla lo declare', () => {
    const n = normNota({ estado: 'firmada' } as Record<string, unknown>, 'nota-1')
    // Sin valor → el visor cae a `config?.nombreClinica` y, si tampoco lo hay,
    // enseña «Falta el nombre del establecimiento». Un valor de relleno aquí
    // apagaría ese aviso y saldría impreso con cédula profesional.
    expect(n.metadata.establecimiento).toBeUndefined()
    expect(n.metadata.cedulaProfesional).toBeUndefined()
    expect(n.metadata.hashIntegridad).toBeUndefined()
  })

  it('el metadata que SÍ viene no se toca', () => {
    const n = normNota(
      { metadata: { establecimiento: 'Consultorio sintético', version: 3 } } as Record<string, unknown>,
      'nota-1',
    )
    expect(n.metadata.establecimiento).toBe('Consultorio sintético')
    expect(n.metadata.version).toBe(3)
  })

  it('sigue defendiendo los cuatro arreglos que ya defendía', () => {
    const n = normNota({} as Record<string, unknown>, 'nota-1')
    expect(n.diagnosticos).toEqual([])
    expect(n.medicamentos).toEqual([])
    expect(n.alergias).toEqual([])
    expect(n.secciones).toEqual([])
  })

  /**
   * LA CONEXIÓN ENTRE LOS DOS ARCHIVOS.
   *
   * Las pruebas de arriba fijan lo que `normNota` hace HOY. Ésta es la que
   * atrapa el defecto la PRÓXIMA vez: si alguien añade al visor un
   * `nota.loQueSea.algo` sin guarda y `normNota` no lo defiende, sale en rojo
   * aquí antes de que una pantalla se caiga en la cara de nadie.
   */
  it('todo lo que el visor desreferencia sin guarda, normNota lo defiende', () => {
    const visor = readFileSync(VISOR, 'utf8')
    const fuenteNorm = readFileSync(join(RAIZ, 'lib/expediente/firestore.ts'), 'utf8')
    const cuerpoNorm = fuenteNorm.slice(
      fuenteNorm.indexOf('export function normNota'),
      fuenteNorm.indexOf('export function normNota') + 3000,
    )

    /*
     * LOS COMENTARIOS FUERA, Y NO ES UN DETALLE.
     *
     * La primera versión de este barrido leía el archivo entero, comentarios
     * incluidos, y daba por bueno `nota.firma.timestamp` —una desreferencia
     * DURA de verdad— porque cuarenta líneas más arriba, dentro de un
     * comentario, alguien había escrito `nota.firma.imagenDataUrl` entre
     * comillas invertidas. Un guardián que se convence a sí mismo con la prosa
     * del archivo que vigila no vigila nada.
     */
    const codigo = visor.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

    const duros = new Set<string>()
    // `nota.X.` o `nota.X[` donde ESA aparición no lleva `?`. Se mira aparición
    // por aparición a propósito: el visor usa `nota.metadata?.medicoId` en una
    // línea y `nota.metadata.establecimiento` en otra, así que preguntar «¿usa
    // alguna vez `?.`?» daba un falso verde justo sobre el campo que fallaba.
    for (const m of codigo.matchAll(/\bnota\.([A-Za-z_$][\w$]*)(\??)\s*[.[]/g)) {
      if (m[2] === '') duros.add(m[1])
    }
    expect(duros.size).toBeGreaterThan(0) // el barrido encuentra algo

    const sinDefensa = [...duros].filter(campo => {
      if (new RegExp(`\\b${campo}:`).test(cuerpoNorm)) return false   // normNota lo defiende
      // Guarda envolvente: en algún punto del archivo el campo se PONE A PRUEBA
      // antes de usarse —`nota.signosVitales &&`, `nota.iaAuditoria?.procesadoEn &&`,
      // `nota.firma ?`—. `metadata` no aparece a prueba en ningún sitio: se lee
      // y ya, en cada render, y por eso era la que tumbaba la pantalla.
      if (new RegExp(`nota\\.${campo}\\b[^\\n]{0,80}?(&&|\\?\\s)`).test(codigo)) return false
      return true
    })

    expect(sinDefensa, `El visor lee estos campos sin guarda y \`normNota\` no los defiende: ${sinDefensa.join(', ')}. `
      + 'O se defienden en `normNota` (con ausencia, nunca con un valor inventado) o se envuelven en un `nota.X &&` '
      + 'en el visor. Sin eso, una nota vieja o un respaldo a medias tumba la pantalla entera del documento.')
      .toEqual([])
  })
})
