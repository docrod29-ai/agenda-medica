/**
 * RTC-08 — «Encuentro» es un lugar, o dice que no lo hay.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El destino ENCOUNTER del `FlowRail` apuntaba a `/pacientes` siempre que no
 * estuvieras ya dentro de una `/consulta/[id]`. Resultado en el primer uso:
 * pides «Encuentro», apareces en la lista de pacientes, y el riel ilumina
 * **Paciente**. El ítem no sólo te llevaba a otro sitio: marcaba ese otro sitio
 * como si fuera el que pediste. Es la pregunta de §15 («¿dónde estoy y a dónde
 * puedo ir?») fallando justo cuando el médico decide si puede fiarse de la
 * barra — y una barra en la que no se confía se deja de mirar.
 *
 * Y había un daño mayor detrás del cosmético: una consulta a medio escribir no
 * tenía ninguna puerta de vuelta. El respaldo local existía y funcionaba, pero
 * sólo lo encontrabas si te acordabas de qué paciente era.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de equipo rojo de originalidad (§41): ORT-03 y RT-04 por separado, la
 * misma frase — «no es un lugar». Unificados como RTC-08 en el registro
 * canónico.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La IA de V15 declaró cinco contextos primarios antes de que existiera el
 * estado que uno de ellos necesitaba, y lo dejó ESCRITO en la cabecera del
 * componente («no hay que inventarlo aquí»). La decisión fue correcta; lo que
 * faltó fue volver cuando el estado ya estaba disponible. El respaldo local de
 * la consulta —que se escribe mientras se dicta y se purga al cerrar sesión—
 * llevaba desde antes de V15 siendo, sin que nadie lo llamara así, la marca de
 * «hay un encuentro abierto en este dispositivo».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. `encuentroAbierto()` responde la pregunta leyendo lo que el producto YA
 *    guarda; no abre una fuente de verdad nueva.
 * 2. Saca IDs y sello de tiempo — **ni un dato clínico**. La barra de
 *    navegación no es sitio para PHI.
 * 3. REG-674: un respaldo ilegible se CONSERVA, pero no se ofrece como destino.
 *    La auditoría del PR #487 ejecutó el lector con dos usuarios sintéticos:
 *    el segundo recibía el patientId del primero, incluso sin uid activo.
 *    Confundir existencia con pertenencia exponía una consulta ajena. Sólo se
 *    ofrece un objeto que se pueda desofuscar con el uid vivo. Esto no prueba
 *    pertenencia al consultorio: los respaldos legados no incluyen clinicId.
 * 4. El riel tiene tres respuestas y ninguna es el silencio: estás dentro ·
 *    hay uno y lo retomo · no hay ninguno y lo digo.
 *
 * Probado al revés: devolviendo `encounterHref` a `'/pacientes'` fijo fallan
 * los casos 7 y 8; quitando el nombre accesible falla el 9. REG-674 conserva
 * el lector anterior como control inverso: fallan los negativos de cuenta,
 * sesión ausente y contenido ilegible; el respaldo del dueño sigue intacto.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No cubre encuentros abiertos en OTRO dispositivo: por diseño. Un encuentro
 *   abierto es lo que este médico está haciendo aquí; lo que quedó a medias en
 *   otro equipo es trabajo pendiente y vive en Seguimiento, que es otro
 *   destino del riel.
 * · No mide el pintado del punto de señal ni el foco: eso es el arnés de
 *   navegador (`verificar-rtc08-v15.mjs`).
 * · No cubre la barra de Secretaria: no tiene destino «Encuentro».
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { encuentroAbierto, partesDeLaClave, rutaDelEncuentro } from '@/lib/nav/encuentro-abierto'
import { ofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'

const FLOW_RAIL = readFileSync(join(process.cwd(), 'src/components/FlowRail.tsx'), 'utf8')
const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/**
 * localStorage de mentira: el módulo enumera por índice (`length` + `key(i)`),
 * igual que el de verdad — si el doble enumerara de otro modo, la prueba
 * pasaría con una implementación que en el navegador no encuentra nada.
 *
 * La suite corre en entorno `node`, así que se sustituye `window` entero: es
 * lo ÚNICO que este módulo toca del navegador, y sustituirlo deja a la vista
 * esa superficie tan estrecha en vez de esconderla tras un entorno completo.
 */
