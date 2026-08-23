/**
 * GOLDEN — el sobre de #314 CABLEADO al consultor del médico, y probado ahí.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `src/app/api/consultor-evidencia/route.ts` —la pantalla por la que el médico
 * pregunta a la literatura— buscaba en PubMed con tres redes encadenadas y las
 * tres acababan en `.catch(() => [])`. Con eso, DOS situaciones opuestas
 * producían exactamente la misma pantalla:
 *
 *   · PubMed contestó y no hay literatura para esa pregunta   → dato clínico.
 *   · PubMed no contestó (red, 429 del NCBI, timeout)         → no se sabe nada.
 *
 * Y la interfaz escribía, determinista, «Sin resultados de PubMed para esta
 * pregunta». Un fallo de red presentado como hallazgo: la peor clase de error,
 * porque tiene forma de resultado.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo el punto 9 de #314 contra la ruta real. La arquitectura de
 * `src/lib/evidence-integrations/**` ya sabía representar la diferencia, pero
 * NINGÚN código de producción la usaba: el módulo existía y no corría en el
 * camino del médico — la familia de defecto más grande del ledger.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Dos capas, cada una con su mitad del problema:
 *
 *  1. `buscarEvidenciaMulti` NUNCA LANZA: ante un 429 devuelve `[]` y deja la
 *     marca en `TestigoPubMed`. Envolverlo en `adaptadorPubMed` tal cual seguía
 *     dando `available` con cero fuentes — la misma mentira con un sobre
 *     encima. El testigo tenía que leerse y convertirse en excepción.
 *  2. La ruta no transportaba el estado hasta la pantalla, así que `sinCitas`
 *     significaba las dos cosas a la vez.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 *   SI ALGÚN PELDAÑO NO OBTUVO RESPUESTA Y NINGUNO TRAJO MATERIAL, EL
 *   RESULTADO ES «NO SE PUDO CONSULTAR» — NUNCA «NO HAY NADA».
 *
 * El fallo gana al cero: que otra búsqueda —con otros términos— contestara
 * «cero» no autoriza a afirmar que la literatura no existe. Se contestó otra
 * cosa. La regla vive en el SERVIDOR (`recuperacion-consultor.ts`), no en el
 * prompt, porque un prompt se cumple cuando el modelo colabora.
 *
 * ── PROBADA AL REVÉS ────────────────────────────────────────────────────────
 *
 * · «el fallo gana al cero» falla si se invierte el orden de las dos ramas
 *   finales de `cascadaDePubMed` (devolver el cero antes que el fallo);
 * · «la frase del fallo no dice sin resultados» falla si se borra la línea que
 *   convierte el testigo en excepción (`unIntento`): el sobre vuelve a salir
 *   `available` con cero fuentes y la frase pasa a ser la del cero.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO habla con PubMed real: la búsqueda se inyecta. La corrección del
 *   retrieval (cola de throttle, jerarquía, dedup) es de `evidencia/pubmed.ts`
 *   y de sus propias pruebas; aquí sólo se comprueba el ENVOLTORIO.
 * · NO monta la ruta HTTP ni React. Lo que se comprueba de la ruta y de la
 *   pantalla es ESTRUCTURAL (que los cables sigan ahí), no de comportamiento:
 *   un guardián de texto no sustituye a abrir el producto.
 * · NO juzga la CALIDAD de la evidencia recuperada. Ordenar por autoridad
 *   metodológica sería inventar criterio clínico (regla 1 de clinical-safety).
 * · NO cubre que el sobre llegue a TIEMPO a la pantalla: REG-190 y REG-173
 *   eran motores alcanzables que llegaban tarde.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  recuperarEvidenciaParaConsultor,
  type BusquedaDePubMed,
  type EntradaRecuperacionConsultor,
  type IntentoDeBusqueda,
} from '@/lib/evidencia/recuperacion-consultor'
import { tieneMaterial, comoSeLeDiceAlMedico } from '@/lib/evidence-integrations'
import { decisionDelMedico } from '@/lib/evidence-integrations/compuertas'
import { alcanzableDesdeLaApp } from '@/lib/arquitectura/grafo-de-dependencias'
import type { ArticuloPubMed } from '@/lib/evidencia/pubmed'

const RUTA_CONSULTOR = 'src/app/api/consultor-evidencia/route.ts'
const ENVOLTORIO = 'src/lib/evidencia/recuperacion-consultor.ts'
const CAMINO = 'src/__tests__/el-camino-del-medico-llega-entero.test.ts'

const AHORA = '2026-08-23T10:00:00.000Z'
/** Marca OPACA, como la que pone la ruta con `randomUUID()`. Nunca lleva PHI. */
const CORRELACION = 'corr-runtime-consultor-1'

