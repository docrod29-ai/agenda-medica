/**
 * REP-080 · RT-001 (equipo rojo, ataques propios) — un homónimo que llama CON su
 * celular se cuelga del expediente del OTRO cuando ese expediente no tiene
 * teléfono; y tener un segundo homónimo con teléfono contradictorio en el
 * directorio no protege: lo empeora.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/pacientes/duplicados.ts:462-473`, `elegirExpedienteParaCita`:
 *   const seContradicen = telReserva.length > 0 && telExistente.length > 0 && …
 *   if (seContradicen) continue
 * (a) Con el expediente SIN teléfono no hay contradicción posible, así que
 *     «Juan Pérez Ramírez, 68 años, sin teléfono» funde con la reserva «Juan
 *     Perez Ramirez, 555-111-2233» por `compararPacientes` = {probable, «Mismo
 *     nombre», puntaje 60} — el MÍNIMO de la escala para nombre idéntico.
 * (b) Con DOS homónimos —uno sin teléfono y otro con un teléfono que
 *     contradice— el `continue` de :465 saca al segundo de `candidatos` ANTES
 *     del desempate de :473 («dos candidatos igual de buenos → se crea uno
 *     nuevo»). El desempate nunca ve que hay dos Marías y funde con la que
 *     quedó. La evidencia de homonimia se destruye justo antes de usarse.
 * Río abajo: `asistente/page.tsx:341` hace `pacienteId = existente.id` sin
 * preguntar; mismo motor en `public/booking:245` y `whatsapp/webhook:127`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Equipo rojo, RT-001 (`crudos/R-ataques-propios.json`), ejecutando el motor
 * real con jiti. Salida literal de su corrida:
 *   A homonima con tel vs expediente SIN tel  => FUNDE con e1 (tel=sin telefono)
 *   B homonimos con telefonos distintos       => crea expediente nuevo
 *   C uno sin tel + otro con otro tel         => FUNDE con e1 (tel=sin telefono)
 *   E Juan Perez hijo vs Juan Perez padre     => FUNDE con papa (tel=sin telefono)
 * REG-039 (CLOSED) cerró el caso ESPEJO —reserva SIN teléfono contra homónimo
 * CON teléfono— y `pacientes-duplicados.test.ts:408` prueba a propósito la
 * regla general «si al existente le falta el teléfono, se funde» con la lectura
 * del paciente que vuelve y ahora sí da su número. La segunda lectura de la
 * misma regla (el homónimo) y el caso C no tienen ni prueba ni declaración.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Dos cosas: la contradicción de teléfono se trata como RUIDO que se descarta
 * (`continue`) en vez de como EVIDENCIA de homonimia que debe contar en el
 * desempate; y un solo candidato sin teléfono funde con el puntaje mínimo (60)
 * sin exigir una segunda señal (fecha de nacimiento o edad).
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * El propio módulo (:412-437): «fundir con quien no es … no se ve como un
 * error: se ve como un paciente que vino a consulta. Por eso ante la duda se
 * CREA. Siempre.» clinical-safety §6: se pregunta, no se adivina. CLAUDE.md:
 * UN PACIENTE · UNA IDENTIDAD · UN EXPEDIENTE.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO, motor puro real. La salida segura es `null` (crear nuevo; el
 * llamador es quien pregunta). Se prueba AL REVÉS con dos controles que deben
 * seguir en verde tras la reparación: la reserva con una segunda señal que
 * coincide (misma fecha de nacimiento) SÍ puede fundir, y dos homónimos con
 * teléfonos que se contradicen entre sí ya crean nuevo hoy (caso B).
 *
 * NOTA: el caso «un solo candidato sin teléfono» CONTRADICE a propósito la
 * prueba de `pacientes-duplicados.test.ts:408`. La reparación tiene que
 * reescribir esa prueba con una segunda señal, no borrarla. Si el dueño decide
 * seguir fundiendo por nombre a secas, la alternativa que da RT-001 es marcar
 * la cita «expediente elegido por nombre» y enseñarlo antes de dictar — eso ya
 * no se prueba aquí.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre el duplicado con el orden de los nombres cambiado y sin teléfono en
 * común (`candidatos.ts:38-41`, hueco de REG-347). No cubre el emparejamiento
 * del bot con nombre de menos de 4 caracteres (RT-008), que es otro camino. No
 * comprueba que el llamador (`asistente/page.tsx`) PREGUNTE al recibir `null`:
 * eso es la pantalla, y hoy ya crea nuevo cuando el motor devuelve `null`.
 */
