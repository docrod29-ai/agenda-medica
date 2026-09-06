'use client'
/**
 * LA PORTADA — reescrita porque contaba el producto equivocado.
 *
 * ── QUÉ CONTABA, MEDIDO EN EL NAVEGADOR ─────────────────────────────────────
 *
 * Capturas de referencia en `docs/audit/ausculta-transformacion/antes/`.
 * Titular: «El consultorio, conectado». Bajada: «Agenda, expediente, recetas y
 * cobros en una sola herramienta». Y las seis funciones, EN ESTE ORDEN:
 *
 *     Agenda inteligente · Bot de WhatsApp · Recordatorios automáticos ·
 *     Lista de espera · Portal de asistente · Google Calendar sync
 *
 * Los tres pasos de «cómo funciona» eran: crea tu cuenta → configura tu
 * horario → **comparte tu número de WhatsApp**. Ni una palabra de la voz, de
 * la nota, de la evidencia, de la procedencia ni de los avisos antes de firmar.
 *
 * Ausculta se vendía como un **agendador con bot de WhatsApp**. Eso fue verdad
 * y dejó de serlo: el producto de hoy es el que describe
 * `docs/product/EL-CAMINO-DEL-MEDICO.md`, y su promesa —salir de la consulta
 * con la nota hecha sin dejar de mirar al paciente— **no aparecía en la
 * portada**. Un visitante no podía enterarse de por qué existe este producto.
 *
 * ── DE DÓNDE SALE LA HISTORIA NUEVA ─────────────────────────────────────────
 *
 * De `docs/product/EL-CAMINO-DEL-MEDICO.md`, que ya tenía los siete pasos
 * escritos en lenguaje clínico y con la regresión real que los originó. No se
 * inventó una narrativa de mercadotecnia: se sacó a la superficie la que el
 * repositorio ya sostenía con pruebas. Cada paso de «El recorrido» cita el
 * fallo que lo hizo necesario, porque **el fallo es la prueba de que el paso
 * existe**: cualquiera puede escribir «entiende la negación»; pocos pueden
 * contar en qué caso les falló y qué hicieron.
 *
 * Y las NEGATIVAS —lo que este producto se niega a hacer— salen de la tabla
 * final de ese mismo documento. Es el bloque más distintivo de la página y el
 * único que un competidor no puede copiar sin comprometerse a lo mismo.
 *
 * ── LO QUE SE FUE, Y POR QUÉ NO ES UNA PÉRDIDA ──────────────────────────────
 *
 * · La maqueta de conversación de WhatsApp (360 px de alto con desplazamiento
 *   propio, recortada a media conversación en la captura). El bot sigue
 *   existiendo y sigue contándose — como UNA línea del recorrido, no como la
 *   tercera parte de la portada.
 * · La banda de cifras. «hasta 40 %», «menos», «$0», «5 min»: dos de las cuatro
 *   no eran cifras («menos» no es un dato) y la que sí lo era necesitaba una
 *   nota al pie de tres renglones para no mentir. Su contenido honesto vive
 *   ahora dentro del recorrido y en /evidencia.
 * · Las seis tarjetas idénticas. Ver la nota de sopa de tarjetas en globals.css.
 *
 * ── LO QUE NO SE TOCÓ ───────────────────────────────────────────────────────
 *
 * Los precios siguen derivándose de `PLANES` (`src/lib/planes-ia.ts`): fue una
 * corrección anterior contra la desincronización, y sigue siendo correcta.
 * Ninguna afirmación clínica ni comercial nueva se inventó aquí; las que
 * llevaban respaldo lo conservan y siguen enlazando a /evidencia.
 */
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { MetaPixel } from '@/components/MetaPixel'
import { PLANES } from '@/lib/planes-ia'
import { NavPublica } from '@/components/landing/NavPublica'
import { HeroConsulta } from '@/components/landing/HeroConsulta'
import { Revelar } from '@/components/landing/Revelar'

