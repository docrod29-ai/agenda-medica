import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar, Mic, FileText, MessageCircle, Headset, ArrowRight, CheckCircle2, MousePointerClick, FlaskConical, Sparkles, ShieldAlert, BookOpen, Repeat, Smartphone, Lock } from 'lucide-react'
import { NavPublica } from '@/components/landing/NavPublica'

export const metadata: Metadata = {
  title: 'Ver el producto · Ausculta',
  description:
    'Una consulta de principio a fin: lo que se oye, lo que Ausculta entiende, la nota, lo que avisa antes de firmar, la evidencia que aplica a esta paciente y el seguimiento hasta el resultado. Datos ficticios.',
}

/**
 * /demo — UNA CONSULTA, DE PRINCIPIO A FIN.
 *
 * ── QUÉ HABÍA ───────────────────────────────────────────────────────────────
 *
 * Nueve funciones numeradas en zigzag: agenda · nota · receta · antibiograma ·
 * consultor · herramientas · WhatsApp · asistente · portal. Un catálogo — cada
 * bloque decía qué hace una parte del producto, y ninguno decía qué pasa
 * después. Nadie termina un catálogo pensando «ya entendí por qué usaría esto
 * mañana»; se termina pensando «tiene muchas cosas».
 *
 * Y le faltaba justo lo que la portada promete. Ni la negación, ni la
 * procedencia, ni los avisos antes de firmar, ni la aplicabilidad de la
 * evidencia, ni el ciclo cerrado de la orden aparecían por ningún lado: el
 * demo enseñaba el producto de hace dos versiones.
 *
 * ── LO QUE ES AHORA ─────────────────────────────────────────────────────────
 *
 * La visita de UNA paciente, en orden. Los capítulos son los mismos nueve
 * pasos de la portada y de `docs/product/EL-CAMINO-DEL-MEDICO.md`, así que el
 * visitante que llega desde la portada reconoce el recorrido en vez de empezar
 * otro. Y se añaden los cuatro momentos que faltaban, que son los que
 * distinguen a este producto de un dictado.
 *
 * Lo que el consultorio necesita ALREDEDOR de la consulta —el bot, el modo
 * asistente, las herramientas por especialidad, el antibiograma— sigue estando,
 * pero como lo que es: el segundo plano. Antes pesaba lo mismo que la nota.
 *
 * ── LOS DOS RECORRIDOS VIVOS ────────────────────────────────────────────────
 *
 * Esta página son maquetas honestas (divs con el estilo real, no capturas
 * falsas). Lo que de verdad corre está en otras dos rutas, y estaban escondidas
 * —una en un botón secundario, la otra en un enlace del pie de la portada—:
 *
 *   · /demo/interactivo  — la aplicación, navegable, con datos ficticios
 *   · /demo/razonamiento — los motores DETERMINISTAS de verdad sobre un caso
 *                          sembrado, con procedencia y confianza
 *
 * La segunda es el activo más fuerte del repositorio para convencer a un
 * médico, y llevaba el rótulo «Ver cómo razona el copiloto» en un botón
 * secundario. Aquí van las dos, dichas por lo que enseñan.
 *
 * ── TODO ES FICTICIO Y SE DICE EN PANTALLA ──────────────────────────────────
 *
 * Paciente sintética. La regla de datos del repositorio prohíbe pacientes
 * reales en cualquier superficie, y ésta es pública.
 */

/** La paciente de la visita. Sintética — ver cabecera. */
const PACIENTE = 'María Robles, 61 años'

