// Aviso de privacidad GENERAL de la plataforma NexusMED.
// URL fija /privacidad — la que pide Meta para la revisión de la app de WhatsApp
// (además de los avisos por consultorio en /privacidad/[clinicId]).
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad — NexusMED',
  description: 'Aviso de privacidad de la plataforma NexusMED (agenda médica y expediente clínico electrónico).',
}

const ACTUALIZADO = 'julio de 2026'

export default function PrivacidadGeneralPage() {
  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '48px 22px 80px', color: '#1A1A1A', background: '#FFF', lineHeight: 1.7, fontSize: 16 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 6px', color: '#0B1220' }}>Aviso de Privacidad</h1>
      <p style={{ color: '#667', margin: '0 0 28px', fontSize: 14 }}>Plataforma NexusMED · Última actualización: {ACTUALIZADO}</p>

      <p>
        NexusMED es una plataforma de <strong>agenda médica y expediente clínico electrónico</strong> para consultorios y
        clínicas. Este aviso explica cómo se tratan los datos personales conforme a la <strong>Ley Federal de Protección de
        Datos Personales en Posesión de los Particulares (LFPDPPP)</strong> de México.
      </p>

      <Section titulo="1. Identidad del operador">
        NexusMED es una plataforma operada por <strong>David Alonso Rodríguez Luna</strong> (persona física con actividad
        empresarial), con domicilio en México. Contacto para asuntos de privacidad: <strong>privacidad@nexusmed.mx</strong>.
        Los datos de identificación fiscal y el domicilio completo del operador están disponibles para las autoridades
        competentes y para los titulares que lo soliciten; no se publican en este aviso por seguridad.
      </Section>

      <Section titulo="2. Responsable y encargado">
        Cada consultorio o clínica que usa NexusMED es el <strong>responsable</strong> de los datos de sus pacientes.
        NexusMED (operado por la persona señalada arriba) actúa como <strong>encargado</strong> del tratamiento: provee el
        software y resguarda la información por cuenta del consultorio, siguiendo sus instrucciones.
      </Section>

      <Section titulo="3. Datos de los médicos y personal suscriptor">
        Respecto de los datos de sus <strong>suscriptores</strong> (médicos y su personal), NexusMED actúa como
        <strong> responsable</strong>. Se tratan: <strong>datos de la cuenta</strong> (nombre, correo, teléfono, cédula
        profesional, especialidad y datos del consultorio), <strong>datos de suscripción y facturación</strong> (plan,
        pagos y datos fiscales para el CFDI, procesados por el proveedor de pagos y el emisor de facturas) y
        <strong> datos de soporte</strong> (los mensajes y adjuntos que envías al pedir ayuda). Finalidades: crear y operar
        tu cuenta, cobrar la suscripción, emitir comprobantes fiscales, brindar soporte y cumplir obligaciones legales y
        fiscales. La base del tratamiento es la <strong>relación contractual</strong> contigo. Los datos de pago los procesan
        el proveedor de pagos y el PAC de facturación como encargados; NexusMED no almacena los datos completos de la tarjeta.
        Puedes ejercer tus derechos ARCO escribiendo a <strong>privacidad@nexusmed.mx</strong>.
      </Section>

      <Section titulo="4. Datos que se recaban (de pacientes)">
        Según el uso, pueden tratarse: nombre, teléfono, correo, fecha de nacimiento, sexo, y datos de la atención médica
        (motivo de consulta, diagnósticos, recetas, notas clínicas, signos vitales). Los datos de salud son
        <strong> datos personales sensibles</strong> y reciben protección reforzada.
      </Section>

      <Section titulo="5. Finalidades">
        Los datos se usan para: agendar y administrar citas; integrar el expediente clínico; emitir recetas y órdenes;
        y <strong>enviar mensajes por WhatsApp</strong> (confirmaciones de cita, recordatorios y, si el paciente lo autoriza,
        invitaciones a dejar una reseña). Los recordatorios por WhatsApp solo se envían a pacientes que otorgaron su
        consentimiento.
      </Section>

      <Section titulo="6. WhatsApp Business y Meta">
        Para el envío de mensajes, NexusMED utiliza la <strong>API de WhatsApp Business de Meta Platforms, Inc.</strong> El
        número de teléfono y el contenido del mensaje se procesan a través de la infraestructura de Meta con el único fin de
        entregar la comunicación al paciente. El tratamiento por parte de Meta se rige por sus propias políticas. No se
        comparten datos con Meta para publicidad ni para fines distintos al envío del mensaje solicitado.
      </Section>

      {/*
        LA LISTA DICE LO QUE EL CÓDIGO HACE, NO UNA GENERALIDAD.
        Antes esta sección nombraba «infraestructura en la nube y la mensajería
        de WhatsApp» y ya. El sistema manda datos además a los proveedores de
        transcripción, de modelos de lenguaje, de video y de pagos: un aviso que
        no los nombra no informa de nada. Cada línea corresponde a una llamada
        real que se puede señalar en el código.
      */}
      <Section titulo="7. Transferencias y encargados">
        No se venden ni comercializan datos personales. Se comparten únicamente con los proveedores necesarios para operar
        el servicio, que actúan como encargados y están obligados a la confidencialidad. Estos son, y para qué:
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li><strong>Infraestructura en la nube</strong> (Google Firebase / Vercel): alojamiento del expediente y de la agenda.</li>
          <li><strong>Transcripción de voz</strong> (OpenAI, AssemblyAI): el audio del dictado de la consulta. La transcripción se
            elimina del proveedor en cuanto el texto llega al expediente.</li>
          <li><strong>Asistencia por inteligencia artificial</strong> (Anthropic, OpenAI): el texto clínico para redactar y estructurar
            la nota. <strong>No se envía el nombre del paciente</strong>: sólo edad, sexo, alergias y el contenido clínico.</li>
          <li><strong>Mensajería</strong> (WhatsApp Business de Meta): teléfono y contenido del recordatorio o aviso.</li>
          <li><strong>Videoconsulta</strong> (Daily.co): sólo cuando hay teleconsulta, para establecer la sala.</li>
          <li><strong>Pagos</strong> (Stripe): importe y datos de la operación cuando se paga en línea. El consultorio no almacena
            números de tarjeta.</li>
          <li><strong>Calendario externo</strong> (Google Calendar), sólo si el consultorio lo conecta: se envía el tipo de cita, la
            hora y las <strong>iniciales</strong> del paciente. <strong>No se envía el nombre completo, ni el teléfono, ni el motivo
            de consulta.</strong></li>
        </ul>
        <p style={{ marginTop: 10 }}>
          La búsqueda de literatura médica (PubMed) se hace con términos clínicos: <strong>no se envía ningún dato del paciente</strong>.
        </p>
      </Section>

      <Section titulo="8. Seguridad">
        Se aplican medidas de seguridad administrativas, técnicas y físicas razonables (cifrado en tránsito, control de
        acceso por roles y registro de accesos) para proteger la información contra pérdida, uso o acceso no autorizado.
      </Section>

      <Section titulo="9. Derechos ARCO">
        Todo paciente puede <strong>Acceder, Rectificar, Cancelar u Oponerse</strong> al tratamiento de sus datos, así como
        revocar su consentimiento. Para ejercerlos, contacte directamente a su consultorio, o utilice el portal de solicitudes
        que su consultorio pone a disposición en NexusMED.
      </Section>

      <Section titulo="10. Cambios a este aviso">
        Este aviso puede actualizarse. La versión vigente estará siempre disponible en esta página.
      </Section>

      <Section titulo="11. Contacto">
        Dudas sobre este aviso o sobre el tratamiento de datos: <strong>privacidad@nexusmed.mx</strong>.
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
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#0B1220' }}>{titulo}</h2>
      <p style={{ margin: 0 }}>{children}</p>
    </section>
  )
}
