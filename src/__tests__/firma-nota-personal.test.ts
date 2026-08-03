/**
 * GOLDEN — la nota se firma con la identidad de la persona, y el snapshot no nace vacío.
 *
 * ── DOS FALLOS EN EL MISMO BLOQUE, DE LA AUDITORÍA MAYOR ─────────────────────
 *
 * **1. La identidad era la del consultorio.** `nota.firma` se estampaba con
 * `config.nombreMedico`, `config.cedulaProfesional` y `config.especialidad` —
 * campos de nivel clínica—. Y `nota.firma` es el **snapshot inmutable**: en un
 * consultorio con dos médicos, cada nota que firmaba la Dra. quedaba **congelada
 * para siempre** con el nombre y la cédula del dueño.
 *
 * Es peor que la adenda (v933): aquí no se corrige después, porque la nota
 * firmada es inmutable por diseño y por reglas.
 *
 * Y la compuerta miraba el campo equivocado **en los dos sentidos**: exigía
 * `config.cedulaProfesional`, así que dejaba firmar a la Dra. con la cédula del
 * dueño, y bloqueaba a un médico que sí tuviera la suya si la clínica no la había
 * llenado.
 *
 * **2. El snapshot de la firma gráfica nacía vacío.** REG-014 movió la firma a
 * `config/firma` y la **borra** de `config/main`; esta pantalla seguía leyendo
 * `config.firmaImagenDataUrl`, que desde entonces es `undefined`. Al imprimir se
 * caía a la firma **viva**, así que cambiar la firma reimprimía las notas viejas
 * con la nueva — justo lo contrario de lo que el snapshot existe para garantizar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const s = readFileSync(
  join(process.cwd(), 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'), 'utf8')

describe('la nota se firma con la persona', () => {
  it('el sello usa la identidad resuelta, no la de la clínica', () => {
    expect(s).toContain('nombreMedico: identidadFirma.nombre')
    expect(s).toContain('cedulaProfesional: identidadFirma.cedula')
    expect(s).toContain('especialidad: identidadFirma.especialidad')
  })

  it('el médico se resuelve por uid y, si no, por correo, sin adivinar', () => {
    expect(s).toContain('activeDoctors.filter(d => d.uid === uid)')
    expect(s).toContain('porCorreo.length === 1 ? porCorreo[0] : undefined')
  })

  it('con VARIOS médicos no se cae a la cédula del consultorio', () => {
    // Estampar la cédula de otro en un documento inmutable es peor que no poder
    // firmar.
    expect(s).toContain("cedula: medicoEnSesion.cedulaProfesional || (unico ? (config?.cedulaProfesional ?? '') : '')")
  })

  it('con UN médico se conserva el comportamiento de siempre', () => {
    // La del consultorio ES la suya: bloquear ahí sería romper a quien ya
    // trabajaba bien.
    expect(s).toContain('const unico = activeDoctors.length <= 1')
    expect(s).toContain('resuelta: unico')
  })
})

describe('la compuerta mira la cédula EFECTIVA', () => {
  it('no deja firmar si no se sabe quién firma', () => {
    expect(s).toContain('if (!identidadFirma.resuelta)')
    expect(s).toContain('No se pudo identificar con qué médico estás firmando')
  })

  it('y si falta la cédula, dice CUÁL falta', () => {
    // «Agrega tu cédula» a secas manda al médico a Configuración General, donde
    // la de la clínica ya estaba llena: el mensaje tiene que decir que es la SUYA.
    expect(s).toContain('if (!identidadFirma.cedula.trim())')
    expect(s).toContain('Agrega TU cédula profesional en Configuración → Médicos')
  })

  it('ya no exige la de la clínica', () => {
    expect(s).not.toContain("if (!config?.cedulaProfesional) {\n      toast('Agrega tu cédula profesional en Configuración → General', 'error')")
  })
})

describe('el snapshot de la firma gráfica ya no nace vacío', () => {
  it('se lee del subdocumento protegido, no de `config/main`', () => {
    expect(s).toContain('useFirmaProtegida(clinicId, config ?? undefined)')
    expect(s).toContain('firmaProtegida.firmaPorMedico?.[medicoEnSesion.id]')
  })

  it('con varios médicos no se estampa la firma global', () => {
    // Sería la de otro, congelada para siempre.
    expect(s).toContain('activeDoctors.length <= 1 ? firmaProtegida.firmaImagenDataUrl : undefined')
  })

  it('ya no lee el campo que REG-014 borra', () => {
    expect(s).not.toContain('imagenDataUrl: config.firmaImagenDataUrl')
  })
})
