'use client'
/**
 * EL HÉROE — la consulta en tres tiempos, no una captura de pantalla.
 *
 * ── QUÉ HABÍA ───────────────────────────────────────────────────────────────
 *
 * Píldora + titular + subtítulo + dos botones + captura del producto. Es la
 * forma exacta que tienen decenas de miles de portadas, y no enseña nada:
 * una captura de una agenda dice «esto tiene una agenda», que es lo que ya
 * suponías. La promesa de Ausculta —salir de la consulta con la nota hecha, y
 * poder rastrear cada frase hasta el segundo en que se dijo— **no se ve en
 * ninguna captura**, porque no es una pantalla: es un mecanismo.
 *
 * ── QUÉ ENSEÑA ESTO ─────────────────────────────────────────────────────────
 *
 * Los tres tiempos que separan a este producto de un editor de notas:
 *
 *   1 · SE OYE      lo que se dijo, tal cual, con quién lo dijo
 *   2 · SE ENTIENDE  lo afirmado y lo NEGADO, lo de hoy y lo de antes
 *   3 · SE ESCRIBE   la nota — y cada frase conserva de dónde salió
 *
 * El paso 2 es el argumento entero. Que «no ha tenido fiebre» acabe como
 * *niega fiebre* y no como *fiebre* es la diferencia entre una nota y una nota
 * en la que se puede confiar; y es lo que ningún dictado genérico hace. Por eso
 * la negación va marcada como negación, en su propio color, con su propio
 * rótulo — no escondida en un párrafo.
 *
 * El paso 3 lleva la marca de procedencia visible (`0:41`). Es la promesa
 * medicolegal del producto, y aquí se ve antes de crear una cuenta.
 *
 * ── EL MOVIMIENTO, Y POR QUÉ NO LO GOBIERNA JAVASCRIPT ──────────────────────
 *
 * Tres tiempos, uno detrás de otro, **una sola vez**. No es decoración: es el
 * orden causal. Si los tres aparecieran juntos, el usuario vería tres cajas;
 * apareciendo en orden, ve un proceso — que es lo que hay que entender en cinco
 * segundos.
 *
 * No hay bucle. Una animación que se repite en la portada compite con la
 * lectura durante todo el tiempo que el usuario esté ahí, y en una página que
 * también quiere que leas un precio eso es ruido.
 *
 * **La secuencia entera vive en CSS** (`@keyframes nx-acto`, con `animation-
 * delay` por acto y `animation-fill-mode: both`). La primera versión la llevaba
 * un `useState` con tres temporizadores, y tenía el riesgo que `Revelar`
 * documenta: un estado inicial oculto que depende de que el JavaScript llegue a
 * quitarlo. Con animación de CSS ese riesgo **no existe** — una animación de CSS
 * termina aunque el paquete de JavaScript nunca cargue, aunque falle la
 * hidratación y aunque el componente se desmonte. El héroe no puede quedarse en
 * blanco.
 *
 * De paso, el componente deja de tener estado: no hay renderizados en cascada,
 * y la secuencia corre en el compositor en vez de en el hilo principal, que es
 * justo lo que se quiere en la primera pantalla.
 *
 * `prefers-reduced-motion` lo resuelve el bloque explícito de `globals.css`:
 * el apagador global de §24 anula la DURACIÓN pero no el RETRASO, así que ahí
 * se declara a mano el estado final. Ver la nota al pie de la hoja.
 *
 * ── EL DATO ES FICTICIO Y SE DICE ───────────────────────────────────────────
 *
 * Paciente sintético. La regla de datos de este repositorio prohíbe pacientes
 * reales en cualquier superficie, y una portada es la más pública de todas. El
 * rótulo lo declara en pantalla, no sólo en este comentario.
 */
import Link from 'next/link'
import { ArrowRight, Mic, Play } from 'lucide-react'

/** Lo que se oye. Paciente sintético — ver cabecera. */
const DICHO = [
  { quien: 'Paciente', texto: 'Doctor, llevo tres días con tos y me falta el aire al subir las escaleras.' },
  { quien: 'Paciente', texto: 'Fiebre no he tenido. Sigo con el losartán de siempre.' },
]

/**
 * Lo que se entiende. `clase` gobierna el color, y los tres valores son
 * SEMÁNTICA, no adorno: afirmado / negado / continúa. La negación tiene cara
 * propia porque es el error que más caro sale.
 */
const ENTENDIDO = [
  { clase: 'afirma', rotulo: 'Refiere', valor: 'Tos · 3 días' },
  { clase: 'afirma', rotulo: 'Refiere', valor: 'Disnea de esfuerzo' },
  { clase: 'niega', rotulo: 'Niega', valor: 'Fiebre' },
  { clase: 'sigue', rotulo: 'Continúa', valor: 'Losartán' },
]

