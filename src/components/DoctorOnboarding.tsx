'use client'
/**
 * DoctorOnboarding
 * Shows a 5-step questionnaire when the doctor hasn't configured
 * their bot FAQ answers. Triggered from layout when doctor.botConfig.completado = false.
 */
import { useState } from 'react'
import { updateDoctor } from '@/lib/firestore'
import { useClinic } from '@/context/ClinicContext'
import { Doctor } from '@/types'
import { Stethoscope, DollarSign, Building2, MapPin, MessageSquare, Bot, CheckCircle2, ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'

interface Props {
  doctor: Doctor
  onComplete: () => void
}

const STEPS: { id: string; Icon: LucideIcon; title: string; subtitle: string; placeholder: string; multiline: boolean }[] = [
  {
    id: 'padecimientos',
    Icon: Stethoscope,
    title: '¿Qué padecimientos atiende?',
    subtitle: 'El bot usará esto para responder preguntas de pacientes.',
    placeholder: 'Ej: Infecciones bacterianas, virales, VIH/SIDA, tuberculosis, infecciones de transmisión sexual, fiebre de origen desconocido...',
    multiline: true,
  },
  {
    id: 'costoConsulta',
    Icon: DollarSign,
    title: '¿Cuánto cuesta la consulta?',
    subtitle: 'Sea específico: primera vez, seguimiento, urgencias.',
    placeholder: 'Ej: Primera vez $800, seguimiento $600. Consulta de urgencias $1,000. Incluye revisión y receta.',
    multiline: true,
  },
  {
    id: 'seguros',
    Icon: Building2,
    title: '¿Acepta seguros médicos?',
    subtitle: 'Si no acepta, indique por qué.',
    placeholder: 'Ej: GNP Seguros, AXA, BBVA Seguros. Deducible según póliza del paciente. No aceptamos IMSS/ISSSTE en consulta privada.',
    multiline: true,
  },
  {
    id: 'comoLlegar',
    Icon: MapPin,
    title: '¿Cómo llegar al consultorio?',
    subtitle: 'Referencias, estacionamiento, transporte.',
    placeholder: 'Ej: Edificio Médica Sur, piso 3, consultorio 304. Estacionamiento gratuito en el sótano. A 2 cuadras del metro...',
    multiline: true,
  },
  {
    id: 'infoExtra',
    Icon: MessageSquare,
    title: '¿Información adicional para pacientes?',
    subtitle: 'Cualquier otra cosa que el bot deba saber (opcional).',
    placeholder: 'Ej: Traer estudios previos si los tiene. Llegar 10 min antes de su cita. No se realizan estudios de laboratorio en el consultorio...',
    multiline: true,
  },
]

export function DoctorOnboarding({ doctor, onComplete }: Props) {
  const { clinicId } = useClinic()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({
    padecimientos: doctor.botConfig?.padecimientos || '',
    costoConsulta: doctor.botConfig?.costoConsulta || '',
    seguros: doctor.botConfig?.seguros || '',
    comoLlegar: doctor.botConfig?.comoLlegar || '',
    infoExtra: doctor.botConfig?.infoExtra || '',
  })
  const [saving, setSaving] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  const handleNext = async () => {
    if (!isLast) {
      setStep(s => s + 1)
      return
    }
    // Save on last step
    setSaving(true)
    try {
      await updateDoctor(clinicId!, doctor.id, {
        botConfig: {
          padecimientos: values.padecimientos,
          costoConsulta: values.costoConsulta,
          seguros: values.seguros,
          comoLlegar: values.comoLlegar,
          infoExtra: values.infoExtra,
          completado: true,
        },
      })
      onComplete()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const canContinue = current.id === 'infoExtra' || values[current.id]?.trim().length > 3

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d1f2d] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-300">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">Configuración del bot</p>
              <h2 className="text-lg font-semibold text-white">Información para el asistente virtual</h2>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-2">Paso {step + 1} de {STEPS.length}</p>
        </div>

        {/* Step content */}
        <div className="p-6">
          <div className="mb-3 text-teal-300"><current.Icon size={32} /></div>
          <h3 className="text-xl font-semibold text-white mb-1">{current.title}</h3>
          <p className="text-sm text-white/50 mb-4">{current.subtitle}</p>
          <textarea
            value={values[current.id]}
            onChange={e => setValues(v => ({ ...v, [current.id]: e.target.value }))}
            placeholder={current.placeholder}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-400/50 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(s => s - 1)}
            disabled={step === 0}
            className="px-4 py-2 text-sm text-white/50 hover:text-white disabled:opacity-30 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={!canContinue || saving}
            className="px-6 py-2.5 rounded-xl bg-teal-500 text-white font-medium text-sm hover:bg-teal-400 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5"
          >
            {saving ? 'Guardando…' : isLast ? <><CheckCircle2 size={15} /> Finalizar</> : <>Siguiente <ArrowRight size={15} /></>}
          </button>
        </div>

        {step === STEPS.length - 1 && (
          <p className="px-6 pb-4 text-xs text-center text-white/30">
            Podrá editar estas respuestas en Configuración → Bot WhatsApp
          </p>
        )}
      </div>
    </div>
  )
}