/* ─── El recorrido ─────────────────────────────────────────────────────────
   Los siete pasos de docs/product/EL-CAMINO-DEL-MEDICO.md, dichos para un
   médico y no para el repositorio, más los dos que cierran el ciclo fuera del
   consultorio. `prueba` es el fallo real que hizo necesario el paso: no es
   adorno, es lo que hace creíble la afirmación de arriba. */
const RECORRIDO = [
  {
    titulo: 'Te oye, y sabe quién habló',
    texto:
      'Grabas la consulta y hablas con naturalidad. Ausculta separa lo que dijo el paciente de lo que dijiste tú.',
    prueba:
      'Cuando no puede separar las voces con seguridad, lo dice y explica por qué — en vez de repartir las frases al azar.',
  },
  {
    titulo: 'Distingue lo que se niega de lo que se afirma',
    texto:
      'Y lo que pasó hace años de lo que pasa hoy. Está hecho para el español que se habla en consulta, no para el que se escribe.',
    prueba:
      'Es donde más veces nos ha fallado el producto: llegamos a cazar 1 de cada 7 formas mexicanas de decir que no. Hoy están cubiertas, y cada una tiene su prueba.',
  },
  {
    titulo: 'Deja vacío lo que nadie dijo',
    texto:
      'Convierte la conversación en datos sin rellenar huecos. Un campo vacío es información; uno inventado es un riesgo con apariencia de dato.',
    prueba:
      'Una vía de administración que nadie dictó llegó una vez a una receta firmada porque el hueco se guardó como dato. No vuelve a pasar, y hay una prueba que lo vigila.',
  },
  {
    titulo: 'Ve al paciente entero, no sólo lo de hoy',
    texto:
      'Los motores de alergias, dosis e interacciones reciben el cuadro completo: lo que el paciente ya toma, las alergias selladas en notas anteriores, y su función renal con la fecha en que se midió.',
    prueba:
      'Un motor de interacciones que sólo ve la receta que estás escribiendo no está comprobando nada.',
  },
  {
    titulo: 'Te avisa antes de firmar, y no de más',
    texto:
      'Una sola barra, tres niveles. Tres cosas nunca se pliegan: alergia a un medicamento, contradicción con lo que el paciente negó, y dosis peligrosa.',
    prueba:
      'Un aviso que estorba se aprende a ignorar, y entonces deja de proteger. Por eso lo demás sí se pliega.',
  },
  {
    titulo: 'Quitar de la nota quita de la nota',
    texto:
      'Corriges lo que quieras y el cambio es real. Y toda corrección automática que Ausculta haga sobre tu dictado es visible y reversible.',
    prueba:
      'Hubo un botón que tachaba el renglón en pantalla mientras el diagnóstico equivocado seguía en la nota que se firmaba. Un control que miente sobre lo que hizo es peor que no tenerlo.',
  },
  {
    titulo: 'Firmas, o sabes exactamente por qué no puedes',
    texto:
      'El botón apagado dice su motivo. La nota firmada queda sellada, alineada a los requisitos aplicables de la NOM-004.',
    prueba:
      'Un botón deshabilitado sin explicación convierte al médico en adivino.',
  },
  {
    titulo: 'La receta y la orden salen contigo',
    texto:
      'Receta con tu membrete, tu firma y un QR de validación. Órdenes de estudios que el paciente se lleva impresas o recibe por WhatsApp.',
    prueba:
      'Y la orden no desaparece al pedirla: Ausculta la sigue hasta que hay resultado, alguien lo revisa y queda escrito qué se decidió.',
  },
  {
    titulo: 'La agenda y el paciente siguen su curso',
    texto:
      'Calendario por día y semana, recordatorios automáticos, lista de espera que avisa al instante cuando alguien cancela, y un portal donde el paciente ve sólo lo que su médico liberó.',
    prueba:
      'El paciente nunca ve un borrador. Firmar la nota y liberar información al paciente son dos actos distintos, y se registran aparte.',
  },
]

