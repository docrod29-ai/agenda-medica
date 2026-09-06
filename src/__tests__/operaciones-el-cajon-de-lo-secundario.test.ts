/**
 * GOLDEN — EL ÍNDICE ABRE CON LO DE HOY, NO CON TODO (4-sep-2026)
 *
 * QUÉ FALLABA: `/operaciones` pintaba de golpe todos sus grupos. Tras «Agenda»
 * venían nueve destinos de «Negocio» y «Cumplimiento y documentos» —CRM,
 * reseñas, reactivación, farmacia, finanzas, membresías, cumplimiento,
 * documentos legales, migración— cosas de cada semana, cada mes o de vez en
 * cuando, ocupando dos pantallazos por delante de lo que se usa a diario.
 *
 * CÓMO SE DESCUBRIÓ: el dueño lo vio en pantalla y lo dijo por su nombre:
 * confunde. El objetivo declarado del producto es que esto sea amigable.
 *
 * CAUSA RAÍZ: la única jerarquía que la pantalla tenía era el ORDEN (la
 * cadencia ordenaba los grupos de arriba abajo). Ordenar no arregla la
 * cantidad visible de golpe: por muchos que se bajen, siguen ahí, con el mismo
 * peso visual, compitiendo por la atención de quien vino buscando UNA cosa.
 * §34 lo dice: «un tablero donde todo pesa lo mismo no tiene jerarquía: tiene
 * inventario».
 *
 * LA REGLA QUE LO HACE SEGURO: revelación progresiva de verdad — el grupo se
 * marca `secundario` en el DATO, se pinta dentro de un cajón cerrado, y lo que
 * el botón promete se CUENTA de lo que va a pintar (ya filtrado por modo, por
 * módulo contratado y por pausa). Nada se borra ni se manda a otra ruta:
 * esconder no puede significar perder, y estos destinos se usan de verdad.
 *
 * QUÉ NO CUBRE:
 * - No mide la pantalla en navegador: ni contraste, ni foco visible, ni que el
 *   cajón se vea bien en móvil. Eso es el arnés
 *   `scripts/design/capturar-operaciones-configuracion-v15.mjs`, y esta rama
 *   no lo pudo correr (sin credenciales la app no arranca).
 * - No prueba el clic real (no hay render aquí): comprueba el cableado del
 *   estado y del ARIA sobre el fuente. Un `onClick` que no cambiara nada
 *   pasaría este guardián — lo que no pasaría es que el cajón desapareciera o
 *   que el botón mintiera sobre su contenido.
 * - No decide qué grupo es secundario: eso es criterio del dueño, y está en el
 *   dato, no aquí. El caso 2 sólo fija los dos que él señaló.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const OPS = readFileSync(join(process.cwd(), 'src/app/(dashboard)/operaciones/page.tsx'), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
const SRC = sinComentarios(OPS)

/** Los grupos declarados, con su marca de secundario, leídos del fuente. */
const gruposDeclarados = (): { titulo: string; secundario: boolean }[] => {
  const inicio = OPS.search(/const GRUPOS:/)
  const cierre = OPS.indexOf('\n]', inicio)
  const bloque = OPS.slice(inicio, cierre)
  return [...bloque.matchAll(/titulo: '([^']+)',\s*\n\s*cadencia: '[^']+',\s*\n(\s*secundario: true,)?/g)]
    .map(m => ({ titulo: m[1], secundario: !!m[2] }))
}

