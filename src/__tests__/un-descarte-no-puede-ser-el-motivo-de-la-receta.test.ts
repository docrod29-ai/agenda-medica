/**
 * GOLDEN — LO QUE EL MÉDICO DESCARTÓ SALÍA IMPRESO COMO EL MOTIVO DE LA RECETA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La receta y la orden de estudios rellenan su campo «diagnóstico» —el que se
 * imprime— con un principal sacado de la nota. Las dos lo elegían con la misma
 * línea, copiada de una a otra:
 *
 *     const principal = dxs.find(d => d.tipo === 'definitivo') ?? dxs[0]
 *
 * El respaldo `?? dxs[0]` no mira `tipo`. Cuando ningún diagnóstico es
 * `definitivo` —el caso corriente: `presuntivo` es el valor de fábrica— coge el
 * PRIMERO de la lista, tal como venga del dictado.
 *
 * ── LO QUE SE MIDIÓ ─────────────────────────────────────────────────────────
 *
 * Corriendo esa línea literal, antes de tocar nada:
 *
 *     dx: [{ Embarazo, descartado }, { Cefalea tensional, presuntivo }]
 *     → receta y orden imprimen: «Embarazo»
 *
 * «Embarazo descartado» es como se documenta una prueba negativa, y el sistema
 * lo escribe solo: `corregirCertezaPorNegacion` reclasifica a `descartado` en
 * cuanto oye la negación en el dictado. Así que no hace falta que el médico se
 * equivoque en nada — basta con que diga «descartamos embarazo» y que ése sea el
 * primer diagnóstico que nombró.
 *
 * El resultado salía por la impresora, con cédula profesional debajo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Verificando la entrada del censo de `WS-10.pantalla-de-certeza`, que pedía
 * llevar el selector de tipo de REG-407 «a las otras superficies que muestran
 * diagnósticos (expediente, UCI/hospital)». Al mirar el árbol, la petición no
 * se sostenía: hospital y UCI no tienen `Diagnostico[]` —tienen
 * `diagnosticoIngreso`, una cadena libre sin tipo— y el expediente enseña notas
 * ya firmadas, donde un selector sería una segunda puerta de escritura a una
 * nota firmada.
 *
 * Buscando entonces quién más LEE diagnósticos aparecieron cinco lectores, y
 * dos de ellos no los leían: los imprimían.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La de REG-364, en los consumidores a los que aquel arreglo no llegó.
 * `estaVigente` lleva escrito, exportado y probado desde entonces, y estas dos
 * pantallas resolvían la misma pregunta con un criterio propio y más flojo.
 * Familia «el sistema se contradice a sí mismo».
 *
 * El comentario de la receta lo delata: decía «primero activo de tipo
 * definitivo» y el código no miraba `estado` en ningún sitio. Describía un
 * filtro que nunca existió.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se separan dos gestos que se estaban confundiendo:
 *
 *  · Donde se enseña la LISTA entera (la nota, el expediente, la carta de
 *    referencia), no se filtra nada —un descarte documentado es información
 *    medicolegal y el que recibe la carta lo quiere— pero cada renglón va
 *    DICIENDO lo que es, con `nombreConCerteza`.
 *
 *  · Donde se elige UNO para que represente la visita (receta, orden), lo que
 *    no es un problema del paciente no puede representarla: `estaVigente`
 *    decide, que es la definición única, y si nada califica **no se rellena
 *    nada**. El respaldo era el defecto.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO comprueba la impresión. Comprueba qué diagnóstico se ELIGE y con qué
 *   nombre se pinta; que el PDF lo lleve es otra frontera («el dato tiene que
 *   LLEGAR») y se mira en navegador.
 * · NO decide si `presuntivo` debe etiquetarse ahora que REG-407 dejó al médico
 *   elegir el tipo. `nombreConCerteza` sigue callándolo a propósito, y su
 *   cabecera dice por qué; distinguir el `presuntivo` elegido del de fábrica
 *   usando `tipoOrigen` es un cambio de modelo y no se hace aquí.
 * · NO toca hospital ni UCI: su `diagnosticoIngreso` es una cadena libre sin
 *   tipo, así que no hay certeza que preservar. Que deba tenerla es una decisión
 *   de modelo, y queda dicha en el censo.
 * · NO ordena por importancia clínica. Descarta lo que no puede ser el motivo y
 *   conserva la preferencia por `definitivo` que ya había.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  diagnosticoQueSeImprime, nombreConCerteza, estaVigente,
} from '@/lib/expediente/problemas-activos'
import type { Diagnostico } from '@/types/expediente'

const dx = (p: Partial<Diagnostico>): Diagnostico =>
  ({ descripcion: 'X', tipo: 'presuntivo', estado: 'activo', ...p }) as Diagnostico

const RECETA = readFileSync('src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx', 'utf8')
const ORDEN = readFileSync('src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx', 'utf8')
const REFERENCIA = readFileSync('src/app/(dashboard)/referencia/[patientId]/page.tsx', 'utf8')
const NOTA = readFileSync('src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx', 'utf8')
const EXPEDIENTE = readFileSync('src/app/(dashboard)/expediente/[patientId]/page.tsx', 'utf8')

describe('el caso medido, con la regla vieja al lado', () => {
  const caso = [
    dx({ descripcion: 'Embarazo', tipo: 'descartado' }),
    dx({ descripcion: 'Cefalea tensional', tipo: 'presuntivo' }),
  ]

  it('la regla VIEJA imprimía el descarte — sin esto, el arreglo no se ve', () => {
    /* La línea literal que había en las dos pantallas. Se conserva aquí porque
       un golden que sólo enseña el resultado bueno no demuestra que hubiera
       algo malo. */
    const vieja = caso.find(d => d.tipo === 'definitivo') ?? caso[0]
    expect(vieja.descripcion).toBe('Embarazo')
    expect(vieja.tipo).toBe('descartado')
  })

  it('la regla nueva elige el problema, no el descarte', () => {
    expect(diagnosticoQueSeImprime(caso)?.descripcion).toBe('Cefalea tensional')
  })
})