/* ─── Las negativas ────────────────────────────────────────────────────────
   De la tabla final de docs/product/EL-CAMINO-DEL-MEDICO.md y de las reglas de
   seguridad clínica del repositorio. Ninguna es una promesa de mercadotecnia:
   las cuatro están escritas como código y tienen guardián. */
const NEGATIVAS = [
  {
    que: 'El modelo de lenguaje no calcula una cifra clínica',
    porque:
      'Escalas, dosis, ajustes por función renal y conversiones de unidades los hace código determinista con pruebas. El modelo redacta y extrae; no decide cuánto.',
  },
  {
    que: 'No rellena un hueco para que la nota se vea completa',
    porque:
      'Si falta un dato, la nota lo enseña vacío. Que no se oyera un antecedente no significa que el paciente lo niegue.',
  },
  {
    que: 'No cambia nada en silencio',
    porque:
      'Cada corrección automática sobre tu dictado se ve y se deshace. El audio original y el texto que tú editaste se guardan los dos.',
  },
  {
    que: 'No inflamos cifras ni inventamos testimonios',
    porque:
      'Ausculta es nuevo. Lo que publicamos está respaldado por evidencia citada o es una oferta real, y las fuentes están enlazadas.',
  },
]

const TAGLINE_PLAN: Record<string, string> = {
  agenda: 'Para empezar a organizar el consultorio',
  clinica: 'Voz, nota con IA, recetas y evidencia',
  premium: 'Máxima inteligencia clínica',
}
const PLANES_PORTADA = (['agenda', 'clinica', 'premium'] as const).map(k => {
  const p = PLANES[k]
  return {
    nombre: p.nombre,
    precio: p.precioMXN.toLocaleString('es-MX'),
    para: TAGLINE_PLAN[k],
    incluye: p.incluye,
    destacado: !!p.destacado,
  }
})

const PREGUNTAS = [
  {
    q: '¿Tengo que cambiar mi forma de dar consulta?',
    a: 'No. Hablas con el paciente como siempre; Ausculta escucha. La diferencia es que al terminar la nota ya está redactada y tú la revisas en vez de escribirla desde cero.',
  },
  {
    q: '¿Qué pasa si entiende mal algo?',
    a: 'Lo corriges y el cambio es real, no cosmético. Además Ausculta marca lo que no oyó con seguridad en vez de adivinar, y cuando hay ambigüedad crítica —una dosis, una unidad, izquierda o derecha— pregunta en lugar de elegir por ti. El audio original se conserva siempre.',
  },
  {
    q: '¿La IA decide algo por mí?',
    a: 'No. Propone, organiza y busca evidencia; tú confirmas. Ninguna receta, orden ni nota se emite sin que tú la firmes, y las escalas y dosis las calcula código con pruebas, no el modelo de lenguaje.',
  },
  {
    q: '¿Necesito saber de tecnología?',
    a: 'No. La configuración toma menos de cinco minutos y no hay nada que instalar: funciona en el navegador de tu computadora y de tu teléfono.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Corren sobre Google Cloud con cifrado en tránsito y en reposo, acceso por roles y aislamiento por consultorio. Estamos activando respaldos con recuperación a un punto en el tiempo y no lo declaramos listo hasta probar una restauración. El estado de cada control está publicado en /seguridad.',
  },
  {
    q: '¿Puedo llevarme mi información?',
    a: 'Sí, y sin pedir permiso. Al cancelar te entregamos la exportación completa de pacientes y expedientes. La información es tuya.',
  },
  {
    q: '¿Qué pasa cuando terminan los 14 días?',
    // Aquí se prometía un aviso por correo «tres días antes» que no existe: no
    // hay canal de correo en el repositorio y ningún cron mira el vencimiento
    // de la prueba (N-005, Panel de Lujo 2026-09, P1). Decisión por omisión
    // PL-D6: la portada dice lo que SÍ pasa —el aviso dentro de la aplicación—;
    // el correo se construye antes de volver a prometerlo (ver handoff-DINERO).
    a: 'Dentro de la aplicación ves cuántos días te quedan. Si continúas, eliges plan y configuras el pago; si no, la cuenta se pausa sin borrar nada. Nunca se bloquea el consultorio entero por falta de tarjeta.',
  },
  {
    q: '¿Sirve para cualquier especialidad?',
    a: 'Sí. Hay además herramientas propias de algunas —infectología, cardiometabólico, pediatría por peso, ginecología— que aparecen sólo cuando el caso las pide.',
  },
]

