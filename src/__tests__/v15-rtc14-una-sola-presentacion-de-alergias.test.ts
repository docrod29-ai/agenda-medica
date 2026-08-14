/**
 * RTC-14 — la alergia se enseña UNA vez, y enseña las dos cosas.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En `/consulta`, la alergia del paciente se pintaba **dos veces en el primer
 * pliegue**: la franja editable de arriba (texto escrito) y una píldora de
 * sólo lectura bajo el nombre, a ~200px de distancia, con los alérgenos ya
 * interpretados. Dos avisos del mismo dato compiten entre sí: el segundo se
 * aprende a ignorar, y el día que digan cosas distintas —ya pasó: REG-311— el
 * médico no sabe cuál creer.
 *
 * ── CÓMO SE DESCUBRIÓ, Y POR QUÉ TARDÓ TANTO ────────────────────────────────
 *
 * El equipo rojo lo escribió como RTC-14/P2 el 13-ago… y **no se pudo medir en
 * navegador durante un día entero**: ningún paciente de la siembra tenía
 * alergias registradas ni notas, así que la pantalla salía siempre en su estado
 * vacío y la duplicación no existía. En cuanto la siembra creó historia
 * (14-ago), se contó sola:
 *
 *   /consulta    alergia ×2 en el pliegue, 49px   →  ×1, 20px
 *   «Grabar la consulta» a 452px (escritorio)     →  416px
 *                        a 564px (móvil)          →  527px
 *   /expediente  ×1 — esa mitad ya estaba pagada
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Una presentación.** Sobrevive la franja: es la primera, es la que
 *    permite ESCRIBIR la alergia durante la consulta, y es la que ya llevaba
 *    el color y el icono medidos en los dos temas.
 * 2. **No se pierde nada.** Lo único que la píldora aportaba de más era la
 *    LECTURA semántica —qué entiende el sistema por alérgeno a partir de lo
 *    escrito— y eso sube a la franja, junto al texto del que sale. Una
 *    presentación, los dos hechos.
 * 3. **La lectura sale de `alergenosDe`**, la semántica sellada de REG-279 /
 *    REG-311, nunca de una copia local del criterio: la copia local fue el
 *    defecto que pintaba «Niega penicilina. Alérgico a sulfas» como neutro.
 * 4. **Sólo se enseña cuando AÑADE algo.** Si el texto escrito es exactamente
 *    el alérgeno, repetirlo al lado sería el mismo defecto que esto viene a
 *    quitar.
 *
 * Probado al revés: devolviendo la píldora bajo el nombre falla el caso 1;
 * quitando la lectura de la franja falla el 2; leyendo `patient.alergias` con
 * un criterio propio en vez de `alergenosDe` falla el 3; quitando la guarda de
 * «sólo si añade algo» falla el 4.
 *
 * ── VERIFICADO EN NAVEGADOR ─────────────────────────────────────────────────
 *
 * `scripts/design/medir-alergias-duplicadas-v15.mjs`, sobre un paciente
 * sembrado a propósito con el caso de REG-311 («Niega penicilina. Alérgico a
 * sulfas»): la franja enseña **«se lee: sulfas»** junto al texto completo, en
 * escritorio y en móvil. El dato LLEGA — no se quedó escrito.
 * Acta: `docs/design/capturas/v15-rtc14-despues/medicion.json`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No arregla dónde está la identidad.** Con historia, el nombre del
 *   paciente sigue cayendo a 287px (escritorio) y 404px (móvil) porque las
 *   cajas de contexto van por delante. Está medido y declarado en el registro
 *   canónico; es otra rebanada.
 * · No cubre la salience cromática de la franja (la otra mitad de RTC-14: «en
 *   gris es el elemento MENOS saliente»). El icono ya acompaña al color, pero
 *   el peso relativo no se ha medido en gris.
 * · No cubre `/expediente`: ahí ya era una sola presentación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const SIEMBRA = leer('scripts/design/sembrar-capturas.mjs')

describe('RTC-14 — una sola presentación de la alergia en la consulta', () => {
  it('1 · la píldora de bajo el nombre ya no existe', () => {
    // Era la segunda: `<AlertTriangle size={13} /> Alergias: …` con los
    // alérgenos ya interpretados, a ~200px de la franja.
    expect(CONSULTA).not.toMatch(/<AlertTriangle size=\{13\} \/> Alergias:/)
    // Y sólo queda UNA etiqueta «Alergias:» pintada en esta pantalla.
    const sinComentarios = CONSULTA
      .split('\n').filter(l => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//')).join('\n')
    expect((sinComentarios.match(/>Alergias:</g) ?? []).length).toBe(1)
  })

  it('2 · la franja enseña la lectura del sistema, además del texto escrito', () => {
    expect(CONSULTA).toContain('se lee: ')
    expect(CONSULTA).toMatch(/\{alergenosDelPaciente\.join\(' · '\)\}/)
    // Y sigue siendo EDITABLE: la capacidad que decidió cuál de las dos
    // presentaciones sobrevivía.
    expect(CONSULTA).toMatch(/value=\{patient\?\.alergias \?\? ''\}/)
    expect(CONSULTA).toMatch(/campo: 'alergias'/)
  })

  it('3 · la lectura sale de `alergenosDe`, no de un criterio propio', () => {
    /**
     * REG-311: la copia local del criterio («empieza por niega/no/sin…», sin
     * leer las estructuradas) pintaba NEUTRO «Niega penicilina. Alérgico a
     * sulfas» y callaba una alergia sólo-estructurada. El criterio vive en un
     * sitio y se importa.
     */
    expect(CONSULTA).toMatch(/const alergenosDelPaciente = alergenosDe\(patient \?\? \{\}\)/)
    expect(CONSULTA).toMatch(/import \{[^}]*alergenosDe/s)
  })

  it('4 · sólo se enseña la lectura cuando AÑADE algo', () => {
    // Si lo escrito ya es exactamente el alérgeno, repetirlo al lado sería el
    // mismo defecto que esta rebanada quita.
    expect(CONSULTA).toMatch(/alergenosDelPaciente\.join\(' · '\) !== \(patient\?\.alergias \?\? ''\)\.trim\(\)/)
  })

  it('5 · la siembra trae el caso de REG-311, para poder verlo en navegador', () => {
    // Sin un paciente cuyo texto y lectura NO coincidan, esa mitad quedaría
    // escrita y sin comprobar — que es exactamente por lo que RTC-14 tardó un
    // día en poder medirse.
    expect(SIEMBRA).toContain("alergias: 'Niega penicilina. Alérgico a sulfas'")
  })
})