describe('qué puede representar la visita', () => {
  it('conserva la preferencia por `definitivo` aunque no sea el primero', () => {
    const d = diagnosticoQueSeImprime([
      dx({ descripcion: 'Cefalea', tipo: 'presuntivo' }),
      dx({ descripcion: 'Migraña', tipo: 'definitivo' }),
    ])
    expect(d?.descripcion).toBe('Migraña')
  })

  it('un `definitivo` DESCARTADO no existe: no puede colarse por la preferencia', () => {
    /* El orden de los filtros importa. Filtrar después de preferir habría
       dejado pasar esto. */
    expect(diagnosticoQueSeImprime([
      dx({ descripcion: 'Lupus', tipo: 'descartado' }),
      dx({ descripcion: 'Artralgia', tipo: 'presuntivo' }),
    ])?.descripcion).toBe('Artralgia')
  })

  it('un diferencial tampoco representa la visita', () => {
    expect(diagnosticoQueSeImprime([
      dx({ descripcion: 'Tromboembolia', tipo: 'diferencial' }),
      dx({ descripcion: 'Disnea', tipo: 'presuntivo' }),
    ])?.descripcion).toBe('Disnea')
  })

  it('un problema RESUELTO no es el motivo de la receta de hoy', () => {
    /* Lo que el comentario de la receta decía hacer y no hacía. */
    expect(diagnosticoQueSeImprime([
      dx({ descripcion: 'Neumonía', tipo: 'definitivo', estado: 'resuelto' }),
      dx({ descripcion: 'Tos residual', tipo: 'presuntivo' }),
    ])?.descripcion).toBe('Tos residual')
  })

  it('lo crónico sí puede: no se pierde al paciente de vista', () => {
    expect(diagnosticoQueSeImprime([
      dx({ descripcion: 'Diabetes tipo 2', tipo: 'definitivo', estado: 'cronico' }),
    ])?.descripcion).toBe('Diabetes tipo 2')
  })

  it('si NADA califica no se rellena nada — el respaldo era el defecto', () => {
    expect(diagnosticoQueSeImprime([dx({ descripcion: 'Embarazo', tipo: 'descartado' })])).toBeNull()
    expect(diagnosticoQueSeImprime([])).toBeNull()
    expect(diagnosticoQueSeImprime(undefined)).toBeNull()
  })

  it('usa `estaVigente`, no un criterio paralelo', () => {
    /* Al revés: cualquier cosa que `estaVigente` rechace tampoco puede salir
       elegida. Si alguien añade un criterio propio aquí, esto lo caza. */
    const rechazados = [
      dx({ descripcion: 'a', tipo: 'descartado' }),
      dx({ descripcion: 'b', tipo: 'diferencial' }),
      dx({ descripcion: 'c', estado: 'resuelto' }),
    ]
    for (const r of rechazados) {
      expect(estaVigente(r)).toBe(false)
      expect(diagnosticoQueSeImprime([r])).toBeNull()
    }
  })
})

