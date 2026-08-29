/**
 * GOLDEN — LOS CAMPOS DEL CIERRE EXISTÍAN Y NINGUNA PANTALLA LOS LLENABA.
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────
 *
 * REG-360 le dio campo a las tres etapas del §9 que faltaban —DECISION, ACTION
 * y PATIENT COMMUNICATION— y lo dejó escrito en su propio «qué no cubre»:
 * *ninguna pantalla lo llena todavía*.
 *
 * Eso es la familia «escrito, probado y sin conectar» **a un paso de ocurrir**,
 * y este repositorio tiene un ledger entero explicando cómo termina: el campo se
 * queda vacío, alguien lo da por hecho al leer el tipo, y meses después alguien
 * descubre que el dato nunca llegó. Se cierra ahora, en la unidad siguiente, en
 * vez de dejarlo para «cuando haya tiempo».
 *
 * ── QUÉ FALLABA, EN LO QUE EL MÉDICO VE ─────────────────────────────────────
 *
 * El botón «Lo revisé — cerrar» avanzaba el estado y ya. Un resultado crítico
 * revisado y cerrado **sin que nadie llamara al paciente** quedaba idéntico a
 * uno donde sí se llamó.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Cerrar pasa por un formulario, y **cerrar y avanzar de estado dejan de ser el
 * mismo gesto**: el botón de cierre abre el formulario, los demás avanzan
 * directo. Fundirlos habría dejado cerrar sin decidir, que es el fallo entero
 * —el mismo razonamiento por el que «ya se hizo» y «lo revisé» ya eran dos
 * botones distintos en esta pantalla.
 *
 * · La **decisión** es obligatoria: el botón está deshabilitado sin ella.
 * · La **acción** y el **aviso** no lo son: un worklist que cuesta se abandona
 *   en una semana, y entonces deja de verse el resultado que sí importaba.
 * · Lo que no se marca queda **sin registrar**, y el formulario lo dice con esas
 *   palabras: «no consta» no es «no se hizo».
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No renderiza.** Lee la fuente de la pantalla: comprueba que el camino y
 *   las palabras existan, no que se vean. Eso es navegador (WS-05).
 * · **No prueba Firestore.** El escritor tiene su propia comprobación de
 *   contrato; aquí se mira que la pantalla le pase el cierre.
 * · **No cubre el cierre desde otras pantallas.** Hoy sólo `/pendientes` cierra
 *   tareas; si mañana lo hace otra, este golden no la ve — y ése es exactamente
 *   el patrón de REG-337 y REG-356, así que queda dicho.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedeCerrarse } from '@/lib/tareas-clinicas/modelo'

const PANTALLA = readFileSync('src/app/(dashboard)/pendientes/page.tsx', 'utf8')
const ESCRITOR = readFileSync('src/lib/tareas-clinicas/firestore.ts', 'utf8')

describe('CERRAR YA NO ES «AVANZAR DE ESTADO»', () => {
  it('el botón de cerrar abre el formulario, no mueve el estado directo', () => {
    expect(PANTALLA).toContain("paso.estado === 'cerrada' ? onCerrar(t) : onMover(t, paso.estado)")
  })

  it('y el formulario existe, con su título', () => {
    expect(PANTALLA).toContain('Cerrar: ¿qué se decidió?')
  })

  it('la decisión es obligatoria: sin ella el botón no deja cerrar', () => {
    expect(PANTALLA).toContain('disabled={!decision.trim()}')
  })

  it('la acción y el aviso NO son obligatorios, y se marca cuáles', () => {
    expect(PANTALLA).toContain('(opcional)')
    // Sólo la decisión lleva la marca de obligatorio.
    expect(PANTALLA).toContain('· obligatorio')
  })
})

describe('LO QUE NO SE MARCA QUEDA «SIN REGISTRAR», Y SE DICE', () => {
  it('el formulario lo explica con esas palabras', () => {
    expect(PANTALLA).toContain('sin registrar')
    expect(PANTALLA).toContain('no que no se avisó')
  })

  it('y no manda el campo cuando nadie lo marcó — no manda un valor por omisión', () => {
    /**
     * Mandar `'no_avisado'` por omisión convertiría «no lo marqué» en un hecho
     * clínico, y del lado que hace que nadie llame.
     */
    expect(PANTALLA).toContain("...(aviso ? { avisoAlPaciente: aviso } : {})")
    expect(PANTALLA).toContain("...(accion.trim() ? { accion: accion.trim() } : {})")
  })

  it('las tres respuestas del aviso están, incluida «no hacía falta»', () => {
    for (const v of ['avisado', 'no_avisado', 'no_aplica']) {
      expect(PANTALLA).toContain(`'${v}'`)
    }
    expect(PANTALLA).toContain('No hacía falta')
  })
})

describe('EL DATO LLEGA AL ESCRITOR', () => {
  it('la pantalla le pasa el cierre a `cambiarEstado`', () => {
    expect(PANTALLA).toContain("mover(t, 'cerrada', {")
    expect(PANTALLA).toContain('cierre: {')
  })

  it('y el escritor lo valida antes de guardar', () => {
    expect(ESCRITOR).toContain('puedeCerrarse(cierre)')
    // El autor y el instante los pone el servidor, no el formulario: un cierre
    // firmado por quien lo teclea no se puede auditar.
    expect(ESCRITOR).toContain('quien: uid, cuando: ahora')
  })

  it('el escritor sigue rechazando un cierre sin decisión, venga de donde venga', () => {
    expect(puedeCerrarse({ quien: 'uid', cuando: 'x' }).permitido).toBe(false)
  })

  it('y registra la transición', () => {
    expect(ESCRITOR).toContain('conTransicion(tarea.transiciones')
  })
})
