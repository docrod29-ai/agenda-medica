/**
 * GUARDIÁN — ninguna capacidad de IA sin contrato, y ningún umbral inventado.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `ia/evaluacion.ts` es un buen instrumento: mide exactitud por campo, campos
 * faltantes y una proxy de alucinación. Faltaba lo que convierte una medición en
 * una compuerta —qué conjunto, qué métrica, **a partir de qué número está bien**,
 * y qué hace el producto cuando no lo está—, y sin eso, en palabras del censo,
 * «una métrica es decorativa».
 *
 * ── LA TENTACIÓN QUE ESTE GUARDIÁN EXISTE PARA IMPEDIR ──────────────────────
 *
 * Rellenar los umbrales. Poner 0,95 en cada fila deja el requisito con aspecto
 * de cerrado y es **el fallo más caro posible** en este repositorio: no rompe
 * nada, no falla ninguna prueba, y convierte una decisión clínica no tomada en
 * una compuerta que parece acordada.
 *
 * Cuánta pérdida de medicamentos es tolerable al extraer una nota es una cifra
 * clínica, y la regla 1 prohíbe inventarlas. Aquí un umbral es **un número con
 * fuente** o es `NEEDS_CLINICAL_REVIEW` con qué hay que decidir.
 *
 * ── LO QUE SÍ SE DECIDIÓ SIN EL MÉDICO, Y NO ES POCO ────────────────────────
 *
 * Qué capacidades existen, qué decide cada una, **qué cuesta que se equivoque**,
 * si hay conjunto de referencia o no lo hay, y qué hace el producto cuando
 * falla. Esto último es una propiedad del código y se comprueba hoy.
 *
 * La consecuencia del error es lo que hace *discutible* el umbral: sin ella un
 * número es una preferencia; con ella se puede argumentar.
 *
 * ── EL HALLAZGO DE PASO: DOS NOMBRES PARA UNA CAPACIDAD ─────────────────────
 *
 * Al censar los nombres aparecieron **tres rutas que usaban dos**: uno para el
 * libro de costos (el contexto del gateway) y otro distinto para el registro de
 * incidencias, en el mismo archivo.
 *
 *     extraer-entidades → costos «extraer-entidades» · incidencias «entidades»
 *     procesar          → costos «nota-consulta»     · incidencias «nota»
 *     transcribir       → costos «transcribir»       · incidencias «transcripcion»
 *
 * Los dos registros agrupan por ese nombre, así que **«qué está fallando» y «qué
 * está costando» no se podían cruzar**, y la lista de funciones afectadas que
 * enseña una incidencia nombraba cosas que no aparecen en ningún otro sitio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide nada.** Es el contrato, no la evaluación. Los conjuntos de la
 *   mayoría de las capacidades **no existen**, y el contrato lo dice fila por
 *   fila en vez de dejarlo en blanco.
 * · **No arregla los documentos viejos.** Las incidencias ya escritas con el
 *   nombre anterior conservan su nombre: reescribir el histórico sería peor que
 *   el desajuste que corrige.
 * · **No cubre la IA de cara al paciente**, que tiene su propia compuerta
 *   permanente (las doce preguntas del §0 de V9, `evals/patient-ai/`).
 * · **La política de fallo se declara, y sólo una está comprobada en el código**
 *   (`rechaza_al_momento`, por la contrapresión de REG-390). Las demás son la
 *   intención escrita, no la propiedad medida — y se dice aquí para que nadie lo
 *   lea al revés.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONTRATOS, nombresCanonicos, esperaAlMedico, sinUmbral,
  PENDIENTE_DEL_MEDICO, POR_QUE_NO_SE_INVENTA_UN_UMBRAL, POR_QUE_EL_NOMBRE_IMPORTA,
} from '@/lib/ia/contratos-de-evaluacion'

/** Todos los `feature: '…'` del árbol, que es el censo real de capacidades. */
function featuresDelArbol(): { nombre: string; archivo: string }[] {
  const out: { nombre: string; archivo: string }[] = []
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') recorrer(p) }
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) {
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/feature: '([a-z0-9-]+)'/g)) out.push({ nombre: m[1], archivo: p })
      }
    }
  }
  recorrer('src/app/api')
  recorrer('src/lib')
  return out
}

