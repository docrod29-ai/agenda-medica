#!/usr/bin/env node
/**
 * SIEMBRA EL RECORRIDO DE RESERVA DEL PACIENTE — sobre el consultorio sintético.
 *
 * `scripts/design/sembrar-emulador.mjs` deja un consultorio con médica,
 * pacientes y citas, pero su `config/main` no lleva `horario` por día ni
 * `publicBookingEnabled`. Sin esas dos cosas `getDaySchedule` devuelve `null`
 * y el portal público no ofrece un solo hueco — o sea, el recorrido que este
 * carril tiene que probar no existe.
 *
 * Esto NO reescribe aquel sembrador: lo COMPLETA. Aquél sirve al arnés visual
 * V10 y no es de este carril.
 *
 * Cero pacientes reales: el consultorio es el mismo inventado de allí.
 *
 * Uso:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/carril-excelencia/sembrar-reserva.mjs
 */
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const PROYECTO = process.env.GOOGLE_CLOUD_PROJECT || 'demo-nexusmed-v10'
const CLINICA = 'consultorio-demo-v10'

/** Los siete días abiertos de 09:00 a 19:00, con hora de comida. */
const dia = (activo) => ({
  mapValue: { fields: {
    activo: { booleanValue: activo },
    inicio: { stringValue: '09:00' },
    fin: { stringValue: '19:00' },
    descansos: { arrayValue: { values: [
      { mapValue: { fields: { inicio: { stringValue: '14:00' }, fin: { stringValue: '15:00' } } } },
    ] } },
  } },
})

const campos = {
  publicBookingEnabled: { booleanValue: true },
  intervaloMinutos: { integerValue: '30' },
  duraciones: { mapValue: { fields: {
    'primera-vez': { integerValue: '45' },
    seguimiento: { integerValue: '30' },
    urgente: { integerValue: '30' },
    procedimiento: { integerValue: '60' },
  } } },
  horario: { mapValue: { fields: {
    lunes: dia(true), martes: dia(true), miercoles: dia(true),
    jueves: dia(true), viernes: dia(true), sabado: dia(true),
    domingo: dia(false),   // cerrado: hace falta un día CERRADO para probarlo
  } } },
  // Un festivo recurrente (`MM-DD`): la Navidad de cualquier año.
  diasFestivos: { arrayValue: { values: [{ stringValue: '12-25' }] } },
}

const url = `http://${HOST}/v1/projects/${PROYECTO}/databases/(default)/documents/clinics/${CLINICA}/config/main`
const mascara = Object.keys(campos).map(k => `updateMask.fieldPaths=${k}`).join('&')
const res = await fetch(`${url}?${mascara}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ fields: campos }),
})
if (!res.ok) {
  console.error('✗ no se pudo sembrar:', res.status, (await res.text()).slice(0, 400))
  process.exit(1)
}
console.log(`✓ ${CLINICA}: reservas públicas abiertas, L-S 09:00-19:00 (comida 14-15), domingo cerrado, 25-dic festivo`)
