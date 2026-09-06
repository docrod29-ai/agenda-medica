/**
 * LA ESPERA DE LA PUERTA — un hueco con la FORMA de lo que va a llegar.
 *
 * ── QUÉ HABÍA ───────────────────────────────────────────────────────────────
 *
 * Las dos puertas del producto —`/login` y `/registro`— tenían tres esperas y
 * las tres eran huecos:
 *
 *   · el `fallback` del `Suspense`, en las dos: `<div>` negro de alto de
 *     pantalla, literalmente nada;
 *   · la comprobación de sesión de `/login`: un aspa girando en medio de la
 *     nada, sin decir qué se está esperando.
 *
 * Las tres terminaban con el formulario apareciendo de golpe. Y la del
 * `Suspense` es la que ve el usuario con la conexión mala, que es exactamente
 * quien menos tolera una pantalla en negro: no distingue «cargando» de «se
 * rompió», y recarga.
 *
 * ── LA DECISIÓN ─────────────────────────────────────────────────────────────
 *
 * El hueco ocupa **el mismo sitio** que el formulario real: misma columna,
 * mismo bloque de marca, mismas alturas de campo. Cuando el formulario llega,
 * llega en su sitio y no empuja nada — que es la mitad del trabajo de un
 * esqueleto y la que casi nunca se hace.
 *
 * Y **dice qué está pasando**. «Comprobando tu sesión…» cuando es eso;
 * «Preparando el acceso…» cuando aún no se sabe. Un aspa sin contexto obliga a
 * adivinar si el problema es la red, la cuenta o la aplicación.
 *
 * `role="status"` + `aria-busy`: quien no ve la pantalla se entera igual. Un
 * esqueleto silencioso es, para un lector de pantalla, una página vacía.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No pone tope de tiempo. Si la comprobación de sesión no termina nunca, esto
 * gira para siempre — decir «esto está tardando de más, reintenta» exige saber
 * cuánto es de más, y ese umbral no está medido. Queda declarado.
 */
import { Loader2 } from 'lucide-react'
import { MarcaAusculta } from '@/components/MarcaAusculta'

export function EsperaDeLaPuerta({ comprobando = false }: { comprobando?: boolean }) {
  return (
    <main className="nx-puerta" aria-busy="true">
      <div className="nx-puerta-columna">
        <div className="nx-puerta-marca">
          <span className="nx-puerta-volver">
            <span className="nx-puerta-sello"><MarcaAusculta size={28} /></span>
            <span className="nx-display nx-puerta-nombre">Ausculta</span>
          </span>
        </div>
        <div className="nx-puerta-tarjeta">
          <p role="status" className="nx-puerta-espera">
            <Loader2 size={15} aria-hidden="true" className="nx-gira" />
            {comprobando ? 'Comprobando tu sesión…' : 'Preparando el acceso…'}
          </p>
          {/* Las alturas son las del formulario real: 48 el botón de Google,
              14 el separador, 44 cada campo, 48 la acción. Un esqueleto con
              medidas inventadas hace justo lo que viene a evitar. */}
          <span className="skeleton nx-puerta-hueso" style={{ height: 48 }} />
          <span className="skeleton nx-puerta-hueso" style={{ height: 14, width: '38%' }} />
          <span className="skeleton nx-puerta-hueso" style={{ height: 44 }} />
          <span className="skeleton nx-puerta-hueso" style={{ height: 44 }} />
          <span className="skeleton nx-puerta-hueso" style={{ height: 48 }} />
        </div>
      </div>
    </main>
  )
}