function conAlmacen(entradas: Record<string, string>) {
  const datos = new Map(Object.entries(entradas))
  const almacen = {
    get length() { return datos.size },
    key: (i: number) => [...datos.keys()][i] ?? null,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v) },
    removeItem: (k: string) => { datos.delete(k) },
    clear: () => { datos.clear() },
  } satisfies Storage
  vi.stubGlobal('window', { localStorage: almacen })
  return almacen
}

const UID = 'medico-1'
const conSello = (ts: number, ruido = 'diagnóstico que no debe salir de aquí') =>
  ofuscar(JSON.stringify({ ts, diagnosticos: ruido }), secretoLocal(UID))

beforeEach(() => { vi.unstubAllGlobals() })

describe('RTC-08 — la lectura del encuentro abierto', () => {
  it('REG-681 · un respaldo legado sin consultorio no se adopta por tener el mismo uid', () => {
    const clave = 'nx.consulta.bkp.paciente-legado'
    const bytes = conSello(1000)
    const almacen = conAlmacen({ [clave]: bytes })
    const leer = encuentroAbierto as (uid: string, clinicId: string) => unknown
    expect(leer(UID, 'consultorio-distinto')).toBeNull()
    expect(almacen.getItem(clave)).toBe(bytes)
  })
  it('1 · sin respaldos, no hay encuentro', () => {
    conAlmacen({ 'nx.tema': 'dark' })
    expect(encuentroAbierto(UID, 'consultorio-1')).toBeNull()
  })

  it('2 · un respaldo de consulta ES un encuentro abierto', () => {
    conAlmacen({ 'nx.consulta.bkp.scope:medico-1:consultorio-1:pac-7:': conSello(1000) })
    expect(encuentroAbierto(UID, 'consultorio-1')).toEqual({ patientId: 'pac-7', ts: 1000 })
  })

  it('3 · con varios, gana el más reciente', () => {
    conAlmacen({
      'nx.consulta.bkp.scope:medico-1:consultorio-1:pac-viejo:': conSello(1000),
      'nx.consulta.bkp.scope:medico-1:consultorio-1:pac-nuevo:': conSello(9000),
      'nx.uci.lecturas.x': 'no soy una consulta',
    })
    expect(encuentroAbierto(UID, 'consultorio-1')?.patientId).toBe('pac-nuevo')
  })

  it('4 · otro usuario no recibe el destino; el dueño conserva su recuperación', () => {
    const clave = 'nx.consulta.bkp.scope:otro-uid:consultorio-1:pac-9:'
    const respaldo = ofuscar(JSON.stringify({ ts: 5 }), 'otro-uid')
    const almacen = conAlmacen({ [clave]: respaldo })
    expect(encuentroAbierto(UID, 'consultorio-1')).toBeNull()
    expect(almacen.getItem(clave)).toBe(respaldo)
    expect(encuentroAbierto('otro-uid', 'consultorio-1')).toEqual({ patientId: 'pac-9', ts: 5 })
  })

  it('5 · el episodio hospitalario viaja en la ruta que retoma', () => {
    conAlmacen({
      'nx.consulta.bkp.scope:medico-1:consultorio-1:pac-3:int-42': conSello(2000),
    })
    const e = encuentroAbierto(UID, 'consultorio-1')!
    expect(e).toEqual({ patientId: 'pac-3', internamientoId: 'int-42', ts: 2000 })
    expect(rutaDelEncuentro(e)).toBe('/consulta/pac-3?internamiento=int-42')
  })

  it('6 · una clave ajena nunca se convierte en destino', () => {
    expect(partesDeLaClave('nx.uci.lecturas.abc')).toBeNull()
    expect(partesDeLaClave('nx.consulta.bkp.')).toBeNull()
    expect(partesDeLaClave('nx.consulta.bkp.pac.h.')).toBeNull()
  })

  it('REG-674 · sin sesión activa no se reutiliza el uid recordado', () => {
    conAlmacen({ 'nx.consulta.bkp.scope:medico-1:consultorio-1:pac-7:': conSello(1000) })
    expect(encuentroAbierto(UID, 'consultorio-1')?.patientId).toBe('pac-7')
    for (const uid of [undefined, null, '']) expect(encuentroAbierto(uid, 'consultorio-1')).toBeNull()
  })

  it('REG-674 · texto plano, corrupción y JSON que no es objeto se conservan sin ofrecerlos', () => {
    const clave = 'nx.consulta.bkp.scope:medico-1:consultorio-1:pac-7:'
    for (const respaldo of [
      JSON.stringify({ ts: 1000 }), 'NXO1:inválido',
      ofuscar('null', UID), ofuscar('[]', UID), ofuscar('"texto"', UID),
    ]) {
      const almacen = conAlmacen({ [clave]: respaldo })
      expect(encuentroAbierto(UID, 'consultorio-1')).toBeNull()
      expect(almacen.getItem(clave)).toBe(respaldo)
    }
  })

  it('REG-674 · un respaldo ajeno no sustituye el propio sin fecha', () => {
    conAlmacen({
      'nx.consulta.bkp.scope:medico-1:consultorio-1:propio:': ofuscar(JSON.stringify({ resumen: 'Borrador sintético' }), UID),
      'nx.consulta.bkp.scope:otro-uid:consultorio-1:ajeno:': ofuscar(JSON.stringify({ ts: 9000 }), 'otro-uid'),
    })
    expect(encuentroAbierto(UID, 'consultorio-1')).toEqual({ patientId: 'propio', ts: 0 })
  })

  it('REG-674 · sin uid no se consulta siquiera el almacenamiento sensible', () => {
    const leer = vi.fn(() => { throw new Error('no debe leer') })
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: leer }))
    expect(encuentroAbierto(null)).toBeNull()
    expect(leer).not.toHaveBeenCalled()
  })
})

