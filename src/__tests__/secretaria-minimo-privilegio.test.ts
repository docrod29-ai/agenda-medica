/**
 * GOLDEN PATH 11 — la asistente puede operar el mostrador sin entrar al secreto
 * médico. Se demuestra en tres capas que ya existen: capacidades de servidor,
 * permisos de UX y Firestore Rules. No se crea un sistema paralelo de roles.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { capacidadesDe, tieneCapacidad } from '@/lib/authz/capabilities'
import { permisosPorRol } from '@/lib/permissions'

const reglas = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')

describe('GP11 — secretaria trabaja el mostrador con mínimo privilegio', () => {
  it('puede gestionar agenda, mensajería, cobro y facturación', () => {
    expect(capacidadesDe('secretaria')).toEqual(expect.arrayContaining([
      'agenda.gestionar',
      'mensajeria.enviar',
      'cobrar',
      'facturar',
      'auditoria.registrar',
    ]))
    expect(permisosPorRol('secretaria')).toMatchObject({
      verAgenda: true,
      editarAgenda: true,
      verFinanzas: true,
      cobrarPagos: true,
    })
  })

  it('no obtiene ninguna capacidad clínica, de firma o prescripción', () => {
    for (const capacidad of ['clinico.leer', 'clinico.escribir', 'firmar', 'prescribir'] as const) {
      expect(tieneCapacidad('secretaria', capacidad)).toBe(false)
    }
    expect(permisosPorRol('secretaria')).toMatchObject({
      verExpediente: false,
      editarExpediente: false,
      firmarNota: false,
    })
  })

  it('tampoco puede destruir agenda ni administrar la clínica', () => {
    expect(tieneCapacidad('secretaria', 'agenda.destruir')).toBe(false)
    expect(tieneCapacidad('secretaria', 'administrar')).toBe(false)
  })
})

describe('GP11 — el borde de datos niega notas clínicas a la secretaria', () => {
  it('isMedico excluye explícitamente a secretaria', () => {
    const inicio = reglas.indexOf('function isMedico(clinicId)')
    const fin = reglas.indexOf('function isClinicoHospital', inicio)
    const bloque = reglas.slice(inicio, fin)
    expect(inicio).toBeGreaterThan(-1)
    expect(bloque).toContain("role == 'medico'")
    expect(bloque).toContain("role == 'admin'")
    expect(bloque).not.toContain("role == 'secretaria'")
  })

  it('las notas del expediente se leen y escriben sólo detrás de isMedico', () => {
    const inicio = reglas.indexOf('match /notas/{notaId}')
    const fin = reglas.indexOf('match /versions/{versionId}', inicio)
    const bloque = reglas.slice(inicio, fin)
    expect(inicio).toBeGreaterThan(-1)
    expect(bloque).toContain('allow read: if isMedico(clinicId)')
    expect(bloque).toContain('allow create: if isMedico(clinicId)')
    expect(bloque).toContain('allow update: if isMedico(clinicId)')
    expect(bloque).toContain('allow delete: if isMedico(clinicId)')
    expect(bloque).not.toContain('isMember(clinicId)')
  })
})

describe('GP11 — rol ausente o desconocido falla cerrado en autorización real', () => {
  it('no recibe capacidades por defecto', () => {
    expect(capacidadesDe(undefined)).toEqual([])
    expect(capacidadesDe('rol-inventado')).toEqual([])
  })
})