/**
 * Quita comentarios antes de buscar un cable en el código.
 *
 * Sin esto el guardián se dispara con la PROPIA DOCUMENTACIÓN del arreglo: la
 * ruta explica en su comentario que «antes cada peldaño acababa en
 * `.catch(() => [])`», y un lector ciego a los comentarios leería esa frase
 * como código vivo. Es la misma ceguera que ya cazó el grafo de dependencias.
 */
function soloCodigo(src: string): string {
  return src
    .split('\n')
    .filter(l => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

function codigoDe(archivo: string): string {
  return soloCodigo(readFileSync(archivo, 'utf8'))
}

/** Los `.ts`/`.tsx` de una carpeta, en el mismo formato que usa el grafo. */
function modulosDe(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { out.push(...modulosDe(p)); continue }
    if (/\.tsx?$/.test(e)) out.push(p)
  }
  return out.sort()
}

const articulo = (pmid: string, resumen: string): ArticuloPubMed => ({
  pmid,
  titulo: `Duración corta frente a larga, estudio ${pmid}`,
  revista: 'N Engl J Med',
  anio: '2024',
  resumen,
  url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
  tipo: 'ECA',
})

const RESUMEN = 'La pauta corta no fue inferior a la larga en el desenlace principal a los 30 días.'

/** PubMed CONTESTA y no hay nada. El testigo NO se marca: es un dato. */
const CONTESTA_CERO: BusquedaDePubMed = async () => []

/** PubMed NO contesta: `pubmed.ts` marca el testigo y devuelve `[]` igual. */
const NO_CONTESTA: BusquedaDePubMed = async (_terminos, opts) => {
  opts.testigo.fallo = true
  return []
}

/** La otra mitad del contrato: una búsqueda que sí lanza. */
const LANZA: BusquedaDePubMed = async () => { throw new Error('fetch failed') }

const INTENTO_UNICO: readonly IntentoDeBusqueda[] = [{
  terminos: ['community acquired pneumonia antibiotic duration'],
  aniosRecientes: 12,
  porQue: 'las sub-búsquedas del modelo, igual que en producción',
}]

function entrada(
  buscar: BusquedaDePubMed,
  intentos: readonly IntentoDeBusqueda[] = INTENTO_UNICO,
): EntradaRecuperacionConsultor {
  return {
    pregunta: '¿Cuánto dura el antibiótico en neumonía adquirida en la comunidad?',
    intentos,
    maximo: 8,
    ahora: AHORA,
    correlacion: CORRELACION,
    buscar,
  }
}

// ---------------------------------------------------------------------------

describe('«no hay literatura» y «no se pudo preguntar» dejan de pintarse igual', () => {
  it('PubMed contesta CERO: es un DATO — `sin_resultados`, y sin motivo de fallo', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(CONTESTA_CERO))
    expect(r.estado).toBe('sin_resultados')
    expect(r.motivo).toBeNull()
    expect(r.articulos).toHaveLength(0)
    expect(tieneMaterial(r.sobre)).toBe(true)
    // `available` con cero fuentes: se preguntó, y la respuesta fue «nada».
    expect(tieneMaterial(r.sobre) && r.sobre.estado).toBe('available')
  })

  it('PubMed NO contesta: `no_consultado`, con motivo legible por el médico', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(NO_CONTESTA))
    expect(r.estado).toBe('no_consultado')
    expect(r.articulos).toHaveLength(0)
    expect(tieneMaterial(r.sobre)).toBe(false)
    expect(!tieneMaterial(r.sobre) && r.sobre.estado).toBe('unavailable')
    // La frase separa las dos cosas con todas las letras.
    expect(r.motivo).toMatch(/NO incluye literatura indexada; no es que no exista/)
  })

  it('y los dos resultados son DISTINTOS: ahí estaba todo el defecto', async () => {
    const cero = await recuperarEvidenciaParaConsultor(entrada(CONTESTA_CERO))
    const caida = await recuperarEvidenciaParaConsultor(entrada(NO_CONTESTA))
    expect(cero.estado).not.toBe(caida.estado)
    expect(cero.avisos[0]).not.toBe(caida.avisos[0])
    expect(cero.motivo).toBeNull()
    expect(caida.motivo).not.toBeNull()
  })

  it('una búsqueda que LANZA también acaba en `no_consultado`, clasificada', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(LANZA))
    expect(r.estado).toBe('no_consultado')
    expect(!tieneMaterial(r.sobre) && r.sobre.clase).toBe('red')
  })
})