export function HeroConsulta() {
  return (
    <section className="nx-hero">
      <div className="nx-hero-dicho">
        <h1 className="nx-display nx-hero-titulo">
          Sal de la consulta<br />
          con la nota <span className="nx-hero-hecha">hecha</span>.
        </h1>

        <p className="nx-hero-bajada">
          Ausculta escucha la consulta, distingue lo que el paciente afirma de lo
          que niega y deja la nota escrita. Cada frase guarda el segundo del
          dictado del que salió. Tú revisas, corriges y firmas.
        </p>

        <div className="nx-hero-acciones">
          <Link href="/registro" className="btn btn-primary btn-lg">
            Empezar gratis <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/demo" className="btn btn-secondary btn-lg">
            <Play size={15} aria-hidden="true" /> Ver el producto
          </Link>
        </div>

        {/* La promesa comercial va DESPUÉS de la acción, no antes del titular.
            Arriba era una píldora más entre el usuario y la primera frase de la
            página; aquí resuelve la duda justo cuando aparece: «¿me va a pedir
            la tarjeta?». Lo mismo con el enlace de sesión, que es el atajo del
            que ya es cliente y no compite con la conversión. */}
        <p className="nx-hero-pie">
          <span className="nx-hero-punto" aria-hidden="true" />
          14 días gratis · sin tarjeta
          <span className="nx-hero-sep" aria-hidden="true">·</span>
          <Link href="/login" className="nx-enlace-tactil nx-hero-enlace">Ya tengo cuenta</Link>
        </p>
      </div>

      {/* LA COMPOSICIÓN. `aria-hidden` no: se lee, y se lee en orden. */}
      <figure className="nx-hero-obra">
        <figcaption className="nx-hero-obra-pie">
          Cómo trabaja Ausculta · paciente ficticio
        </figcaption>

        {/* 1 · SE OYE */}
        <div className="nx-hero-acto" data-acto="1" style={{ ['--nx-acto' as string]: '0' }}>
          <p className="nx-hero-acto-rotulo">
            {/* `nx-escucha` es el latido de «el micrófono está abierto» que ya
                existía en el sistema (opacidad, 2,4 s, nunca tamaño: nada se
                mueve de sitio). Al retirar `ProductWindow` se quedó sin quien
                lo llevara, y una regla sin portador es la misma deuda que un
                módulo sin conectar. Aquí vuelve a significar lo que significa. */}
            <span className="nx-escucha" style={{ display: 'inline-flex' }}>
              <Mic size={13} aria-hidden="true" />
            </span>
            Se oye
          </p>
          <div className="nx-hero-onda" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} style={{ ['--nx-i' as string]: `${i}` }} />
            ))}
          </div>
          {DICHO.map(d => (
            <p key={d.texto} className="nx-hero-frase">
              <span className="nx-hero-quien">{d.quien}</span>
              {d.texto}
            </p>
          ))}
        </div>

        {/* 2 · SE ENTIENDE */}
        <div className="nx-hero-acto" data-acto="2" style={{ ['--nx-acto' as string]: '1' }}>
          <p className="nx-hero-acto-rotulo">Se entiende</p>
          <ul className="nx-hero-hechos">
            {ENTENDIDO.map((h, i) => (
              <li key={h.valor} className="nx-hero-hecho" data-clase={h.clase} style={{ ['--nx-orden' as string]: `${i}` }}>
                <span className="nx-hero-hecho-rotulo">{h.rotulo}</span>
                <span className="nx-hero-hecho-valor">{h.valor}</span>
              </li>
            ))}
          </ul>
          <p className="nx-hero-nota-al-pie">
            «Fiebre no he tenido» queda como <strong>niega fiebre</strong> — no como fiebre.
          </p>
        </div>

        {/* 3 · SE ESCRIBE */}
        <div className="nx-hero-acto" data-acto="3" style={{ ['--nx-acto' as string]: '2' }}>
          <p className="nx-hero-acto-rotulo">Se escribe</p>
          <p className="nx-hero-seccion">Padecimiento actual</p>
          <p className="nx-hero-redactado">
            Tos de tres días de evolución acompañada de disnea de esfuerzo.
            <mark className="nx-hero-procedencia">
              Niega fiebre.
              <span className="nx-hero-sello">0:41</span>
            </mark>{' '}
            Continúa con losartán.
          </p>
          <p className="nx-hero-nota-al-pie">
            Toca una frase y oyes el segundo del dictado del que salió.
          </p>
        </div>
      </figure>
    </section>
  )
}