/* ─── Secciones ────────────────────────────────────────────────────────────── */

function Recorrido() {
  return (
    <section id="recorrido" className="nx-pub-seccion">
      <p className="nx-pub-rotulo">El recorrido</p>
      <h2 className="nx-pub-titulo">De lo que se dice, a la nota firmada</h2>
      <p className="nx-pub-bajada">
        Nueve pasos. Cada uno lleva debajo el fallo real que lo hizo necesario —
        porque cualquiera puede prometer que entiende una negación, y pocos
        pueden contar en qué caso les falló.
      </p>
      <ol className="nx-camino">
        {RECORRIDO.map((p, i) => (
          <li key={p.titulo} className="nx-camino-paso">
            <span className="nx-camino-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="nx-camino-titulo">{p.titulo}</h3>
            <p className="nx-camino-texto">{p.texto}</p>
            {/* Hermana, no anidada: a partir de 1000 px se va a su propia
                columna de la rejilla y la fila pasa a leerse «esto afirmamos |
                esto es lo que nos pasó». Ver globals.css. */}
            <p className="nx-camino-prueba">{p.prueba}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Negativas() {
  return (
    <section className="nx-pub-seccion">
      <p className="nx-pub-rotulo">Los límites</p>
      <h2 className="nx-pub-titulo">Lo que Ausculta se niega a hacer</h2>
      <p className="nx-pub-bajada">
        Una lista de funciones no dice nada de un producto clínico. Estas
        negativas sí, y las cuatro están escritas como código — no como
        promesa.
      </p>
      <div className="nx-negativas">
        {NEGATIVAS.map(n => (
          <div key={n.que} className="nx-negativa">
            <p className="nx-negativa-que">{n.que}</p>
            <p className="nx-negativa-porque">{n.porque}</p>
          </div>
        ))}
      </div>
      <p className="nx-pub-remate">
        <Link href="/seguridad" className="nx-enlace-tactil nx-hero-enlace">
          Cómo protegemos la información clínica
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href="/evidencia" className="nx-enlace-tactil nx-hero-enlace">
          De dónde salen nuestras cifras
        </Link>
      </p>
    </section>
  )
}

function Precios() {
  return (
    <section id="precios" className="nx-pub-seccion">
      <p className="nx-pub-rotulo">Precios</p>
      <h2 className="nx-pub-titulo">14 días gratis, sin tarjeta</h2>
      <p className="nx-pub-bajada">
        Sin contrato ni permanencia. Cancelas desde tu panel y te llevas tu
        información.
      </p>
      <div className="nx-planes">
        {PLANES_PORTADA.map(p => (
          <div key={p.nombre} className="nx-plan" data-destacado={p.destacado}>
            {p.destacado && <span className="nx-plan-cinta">El más elegido</span>}
            <h3 className="nx-plan-nombre">{p.nombre}</h3>
            <p className="nx-plan-para">{p.para}</p>
            <p className="nx-plan-precio">
              <span className="nx-plan-cifra">${p.precio}</span>
              <span className="nx-plan-unidad">MXN al mes</span>
            </p>
            <Link href="/registro" className={`btn ${p.destacado ? 'btn-primary' : 'btn-secondary'} btn-lg`}>
              Empezar gratis
            </Link>
            <ul className="nx-plan-lista">
              {p.incluye.map(f => (
                <li key={f}>
                  <Check size={15} aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="nx-pub-remate">
        Precios antes de IVA; en el pago ves el desglose. Durante la prueba la
        inteligencia clínica viene limitada — el resto del producto, completo.
      </p>
    </section>
  )
}

function Preguntas() {
  const [abierta, setAbierta] = useState<number | null>(null)
  return (
    <section className="nx-pub-seccion nx-pub-seccion--angosta">
      <p className="nx-pub-rotulo">Preguntas</p>
      <h2 className="nx-pub-titulo">Lo que suelen preguntarnos</h2>
      <div className="nx-faq">
        {PREGUNTAS.map((f, i) => {
          const esta = abierta === i
          return (
            <div key={f.q} className="nx-faq-fila">
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  className="nx-faq-boton"
                  aria-expanded={esta}
                  aria-controls={`faq-${i}`}
                  onClick={() => setAbierta(esta ? null : i)}
                >
                  {f.q}
                  <ChevronDown size={18} className="nx-faq-signo" aria-hidden="true" />
                </button>
              </h3>
              {/* El cuerpo vive siempre en el DOM y se pliega con altura: así el
                  contenido EMPUJA al abrirse, que es lo que hace entender de
                  dónde salió. `inert` lo saca del teclado mientras esté plegado. */}
              <div id={`faq-${i}`} className="nx-faq-cuerpo" data-abierto={esta} inert={!esta}>
                <div><p>{f.a}</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Cierre() {
  return (
    <section className="nx-cierre">
      <h2 className="nx-pub-titulo">Pruébalo en tu próxima consulta</h2>
      <p className="nx-pub-bajada">
        Catorce días completos, sin tarjeta. Si no te ahorra tiempo, no lo
        vuelves a abrir y no te cobramos nada.
      </p>
      <Link href="/registro" className="btn btn-primary btn-lg nx-cierre-cta">
        Empezar gratis <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  )
}

function Pie() {
  return (
    <footer className="nx-pie">
      <span className="nx-pie-marca">Ausculta</span>
      <span className="nx-pie-lugar">Hecho en México</span>
      {/* `nx-enlace-tactil` en los NUEVE: son enlaces de 13 px, o sea 18 px de
          alto de caja. Sin él, en un teléfono hay que acertarle a un renglón de
          texto — es la regla que cazó `los-enlaces-de-accion-tambien-se-tocan`,
          y vale igual para el pie de la portada nueva. */}
      <nav className="nx-pie-enlaces" aria-label="Pie de página">
        <Link href="/demo" className="nx-enlace-tactil">Ver el producto</Link>
        <Link href="/precios" className="nx-enlace-tactil">Precios</Link>
        <Link href="/paquetes" className="nx-enlace-tactil">Paquetes por especialidad</Link>
        <Link href="/seguridad" className="nx-enlace-tactil">Seguridad</Link>
        <Link href="/evidencia" className="nx-enlace-tactil">Evidencia</Link>
        <Link href="/operacion" className="nx-enlace-tactil">Operación</Link>
        <Link href="/terminos" className="nx-enlace-tactil">Términos</Link>
        <Link href="/privacidad" className="nx-enlace-tactil">Privacidad</Link>
        <Link href="/contacto" className="nx-enlace-tactil">Soporte</Link>
      </nav>
      <span className="nx-pie-copia">
        © {new Date().getFullYear()} Ausculta. Apoyo a la decisión clínica; la
        decisión y la responsabilidad son del médico tratante.
      </span>
    </footer>
  )
}

export default function Portada() {
  return (
    <div className="nx-pub">
      <MetaPixel />
      <NavPublica />
      <main>
        <HeroConsulta />
        <Revelar><Recorrido /></Revelar>
        <Revelar><Negativas /></Revelar>
        <Revelar><Precios /></Revelar>
        <Revelar><Preguntas /></Revelar>
        <Revelar><Cierre /></Revelar>
      </main>
      <Pie />
    </div>
  )
}