const CAPITULOS = [
  {
    icon: Calendar,
    titulo: 'Llega María, y ya sabes qué traes hoy',
    texto:
      'La agenda dice quién viene, a qué y en qué punto está cada quien: quién llegó, quién espera, quién está dentro. Ella pidió la cita sola por WhatsApp el jueves.',
    mock: 'agenda',
  },
  {
    icon: Mic,
    titulo: 'Hablas con ella, no con la computadora',
    texto:
      'Grabas la consulta y Ausculta separa lo que dijo ella de lo que dijiste tú. Lo que oye se entiende antes de escribirse: lo que afirma, lo que NIEGA, y lo que ya venía tomando.',
    mock: 'entendido',
  },
  {
    icon: FileText,
    titulo: 'Al terminar, la nota ya está',
    texto:
      'Redactada y estructurada, alineada a los requisitos aplicables de la NOM-004. Tocas una frase y oyes el segundo del dictado del que salió — para revisarla hoy y para sostenerla dentro de tres años.',
    mock: 'nota',
  },
  {
    icon: ShieldAlert,
    titulo: 'Y antes de firmar, te avisa',
    texto:
      'Una sola barra. Tres cosas nunca se pliegan: alergia a un medicamento, contradicción con lo que la paciente negó, y dosis peligrosa. El resto sí — un aviso que estorba se aprende a ignorar.',
    mock: 'avisos',
  },
  {
    icon: BookOpen,
    titulo: 'La evidencia, aplicada a ELLA',
    texto:
      'No diez enlaces: qué recomienda, quién, de cuándo, y qué de esta paciente hace que aplique o no. Cuando falta un dato para decidirlo, lo dice en vez de rellenarlo.',
    mock: 'evidencia',
  },
  {
    icon: CheckCircle2,
    titulo: 'La receta y la orden salen con ella',
    texto:
      'Receta con tu membrete, tu firma y un QR de validación. Impresa, o por WhatsApp. Las órdenes de estudios, igual.',
    mock: 'receta',
  },
  {
    icon: Repeat,
    titulo: 'La orden no desaparece al pedirla',
    texto:
      'Pedir un estudio no cierra nada. Ausculta lo sigue hasta que hay resultado, alguien lo revisa y queda escrito qué se decidió — y si el resultado es crítico, hasta que consta que se avisó.',
    mock: 'ciclo',
  },
  {
    icon: Smartphone,
    titulo: 'Ella ve lo que tú liberaste, y nada más',
    texto:
      'Con un enlace seguro, sin contraseña. Firmar la nota y liberar información a la paciente son dos actos distintos: nunca ve un borrador.',
    mock: 'portal',
  },
]

/** Lo que el consultorio necesita ALREDEDOR de la consulta. Segundo plano. */
const ALREDEDOR = [
  { icon: MessageCircle, titulo: 'El bot de WhatsApp', texto: 'Agendan, reagendan y reciben recordatorios solos. Si alguien cancela, la lista de espera se entera al instante.', mock: 'whatsapp' },
  { icon: Headset, titulo: 'El modo asistente', texto: 'Tu asistente ve agenda y contacto; la información clínica y la configuración, no. Permisos por rol reales.', mock: 'secretaria' },
  { icon: FlaskConical, titulo: 'El antibiograma desde una foto', texto: 'Subes el reporte, confirmas el patrón S/I/R, y el motor PROA infiere fenotipo, propone terapia dirigida y arma la NOM-045.', mock: 'antibiograma' },
  { icon: Sparkles, titulo: 'El consultor, cuando lo pides', texto: 'Dosis por función renal, esquemas empíricos, diferencial. Respaldado con evidencia real. Apoyo decisional: decides tú.', mock: 'ia' },
]