describe('la copia del fallo no puede insinuar que se buscó y no había nada', () => {
  it('el fallo se dice «NO CONSULTADO» y NUNCA «sin resultados»', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(NO_CONTESTA))
    const dePubMed = r.avisos[0]
    expect(dePubMed).toMatch(/^PubMed \/ MEDLINE \(NCBI E-utilities\): NO CONSULTADO —/)
    expect(dePubMed).not.toMatch(/sin resultados/i)
  })

  it('y el cero se dice «consultado, sin resultados» — que es lo contrario', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(CONTESTA_CERO))
    expect(r.avisos[0]).toMatch(/consultado, sin resultados para esta búsqueda/)
    expect(r.avisos[0]).not.toMatch(/NO CONSULTADO/)
  })

  it('EL FALLO GANA AL CERO: un peldaño caído no autoriza a decir que no hay nada', async () => {
    /**
     * Probada al revés: si `cascadaDePubMed` devolviera el `cero` antes que el
     * `fallo`, este caso saldría `sin_resultados` — y el médico leería que no
     * hay literatura cuando la primera búsqueda ni siquiera se contestó.
     */
    const r = await recuperarEvidenciaParaConsultor(entrada(CONTESTA_CERO, [
      { terminos: ['pneumonia short course'], buscar: NO_CONTESTA, porQue: 'primer peldaño: se cae' },
      { terminos: ['neumonía duración'], buscar: CONTESTA_CERO, porQue: 'segundo peldaño: contesta cero' },
    ]))
    expect(r.estado).toBe('no_consultado')
    expect(r.motivo).not.toBeNull()
  })

  it('en la ruta no queda ningún `.catch(() => [])` en el camino de la literatura', () => {
    // El defecto original, escrito tres veces. Se comprueba sobre el CÓDIGO:
    // el comentario que lo explica contiene la misma cadena a propósito.
    const src = codigoDe(RUTA_CONSULTOR)
    expect(src).not.toMatch(/catch\(\s*\(\s*\)\s*=>\s*\[\s*\]\s*\)/)
    // Y `sinCitas` —lo que la pantalla usa para escribir «Sin resultados de
    // PubMed»— ya sólo se enciende cuando de verdad se preguntó.
    expect(src).toMatch(/sinCitas:\s*!noSePudoConsultar/)
  })
})

