/**
 * EL ENLACE DE LA VIDEOCONSULTA VIAJA CON SU TOKEN — V9 · REG-292.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-265 cerró medio problema. `/api/telesalud/sala` exige prueba de
 * titularidad y responde **404 «Cita no encontrada»** a quien no la trae; el
 * botón del portal no llevaba token, así que el paciente veía que su cita no
 * existía, en su propio portal, a la hora de su consulta.
 *
 * Aquella reparación arregló el portal y dejó el camino de **WhatsApp** a
 * medias, a propósito: `dondeEsLaCita` dejó de emitir enlace sin token y pasó a
 * escribir «recibirás el enlace por este medio». Honesto —un 404 es peor que un
 * aviso— pero **el paciente seguía sin enlace**, y el recordatorio de WhatsApp
 * es justo donde le hace falta: es el mensaje que abre media hora antes de la
 * consulta, con prisa, desde el teléfono.
 *
 * Los tres llamadores de servidor —el recordatorio del cron y las dos
 * confirmaciones del bot— no pasaban `tokenPaciente` porque **nadie lo
 * acuñaba**.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `PATIENT-UX-TRUTH-001` (V9) lo dejó anotado como el P0 que quedaba abierto
 * tras cerrar REG-265, con los tres sitios y su plan escrito.
 *
 * ── LA FAMILIA ──────────────────────────────────────────────────────────────
 *
 * «El dato tiene que LLEGAR». El módulo que compone el mensaje estaba bien y su
 * prueba de contrato pasaba: comprobaba que **dijera** lo acordado. Lo que no
 * comprobaba nadie es que al otro lado —el mensaje que recibe el paciente—
 * llegara un enlace utilizable. Por eso esta prueba mira también a los
 * **llamadores**, no sólo al módulo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **El plazo se deriva de la cita.** Un plazo fijo se equivoca en los dos
 *    sentidos: corto caduca antes de la cita y devuelve el 404 que veníamos a
 *    evitar; largo deja una credencial del paciente viva en un chat que se
 *    reenvía a un grupo familiar. Nunca se emite un token que muera antes de la
 *    cita, y nunca uno para una cita más allá del techo.
 * 2. **Alcance `agenda`, el mínimo.** La sala no mira el alcance: comprueba que
 *    el token sea de ESE paciente y de ESA clínica. Pedir alcance `clinico`
 *    para entrar a una videollamada sería mandar por WhatsApp una credencial
 *    que abre el expediente.
 * 3. **Se firma en el servidor.** El módulo no lo importa `lib/whatsapp.ts`,
 *    que también se carga en el navegador: firmar ahí filtraría el secreto.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No manda un mensaje de verdad.** Comprueba que los llamadores pasan el
 *   token y que el token que se acuña es válido para esa cita; no que Meta
 *   entregue el WhatsApp ni que la sala de Daily se cree.
 * - **No mira la zona horaria de la clínica.** El plazo la ignora a propósito:
 *   una hora de desfase la absorbe el margen, y meter zonas en el cálculo de
 *   una caducidad añade una forma de equivocarse sin ganar nada.
 * - **Sólo cubre los tres llamadores de SERVIDOR.** Si mañana aparece un cuarto
 *   sitio que componga el mensaje, esta prueba no lo conoce — pero el guardián
 *   de más abajo cuenta los llamadores de `dondeEsLaCita` y falla si aparece
 *   uno nuevo sin token.
 * - **Nadie ha recibido el mensaje.** No se ha mandado un WhatsApp real ni se
 *   ha abierto la sala desde un teléfono: eso exige credenciales del dueño.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  tokenParaLaSala, diasHastaLaCita, DIAS_TECHO, DIAS_DE_MARGEN,
} from '@/lib/telesalud/token-de-la-sala'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { dondeEsLaCita, SIN_ENLACE } from '@/lib/telesalud/donde-es'

/**
 * Instante de referencia en hora LOCAL, no en Z. El módulo interpreta
 * `'YYYY-MM-DD HH:mm'` como hora local (lo dice y explica por qué), así que
 * mezclar aquí un instante UTC haría que esta prueba pasara o fallara según la
 * zona de la máquina — que es justo el tipo de prueba que no sirve.
 */