/* ─── Maquetas ligeras (divs con el estilo de la app, no capturas) ─── */
function Mock({ tipo }: { tipo: string }) {
  const base: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, minHeight: 200 }
  if (tipo === 'agenda') {
    return (
      <div style={base}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>Lunes 14 de julio</div>
        {[['09:00', 'María Robles', 'En consulta', 'var(--nexus)'], ['10:30', 'Juan Pérez', 'En sala', 'var(--green)'], ['12:00', 'Ana Ríos', 'Control', 'var(--amber)']].map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 9, background: 'var(--s2)', marginBottom: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', width: 42 }}>{c[0]}</span>
            <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: c[3] }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c[1]}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{c[2]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'nota') {
    return (
      <div style={base}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--nexus)', background: 'var(--nexus-soft)', border: '1px solid var(--nexus-borde)', padding: '4px 10px', borderRadius: 'var(--r-pill)', marginBottom: 12 }}>
          Borrador · lista para revisar
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Padecimiento actual</div>
        <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, margin: '5px 0 12px' }}>
          Femenino de 61 años que refiere cifras tensionales elevadas de un mes de evolución.{' '}
          <mark className="nx-hero-procedencia">
            Niega fiebre.
            <span className="nx-hero-sello">2:14</span>
          </mark>{' '}
          Continúa con metformina.
        </p>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exploración física</div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--s2)', margin: '6px 0', width: '90%' }} />
        <div style={{ height: 8, borderRadius: 4, background: 'var(--s2)', width: '70%' }} />
        <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Toca una frase y oyes el segundo del dictado del que salió.
        </p>
      </div>
    )
  }
  if (tipo === 'receta') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Dr. Nombre Apellido</div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Cardiología · Céd. Prof. 0000000</div>
        </div>
        {['Ácido acetilsalicílico 100 mg — 1 tableta cada 24 h', 'Atorvastatina 40 mg — 1 tableta por la noche'].map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 7 }}><CheckCircle2 size={14} style={{ color: 'var(--nexus)', flexShrink: 0, marginTop: 1 }} /> {m}</div>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--s2)', display: 'grid', placeItems: 'center', fontSize: 10.5, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.1 }}>QR<br/>válido</div>
        </div>
      </div>
    )
  }
  /* ── LO QUE SE ENTIENDE. La negación tiene cara propia: es el error que más
        caro sale, y el que ningún dictado genérico distingue. ── */
  if (tipo === 'entendido') {
    return (
      <div style={base}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Se oyó</div>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 14px' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text3)', marginRight: 6 }}>PACIENTE</span>
          «Me sube la presión desde hace como un mes. Fiebre no he tenido. La metformina sí la sigo tomando.»
        </p>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Se entendió</div>
        <ul className="nx-hero-hechos" style={{ marginBottom: 10 }}>
          <li className="nx-hero-hecho" data-clase="afirma"><span className="nx-hero-hecho-rotulo">Refiere</span><span className="nx-hero-hecho-valor">Hipertensión · 1 mes</span></li>
          <li className="nx-hero-hecho" data-clase="niega"><span className="nx-hero-hecho-rotulo">Niega</span><span className="nx-hero-hecho-valor">Fiebre</span></li>
          <li className="nx-hero-hecho" data-clase="sigue"><span className="nx-hero-hecho-rotulo">Continúa</span><span className="nx-hero-hecho-valor">Metformina</span></li>
        </ul>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
          Lo que nadie dijo queda vacío. Ausencia de dato no es dato de ausencia.
        </p>
      </div>
    )
  }
  /* ── LO QUE AVISA ANTES DE FIRMAR. Tres niveles y una sola barra: dos avisos
        se pliegan, uno no. Que se vea CUÁL no se pliega es el argumento. ── */
  if (tipo === 'avisos') {
    return (
      <div style={base}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, marginBottom: 8,
          background: 'color-mix(in srgb, var(--red) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 34%, transparent)' }}>
          <ShieldAlert size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>
            <strong>Alergia registrada a penicilina</strong> — y la receta lleva amoxicilina. No se pliega.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, marginBottom: 8,
          background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)' }}>
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>
            La nota dice <strong>«refiere fiebre»</strong> y la paciente la negó. No se pliega.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.45 }}>2 avisos informativos · plegados</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Y si el botón de firmar está apagado, dice por qué.
        </p>
      </div>
    )
  }
  /* ── LA EVIDENCIA APLICADA. Lo que la separa de una lista de enlaces es la
        columna de la derecha: qué de ESTA paciente hace que aplique o no, y
        qué falta para poder decidirlo. ── */
  if (tipo === 'evidencia') {
    return (
      <div style={base}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.45, marginBottom: 4 }}>
          Iniciar IECA en hipertensión con diabetes tipo 2
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 12 }}>Guía de práctica · 2024 · recomendación fuerte</div>
        {[
          ['Aplica', 'Diabetes tipo 2 confirmada', 'var(--green)'],
          ['Aplica', 'Hipertensión de nuevo diagnóstico', 'var(--green)'],
          ['Falta', 'Función renal: sin creatinina en los últimos 12 meses', 'var(--amber)'],
        ].map(([r, t, c], i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: c as string, width: 42, flexShrink: 0, paddingTop: 2 }}>{r}</span>
            <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.45 }}>{t}</span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Sin ese dato no dice que aplique. Lo pide.
        </p>
      </div>
    )
  }
  /* ── EL CICLO CERRADO. Cuatro estados, y los dos últimos son los que casi
        ningún expediente distingue: revisado ≠ decidido, decidido ≠ avisado. ── */
  if (tipo === 'ciclo') {
    return (
      <div style={base}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Química sanguínea · solicitada el 14 jul</div>
        {[
          ['Solicitada', '14 jul', true],
          ['Resultado recibido', '17 jul', true],
          ['Revisada por el médico', '17 jul', true],
          ['Decidido: ajustar metformina', 'pendiente', false],
        ].map(([t, cuando, hecho], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <span style={{ width: 9, height: 9, borderRadius: 'var(--r-pill)', flexShrink: 0,
              background: hecho ? 'var(--nexus)' : 'transparent', border: hecho ? 'none' : '1px solid var(--border2)' }} />
            <span style={{ flex: 1, fontSize: 12, color: hecho ? 'var(--text)' : 'var(--text3)' }}>{t as string}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{cuando as string}</span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Un resultado revisado no es un resultado decidido, y ninguno de los dos es haber avisado.
        </p>
      </div>
    )
  }
  if (tipo === 'antibiograma') {
    return (
      <div style={base}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>S. aureus · piel</div>
        {[['Oxacilina', 'R', '#dc2626'], ['Cefoxitina', 'R', '#dc2626'], ['Vancomicina', 'S', '#16a34a'], ['TMP-SMX', 'S', '#16a34a']].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--s2)', marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{r[0]}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: r[2] }}>{r[1]}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 9, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--text)' }}>
          <strong>MRSA</strong> → terapia dirigida + NOM-045
        </div>
      </div>
    )
  }
  if (tipo === 'ia') {
    return (
      <div style={base}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <span style={{ maxWidth: '80%', fontSize: 12, padding: '8px 11px', borderRadius: 12, background: 'var(--nexus-solido)', color: '#fff' }}>¿Dosis de cefepime con TFG 35?</span>
        </div>
        <div style={{ display: 'flex', marginBottom: 8 }}>
          <span style={{ maxWidth: '85%', fontSize: 12, padding: '8px 11px', borderRadius: 12, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', lineHeight: 1.5 }}>Con TFG 30–60 mL/min, ajusta el intervalo de cefepime. Dime indicación y peso y te doy la dosis exacta.</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Respaldado por evidencia · apoyo decisional</div>
      </div>
    )
  }
  if (tipo === 'herramientas') {
    return (
      <div style={base}>
        {[['Inmunocomprometido', 'Trasplante · profilaxis'], ['Cardiometabólico', 'Riesgo ACC/AHA · FIB-4'], ['Pediatría', 'Dosis/peso · percentiles OMS'], ['NEWS2', 'Score de deterioro']].map((r, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '9px 11px', borderRadius: 9, background: 'var(--s2)', marginBottom: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r[0]}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r[1]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'whatsapp') {
    return (
      <div style={{ ...base, background: '#0b141a' }}>
        {[['in', 'Hola, quiero una cita con el Dr.'], ['out', 'Claro. Tengo martes 10:00 o jueves 12:30. ¿Cuál te acomoda?'], ['in', 'Martes 10:00'], ['out', 'Listo, María. Cita el martes a las 10:00. Te recuerdo un día antes.']].map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m[0] === 'out' ? 'flex-end' : 'flex-start', marginBottom: 7 }}>
            <span style={{ maxWidth: '80%', fontSize: 12, lineHeight: 1.4, padding: '7px 10px', borderRadius: 10, color: '#e9edef', background: m[0] === 'out' ? '#005c4b' : '#1f2c34' }}>{m[1]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'secretaria') {
    return (
      <div style={base}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--blue)', background: 'rgba(59,130,246,0.12)', padding: '4px 10px', borderRadius: 'var(--r-pill)', marginBottom: 12 }}>
          <Headset size={12} /> Modo asistente
        </div>
        {/*
          «SIN ACCESO» NO SE DICE ATENUANDO. La fila estaba a `opacity: 0.5`
          para significar «esto no lo ve», y axe lo midió en la página servida:
          2,24 : 1 — por debajo de la mitad del mínimo de 4,5. Dos cosas mal en
          una: el texto es ilegible, y el significado depende de percibir una
          diferencia de claridad, que es justo lo que no percibe quien más
          necesita el contraste.

          Lo dice el candado, el rótulo y el trazo discontinuo, a contraste
          entero. Es la regla de Patient State en pequeño: no depender del
          color, ni de la opacidad.
        */}
        {[['María Robles', '09:00', true], ['Juan Pérez', '10:30', true], ['Expediente clínico', '', false]].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6,
            marginBottom: 7,
            background: r[2] ? 'var(--s2)' : 'transparent',
            border: r[2] ? '1px solid transparent' : '1px dashed var(--border2)',
          }}>
            <span style={{ flex: 1, fontSize: 12, color: r[2] ? 'var(--text)' : 'var(--text2)' }}>{r[0]}</span>
            {r[2]
              ? <span style={{ fontSize: 12, color: 'var(--text2)' }}>{r[1] as string}</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)' }}>
                  <Lock size={12} aria-hidden="true" /> sin acceso
                </span>}
          </div>
        ))}
      </div>
    )
  }
  // portal
  return (
    <div style={base}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Hola, María</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Tu próxima cita</div>
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Martes 15 de julio · 10:00</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>Dr. Nombre Apellido · Cardiología</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--nexus)', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 0' }}>Reagendar</span>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 0' }}>Mi receta</span>
      </div>
    </div>
  )
}