import { describe, it, expect } from 'vitest'
import { elegirExpedienteParaCita, compararPacientes } from '@/lib/pacientes/duplicados'

/** Reserva sintética: llega desde el asistente con nombre y celular. */
const RESERVA_JUAN = { nombre: 'Juan Perez Ramirez', telefono: '5551112233' }

describe('REP-080 · un homónimo con teléfono no se cuelga del expediente sin teléfono', () => {
  it('control: el motor reconoce el homónimo sólo por nombre, con el puntaje mínimo (60)', () => {
    const r = compararPacientes(RESERVA_JUAN, { id: 'papa', nombre: 'Juan Pérez Ramírez', telefono: '', edad: 68 })
    expect(r).not.toBeNull()
    expect(r!.puntaje).toBe(60)
    expect(r!.certeza).toBe('probable')
  })

  it('HOY FALLA · caso A: un solo expediente homónimo SIN teléfono no funde con la reserva que trae celular', () => {
    const existentes = [{ id: 'papa', nombre: 'Juan Pérez Ramírez', telefono: '', edad: 68 }]
    const r = elegirExpedienteParaCita(RESERVA_JUAN, existentes)
    expect(r, `fundió con «${r?.nombre}» (id ${r?.id}) sólo por el nombre y sin ninguna segunda señal`).toBeNull()
  })

  it('HOY FALLA · caso C: dos homónimos —uno sin teléfono, otro con teléfono contradictorio— no funde con el que quedó', () => {
    const existentes = [
      { id: 'e1', nombre: 'María García López', telefono: '' },
      { id: 'e2', nombre: 'Maria Garcia Lopez', telefono: '5559998877' },
    ]
    const r = elegirExpedienteParaCita({ nombre: 'Maria Garcia Lopez', telefono: '5551112233' }, existentes)
    expect(r, `hay dos Marías en el directorio y fundió con «${r?.id}»: la contradicción de e2 se tiró antes del desempate`).toBeNull()
  })

  it('control (caso B, resiste hoy): dos homónimos con teléfonos que contradicen a la reserva → crea nuevo', () => {
    const existentes = [
      { id: 'e1', nombre: 'María García López', telefono: '5557770001' },
      { id: 'e2', nombre: 'Maria Garcia Lopez', telefono: '5559998877' },
    ]
    expect(elegirExpedienteParaCita({ nombre: 'Maria Garcia Lopez', telefono: '5551112233' }, existentes)).toBeNull()
  })

  it('probada al revés: con una segunda señal que coincide (misma fecha de nacimiento) SÍ puede fundir', () => {
    // El paciente que vuelve y ahora sí da su número: caso real y frecuente que
    // la reparación no debe romper. Aquí la identidad la sostiene la fecha, no
    // el nombre a secas.
    const existentes = [{ id: 'p1', nombre: 'Ana Ruiz Peña', telefono: '', fechaNacimiento: '1980-03-15' }]
    const r = elegirExpedienteParaCita(
      { nombre: 'Ana Ruiz Peña', telefono: '5557778899', fechaNacimiento: '1980-03-15' },
      existentes,
    )
    expect(r?.id).toBe('p1')
  })

  it('probada al revés: el mismo teléfono en los dos lados sigue fundiendo', () => {
    const existentes = [{ id: 'p1', nombre: 'Ana Ruiz Peña', telefono: '5557778899' }]
    expect(elegirExpedienteParaCita({ nombre: 'Ana Ruiz Peña', telefono: '5557778899' }, existentes)?.id).toBe('p1')
  })
})
