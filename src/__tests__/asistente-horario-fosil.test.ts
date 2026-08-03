/**
 * GOLDEN — la pantalla que agenda usa el mismo horario que el servidor que valida.
 *
 * ── EL FALLO, DE LA AUDITORÍA DE LANZAMIENTO ─────────────────────────────────
 *
 * `/asistente` es la puerta principal para agendar. Construía su configuración
 * efectiva así:
 *
 *     horario: doctor.horario ?? config.horario
 *
 * **siempre**. Y esa copia en `doctors/{id}` es un FÓSIL: se escribe al dar de
 * alta al médico y no se vuelve a tocar. `configParaMedico` —lo que usan el modal
 * de citas y la ruta que da de alta— sólo la respeta si el médico tiene
 * `horarioPropio` marcado.
 *
 * O sea que la pantalla calculaba los huecos contra un horario que el consultorio
 * ya no tiene, y el servidor validaba contra el vigente. Dos formas de fallar:
 *
 *  · ofrecer un hueco que el servidor rechaza con un **409 sin explicación**;
 *  · **esconder** huecos que sí estaban libres.
 *
 * Y `duraciones` salía del mismo fósil y viajaba en el POST: una segunda vía para
 * el mismo 409.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configParaMedico, POR_QUE_MANDA_EL_CONSULTORIO } from '@/lib/horario-medico'
import type { ClinicConfig } from '@/types'

const CLINICA = {
  horario: { lunes: { activo: true, inicio: '09:00', fin: '14:00' } },
  duraciones: { consulta: 30 },
  intervaloMinutos: 15,
  zonaHoraria: 'America/Mexico_City',
} as unknown as ClinicConfig

describe('el criterio compartido', () => {
  it('sin `horarioPropio`, manda el horario del CONSULTORIO', () => {
    // Es el caso normal: la copia del médico es un fósil de cuando se le dio de
    // alta, y el consultorio sí se puede editar desde Configuración.
    const medico = { horario: { lunes: { activo: true, inicio: '07:00', fin: '11:00' } } }
    expect(configParaMedico(CLINICA, medico as never).horario).toEqual(CLINICA.horario)
  })

  it('con `horarioPropio`, manda el del médico', () => {
    const medico = {
      horarioPropio: true,
      horario: { lunes: { activo: true, inicio: '07:00', fin: '11:00' } },
    }
    expect(configParaMedico(CLINICA, medico as never).horario).toEqual(medico.horario)
  })

  it('sin médico, la del consultorio tal cual', () => {
    expect(configParaMedico(CLINICA, null)).toEqual(CLINICA)
    expect(configParaMedico(CLINICA, undefined)).toEqual(CLINICA)
  })

  it('y está explicado por qué', () => {
    expect(POR_QUE_MANDA_EL_CONSULTORIO).toMatch(/fósil/)
  })
})

describe('las tres vías que agendan usan el MISMO criterio', () => {
  const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

  it('el asistente (era el que fallaba)', () => {
    const s = leer('src', 'app', '(dashboard)', 'asistente', 'page.tsx')
    expect(s).toContain('configParaMedico(config, activeDoctors.find(d => d.id === doctorId))')
    // Ya no queda el `??` crudo que se saltaba `horarioPropio`.
    expect(s).not.toContain('horario: doctor.horario ?? config.horario')
  })

  it('el modal de citas', () => {
    expect(leer('src', 'components', 'AppointmentModal.tsx')).toContain('configParaMedico(')
  })

  it('y la ruta que da de alta, que es la que valida', () => {
    expect(leer('src', 'app', 'api', 'appointments', 'route.ts')).toContain('configParaMedico(')
  })

  it('no queda ningún `horario ??` crudo en el CÓDIGO', () => {
    /**
     * Era el último. Si vuelve a aparecer, vuelve el 409 sin explicación.
     *
     * Se quitan los comentarios antes de mirar: el que documenta este fallo cita
     * la forma vieja a propósito, y una prueba que no distingue el código de su
     * explicación acaba obligando a no explicar nada.
     */
    const sinComentarios = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const f of [
      join('src', 'app', '(dashboard)', 'asistente', 'page.tsx'),
      join('src', 'components', 'AppointmentModal.tsx'),
    ]) {
      const codigo = sinComentarios(readFileSync(join(process.cwd(), f), 'utf8'))
      expect(codigo, f).not.toMatch(/\.horario\s*\?\?\s*config\.horario/)
    }
  })
})
