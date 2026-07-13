// Términos y Condiciones de Uso de la plataforma NexusMED.
// URL fija /terminos — enlazada desde el registro y el pie de la landing.
// Redactado para un SaaS médico en México: NexusMED provee el software
// (encargado del tratamiento); el médico/consultorio es el responsable clínico
// y del expediente. Texto base sólido; conviene revisión por abogado antes de
// escalar la venta.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — NexusMED',
  description: 'Términos y condiciones de uso de la plataforma NexusMED (agenda médica y expediente clínico electrónico).',
}

const ACTUALIZADO = 'julio de 2026'

export default function TerminosPage() {
  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '48px 22px 80px', color: '#1a1a1a', background: '#fff', lineHeight: 1.7, fontSize: 16 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 6px', color: '#0b1220' }}>Términos y Condiciones de Uso</h1>
      <p style={{ color: '#667', margin: '0 0 28px', fontSize: 14 }}>Plataforma NexusMED · Última actualización: {ACTUALIZADO}</p>

      <p>
        Estos Términos y Condiciones (los <strong>“Términos”</strong>) regulan el acceso y uso de <strong>NexusMED</strong>,
        una plataforma de <strong>agenda médica y expediente clínico electrónico</strong> para profesionales de la salud,
        consultorios y clínicas (el <strong>“Servicio”</strong>). Al registrarte o usar el Servicio, aceptas estos Términos.
        Si no estás de acuerdo, no utilices el Servicio.
      </p>

      <Section titulo="1. Quién puede usar el Servicio">
        El Servicio está dirigido a <strong>profesionales de la salud con cédula profesional vigente</strong> y a su personal
        autorizado (recepción, enfermería, administración). Al registrarte declaras que la información de tu cuenta es veraz y
        que estás facultado para ejercer la actividad para la que usas el Servicio. Eres responsable de mantener la
        confidencialidad de tu contraseña y de toda actividad realizada bajo tu cuenta.
      </Section>

      <Section titulo="2. Rol de NexusMED y responsabilidad clínica">
        NexusMED es <strong>una herramienta de software</strong>. NexusMED <strong>no practica la medicina</strong>, no emite
        diagnósticos ni prescribe tratamientos. Todas las decisiones clínicas —diagnóstico, medicación, dosis, órdenes y el
        contenido del expediente— son <strong>responsabilidad exclusiva del médico tratante</strong>, con base en su juicio
        profesional. El médico es el <strong>responsable</strong> del expediente clínico y de los datos de sus pacientes; NexusMED
        actúa como <strong>encargado</strong> del tratamiento, conforme al Aviso de Privacidad.
      </Section>

      <Section titulo="3. Asistencia con Inteligencia Artificial">
        El Servicio incluye funciones asistidas por <strong>inteligencia artificial</strong> (redacción de notas a partir de
        dictado por voz, sugerencias, un consultor de apoyo y un asistente de ayuda). Estas funciones son de
        <strong> apoyo</strong> y pueden contener errores o imprecisiones. <strong>El médico debe revisar, corregir y validar</strong>
        todo contenido generado por IA antes de firmarlo o usarlo clínicamente. La IA no sustituye el criterio profesional ni
        constituye consejo médico. El médico es el único responsable del contenido final del expediente.
      </Section>

      <Section titulo="4. Cumplimiento normativo">
        El Servicio ofrece plantillas y elementos documentales <strong>alineados con los requisitos aplicables de la
        NOM-004-SSA3-2012</strong> (expediente clínico) y considera los principios de la <strong>NOM-024-SSA3-2012</strong>
        (sistemas de información de registro electrónico) en lo que resulta aplicable. El uso correcto y el cumplimiento
        normativo en cada consultorio son responsabilidad del profesional de la salud. NexusMED provee las herramientas;
        no garantiza por sí solo el cumplimiento, que depende del uso que le dé cada usuario.
      </Section>

      <Section titulo="5. Planes, pagos y créditos">
        El Servicio se ofrece bajo planes de suscripción. Los precios, créditos de IA y límites de cada plan se muestran al
        momento de contratar. Las suscripciones se renuevan de forma automática al periodo elegido (mensual o anual) salvo
        cancelación previa. Las <strong>recargas de créditos</strong> son cargos únicos y no reembolsables una vez consumidos.
        Puedes cambiar o cancelar tu plan desde tu cuenta; la cancelación surte efecto al final del periodo ya pagado. Los
        pagos se procesan a través de proveedores externos (por ejemplo, Stripe); NexusMED no almacena los datos completos de
        tu tarjeta. La <strong>factura (CFDI)</strong> se emite a solicitud del cliente con sus datos fiscales.
      </Section>

      <Section titulo="6. Uso aceptable">
        Te comprometes a no: (a) usar el Servicio para fines ilícitos o no autorizados; (b) intentar vulnerar, sobrecargar o
        eludir los mecanismos de seguridad, autenticación o límites de uso; (c) acceder a cuentas o datos de otros usuarios sin
        autorización; (d) automatizar el consumo del Servicio o de sus funciones de IA de forma abusiva; (e) revender, copiar,
        descompilar o crear obras derivadas del Servicio. El incumplimiento puede derivar en la suspensión o terminación de la
        cuenta.
      </Section>

      <Section titulo="7. Propiedad intelectual">
        El software, el diseño, la marca <strong>NexusMED</strong>, el código y todos los elementos del Servicio son propiedad de
        sus titulares y están protegidos por las leyes de propiedad intelectual. Estos Términos <strong>no transfieren</strong>
        ningún derecho de propiedad sobre el Servicio; solo otorgan una licencia limitada, personal, revocable e intransferible
        para usarlo. Los <strong>datos de tus pacientes y tu expediente clínico son tuyos</strong> (de tu consultorio); NexusMED
        no reclama propiedad sobre ellos.
      </Section>

      <Section titulo="8. Disponibilidad y respaldos">
        NexusMED procura una alta disponibilidad, pero el Servicio se presta <strong>“tal cual”</strong> y puede tener
        interrupciones por mantenimiento, fallas de terceros o causas de fuerza mayor. Las funciones de IA dependen de
        proveedores externos y pueden degradarse o no estar disponibles temporalmente; en ese caso el Servicio procura una
        <strong> alternativa</strong> o continúa operando sin la función afectada. Se realizan respaldos de la información, sin que
        ello sustituya la obligación del usuario de conservar sus propios registros conforme a la ley.
      </Section>

      <Section titulo="9. Limitación de responsabilidad">
        En la máxima medida permitida por la ley, NexusMED no será responsable por daños indirectos, incidentales o
        consecuentes, ni por lucro cesante, derivados del uso o imposibilidad de uso del Servicio. En particular, NexusMED no es
        responsable por <strong>decisiones clínicas</strong>, por el contenido del expediente, ni por el uso que el profesional
        haga de las funciones de IA. La responsabilidad total de NexusMED, en cualquier caso, se limita al monto pagado por el
        usuario en los <strong>tres meses</strong> previos al evento que originó la reclamación.
      </Section>

      <Section titulo="10. Suspensión y terminación">
        Puedes cancelar tu cuenta en cualquier momento. NexusMED puede suspender o terminar el acceso ante incumplimiento de
        estos Términos, falta de pago o uso que ponga en riesgo la seguridad del Servicio o de otros usuarios. Ante la
        terminación, podrás solicitar la <strong>exportación de tus datos</strong> dentro de un plazo razonable antes de su
        eliminación, conforme al Aviso de Privacidad y a la normativa aplicable.
      </Section>

      <Section titulo="11. Cambios a estos Términos">
        NexusMED puede actualizar estos Términos. La versión vigente estará siempre disponible en esta página. Si los cambios
        son sustanciales, se procurará notificarlos con antelación razonable. El uso continuado del Servicio tras la
        actualización implica su aceptación.
      </Section>

      <Section titulo="12. Ley aplicable y jurisdicción">
        Estos Términos se rigen por las leyes de los <strong>Estados Unidos Mexicanos</strong>. Para cualquier controversia, las
        partes se someten a los tribunales competentes de México, sin perjuicio de los derechos que la legislación de protección
        al consumidor reconozca al usuario.
      </Section>

      <Section titulo="13. Contacto">
        Dudas sobre estos Términos: <strong>soporte@nexusmed.mx</strong>. Consulta también nuestro{' '}
        <a href="/privacidad" style={{ color: '#0d9488', fontWeight: 600 }}>Aviso de Privacidad</a>.
      </Section>

      <p style={{ marginTop: 36, fontSize: 13, color: '#889' }}>
        NexusMED — Agenda médica y expediente clínico electrónico · México.
      </p>
    </main>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#0b1220' }}>{titulo}</h2>
      <p style={{ margin: 0 }}>{children}</p>
    </section>
  )
}
