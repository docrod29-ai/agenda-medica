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
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '48px 22px 80px', color: '#1a1a1a', background: '#fff', lineHeight: 1.7, fontSize: 16 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 6px', color: '#0b1220' }}>Aviso de Privacidad</h1>
      <p style={{ color: '#667', margin: '0 0 28px', fontSize: 14 }}>Plataforma NexusMED · Última actualización: {ACTUALIZADO}</p>

      <p>
        NexusMED es una plataforma de <strong>agenda médica y expediente clínico electrónico</strong> para consultorios y
        clínicas. Este aviso explica cómo se tratan los datos personales conforme a la <strong>Ley Federal de Protección de
        Datos Personales en Posesión de los Particulares (LFPDPPP)</strong> de México.
      </p>

      <Section titulo="1. Responsable">
        Cada consultorio o clínica que usa NexusMED es el <strong>responsable</strong> de los datos de sus pacientes.
        NexusMED actúa como <strong>encargado</strong> del tratamiento: provee el software y resguarda la información por
        cuenta del consultorio, siguiendo sus instrucciones.
      </Section>

      <Section titulo="2. Datos que se recaban">
        Según el uso, pueden tratarse: nombre, teléfono, correo, fecha de nacimiento, sexo, y datos de la atención médica
        (motivo de consulta, diagnósticos, recetas, notas clínicas, signos vitales). Los datos de salud son
        <strong> datos personales sensibles</strong> y reciben protección reforzada.
      </Section>

      <Section titulo="3. Finalidades">
        Los datos se usan para: agendar y administrar citas; integrar el expediente clínico; emitir recetas y órdenes;
        y <strong>enviar mensajes por WhatsApp</strong> (confirmaciones de cita, recordatorios y, si el paciente lo autoriza,
        invitaciones a dejar una reseña). Los recordatorios por WhatsApp solo se envían a pacientes que otorgaron su
        consentimiento.
      </Section>

      <Section titulo="4. WhatsApp Business y Meta">
        Para el envío de mensajes, NexusMED utiliza la <strong>API de WhatsApp Business de Meta Platforms, Inc.</strong> El
        número de teléfono y el contenido del mensaje se procesan a través de la infraestructura de Meta con el único fin de
        entregar la comunicación al paciente. El tratamiento por parte de Meta se rige por sus propias políticas. No se
        comparten datos con Meta para publicidad ni para fines distintos al envío del mensaje solicitado.
      </Section>

      <Section titulo="5. Transferencias">
        No se venden ni comercializan datos personales. Solo se comparten con los proveedores estrictamente necesarios para
        operar el servicio (por ejemplo, infraestructura en la nube y la mensajería de WhatsApp), quienes actúan como
        encargados y están obligados a la confidencialidad.
      </Section>

      <Section titulo="6. Seguridad">
        Se aplican medidas de seguridad administrativas, técnicas y físicas razonables (cifrado en tránsito, control de
        acceso por roles y registro de accesos) para proteger la información contra pérdida, uso o acceso no autorizado.
      </Section>

      <Section titulo="7. Derechos ARCO">
        Todo paciente puede <strong>Acceder, Rectificar, Cancelar u Oponerse</strong> al tratamiento de sus datos, así como
        revocar su consentimiento. Para ejercerlos, contacte directamente a su consultorio, o utilice el portal de solicitudes
        que su consultorio pone a disposición en NexusMED.
      </Section>

      <Section titulo="8. Cambios a este aviso">
        Este aviso puede actualizarse. La versión vigente estará siempre disponible en esta página.
      </Section>

      <Section titulo="9. Contacto">
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
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#0b1220' }}>{titulo}</h2>
      <p style={{ margin: 0 }}>{children}</p>
    </section>
  )
}
