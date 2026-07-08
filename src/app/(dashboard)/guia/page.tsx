'use client'
/**
 * Guía de uso interactiva ("for dummies"). Explica TODAS las funciones de la app
 * en pasos simples. Secciones desplegables + buscador + filtro por rol. Pensada
 * para que un usuario nuevo (médico, recepción, enfermería, dueño) aprenda solo,
 * sin que nadie le explique.
 */
import { useState, useMemo } from 'react'
import {
  BookOpen, Search, ChevronDown, Calendar, Stethoscope, BedDouble, FileSignature,
  Settings, Users, CreditCard, Smartphone, Lightbulb, AlertTriangle, PlayCircle,
} from 'lucide-react'

type Rol = 'todos' | 'recepcion' | 'medico' | 'enfermeria' | 'dueno'
type Paso = { t: string; d: string }
type Seccion = {
  id: string; titulo: string; icono: React.ReactNode; roles: Rol[]
  intro: string; pasos: Paso[]; tips?: string[]; ojo?: string[]
}

const SECCIONES: Seccion[] = [
  {
    id: 'inicio', titulo: 'Primeros pasos', icono: <PlayCircle size={18} />, roles: ['todos'],
    intro: 'Lo mínimo para arrancar el primer día.',
    pasos: [
      { t: 'Entra con tu correo', d: 'Abre la app, escribe tu correo y contraseña (o entra con Google). Si te invitaron a un consultorio, usa el correo con el que te invitaron.' },
      { t: 'Reconoce el menú', d: 'A la izquierda (o abajo en el celular) están las secciones: Dashboard, Citas, Consulta, Hospitalización, etc. Arriba a la izquierda, la flecha "← Atrás" te regresa a donde estabas.' },
      { t: 'Elige tu modo', d: 'Si eres médico, abajo del menú puedes cambiar entre "Médico" y "Recepción" según lo que estés haciendo.' },
      { t: 'Configura lo básico', d: 'Ve a Configuración → Datos del consultorio y Horario de atención. Con eso ya puedes agendar.' },
    ],
    tips: ['Todo se guarda solo en la nube; puedes entrar desde la compu, el celular o la tablet con el mismo correo.'],
  },
  {
    id: 'agenda', titulo: 'Agenda y citas', icono: <Calendar size={18} />, roles: ['recepcion', 'medico'],
    intro: 'Cómo agendar, mover, confirmar y recordar citas.',
    pasos: [
      { t: 'Agendar una cita', d: 'Entra a Citas → botón "Nueva cita". Escribe el nombre del paciente (si ya existe, aparece solo), elige médico, fecha y hora. La app solo te ofrece horas libres. Guarda.' },
      { t: 'Agendar rápido', d: 'Para recepción con prisa: "Agendar rápido" (asistente) te lleva paso a paso: paciente → motivo → primer hueco disponible.' },
      { t: 'Ver el calendario', d: 'En Calendario ves el día/semana. Toca una cita para abrirla, moverla o cancelarla.' },
      { t: 'Reagendar o cancelar', d: 'Abre la cita → "Editar" para cambiar día/hora, o "Cancelar". Si el paciente tiene WhatsApp, puedes avisarle con un toque.' },
      { t: 'Lista de espera', d: 'Si no hay hueco, mete al paciente a Lista de espera. Cuando se libere un lugar, la app te avisa a quién llamar.' },
      { t: 'Recordatorios por WhatsApp', d: 'En la cita, botón "Recordar" abre WhatsApp con el mensaje ya escrito. Solo lo envías. Reduce que no lleguen.' },
      { t: 'Vacaciones y bloqueos', d: 'Configuración → Vacaciones y bloqueos: marca días libres o franjas ocupadas. Esas horas ya no se ofrecen para citas.' },
    ],
    tips: ['La cita nunca se agenda en un hueco ocupado ni en el pasado: la app lo impide sola.'],
  },
  {
    id: 'consulta', titulo: 'Consulta (expediente y notas)', icono: <Stethoscope size={18} />, roles: ['medico'],
    intro: 'El corazón del consultorio: expediente, nota por voz, corregir con IA y firmar.',
    pasos: [
      { t: 'Abrir el expediente', d: 'Ve a Consulta → toca al paciente. Verás sus datos, alergias, notas anteriores, recetas y estudios.' },
      { t: 'Hacer la nota hablando (dictado)', d: 'Dentro del paciente, toca el micrófono y habla normal: motivo, exploración, diagnóstico, plan. Al terminar, la IA arma una nota médica ordenada y concreta.' },
      { t: 'Revisar lo que entendió', d: 'La app extrae datos (diagnósticos, medicamentos, signos). Los seguros se aceptan solos; los delicados (dosis, alergias) te los marca para que confirmes de un vistazo.' },
      { t: 'Corregir sin volver a dictar', d: 'Si algo salió mal, usa el chat de corrección: escribe "la dosis es 500 mg" o "quita la diabetes" y la IA corrige SOLO eso, sin inventar. También puedes editar a mano cualquier campo.' },
      { t: 'Firmar la nota', d: 'Cuando esté correcta, dale "Firmar". Una nota firmada queda blindada (ya no se cambia, por ley NOM-004). Antes de firmar puedes editar o descartar libremente.' },
      { t: 'Generar receta', d: 'Desde la nota o el expediente, "Generar receta": agrega medicamentos (con buscador), indicaciones, y descarga PDF o imprime.' },
      { t: 'Orden de estudios', d: '"Orden" arma la solicitud de laboratorio/imagen en formato de checklist para imprimir o mandar.' },
      { t: 'Carta de referencia', d: 'Para mandar al paciente con otro especialista: "Referencia" genera la carta con tus datos y el motivo.' },
    ],
    tips: ['La nota se puede re-proyectar a otro tipo (evolución, interconsulta, etc.) sin volver a dictar.', 'Los datos del paciente (teléfono, alergias) SIEMPRE se pueden actualizar; solo las notas firmadas se bloquean.'],
  },
  {
    id: 'recetas', titulo: 'Recetas y firma (ajustar el formato)', icono: <FileSignature size={18} />, roles: ['medico'],
    intro: 'Deja tu receta idéntica a tu papel membretado y con tu firma.',
    pasos: [
      { t: 'Abrir el editor', d: 'Configuración → Recetas y órdenes. A la derecha ves una vista previa en vivo de cómo saldrá.' },
      { t: 'Subir tu membrete y pie', d: 'Sube la imagen de tu encabezado (y pie de página si tienes). La app la guarda en alta calidad.' },
      { t: 'Usar tu formato exacto', d: 'Si ya tienes un diseño de receta impreso, súbelo como "diseño completo". Activa "Mi diseño ya tiene los campos del paciente" si tu papel ya trae líneas para nombre/edad/fecha.' },
      { t: 'Calibrar dónde caen los datos', d: 'Con el calibrador (arriba/abajo/izq/der en mm) mueves la zona donde se escriben los medicamentos para que no se encimen con tu diseño. La vista previa te lo muestra en vivo.' },
      { t: 'Tu firma', d: 'Sube una foto/PNG de tu firma. Aparecerá en la receta y en las notas. Consejo: firma en papel blanco, tómale foto y recórtala.' },
      { t: 'Tamaño de papel', d: 'Elige media carta, carta u oficio. Si usas papel chico, elige "Hoja carta + corte" para que funcione en cualquier impresora.' },
      { t: 'Probar la impresión', d: 'Botón "Imprimir prueba": saca una receta de ejemplo para checar que todo cae bien antes de usarla con pacientes.' },
      { t: 'Guardar', d: 'Dale "Guardar template". Si tienes varios médicos, cada uno puede tener su propio formato.' },
    ],
    ojo: ['Al imprimir una receta real, la app abre una ventana limpia con SOLO la receta para que salga rápido.'],
  },
  {
    id: 'hospital', titulo: 'Hospitalización', icono: <BedDouble size={18} />, roles: ['medico', 'enfermeria'],
    intro: 'Censo, indicaciones/MAR, interconsultas, signos y egreso.',
    pasos: [
      { t: 'Ingresar un paciente', d: 'Hospitalización → "Ingresar". Elige al paciente, servicio y cama. Queda en el censo como episodio activo.' },
      { t: 'La ficha del episodio', d: 'Toca al paciente del censo. Adentro hay pestañas: Resumen/Notas, Indicaciones · MAR, Signos, Laboratorio, Enfermería, Interconsultas.' },
      { t: 'Indicaciones y MAR', d: 'En Indicaciones agregas medicamentos (con buscador) y cuidados. Enfermería registra cada administración (MAR) con la verificación de los 5 correctos. Mientras no se administre, puedes editar o borrar la indicación.' },
      { t: 'Interconsultas por WhatsApp', d: '"Solicitar interconsulta": elige especialidad y, si quieres, al médico concreto — le llega un WhatsApp con el motivo. Cuando responde, a ti te llega el aviso de vuelta.' },
      { t: 'Signos vitales y alerta', d: 'Enfermería registra signos; la app calcula el NEWS2 (riesgo de deterioro) y grafica tendencias. Un registro mal capturado se puede borrar.' },
      { t: 'Laboratorio', d: 'Pides estudios desde la ficha; el laboratorio los ve en su bandeja y sube resultados. Un resultado crítico dispara alerta.' },
      { t: 'Camas', d: 'En Camas gestionas el inventario (libre/ocupada/limpieza) y el tablero de ocupación.' },
      { t: 'Egresar', d: 'Botón "Egresar": eliges el motivo y escribes la nota de egreso. Sale del censo activo pero queda en el expediente.' },
    ],
    tips: ['Es UN solo expediente por paciente: lo de consulta y lo de hospital viven juntos, pero cada sección se queda en lo suyo.'],
  },
  {
    id: 'equipo', titulo: 'Tu equipo (médicos y personal)', icono: <Users size={18} />, roles: ['dueno', 'medico'],
    intro: 'Invitar médicos, asistentes, enfermería, etc. con el permiso correcto.',
    pasos: [
      { t: 'Abrir Equipo', d: 'Configuración → Equipo (asistentes y hospital) o Médicos.' },
      { t: 'Invitar a alguien', d: 'Escribe su nombre y correo, y elige su ROL de una lista grande: todas las especialidades médicas (clínicas y quirúrgicas), psicología, nutrición, enfermería, farmacia, laboratorio, recepción, administrador…' },
      { t: 'Se crea solo el médico', d: 'Si el rol es una especialidad médica, la app crea también su ficha de médico (para que aparezca en la agenda) sin que hagas doble trabajo.' },
      { t: 'Manda la invitación', d: 'Se genera un enlace/código; la persona entra con su correo y ya tiene acceso a lo que le toca por su rol.' },
    ],
    tips: ['El personal y los médicos son ilimitados.', 'Pon el teléfono de cada médico en su ficha para que le lleguen las alertas e interconsultas por WhatsApp.'],
  },
  {
    id: 'config', titulo: 'Configuración general', icono: <Settings size={18} />, roles: ['dueno', 'medico', 'recepcion'],
    intro: 'Dónde se ajusta todo lo del consultorio.',
    pasos: [
      { t: 'Datos del consultorio', d: 'Nombre, dirección, teléfono, logo. Aparecen en documentos y en el portal del paciente.' },
      { t: 'Horario y duración', d: 'Define tus horas de atención y cuánto dura cada tipo de cita. La agenda respeta esto.' },
      { t: 'Llaves de IA', d: 'Si usas tu propia cuenta de IA, pega tu llave aquí. Si no, usas la del sistema según tu plan.' },
      { t: 'Portal de auto-agenda', d: 'Activa que tus pacientes agenden solos desde un enlace (tipo Doctoralia, pero tuyo).' },
      { t: 'Notificaciones y WhatsApp', d: 'Ajusta los mensajes automáticos y recordatorios.' },
    ],
  },
  {
    id: 'portal', titulo: 'Portal del paciente', icono: <Smartphone size={18} />, roles: ['recepcion', 'medico'],
    intro: 'Tu propia página para que el paciente agende y vea sus cosas.',
    pasos: [
      { t: 'Comparte tu enlace', d: 'En Configuración → Portal de auto-agenda obtienes tu liga. Ponla en tu Instagram, WhatsApp o tarjeta.' },
      { t: 'El paciente agenda solo', d: 'Elige servicio, ve tus huecos libres y reserva. Le llega confirmación.' },
      { t: 'Sin contraseñas', d: 'El paciente entra con un enlace mágico a su correo/WhatsApp para ver sus citas y recetas.' },
    ],
  },
  {
    id: 'dueno', titulo: 'Para el dueño: suscripciones y cobro', icono: <CreditCard size={18} />, roles: ['dueno'],
    intro: 'La consola privada del dueño para administrar clínicas y precios.',
    pasos: [
      { t: 'Abrir la consola', d: 'Entra a /superadmin (solo tú, el dueño). Ves todas las clínicas, quién paga, cuánto y quién debe.' },
      { t: 'Armar paquetes', d: 'En Paquetes eliges qué módulos incluye cada uno y su precio. Los básicos ya vienen creados.' },
      { t: 'Cobro por médico', d: 'Los paquetes de consultorio se cobran POR MÉDICO: pones un precio base (1 médico) y una cuota por cada médico adicional. Entre más médicos usen el consultorio, más cobra.' },
      { t: 'Cobro por tamaño (hospital)', d: 'Los paquetes de hospital se cobran por cama: precio base + una cuota por cada cama.' },
      { t: 'Asignar y dar cortesías', d: 'Asignas un paquete a cada clínica; puedes dar "pase libre" (gratis) o extender pruebas. El ingreso mensual (MRR) se recalcula solo según médicos/camas.' },
    ],
  },
  {
    id: 'navegacion', titulo: 'Trucos de navegación y móvil', icono: <Smartphone size={18} />, roles: ['todos'],
    intro: 'Para moverte rápido y usar todo desde el celular.',
    pasos: [
      { t: 'Regresar', d: 'La flecha "← Atrás" (arriba en el celular) te devuelve exactamente a donde estabas, no a un lugar fijo.' },
      { t: 'Menú en el celular', d: 'La barra de abajo tiene los accesos principales; el botón de menú (☰) abre todo lo demás.' },
      { t: 'Imprimir', d: 'Al imprimir una receta/nota, la app abre una ventana con SOLO ese documento para que salga rápido y limpio.' },
      { t: 'Se actualiza solo', d: 'Cuando hay una versión nueva, se aplica sola al cerrar y reabrir la app. No tienes que hacer nada.' },
    ],
  },
]