describe('las dos pantallas que imprimen pasan por la puerta', () => {
  it('ni la receta ni la orden vuelven a elegir por su cuenta', () => {
    for (const src of [RECETA, ORDEN]) {
      expect(src).toContain('diagnosticoQueSeImprime(n.diagnosticos)')
      /* El respaldo sin filtro, que es el defecto exacto. */
      expect(src).not.toMatch(/\?\?\s*dxs\[0\]/)
    }
  })

  it('el campo sigue siendo editable — por eso no rellenar es aceptable', () => {
    /* Sin esto, «no rellenar nada» dejaría al médico sin forma de poner el
       motivo, y el arreglo sería peor que el defecto. */
    for (const src of [RECETA, ORDEN]) {
      expect(src).toMatch(/value=\{diagnostico\}/)
      expect(src).toMatch(/onChange=\{\(e\) => setDiagnostico\(e\.target\.value\)\}/)
    }
  })
})

describe('donde se enseña la lista entera, cada renglón dice lo que es', () => {
  it('`nombreConCerteza` nombra el descarte y calla el valor de fábrica', () => {
    expect(nombreConCerteza(dx({ descripcion: 'Embarazo', tipo: 'descartado' })))
      .toBe('Embarazo (descartado)')
    expect(nombreConCerteza(dx({ descripcion: 'Cefalea', tipo: 'presuntivo' })))
      .toBe('Cefalea')
  })

  it('los tres lectores de listas lo usan', () => {
    for (const src of [REFERENCIA, NOTA, EXPEDIENTE]) {
      expect(src).toContain('nombreConCerteza')
      expect(src).toContain("from '@/lib/expediente/problemas-activos'")
    }
  })

  it('y ninguno pinta ya la descripción pelada', () => {
    /* La forma exacta que tenía cada uno. Reaparecer es reintroducir REG-421. */
    expect(EXPEDIENTE).not.toContain('• {d.descripcion}')
    expect(NOTA).not.toContain('<li key={i}>{d.descripcion}')
    expect(REFERENCIA).not.toContain('map(d => `${d.descripcion}')
  })

  it('la lista NO se filtra: un descarte es información medicolegal', () => {
    /* Al revés del caso de la receta, a propósito. Si alguien "arregla" esto
       filtrando, la nota firmada dejaría de decir lo que el médico descartó. */
    for (const src of [REFERENCIA, NOTA, EXPEDIENTE]) {
      expect(src).not.toMatch(/diagnosticos\s*\.filter\(estaVigente\)/)
    }
  })
})