describe('lo que sí se recuperó conserva su procedencia', () => {
  it('cada fuente citable lleva su PMID y de qué proveedor salió', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(async () => [
      articulo('38412345', RESUMEN),
      articulo('38412346', RESUMEN),
    ]))
    expect(r.estado).toBe('con_evidencia')
    expect(r.motivo).toBeNull()
    expect(r.articulos.map(a => a.pmid)).toEqual(['38412345', '38412346'])
    expect(r.fuentes.map(f => f.id)).toEqual(['pubmed:38412345', 'pubmed:38412346'])
    expect(r.procedencia).toEqual([
      { sourceId: 'pubmed:38412345', proveedor: 'pubmed' },
      { sourceId: 'pubmed:38412346', proveedor: 'pubmed' },
    ])
  })

  it('un artículo sin resumen NO se cuela como citable, y el recorte se declara', async () => {
    // Si se silenciara, el médico creería que se revisó material que se tiró.
    const r = await recuperarEvidenciaParaConsultor(entrada(async () => [
      articulo('1', RESUMEN),
      articulo('2', ''),
    ]))
    expect(r.articulos).toHaveLength(2)
    expect(r.fuentes).toHaveLength(1)
    expect(tieneMaterial(r.sobre) && r.sobre.estado).toBe('partial')
  })

  it('llegó material PERO parte de la búsqueda se cayó → `partial`, y se dice', async () => {
    /**
     * El caso intermedio, que es el fácil de perder: hay citas, así que la
     * pantalla parece completa. El sobre baja a `partial` y su frase deja de
     * afirmar que la búsqueda se hizo entera.
     */
    const aMedias: BusquedaDePubMed = async (_t, opts) => {
      opts.testigo.fallo = true
      return [articulo('99', RESUMEN)]
    }
    const r = await recuperarEvidenciaParaConsultor(entrada(aMedias))
    expect(r.estado).toBe('con_evidencia')
    expect(r.fuentes).toHaveLength(1)
    expect(tieneMaterial(r.sobre) && r.sobre.estado).toBe('partial')
    expect(tieneMaterial(r.sobre) && r.sobre.recorte).toMatch(/la búsqueda quedó incompleta/)
    expect(r.avisos[0]).toMatch(/consultado parcialmente/)
  })
})

describe('lo que no se consultó se DECLARA, y nunca se finge consultado', () => {
  it('los cinco proveedores apagados producen su sobre, uno a uno', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(CONTESTA_CERO))
    expect([...r.declarados.map(s => s.proveedor)].sort()).toEqual([
      'cochrane', 'conocimiento_personal', 'openevidence', 'perplexity', 'uptodate',
    ])
    for (const s of r.declarados) {
      expect(tieneMaterial(s), s.proveedor).toBe(false)
      expect(comoSeLeDiceAlMedico(s), s.proveedor).toMatch(/: NO CONSULTADO — /)
    }
    // Y sus frases viajan junto a la de PubMed, no en otro sitio que alguien
    // pueda olvidarse de pintar.
    expect(r.avisos.length).toBe(1 + r.declarados.length)
  })

  it('ninguna fuente citable puede venir de un proveedor que sólo descubre', async () => {
    // Perplexity (descubrimiento) y el conocimiento personal traen texto y aun
    // así no pueden respaldar: puntos 7 y 8 de #314, aplicados en el servidor.
    const r = await recuperarEvidenciaParaConsultor(entrada(async () => [articulo('7', RESUMEN)]))
    expect(r.procedencia.map(p => p.proveedor)).toEqual(['pubmed'])
  })
})

describe('nada de esto se convierte en diagnóstico, orden ni receta', () => {
  it('la recuperación sólo expone estado, material y frases — ninguna acción', async () => {
    const r = await recuperarEvidenciaParaConsultor(entrada(async () => [articulo('7', RESUMEN)]))
    expect(Object.keys(r).sort()).toEqual([
      'articulos', 'avisos', 'declarados', 'estado', 'fuentes', 'motivo', 'procedencia', 'sobre',
    ])
  })

  it('convertir evidencia en receta exige un acto explícito — probado al revés', () => {
    const sinActo = decisionDelMedico({
      accion: 'receta', decidioUid: 'medico-1', decidioEn: AHORA, actoExplicito: false,
    })
    expect(sinActo.ok).toBe(false)
    expect(sinActo.ok === false && sinActo.motivo).toBe('NO_ES_ACTO_EXPLICITO')

    const conActo = decisionDelMedico({
      accion: 'receta', decidioUid: 'medico-1', decidioEn: AHORA, actoExplicito: true,
    })
    expect(conActo.ok).toBe(true)
  })
})

