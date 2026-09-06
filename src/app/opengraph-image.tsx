/**
 * Imagen OG/Twitter (1200×630) generada on-brand con next/og.
 *
 * ── POR QUÉ ESTE ARCHIVO NO PUEDE HABLAR EL SISTEMA DE DISEÑO ───────────────
 *
 * Esta imagen NO la pinta un navegador: la pinta `satori`, en el runtime edge,
 * sin hoja de estilo y sin `:root`. **No existen las variables CSS.** Un
 * `var(--nexus)` aquí no cae a un color de respaldo: `satori` lo normaliza a
 * `background: initial`, no sabe interpretarlo y **lanza**. La ruta devolvía
 * 500 y, con ella, todo enlace de Ausculta compartido por WhatsApp, LinkedIn,
 * Slack o Twitter salía **sin previsualización**.
 *
 * Lo encontró mirar el otro lado —`curl /opengraph-image` → 500—, no leer el
 * código: leído, `COBALT = 'var(--nexus)'` parecía exactamente lo correcto, que
 * es lo que lo hizo sobrevivir. Es la regla «el dato tiene que LLEGAR» aplicada
 * a un píxel: el destinatario de este color no es un navegador.
 *
 * Por eso los valores van **literales y con su origen anotado**. Son el tema
 * OSCURO del sistema (la tarjeta social siempre se compone sobre ink), copiados
 * de `globals.css`. Si el acento cambia allí, hay que cambiarlo aquí — y lo
 * vigila `src/__tests__/la-tarjeta-social-se-puede-pintar.test.ts`, que compara
 * estos literales contra los tokens y falla si se separan.
 */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Ausculta — la nota queda hecha, y se sabe de dónde salió cada frase.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* Literales del tema oscuro de globals.css. NO usar var() — ver cabecera. */
const INK = '#0B0C0E'        /* --bg    */
const COBALT = '#2AA5B5'     /* --nexus */
const TEXT = '#F2EFE9'       /* --text  */
const MUTED = '#9BA3AE'      /* --text2 */
const HALO = 'rgba(42,165,181,0.10)'   /* --nexus a 10 %  */
const TRAZO = 'rgba(42,165,181,0.34)'  /* --nexus-borde   */

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: INK, padding: '64px 72px 68px',
          fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        {/* Halo de marca */}
        <div style={{ position: 'absolute', top: -280, right: -260, width: 860, height: 860, borderRadius: 860, background: HALO, display: 'flex' }} />

        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: COBALT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 16, border: `3px solid ${INK}`, display: 'flex' }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: TEXT, letterSpacing: -0.5 }}>Ausculta</div>
        </div>

        {/* Titular */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 62, fontWeight: 600, color: TEXT, letterSpacing: -2, lineHeight: 1.05, maxWidth: 920 }}>
            Sal de la consulta con la nota hecha.
          </div>
          <div style={{ fontSize: 29, color: MUTED, maxWidth: 860, lineHeight: 1.35 }}>
            Ausculta escucha la consulta, escribe la nota y enseña de dónde salió cada frase. Tú revisas y firmas.
          </div>
        </div>

        {/* Pie: lo que hace, en el orden en que ocurre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['Escucha', 'Redacta', 'Avisa antes de firmar', 'Da seguimiento'].map((t) => (
            <div key={t} style={{ display: 'flex', fontSize: 22, color: COBALT, border: `1px solid ${TRAZO}`, borderRadius: 999, padding: '8px 18px' }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