const ROLES: { id: Rol; label: string }[] = [
  { id: 'todos', label: 'Todo' },
  { id: 'recepcion', label: 'Recepción' },
  { id: 'medico', label: 'Médico' },
  { id: 'enfermeria', label: 'Enfermería' },
  { id: 'dueno', label: 'Dueño' },
]

export default function GuiaPage() {
  const [rol, setRol] = useState<Rol>('todos')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>('inicio')

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase()
    return SECCIONES.filter(s => {
      const porRol = rol === 'todos' || s.roles.includes('todos') || s.roles.includes(rol)
      if (!porRol) return false
      if (!texto) return true
      const enTexto = (s.titulo + ' ' + s.intro + ' ' + s.pasos.map(p => p.t + ' ' + p.d).join(' ')).toLowerCase()
      return enTexto.includes(texto)
    })
  }, [rol, q])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <BookOpen size={24} className="ds-icon" style={{ color: 'var(--teal)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Guía de uso</h1>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text3)', margin: '0 0 16px' }}>
        Todo lo que hace la app, explicado en pasos simples. Toca cada sección para abrirla.
      </p>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Busca: receta, interconsulta, firma, agendar…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s1)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      {/* Filtro por rol */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {ROLES.map(r => {
          const activo = rol === r.id
          return (
            <button key={r.id} onClick={() => setRol(r.id)}
              style={{ padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: activo ? 'var(--teal)' : 'var(--s2)', color: activo ? '#fff' : 'var(--text2)',
                border: activo ? '1px solid var(--teal)' : '1px solid var(--border)' }}>
              {r.label}
            </button>
          )
        })}
      </div>

      {/* Secciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map(s => {
          const open = abierta === s.id
          return (
            <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--s1)', overflow: 'hidden' }}>
              <button onClick={() => setAbierta(open ? null : s.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: 'var(--teal)', display: 'flex' }}>{s.icono}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>{s.titulo}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{s.intro}</span>
                </span>
                <ChevronDown size={18} style={{ color: 'var(--text3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
              </button>

              {open && (
                <div style={{ padding: '0 16px 16px' }}>
                  <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {s.pasos.map((p, i) => (
                      <li key={i} style={{ display: 'flex', gap: 12 }}>
                        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--nexus-soft, rgba(20,184,166,.15))', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                        <span>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.t}</span>
                          <span style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginTop: 2, lineHeight: 1.5 }}>{p.d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  {s.tips?.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.25)' }}>
                      <Lightbulb size={15} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                  {s.ojo?.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.25)' }}>
                      <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {visibles.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12 }}>
            Nada coincide con “{q}”. Prueba otra palabra o quita el filtro.
          </div>
        )}
      </div>
    </div>
  )
}