describe('el runtime del médico LLEGA a la evidencia — sin subir el techo', () => {
  const alcanzables = alcanzableDesdeLaApp()

  it('el lector funciona (si no, todo lo de abajo pasaría por vacío)', () => {
    expect(alcanzables.size).toBeGreaterThan(300)
    expect(alcanzables.has('src/lib/expediente/firestore.ts')).toBe(true)
  })

  it('se llega a TODOS los módulos de src/lib/evidence-integrations', () => {
    const modulos = modulosDe('src/lib/evidence-integrations')
    expect(modulos.length).toBeGreaterThanOrEqual(12)
    const fuera = modulos.filter(m => !alcanzables.has(m))
    expect(fuera, `fuera del camino del médico: ${fuera.join(', ')}`).toEqual([])
  })

  it('y al envoltorio que la ruta usa, y al adaptador Source que él arrastra', () => {
    expect(alcanzables.has(ENVOLTORIO)).toBe(true)
    // `desde-pubmed.ts` existía desde E2-01 SIN NINGÚN LLAMADOR. Ahora corre.
    expect(alcanzables.has('src/lib/evidencia/desde-pubmed.ts')).toBe(true)
  })

  it('el techo de módulos fuera del camino NO se subió para conseguirlo', () => {
    // Subirlo sería «arreglar» el instrumento en vez del cable. Si alguien lo
    // toca, este caso se pone rojo antes de que nadie lo dé por bueno.
    expect(readFileSync(CAMINO, 'utf8')).toMatch(/const FUERA_DEL_CAMINO_HOY = 29\b/)
  })

  it('no son imports de adorno: la ruta LLAMA, y el envoltorio USA la semántica', () => {
    /**
     * La diferencia entre estar cableado y parecerlo. Un import que nadie
     * invoca deja el grafo verde y al médico igual de desprotegido.
     */
    expect(codigoDe(RUTA_CONSULTOR)).toContain('await recuperarEvidenciaParaConsultor(')
    const env = codigoDe(ENVOLTORIO)
    expect(env).toContain('adaptadorPubMed(')
    expect(env).toContain('planDeConsulta(')
    expect(env).toContain('corpusParaSintesis(')
    expect(env).toContain('comoSeLeDiceAlMedico(')
  })
})

describe('la puerta de la ruta sigue donde estaba', () => {
  it('sesión, límite de tasa, créditos, minimización de PHI y libro de costos', () => {
    /**
     * El arreglo entra en medio de la ruta más cara de la aplicación. Estos son
     * los cables que NO se podían perder por el camino; cada uno nació de una
     * auditoría o de un defecto real.
     */
    const src = codigoDe(RUTA_CONSULTOR)
    for (const cable of [
      'verificarModuloIA(',            // sesión y módulo autorizado
      'limitarOResponder(',            // límite de tasa por médico
      'gateCreditos(',                 // tope duro con llave del dueño
      'creditosUsadosDelMes(',         // cupo del plan vigente
      'minimizarContextoPaciente(',    // PHI minimizada EN LA PUERTA
      'anotarLlamada(',                // libro de costos
      'registrarUso(',                 // consumo del consultorio
      'registrarConsultor(',           // créditos del consultor
    ]) {
      expect(src, `se perdió el cable ${cable}`).toContain(cable)
    }
  })

  it('la recuperación no filtra la pregunta del médico a las frases ni al motivo', async () => {
    // La pregunta puede traer contexto del paciente. Lo que sale del sobre son
    // frases fijas y una marca opaca — nunca el texto que escribió el médico.
    const pregunta = 'Paciente con CURP ABCD801231HDFXYZ01, ¿cuánto dura el antibiótico?'
    const r = await recuperarEvidenciaParaConsultor({ ...entrada(NO_CONTESTA), pregunta })
    const visible = JSON.stringify({ avisos: r.avisos, motivo: r.motivo, procedencia: r.procedencia })
    expect(visible).not.toContain('ABCD801231HDFXYZ01')
    expect(visible).not.toContain(pregunta)
    expect(r.sobre.correlacion).toBe(CORRELACION)
  })

  it('el consultorio viaja en el contexto y no altera lo que se le pide a PubMed', async () => {
    // Aislamiento: el inquilino llega al contexto (lo usan la caché y las notas
    // personales) pero la literatura pública no cambia por consultorio, y el
    // identificador NO se filtra a lo que el médico lee.
    const sin = await recuperarEvidenciaParaConsultor(entrada(async () => [articulo('5', RESUMEN)]))
    const con = await recuperarEvidenciaParaConsultor({
      ...entrada(async () => [articulo('5', RESUMEN)]),
      clinicId: 'clinica-1',
    })
    expect(con.estado).toBe(sin.estado)
    expect(con.procedencia).toEqual(sin.procedencia)
    expect(JSON.stringify(con.avisos)).not.toContain('clinica-1')
  })
})