export default function DemoPage() {
  return (
    <div className="nx-pub">
      <NavPublica />
      <main>
        <section className="nx-hero nx-demo-entrada">
          <div>
            <p className="nx-pub-rotulo">Una consulta, de principio a fin</p>
            <h1 className="nx-display nx-hero-titulo nx-demo-titulo">
              Así se ve un martes<br />por la mañana.
            </h1>
            <p className="nx-hero-bajada">
              La visita de {PACIENTE} — paciente ficticia — desde que entra
              hasta que el resultado de su estudio queda decidido. Lo que hay
              aquí son maquetas honestas: el producto de verdad se recorre en
              los dos enlaces de abajo.
            </p>
            <div className="nx-hero-acciones">
              <Link href="/demo/interactivo" className="btn btn-primary btn-lg">
                <MousePointerClick size={17} aria-hidden="true" /> Recorrer la aplicación
              </Link>
              <Link href="/demo/razonamiento" className="btn btn-secondary btn-lg">
                Ver los motores razonar un caso
              </Link>
            </div>
            <p className="nx-hero-pie">Sin registro · datos ficticios · lo conduces tú</p>
          </div>

          {/*
            EL VÍDEO. Con portada: sin ella, quien entra a la página que existe
            para convencerlo veía un rectángulo NEGRO con un aspa mientras
            cargaban 8,5 MB — varios segundos de nada delante de la primera
            impresión del producto. El fotograma es el gancho («Son las 9 pm. Y
            me faltan 12 notas»), así que la espera pasa de un vacío a un
            argumento. 52 KB.
          */}
          <div className="nx-demo-video">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/videos/demo-nota-portada.jpg"
            >
              <source src="/videos/demo-nota.mp4" type="video/mp4" />
              Tu navegador no puede reproducir el video.
            </video>
          </div>
        </section>

        {/* LA VISITA, en orden. Los mismos pasos que la portada: quien llega de
            allí reconoce el recorrido en vez de empezar otro. */}
        <section className="nx-pub-seccion">
          <ol className="nx-demo-visita">
            {CAPITULOS.map((c, i) => {
              const Icono = c.icon
              return (
                <li key={c.titulo} className="nx-demo-capitulo">
                  <div className="nx-demo-dicho">
                    <p className="nx-demo-paso">
                      <span className="nx-demo-icono"><Icono size={16} aria-hidden="true" /></span>
                      <span className="nx-demo-n">{String(i + 1).padStart(2, '0')}</span>
                    </p>
                    <h2 className="nx-demo-titular">{c.titulo}</h2>
                    <p className="nx-demo-texto">{c.texto}</p>
                  </div>
                  <div className="nx-demo-obra"><Mock tipo={c.mock} /></div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Y ALREDEDOR. Existe, y pesa lo que pesa: antes ocupaba lo mismo que
            la nota, y eso decía que el producto es un agendador con extras. */}
        <section className="nx-pub-seccion">
          <p className="nx-pub-rotulo">Y alrededor de la consulta</p>
          <h2 className="nx-pub-titulo">Lo que el consultorio necesita para funcionar</h2>
          <p className="nx-pub-bajada">
            Nada de esto es por lo que se compra Ausculta. Todo esto es por lo
            que se puede dejar de usar otras cuatro cosas.
          </p>
          <div className="nx-demo-alrededor">
            {ALREDEDOR.map(a => {
              const Icono = a.icon
              return (
                <div key={a.titulo} className="nx-demo-satelite">
                  <div>
                    <p className="nx-demo-paso">
                      <span className="nx-demo-icono"><Icono size={16} aria-hidden="true" /></span>
                    </p>
                    <h3 className="nx-demo-subtitular">{a.titulo}</h3>
                    <p className="nx-demo-texto">{a.texto}</p>
                  </div>
                  <Mock tipo={a.mock} />
                </div>
              )
            })}
          </div>
        </section>

        <section className="nx-cierre">
          <h2 className="nx-pub-titulo">Pruébalo con tus propios pacientes</h2>
          <p className="nx-pub-bajada">
            14 días gratis, sin tarjeta. Se configura en cinco minutos y no hay
            nada que instalar.
          </p>
          <div className="nx-demo-cierre-acciones">
            <Link href="/registro" className="btn btn-primary btn-lg">
              Empezar gratis <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/precios" className="btn btn-secondary btn-lg">Ver precios</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
