import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guardián ESTÁTICO de firestore.rules (sin emulador). Fija las invariantes de
 * seguridad que un cambio accidental no debe romper: aislamiento por tenant,
 * inmutabilidad de notas firmadas (NOM-024), append-only del audit_log, secretos
 * solo Admin SDK, y default-deny. Hallazgo del panel (Ingeniería): "suite de reglas
 * cubriendo aislamiento de tenant e inmutabilidad".
 */
const reglas = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
const sinComentarios = reglas.replace(/\/\/[^\n]*/g, '')

describe('firestore.rules — invariantes de seguridad', () => {
  it('default-deny: el catch-all niega todo', () => {
    expect(reglas).toContain('match /{document=**}')
    expect(sinComentarios).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/)
  })

  it('aislamiento por tenant: isMember compara la clínica del miembro', () => {
    expect(sinComentarios).toContain('function isMember(clinicId)')
    expect(sinComentarios).toMatch(/memberClinicId\(\)\s*==\s*clinicId/)
  })

  it('notas firmadas son INMUTABLES (update y delete lo exigen)', () => {
    const ocurrencias = (sinComentarios.match(/estado != 'firmada'/g) || []).length
    expect(ocurrencias).toBeGreaterThanOrEqual(2) // al menos en update y delete
  })

  it('audit_log NO se escribe desde el cliente (solo Admin SDK) y es inmutable', () => {
    // Antes bastaba con que update y delete estuvieran cerrados. Ahora también el
    // create: la bitácora se escribe por /api/auditoria/registrar, que pone la
    // identidad desde el ID-token y la hora del servidor. Con `create: if isMember`
    // cualquier miembro podía fabricar entradas a nombre de otro médico.
    expect(sinComentarios).toMatch(/audit_log\/\{docId\}\s*\{[\s\S]{0,160}allow create, update, delete: if false;/)
  })

  it('audit_log solo lo lee personal clínico', () => {
    // No contiene notas, pero sí patientId/notaId: revela a quién se atendió.
    expect(sinComentarios).toMatch(/audit_log\/\{docId\}\s*\{\s*allow read: if isMedico\(clinicId\);/)
  })

  it('REGRESIÓN: la excepción por campo de config exige pertenecer a la clínica', () => {
    // Al bloquear la firma por campo, la segunda rama del || quedó sin isMember y
    // CUALQUIER usuario autenticado podía sobrescribir la config de cualquier
    // consultorio. El paréntesis importa.
    expect(sinComentarios).toMatch(/allow update: if isMedico\(clinicId\)\s*\|\|\s*\(isMember\(clinicId\)/)
  })

  it('secretos solo Admin SDK (nada del cliente)', () => {
    expect(sinComentarios).toMatch(/secretos\/\{docId\}\s*\{\s*allow read, write: if false;/)
  })

  /**
   * E0-09 — invariantes del episodio hospitalario que YA rigen hoy y no deben
   * aflojarse. Ojo con lo que este bloque NO afirma: no exige todavía
   * `signos update: if false`. Cerrar ese `update` REVIERTE una política escrita
   * a propósito en las reglas ("enfermería corrige en el sitio", auditoría
   * maestra 2026-07) y es la pregunta Q5 al médico dueño. Cuando la responda,
   * aquí se añade la aserción de aceptación de E0-09.
   */
  it('E0-09: el doc de internamiento NO se escribe desde el cliente (todo por el gateway)', () => {
    expect(sinComentarios).toMatch(
      /match \/internamientos\/\{intId\}\s*\{[\s\S]{0,200}allow create, update, delete: if false;/,
    )
  })

  it('E0-09: un registro de signos vitales NO se borra desde el cliente', () => {
    expect(sinComentarios).toMatch(/match \/signos\/\{signoId\}\s*\{[\s\S]{0,400}allow delete: if false;/)
  })

  it('E0-09-Q5: y TAMPOCO se sobreescribe — las medidas son inmutables', () => {
    /**
     * La regla decía «AÑADEN (create) y CORRIGEN (update)», describiendo un
     * modelo de corrección que la aplicación abandonó: desde el 29-jul-2026,
     * corregir es ANEXAR otro documento con `corrigeA`.
     *
     * Mientras el `update` siguió abierto, la garantía estaba sólo en el código:
     * quien tuviera rol clínico podía abrir la consola del navegador y
     * sobreescribir una SpO₂ sin cadena de corrección, sin motivo y sin rastro.
     *
     * Se cierra con la misma forma ya aceptada para `icu_observations`: el
     * `update` sólo puede tocar el campo de ciclo de vida.
     */
    const bloque = sinComentarios.match(/match \/signos\/\{signoId\}\s*\{([\s\S]*?)\n\s*\}/)
    expect(bloque, 'no se encontró el bloque de signos').not.toBeNull()
    const cuerpo = bloque![1]
    expect(cuerpo).toContain('allow read, create: if isClinicoHospital(clinicId);')
    expect(cuerpo).toMatch(/allow update:[\s\S]*affectedKeys\(\)\.hasOnly\(\['estadoObservacion'\]\)/)
    // Y que no quede la forma vieja, que permitía tocarlo todo.
    expect(cuerpo).not.toContain('allow read, create, update: if isClinicoHospital(clinicId);')
  })

  it('E0-09: el libro append-only `registros` no es escribible por el cliente', () => {
    // Hoy no tiene bloque propio y cae en el catch-all (deny). Si algún día se
    // declara —para poder LEER el historial de correcciones—, la escritura debe
    // seguir siendo exclusiva del Admin SDK.
    const bloque = sinComentarios.match(/match \/registros\/\{[^}]*\}\s*\{([\s\S]*?)\n\s*\}/)
    if (bloque) expect(bloque[1]).toMatch(/allow create, update, delete: if false;/)
    else expect(sinComentarios).not.toContain('match /registros/')
  })

  /**
   * E0-06 — el PHI clínico del paciente vive en su propia subcolección porque
   * Firestore NO autoriza por campo: mientras `alergias` sea un campo de
   * `patients/{docId}` (que es `isMember`), recepción lo lee y ninguna regla lo
   * impide. Aquí se fija el bloque nuevo y, sobre todo, lo que NO debe cambiar.
   */
  it('E0-06: el resumen clínico del paciente solo lo lee personal médico', () => {
    expect(sinComentarios).toMatch(
      /match \/clinico\/\{clinicoId\}\s*\{\s*allow read: if isMedico\(clinicId\);/,
    )
  })

  it('E0-06: el resumen clínico no se borra desde el cliente', () => {
    expect(sinComentarios).toMatch(
      /match \/clinico\/\{clinicoId\}\s*\{[\s\S]{0,300}allow delete: if false;/,
    )
  })

  it('E0-06 REGRESIÓN: recepción SIGUE leyendo el directorio de pacientes', () => {
    // La aceptación pide «lee cita, no lee nota ni alergias». Cerrar el documento
    // administrativo del paciente rompería agendar (nombre y teléfono) y sería una
    // regresión peor que el hueco que se cierra.
    expect(sinComentarios).toMatch(/match \/patients\/\{docId\}\s*\{\s*allow read: if isMember\(clinicId\);/)
  })

  it('E0-06 REGRESIÓN: notas, laboratorios y fotos siguen bajo isMedico', () => {
    expect(sinComentarios).toMatch(/match \/notas\/\{notaId\}\s*\{\s*allow read: if isMedico\(clinicId\);/)
    expect(sinComentarios).toMatch(/match \/laboratorios\/\{labId\}\s*\{\s*allow read: if isMedico\(clinicId\);/)
    expect(sinComentarios).toMatch(/match \/fotos\/\{fotoId\}\s*\{\s*allow read, create, update, delete: if isMedico\(clinicId\);/)
  })

  it('NINGÚN write/update/delete es públicamente abierto (if true)', () => {
    // 'create: if true' está permitido SOLO para colecciones públicas (ARCO/portal);
    // pero write/update/delete jamás deben ser 'if true'.
    expect(sinComentarios).not.toMatch(/allow[^;\n]*\b(write|update|delete)\b[^;\n]*: if true/)
    expect(sinComentarios).not.toMatch(/allow read, write: if true/)
  })
})

describe('ICU-002d · reglas de las colecciones de UCI', () => {
  /**
   * Congela lo que las reglas PROMETEN, no que existan.
   *
   * Las reglas de Firestore son ADITIVAS: una regla más permisiva GANA sobre una
   * estricta (lección REG-014, donde la firma médica seguía leíble porque la
   * regla genérica de `config` no excluía el documento). Por eso el primer caso
   * comprueba que ninguna regla más amplia alcance estas rutas.
   */
  const crudo = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')

  /**
   * Reglas SIN comentarios.
   *
   * Mi primera versión de estos casos contaba `{document=**}` sobre el archivo
   * crudo y encontró DOS — pero el segundo era un comentario que yo mismo había
   * escrito explicando el comodín. Un guardián que lee prosa no está leyendo
   * reglas.
   */
  const reglas = crudo.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  /**
   * Cuerpo de un `match`, contando llaves.
   *
   * `indexOf('}')` no sirve: cierra en la llave del comodín (`{stayId}`), no en
   * la del bloque, y el caso pasa/falla leyendo una línea suelta.
   */
  const bloqueDe = (nombre: string): string => {
    const i = reglas.indexOf(`match /${nombre}/`)
    if (i === -1) return ''
    // La llave que ABRE el bloque es la ÚLTIMA de la línea del `match`, no la
    // primera: `match /icu_stays/{stayId} {` tiene dos, y empezar a contar en la
    // del comodín cierra el bloque en `}` de `{stayId}`.
    const finLinea = reglas.indexOf('\n', i)
    const apertura = reglas.lastIndexOf('{', finLinea)
    let nivel = 0
    for (let j = apertura; j < reglas.length; j++) {
      if (reglas[j] === '{') nivel++
      else if (reglas[j] === '}') { nivel--; if (nivel === 0) return reglas.slice(i, j + 1) }
    }
    return ''
  }

  it('ninguna regla COMODÍN alcanza las colecciones nuevas', () => {
    // El único `{document=**}` REAL del archivo debe ser el deny total del final.
    const comodines = [...reglas.matchAll(/match \/\{[a-zA-Z]+=\*\*\}/g)]
    expect(comodines).toHaveLength(1)
    const iComodin = reglas.indexOf('match /{document=**}')
    expect(reglas.slice(iComodin, iComodin + 120)).toContain('allow read, write: if false')
  })

  it.each(['icu_stays', 'bed_assignments'])('`%s` existe y sólo permite LEER', (coleccion) => {
    const bloque = bloqueDe(coleccion)
    expect(bloque, `no existe la regla de ${coleccion}`).not.toBe('')
    expect(bloque).toMatch(/allow read: if isClinicoHospital\(clinicId\)/)
    expect(bloque).toMatch(/allow create, update, delete: if false/)
  })

  it('la ESCRITURA de las dos va por el servidor, nunca por el cliente', () => {
    // Un cliente que escribiera directo tendría RBAC de vista, no real: puede
    // abrir la consola del navegador y usar el SDK.
    for (const c of ['icu_stays', 'bed_assignments']) {
      expect(bloqueDe(c), `${c} permite escritura desde el cliente`)
        .not.toMatch(/allow [^:]*(create|update|write)[^:]*:\s*if\s+is/)
    }
  })

  it('BORRAR una asignación de cama está cerrado — es la trazabilidad', () => {
    // Borrar destruiría quién ocupó qué cama y cuándo, que es justo lo que esta
    // colección vino a crear.
    expect(bloqueDe('bed_assignments')).toContain('delete: if false')
  })

  it('las dos están DECLARADAS en la matriz de acceso', () => {
    // Si la regla existe pero la matriz no la conoce, la suite del emulador no
    // genera sus casos cross-tenant y el aislamiento queda sin probar.
    const matriz = readFileSync(resolve(process.cwd(), 'src/lib/authz/matriz-acceso.ts'), 'utf8')
    expect(matriz).toContain('internamientos/{intId}/icu_stays/{stayId}')
    expect(matriz).toContain('internamientos/{intId}/bed_assignments/{asigId}')
  })

  it('la matriz declara ESCRITURA POR SERVIDOR para las dos', () => {
    const matriz = readFileSync(resolve(process.cwd(), 'src/lib/authz/matriz-acceso.ts'), 'utf8')
    for (const ruta of ['icu_stays/{stayId}', 'bed_assignments/{asigId}']) {
      const i = matriz.indexOf(ruta)
      const entrada = matriz.slice(i, i + 500)
      expect(entrada, `${ruta} no declara guardaEscritura servidor`).toContain("guardaEscritura: 'servidor'")
    }
  })
})