describe('ninguna capacidad de IA se queda sin contrato', () => {
  it('el censo del árbol no está vacío (si no, esto pasaría solo)', () => {
    expect(featuresDelArbol().length).toBeGreaterThan(10)
  })

  it('cada `feature` del árbol tiene su contrato', () => {
    /**
     * AL REVÉS: añadir una ruta de IA nueva sin declarar qué decide, qué cuesta
     * que se equivoque y qué pasa cuando falla, pone esto en rojo. Es la puerta.
     */
    const canonicos = new Set(nombresCanonicos())
    const huerfanos = [...new Set(featuresDelArbol().filter(f => !canonicos.has(f.nombre)).map(f => `${f.nombre} (${f.archivo})`))]
    expect(huerfanos, 'capacidad de IA sin contrato de evaluación').toEqual([])
  })

  it('y ningún contrato nombra una capacidad que ya no existe', () => {
    /* Al revés del anterior: un contrato huérfano da la impresión de que se
       vigila algo que se borró. */
    const enElArbol = new Set(featuresDelArbol().map(f => f.nombre))
    const fantasmas = nombresCanonicos().filter(n => !enElArbol.has(n))
    expect(fantasmas, 'contrato de una capacidad que no está en el árbol').toEqual([])
  })

  it('una capacidad tiene UN nombre, no dos', () => {
    /**
     * El hallazgo. Tres rutas mandaban un nombre al libro de costos y otro al
     * registro de incidencias, así que los dos registros no se podían cruzar.
     */
    const porArchivo = new Map<string, Set<string>>()
    for (const f of featuresDelArbol()) {
      if (!porArchivo.has(f.archivo)) porArchivo.set(f.archivo, new Set())
      porArchivo.get(f.archivo)!.add(f.nombre)
    }
    /* `evidencia/route.ts` sí tiene DOS capacidades de verdad —buscar y
       responder—, y las dos están declaradas. Lo que no puede haber es un nombre
       sin contrato, que ya lo caza el caso de arriba. */
    const canonicos = new Set(nombresCanonicos())
    for (const [archivo, nombres] of porArchivo) {
      for (const n of nombres) {
        expect(canonicos.has(n), `«${n}» en ${archivo} no es un nombre canónico`).toBe(true)
      }
    }
  })
})

describe('un umbral es un número CON FUENTE, o es una decisión pendiente', () => {
  it('ningún umbral numérico viene sin decir de dónde sale', () => {
    /**
     * Éste es el caso que impide el atajo. Un número sin fuente es una
     * preferencia disfrazada de acuerdo clínico.
     */
    const sinFuente = CONTRATOS
      .filter(c => !esperaAlMedico(c.umbral))
      .filter(c => !('fuente' in c.umbral) || String((c.umbral as { fuente: string }).fuente).trim().length < 30)
    expect(sinFuente.map(c => c.capacidad), 'umbral numérico sin fuente').toEqual([])
  })

  it('y lo pendiente dice QUÉ hay que decidir, no sólo que falta', () => {
    /* «Pendiente» a secas no se puede retomar: no se sabe a quién preguntarle
       qué. */
    for (const c of sinUmbral()) {
      const que = (c.umbral as Record<string, string>)[PENDIENTE_DEL_MEDICO]
      expect(que.length, `${c.capacidad} no dice qué hay que decidir`).toBeGreaterThan(60)
    }
  })

  it('la mayoría sigue esperando al médico, y eso se DICE', () => {
    /**
     * No es un fallo del contrato: es su estado honesto. Si algún día esto baja
     * a cero sin que el médico haya decidido nada, alguien rellenó los huecos —
     * que es exactamente lo que este archivo existe para impedir.
     */
    expect(sinUmbral().length).toBeGreaterThan(0)
    expect(POR_QUE_NO_SE_INVENTA_UN_UMBRAL).toMatch(/regla 1 prohíbe inventarlas/)
  })

  it('un umbral decidido sale de una REGLA ESCRITA o de una DECISIÓN FECHADA, nunca de una opinión', () => {
    /**
     * ACTUALIZADO EN REG-594, y no se debilita: se amplía a la otra fuente que
     * el propio módulo declara legítima.
     *
     * Hasta hoy los únicos umbrales decididos eran dos ceros derivados de reglas
     * del repositorio, así que el guardián exigía «regla». Cuando el médico
     * dueño fijó el de `nota-consulta` el 31-ago-2026, esa exigencia habría
     * obligado a disfrazar su decisión de regla — o a bajar el guardián.
     *
     * Las dos fuentes válidas, y ninguna tercera: una regla escrita del
     * repositorio, o una decisión del médico CON FECHA. «Lo habitual» sigue sin
     * ser ninguna de las dos.
     */
    const decididos = CONTRATOS.filter(c => !esperaAlMedico(c.umbral))
    expect(decididos.length).toBeGreaterThan(0)
    for (const c of decididos) {
      const f = (c.umbral as { fuente: string }).fuente
      const deRegla = /regla|\.claude\/rules|escrit/i.test(f)
      /* Fechada de verdad: no vale «lo decidió el médico» sin cuándo. */
      const deDecision = /DECIDIDO/.test(f) && /\d{1,2}-[a-z]{3}-\d{4}/.test(f)
      expect(deRegla || deDecision, `${c.capacidad}: ni regla escrita ni decisión fechada`).toBe(true)
    }
  })

  it('un umbral con VARIOS EJES declara cada uno, y el `valor` es el más laxo', () => {
    /**
     * REG-594 · `nota-consulta` tiene dos errores que no cuestan lo mismo, y el
     * médico los fijó distintos: perder ≤ 1 %, añadir 0 %.
     *
     * `valor` lleva el más LAXO a propósito: quien lea sólo ese campo no puede
     * llevarse una impresión mejor que la real. Si llevara el más estricto, un
     * lector superficial creería que la capacidad exige cero en todo.
     */
    for (const c of CONTRATOS.filter(c => !esperaAlMedico(c.umbral))) {
      const u = c.umbral as { valor: number; ejes?: readonly { nombre: string; valor: number; porQue: string }[] }
      if (!u.ejes) continue
      expect(u.ejes.length, `${c.capacidad}: un solo eje no necesita la lista`).toBeGreaterThan(1)
      expect(u.valor, `${c.capacidad}: el valor tiene que ser el más laxo de sus ejes`)
        .toBe(Math.max(...u.ejes.map(e => e.valor)))
      for (const e of u.ejes) {
        expect(e.porQue.length, `${c.capacidad}/${e.nombre} no dice por qué`).toBeGreaterThan(80)
      }
    }
  })
})