describe('El índice de Operaciones abre con lo de todos los días', () => {
  it('1 · los grupos se parten en dos lecturas y cada una se pinta por su lado', () => {
    expect(SRC).toMatch(/const primarios = grupos\.filter\(g => !g\.secundario\)/)
    expect(SRC).toMatch(/const secundarios = grupos\.filter\(g => g\.secundario\)/)
    expect(SRC).toMatch(/\{primarios\.map\(g => <GrupoDeDestinos key=\{g\.titulo\} grupo=\{g\} \/>\)\}/)
    expect(SRC).toMatch(/<CajonDeLoSecundario grupos=\{secundarios\} \/>/)
  })

  it('2 · lo que el dueño señaló es lo que queda dentro del cajón, y nada más', () => {
    const grupos = gruposDeclarados()
    expect(grupos.length).toBeGreaterThanOrEqual(5)
    const dentro = grupos.filter(g => g.secundario).map(g => g.titulo)
    expect(dentro).toEqual(['Negocio', 'Cumplimiento y documentos'])
    // Y lo de todos los días sigue a la vista, sin un clic de por medio.
    const fuera = grupos.filter(g => !g.secundario).map(g => g.titulo)
    expect(fuera).toContain('Agenda')
    expect(fuera).toContain('Comunicación')
  })

  it('3 · AL REVÉS: sin la marca, el cajón se queda vacío y no se pinta', () => {
    /**
     * La defensa real de esta pantalla es que `secundario` viaje del dato al
     * render. Si alguien quitara la marca de los dos grupos, `secundarios`
     * quedaría vacío, `CajonDeLoSecundario` devolvería `null` — y la pantalla
     * volvería a abrir con los nueve destinos, que es el defecto que se
     * arregló. Por eso el early-return se fija aquí explícitamente: es la
     * bisagra entre «hay cajón» y «no hay nada».
     */
    expect(SRC).toMatch(/if \(grupos\.length === 0\) return null/)
    const grupos = gruposDeclarados()
    expect(grupos.some(g => g.secundario), 'nadie está marcado: el cajón nacería vacío').toBe(true)
  })

  it('4 · el botón no miente: nombres y cuenta salen de lo que va a pintar', () => {
    // Un «9 destinos» escrito a mano habría envejecido mal al añadir uno — y
    // le habría prometido a una secretaria destinos que su modo no le enseña.
    expect(SRC).toMatch(/const destinos = grupos\.reduce\(\(n, g\) => n \+ g\.items\.length, 0\)/)
    expect(SRC).toMatch(/const nombres = grupos\.map\(g => g\.titulo\.toLowerCase\(\)\)\.join\(', '\)/)
    expect(SRC).toMatch(/\{nombres\} — \{destinos\}/)
    expect(SRC).toMatch(/destinos === 1 \? 'destino' : 'destinos'/)
    // Ninguna cifra de contenido escrita a pelo en el copy del cajón.
    expect(SRC).not.toMatch(/\d+ destinos que/)
  })

  it('5 · §24 — es un <button> de verdad, con ARIA y el mínimo táctil compartido', () => {
    const cajon = SRC.slice(SRC.indexOf('function CajonDeLoSecundario'))
    expect(cajon).toMatch(/<button/)
    expect(cajon).toMatch(/aria-expanded=\{abierto\}/)
    expect(cajon).toMatch(/aria-controls="ops-cajon-secundario"/)
    expect(cajon).toMatch(/id="ops-cajon-secundario"/)          // apunta a algo real
    expect(cajon).toMatch(/\.\.\.FILA_DE_GRUPO/)                 // el 44 no se reescribe
    expect(cajon).toMatch(/<Briefcase[^>]*aria-hidden="true"/)
    expect(cajon).toMatch(/<ChevronDown[\s\S]{0,320}aria-hidden="true"/)
    // La etiqueta dice qué va a pasar, no sólo dónde estás.
    expect(cajon).toMatch(/abierto \? 'Ocultar la gestión del consultorio' : 'Ver la gestión del consultorio'/)
  })

  it('6 · la anatomía de la lista NO se copió: hay UNA pieza de grupo', () => {
    // Pintar el grupo en dos sitios con dos JSX distintos era volver al defecto
    // que RTC-29 pagó (dos dialectos para la misma lista).
    expect(SRC).toMatch(/function GrupoDeDestinos\(\{ grupo \}: \{ grupo: Grupo \}\)/)
    expect((SRC.match(/<GrupoDeDestinos /g) ?? []).length).toBe(2)
    expect((SRC.match(/<CabeceraDeGrupo titulo=\{grupo\.titulo\}/g) ?? []).length).toBe(1)
  })

  it('7 · el movimiento habla tokens, no milisegundos a mano (MOTION-001)', () => {
    expect(SRC).toMatch(/transition: 'transform var\(--mov-rapido\) var\(--mov-curva\)'/)
  })

  it('8 · el subtítulo dice cómo está organizada la pantalla', () => {
    const subtitulo = OPS.match(/subtitle="([^"]+)"/)?.[1] ?? ''
    expect(subtitulo).toMatch(/todos los días/i)
    expect(subtitulo).toMatch(/botón/i)
  })
})