describe('RTC-08 — el riel deja de teletransportar en silencio', () => {
  it('7 · el destino RETOMA el encuentro abierto en vez de ir siempre a /pacientes', () => {
    expect(FLOW_RAIL).toContain('rutaDelEncuentro(abierto)')
    // El fallback sigue existiendo (así se EMPIEZA un encuentro), pero ya no
    // es la única respuesta posible.
    expect(FLOW_RAIL).toMatch(/abierto \? rutaDelEncuentro\(abierto\) : '\/pacientes'/)
  })

  it('8 · el estado se lee de la fuente única, no de una copia del riel', () => {
    expect(FLOW_RAIL).toContain("from '@/hooks/useEncuentroAbierto'")
    expect(FLOW_RAIL).toContain('useEncuentroAbierto()')
  })

  it('9 · las tres respuestas tienen nombre, y el nombre lo oye el lector de pantalla', () => {
    expect(FLOW_RAIL).toContain('Encuentro — estás en él')
    expect(FLOW_RAIL).toContain('Encuentro — retomar la consulta abierta')
    expect(FLOW_RAIL).toContain('Encuentro — ninguno abierto; elige un paciente para empezar')
    // `title` sin `aria-label` no lo oye nadie: la frase va a los dos sitios.
    expect(FLOW_RAIL).toMatch(/title=\{titulo\}/)
    expect(FLOW_RAIL).toMatch(/aria-label=\{titulo\}/)
  })

  it('10 · la señal es estado, no decoración: sólo fuera del encuentro, aria-hidden y con el color en la HOJA', () => {
    expect(FLOW_RAIL).toMatch(/senal=\{!enEncuentro && !!abierto\}/)
    expect(FLOW_RAIL).toMatch(/<span aria-hidden="true" className="nx-rail-senal" \/>/)

    /**
     * EL COLOR NO PUEDE VIVIR EN EL RIEL.
     *
     * La primera versión pintaba el punto con `background: 'var(--nexus)'` en
     * línea y la suite completa lo cazó: `v15-el-acento-entra-al-shell` (Fase
     * 10) exige que `FlowRail` NO lleve acento propio — el acento vive en las
     * reglas base compartidas para que el greybox aprobado no se deshaga a
     * fuerza de colores sueltos por componente. La regla se movió a la hoja y
     * el guardián de Fase 10 volvió a verde SIN tocarlo: cuando dos guardianes
     * se contradicen, o uno de los dos está mal escrito, o el arreglo lo está.
     * Aquí lo estaba el arreglo.
     */
    expect(FLOW_RAIL).not.toContain("'var(--nexus)'")
    expect(CSS).toMatch(/\.nx-rail-senal\s*\{[^}]*background:\s*var\(--nexus\)/)
    // Sólido, no halo: un halo habría subido el trinquete de genericidad.
    expect(CSS).not.toMatch(/\.nx-rail-senal\s*\{[^}]*box-shadow/)
  })
})
