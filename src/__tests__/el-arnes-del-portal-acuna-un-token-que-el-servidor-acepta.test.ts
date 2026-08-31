/**
 * EL TOKEN QUE ACUÑA EL ARNÉS TIENE QUE VALERLE AL SERVIDOR.
 *
 * QUÉ FALLABA (y qué habría fallado en silencio)
 * ───────────────────────────────────────────────
 * El portal del paciente (`/mi/[token]`) no entra con la sesión del equipo:
 * entra con un token HMAC. Para medirlo, los arneses de este carril acuñan uno
 * por su cuenta, repitiendo el cálculo de `src/lib/patient-token.ts`.
 *
 * Un token que el servidor RECHAZA no rompe el arnés: el navegador aterriza en
 * la pantalla de «enlace no válido» —que tiene muy pocos controles y todos
 * bien— y el arnés publica un **cero tranquilizador**. El portal quedaría
 * declarado medido y verde sin haberse mirado nunca.
 *
 * CÓMO SE DESCUBRIÓ
 * ──────────────────
 * Al llevar el portal a un SEGUNDO arnés (el de estaticidad), la opción cómoda
 * era copiar el acuñado que ya vivía dentro de `trinquete-de-interfaz.mjs`.
 * Dos copias de un cálculo de firma divergen en cuanto alguien ajusta una: el
 * día que el payload cambie —una versión, un alcance, un campo más— la copia
 * olvidada seguiría acuñando algo que el servidor no acepta. Se extrajo a
 * `scripts/carril-excelencia/token-del-portal.mjs`, y este caso ata esa única
 * fuente al verificador de verdad.
 *
 * CAUSA RAÍZ
 * ───────────
 * Un contrato repetido a mano en dos sitios, sin nadie que comprobara que el
 * destinatario lo acepta. Es la regla «el dato tiene que LLEGAR»: comprobar que
 * el emisor DICE lo acordado no comprueba que el receptor lo ADMITA.
 *
 * LA REGLA QUE LO HACE SEGURO
 * ────────────────────────────
 * El token del arnés se valida con `verificarTokenPaciente`, que es
 * exactamente la función que corre en el servidor — no con una reimplementación
 * del chequeo.
 *
 * QUÉ *NO* CUBRE ESTE CASO
 * ─────────────────────────
 * - **No comprueba que el paciente `pac-001` exista** en el consultorio
 *   sembrado. Un token válido de un paciente inexistente sigue llevando a una
 *   pantalla vacía, y eso lo tiene que ver el arnés en el navegador.
 * - No mide nada del portal: ni controles, ni contraste, ni solapes.
 * - No comprueba el alcance `clinico` — el arnés mide a propósito el enlace de
 *   mostrador, que es el que recibe un paciente de verdad.
 * - No prueba la caducidad real de 30 días, sólo que el token nace vigente.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verificarTokenPaciente } from '@/lib/patient-token'
import {
  tokenDelPortal,
  claveDeRuta,
  esPortal,
  CLAVE_PORTAL,
} from '../../scripts/carril-excelencia/token-del-portal.mjs'

/**
 * EL SECRETO SE FIJA AQUÍ, A PROPÓSITO.
 *
 * `getSecret()` PREFIERE la variable de entorno. Si esta prueba dependiera de
 * que nadie la hubiera exportado, se pondría roja en la terminal de quien sí la
 * exporta para medir el portal — que es justo lo que hay que hacer. Ya pasó una
 * vez con `portal-alcance.test.ts`. Se fija en los dos lados de la frontera.
 */
const SECRETO = 'secreto-de-prueba-suficientemente-largo-0123456789'

beforeEach(() => { vi.stubEnv('PORTAL_PACIENTE_SECRET', SECRETO) })
afterEach(() => { vi.unstubAllEnvs() })

describe('el token que acuña el arnés del portal', () => {
  it('lo acepta el verificador del servidor', () => {
    const t = tokenDelPortal()
    expect(t).not.toBeNull()

    const v = verificarTokenPaciente(t)
    expect(v).not.toBeNull()
    expect(v!.clinicId).toBe('consultorio-demo-v10')
    expect(v!.patientId).toBe('pac-001')
  })

  it('nace con alcance de mostrador, no con secreto médico dentro', () => {
    // Medir el portal con un enlace clínico sería medir una pantalla que casi
    // ningún paciente recibe — y pasear una credencial con expediente dentro.
    expect(verificarTokenPaciente(tokenDelPortal())!.alcance).toBe('agenda')
  })

  it('nace vigente y no caducado', () => {
    const t = tokenDelPortal()!
    const payload = JSON.parse(
      Buffer.from(t.split('.')[0], 'base64url').toString('utf8'),
    )
    expect(payload.e).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('sin secreto no acuña nada — y entonces el portal NO se mide', () => {
    // Devolver un token con un secreto de relleno sería peor que no medir:
    // el arnés mediría la pantalla de enlace inválido creyendo que es el portal.
    vi.stubEnv('PORTAL_PACIENTE_SECRET', '')
    expect(tokenDelPortal()).toBeNull()
    vi.stubEnv('PORTAL_PACIENTE_SECRET', 'corto')
    expect(tokenDelPortal()).toBeNull()
  })

  it('el techo del portal se guarda con clave estable, no con la URL', () => {
    // El token lleva caducidad: la URL cambia en cada corrida. Guardar la ruta
    // literal dejaría un techo nuevo cada vez y ninguno comparable.
    const t = tokenDelPortal()!
    expect(esPortal(`/mi/${t}`)).toBe(true)
    expect(claveDeRuta(`/mi/${t}`)).toBe(CLAVE_PORTAL)
    expect(claveDeRuta('/citas')).toBe('/citas')

    const otra = tokenDelPortal()!
    expect(claveDeRuta(`/mi/${otra}`)).toBe(claveDeRuta(`/mi/${t}`))
  })
})