const AHORA = new Date('2026-08-09T10:00:00')
/** Suma días a `'YYYY-MM-DD'` sin pasar por UTC. */
const masDias = (dias: number) => {
  const d = new Date(AHORA.getFullYear(), AHORA.getMonth(), AHORA.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const sinVersion = async () => 0

describe('el enlace de la videoconsulta viaja con su token (REG-292)', () => {
  describe('el plazo se deriva de la cita, no es una constante', () => {
    it('cuenta los días hacia arriba: media jornada cuenta como un día', () => {
      // Redondear hacia abajo mataría el token la mañana de la cita.
      expect(diasHastaLaCita('2026-08-09 22:00', AHORA)).toBe(1)
      expect(diasHastaLaCita('2026-08-10 10:00', AHORA)).toBe(1)
      expect(diasHastaLaCita('2026-08-11 09:00', AHORA)).toBe(2)
    })

    it('una cita ya pasada da 0, no un negativo', () => {
      expect(diasHastaLaCita('2026-08-01 09:00', AHORA)).toBe(0)
    })

    it('una fecha ilegible no se convierte en un plazo inventado', () => {
      expect(Number.isNaN(diasHastaLaCita('mañana por la tarde', AHORA))).toBe(true)
    })

    it('el token SIEMPRE sobrevive a su cita', async () => {
      // A la misma hora que `AHORA`, para que «días de calendario» y «días
      // exactos» coincidan y el caso mida lo que dice medir.
      for (const dias of [0, 1, 2, DIAS_TECHO]) {
        const fechaHora = `${masDias(dias)} 10:00`
        const token = await tokenParaLaSala(
          { clinicId: 'c1', patientId: 'p1', fechaHora, ahora: AHORA }, sinVersion)
        expect(token, `cita a ${dias} días`).toBeTruthy()

        // Se comprueba en el instante de la cita, no en el de emisión.
        const payload = JSON.parse(
          Buffer.from(token!.split('.')[0], 'base64url').toString('utf8')) as { e: number }
        expect(payload.e * 1000, `cita a ${dias} días caduca antes de la cita`)
          .toBeGreaterThan(Date.parse(fechaHora.replace(' ', 'T')))
      }
    })

    it('AL REVÉS: un plazo fijo de 1 día habría muerto antes de una cita a 3 días', () => {
      // Ésta es la comprobación que justifica que el plazo se derive. Si deja de
      // fallar es que el margen dejó de hacer falta, y entonces sobra el módulo.
      const cita = Date.parse('2026-08-12T18:00:00')
      const caducidadFija = AHORA.getTime() + 1 * 86_400_000
      expect(caducidadFija).toBeLessThan(cita)
    })
  })

  describe('el techo protege el chat que se reenvía', () => {
    it('una cita más allá del techo NO lleva token', async () => {
      const token = await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: `${masDias(DIAS_TECHO + 1)} 09:00`, ahora: AHORA },
        sinVersion)
      expect(token).toBeUndefined()
    })

    it('y sin token el mensaje DICE que el enlace llega aparte, no manda un 404', () => {
      // Es la mitad que ya existía (REG-265) y que aquí no se rompe.
      const lugar = dondeEsLaCita({
        tipo: 'teleconsulta', citaId: 'a1', clinicId: 'c1',
        baseUrl: 'https://x.test', tokenPaciente: undefined,
      })
      expect(lugar.esVideo).toBe(true)
      expect(lugar.lineas.join('\n')).toContain(SIN_ENLACE)
      expect(lugar.lineas.join('\n')).not.toContain('/teleconsulta/')
    })

    it('el techo se cuenta en días EXACTOS, no de calendario', async () => {
      // Consecuencia real del redondeo hacia arriba, y se prueba para que no
      // sorprenda: una cita a tres noches vista PERO más tarde que ahora son
      // 3,3 días → 4 → fuera del techo. El recordatorio de 24 h la alcanzará.
      const mismaHora = await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: `${masDias(DIAS_TECHO)} 10:00`, ahora: AHORA }, sinVersion)
      const masTarde = await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: `${masDias(DIAS_TECHO)} 18:00`, ahora: AHORA }, sinVersion)
      expect(mismaHora).toBeTruthy()
      expect(masTarde).toBeUndefined()
    })

    it('el techo y el margen son coherentes: el margen nunca es 0', () => {
      expect(DIAS_DE_MARGEN).toBeGreaterThanOrEqual(1)
      expect(DIAS_TECHO).toBeGreaterThanOrEqual(1)
    })
  })

  describe('el token que se acuña sirve para lo que la sala comprueba', () => {
    it('lleva la clínica y el paciente de ESA cita, y alcance mínimo', async () => {
      const token = await tokenParaLaSala(
        { clinicId: 'clinica-9', patientId: 'pac-7', fechaHora: '2026-08-10 09:00', ahora: AHORA }, sinVersion)
      const v = verificarTokenPaciente(token)
      expect(v).not.toBeNull()
      expect(v!.clinicId).toBe('clinica-9')
      expect(v!.patientId).toBe('pac-7')
      // La sala no mira el alcance; se pide el mínimo igualmente. Alcance
      // `clinico` por WhatsApp sería una credencial que abre el expediente.
      expect(v!.alcance).toBe('agenda')
    })

    it('nace con la versión de revocación del expediente', async () => {
      const token = await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: '2026-08-10 09:00', ahora: AHORA },
        async () => 4)
      expect(verificarTokenPaciente(token)!.version).toBe(4)
    })

    it('si la versión no se puede leer se emite la 0, no se deja al paciente sin enlace', async () => {
      // Fallar aquí sería reintroducir el defecto por un problema nuestro. La
      // revocación posterior lo corta igual: el contador del expediente sube.
      const token = await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: '2026-08-10 09:00', ahora: AHORA },
        async () => { throw new Error('firestore caído') })
      expect(verificarTokenPaciente(token)!.version).toBe(0)
    })

    it('sin paciente no se inventa un token', async () => {
      expect(await tokenParaLaSala(
        { clinicId: 'c1', patientId: '', fechaHora: '2026-08-10 09:00', ahora: AHORA }, sinVersion)).toBeUndefined()
      expect(await tokenParaLaSala(
        { clinicId: '', patientId: 'p1', fechaHora: '2026-08-10 09:00', ahora: AHORA }, sinVersion)).toBeUndefined()
      expect(await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: undefined, ahora: AHORA }, sinVersion)).toBeUndefined()
    })

    it('y con él, el mensaje lleva un enlace con `t=`', async () => {
      const token = await tokenParaLaSala(
        { clinicId: 'c1', patientId: 'p1', fechaHora: '2026-08-10 09:00', ahora: AHORA }, sinVersion)
      const lugar = dondeEsLaCita({
        tipo: 'teleconsulta', citaId: 'cita-1', clinicId: 'c1',
        baseUrl: 'https://x.test', tokenPaciente: token,
      })
      expect(lugar.lineas.join('\n')).toContain('/teleconsulta/cita-1')
      expect(lugar.lineas.join('\n')).toContain('&t=')
      // Y NO la dirección: mandar las dos cosas deja que el paciente elija mal.
      expect(lugar.lineas.join('\n')).not.toContain('📍')
    })
  })

  describe('EL DATO LLEGA: los llamadores lo pasan de verdad', () => {
    const RAIZ = join(__dirname, '..')
    const LLAMADORES = [
      'app/api/cron/reminders/route.ts',
      'app/api/whatsapp/webhook/route.ts',
    ]

    /**
     * Extrae el objeto literal de cada `dondeEsLaCita({...})` casando llaves.
     *
     * Contar apariciones sueltas de `tokenPaciente` en el archivo NO sirve, y se
     * comprobó: al quitar el paso del dato dejando la variable declarada, el
     * recuento seguía cuadrando y la prueba pasaba. Una prueba que no puede
     * fallar no es una prueba. Hay que mirar DENTRO de la llamada.
     */
    function argumentosDeCada(src: string): string[] {
      const args: string[] = []
      const marca = 'dondeEsLaCita({'
      let i = src.indexOf(marca)
      while (i !== -1) {
        let prof = 0
        let j = i + marca.length - 1
        for (; j < src.length; j++) {
          if (src[j] === '{') prof++
          else if (src[j] === '}') { prof--; if (prof === 0) break }
        }
        args.push(src.slice(i, j + 1))
        i = src.indexOf(marca, j)
      }
      return args
    }

    it('todo sitio que compone el mensaje pasa `tokenPaciente` DENTRO de la llamada', () => {
      // Esto es lo que ninguna prueba de contrato veía: el módulo decía lo
      // acordado y el llamador no le daba con qué.
      let total = 0
      for (const rel of LLAMADORES) {
        const args = argumentosDeCada(readFileSync(join(RAIZ, rel), 'utf8'))
        expect(args.length, `${rel} ya no llama a dondeEsLaCita`).toBeGreaterThan(0)
        args.forEach((arg, n) => {
          expect(arg, `${rel}, llamada ${n + 1}: compone el mensaje sin token`)
            .toContain('tokenPaciente')
        })
        total += args.length
      }
      // Los tres llamadores de servidor que encontró la auditoría.
      expect(total).toBeGreaterThanOrEqual(3)
    })

    it('AL REVÉS: el extractor SÍ ve una llamada sin token', () => {
      // Prueba del instrumento, no del código: si el extractor se rompiera, la
      // comprobación de arriba pasaría siempre y no lo sabría nadie.
      const falso = 'const x = dondeEsLaCita({ tipo: t, citaId: c, clinicId: k })'
      const args = argumentosDeCada(falso)
      expect(args).toHaveLength(1)
      expect(args[0]).not.toContain('tokenPaciente')
    })

    it('el secreto no baja al navegador: `lib/whatsapp.ts` no firma', () => {
      // `lib/whatsapp.ts` se importa también desde el cliente. Si algún día
      // acuña tokens ahí, el secreto HMAC que firma los enlaces del paciente
      // viaja en el paquete del navegador.
      const src = readFileSync(join(RAIZ, 'lib/whatsapp.ts'), 'utf8')
      expect(src).not.toContain('crearTokenPaciente')
      expect(src).not.toContain('token-de-la-sala')
    })

    it('el módulo del token no arrastra Firestore: la lectura se inyecta', () => {
      // Si importara adminDb no podría probarse sin credenciales, y entonces
      // esta prueba no existiría.
      const src = readFileSync(join(RAIZ, 'lib/telesalud/token-de-la-sala.ts'), 'utf8')
      expect(src).not.toContain('firebase-admin')
      expect(src).not.toContain('adminDb')
    })
  })
})