describe('cada contrato dice qué cuesta equivocarse y qué pasa al fallar', () => {
  it('la consecuencia del error está escrita, y no de adorno', () => {
    /* Es lo que hace discutible el umbral: sin ella un número es una
       preferencia; con ella se puede argumentar. */
    const mudos = CONTRATOS.filter(c => c.consecuenciaDelError.trim().length < 60)
    expect(mudos.map(c => c.capacidad)).toEqual([])
  })

  it('el conjunto se declara, aunque sea para decir que NO existe', () => {
    /* Dejarlo en blanco haría creer que hay uno. La mayoría no existe, y eso es
       la lista de trabajo. */
    const mudos = CONTRATOS.filter(c => c.conjunto.trim().length < 20)
    expect(mudos.map(c => c.capacidad)).toEqual([])
  })

  it('y todas declaran su política de fallo', () => {
    const validas = new Set(['degrada_y_lo_dice', 'pregunta_al_medico', 'no_produce_salida', 'rechaza_al_momento'])
    for (const c of CONTRATOS) expect(validas.has(c.politicaDeFallo), c.capacidad).toBe(true)
  })

  it('la ruta declarada existe de verdad', () => {
    /* Una ruta que ya no está deja el contrato apuntando al vacío. */
    for (const c of CONTRATOS) {
      expect(() => readFileSync(c.ruta, 'utf8'), `${c.capacidad} → ${c.ruta}`).not.toThrow()
    }
  })

  it('y la razón del nombre único está escrita donde se pueda leer', () => {
    expect(POR_QUE_EL_NOMBRE_IMPORTA).toMatch(/no se podían cruzar/)
  })

  it('el censo de nombres se aplica en TIEMPO DE EJECUCIÓN, no sólo en el CI', () => {
    /**
     * Un contrato que sólo mira el CI vigila el árbol de hoy. Al registrar una
     * incidencia se comprueba también ahí: si llega una capacidad sin contrato,
     * la incidencia **se anota igual** —descartarla perdería el aviso justo
     * cuando alguien acaba de añadir una capacidad— y se MARCA, porque una
     * capacidad de IA sin contrato es una avería de proceso que también hay que
     * ver.
     *
     * Corregir el nombre a uno parecido sería inventar un dato, así que no se
     * hace.
     */
    const src = readFileSync('src/lib/ia/incidentes-servidor.ts', 'utf8')
    expect(src).toContain("import { nombresCanonicos } from './contratos-de-evaluacion'")
    expect(src).toMatch(/const declarada = nombresCanonicos\(\)\.includes\(r\.feature\)/)
    expect(src).toMatch(/\.\.\.\(declarada \? \{\} : \{ capacidadSinContrato: true \}\)/)
  })
})
