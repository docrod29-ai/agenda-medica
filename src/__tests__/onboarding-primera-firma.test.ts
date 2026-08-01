/**
 * UN MÉDICO NUEVO TIENE QUE PODER FIRMAR SU PRIMERA NOTA.
 *
 * ── EL DEFECTO (PRACTICE-GA-001, hallazgo P0-1 corregido) ────────────────────
 *
 * `validarNOM004` mete «Falta cédula profesional del médico» como **error**, y la
 * pantalla de consulta apaga el botón de Firmar cuando hay errores. Pero
 * `DEFAULT_CONFIG.cedulaProfesional` nace en `''` y el alta nunca la pedía.
 *
 * Resultado: todo médico que se daba de alta llegaba a su primera consulta —con
 * un paciente enfrente— y encontraba el botón de Firmar muerto, con un renglón
 * rojo que no dice a dónde ir a arreglarlo. Es el peor momento posible para una
 * traba, y era el estado de fábrica del producto.
 *
 * El arreglo NO fue relajar la validación: la cédula es un requisito legal de la
 * NOM-004 y quitarla dejaría notas inválidas. Fue **conseguir el dato**: se pide
 * en el alta (opcional, misma pantalla, sin pasos) y, si no está, la propia nota
 * ofrece un campo para escribirla ahí mismo.
 *
 * Estas pruebas fijan las dos mitades: que sin cédula SIGUE bloqueando (o la nota
 * sería inválida) y que con cédula el bloqueo desaparece.
 */
import { describe, it, expect } from 'vitest'
import { validarNOM004 } from '@/lib/expediente/nom004'
import { seccionesVacias } from '@/lib/expediente/templates'
import type { NotaMedica } from '@/types/expediente'

/** Nota mínima COMPLETA salvo por lo que cada prueba quiera romper. */
function notaBase(cedulaProfesional: string): NotaMedica {
  return {
    metadata: {
      id: 'nota_1',
      tipoNota: 'primera_vez',
      clinicId: 'clinic_1',
      pacienteId: 'pac_1',
      medicoId: 'uid_1',
      cedulaProfesional,
      especialidad: 'Medicina Interna',
      establecimiento: 'Consultorio de prueba',
      fechaCreacion: '2026-07-31T10:00:00.000Z',
      fechaModificacion: '2026-07-31T10:00:00.000Z',
      hashIntegridad: '',
      version: 1,
      estado: 'borrador',
      fuenteGeneracion: 'manual',
    },
    fechaConsulta: '2026-07-31T10:00:00.000Z',
    paciente: { nombre: 'Paciente Sintético', edad: 40, sexo: 'M' },
    resumenEjecutivo: '',
    /**
     * Las secciones salen de la PLANTILLA REAL, no de una lista escrita a mano.
     *
     * Se usa `seccionesVacias`, la MISMA que llama la pantalla de consulta. Un
     * fixture propio se queda viejo en cuanto alguien añada una sección
     * obligatoria a `primera_vez`, y entonces esta prueba seguiría en verde
     * mientras el médico nuevo se topa con un error más — que es justo el fallo
     * que la tercera prueba existe para cazar.
     */
    secciones: seccionesVacias('primera_vez').map(s => ({ ...s, value: 'Contenido sintético de prueba' })),
    diagnosticos: [{ descripcion: 'Diagnóstico sintético', tipo: 'definitivo', estado: 'activo' }],
    medicamentos: [],
    alergias: [{ alergeno: 'Niega alergias' }],
  } as unknown as NotaMedica
}

describe('la primera nota de un médico nuevo', () => {
  it('SIN cédula queda bloqueada — y debe seguir así', () => {
    // No se relaja: una nota sin cédula es inválida para la NOM-004. Lo que se
    // arregló es de dónde sale el dato, no la regla.
    const r = validarNOM004(notaBase(''))
    expect(r.valida).toBe(false)
    expect(r.errores.join(' ')).toMatch(/cédula/i)
  })

  it('CON cédula deja de estar bloqueada por ese motivo', () => {
    // Es lo que pasa ahora: la cédula llega del alta, o el médico la escribe en
    // el rescate de un clic que aparece dentro de la propia nota.
    const r = validarNOM004(notaBase('1234567'))
    expect(r.errores.join(' ')).not.toMatch(/cédula/i)
    expect(r.valida).toBe(true)
  })

  it('la cédula es el ÚNICO error administrativo: lo demás se arregla escribiendo la nota', () => {
    /**
     * Importa para el diseño del rescate. Si mañana apareciera otro error que el
     * médico no pueda resolver escribiendo —otro dato de configuración— el
     * botón volvería a nacer muerto y el rescate de la cédula no lo salvaría.
     *
     * Con la nota completa y la cédula puesta, la lista de errores tiene que
     * quedar VACÍA. Si esta prueba se rompe, alguien añadió un requisito
     * administrativo nuevo y hay que darle su propio rescate.
     */
    expect(validarNOM004(notaBase('1234567')).errores).toEqual([])
  })
})
