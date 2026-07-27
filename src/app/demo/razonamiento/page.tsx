'use client'
/**
 * DEMOSTRACIÓN PÚBLICA DEL RAZONAMIENTO — /demo/razonamiento
 *
 * Responde de frente a "el copiloto es la promesa menos demostrada": un caso
 * clínico sembrado (ficticio) que enciende los motores DE VERDAD y muestra los
 * 12 pasos del razonamiento con provenance y confianza — todo determinista,
 * client-side, sin IA real, sin PubMed en vivo, sin PHI. Lo que se ve aquí es lo
 * mismo que el médico ve dentro de la consulta.
 */
import Link from 'next/link'
import { ArrowLeft, Info, Stethoscope } from 'lucide-react'
import { PanelRazonamiento } from '@/components/PanelRazonamiento'
import { Copiloto } from '@/components/Copiloto'
import { SelloProcedencia } from '@/components/SelloProcedencia'
import { EvidenciaEnVivo } from '@/components/EvidenciaEnVivo'
import type { EntradaCopiloto } from '@/lib/expediente/razonamiento'

// Caso sembrado: mujer 68a con DM2 + ERC + FA y polifarmacia con una "triple
// whammy" (AINE + IECA + ERC). Escogido para que los motores deterministas
// tengan algo REAL que decir: TFG por CKD-EPI, ajuste renal de metformina,
// contradicciones, metas de LDL, FIB-4.
const CASO: EntradaCopiloto = {
  edad: 68,
  sexo: 'Femenino',
  alergias: 'penicilina',
  diagnosticos: [
    { descripcion: 'Diabetes mellitus tipo 2' },
    { descripcion: 'Enfermedad renal crónica' },
    { descripcion: 'Fibrilación auricular' },
    { descripcion: 'Dislipidemia' },
  ],
  medicamentos: [
    { nombre: 'Metformina', dosis: '850 mg' },
    { nombre: 'Enalapril', dosis: '10 mg' },
    { nombre: 'Ibuprofeno', dosis: '400 mg' },
    { nombre: 'Warfarina', dosis: '5 mg' },
    { nombre: 'Amoxicilina', dosis: '500 mg' },
  ],
  signos: { ta: '186/118', fc: 112, fr: 18, temperatura: 36.8, spo2: 96, peso: 74, talla: 158 },
  labs: { creatinina: 2.1, ast: 42, alt: 48, plaquetas: 135, ldl: 162 },
}

// Extracción auditada SEMBRADA (ficticia) solo para demostrar el sello de
// procedencia: algunos datos traen cita del "dictado", otros son inferencia de IA
// (sin cita), y los que NO aparecen aquí se marcan como capturados a mano.
const EXTRACCION_DEMO = {
  diagnosticos: [
    { descripcion: 'Diabetes mellitus tipo 2', source_quote: 'es diabética desde hace doce años', confidence: 'alta' as const },
    { descripcion: 'Enfermedad renal crónica', source_quote: 'la creatinina le salió en dos punto uno', confidence: 'alta' as const },
    { descripcion: 'Fibrilación auricular', confidence: 'media' as const }, // sin cita → IA
    // Dislipidemia NO está aquí → capturado a mano
  ],
  medicamentos: [
    { nombre: 'Metformina', source_quote: 'sigue con su metformina de ochocientos cincuenta', confidence: 'alta' as const },
    { nombre: 'Enalapril', source_quote: 'toma enalapril de diez', confidence: 'alta' as const },
    { nombre: 'Ibuprofeno', confidence: 'baja' as const }, // sin cita → IA
    { nombre: 'Warfarina', source_quote: 'está anticoagulada con warfarina', confidence: 'alta' as const },
    // Amoxicilina NO está aquí → capturado a mano
  ],
  signosVitales: {
    ta: { value: '186/118', source_quote: 'la presión ciento ochenta y seis sobre ciento dieciocho', confidence: 'alta' as const },
  },
}

const FINAL_DEMO = {
  diagnosticos: CASO.diagnosticos,
  medicamentos: CASO.medicamentos,
  alergias: ['penicilina'],
  signosVitales: { ta: '186/118', fc: 112, peso: 74, talla: 158 },
}

export default function DemoRazonamientoPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <div style={{ background: 'var(--nexus-soft, rgba(61,90,254,.08))', borderBottom: '1px solid var(--border)', padding: '8px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text2)', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <Info size={14} style={{ color: 'var(--nexus, #3d5afe)', flexShrink: 0 }} />
        <span><strong style={{ color: 'var(--text)' }}>Demostración</strong> · paciente ficticio · los 12 pasos corren con código (sin IA de caja negra); la evidencia se recupera de PubMed en vivo</span>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 20px 80px' }}>
        <Link href="/demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none', marginBottom: 14 }}>
          <ArrowLeft size={15} /> Volver a la demo
        </Link>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 6px' }}>
          Así razona el copiloto — a la vista
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 20px', maxWidth: '66ch' }}>
          Este es un <strong>caso sintético</strong> (paciente ficticio, sin datos reales) representativo de consultorio. Abajo verás <strong>los 12 pasos del razonamiento clínico</strong>, cada
          uno con su <strong>origen</strong> (regla con código, IA o evidencia) y su <strong>confianza</strong>. Nada es
          una caja negra: lo que dice “regla con código” lo calcula el sistema, con fórmula, aquí mismo.
        </p>

        {/* Ficha del caso */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1, rgba(127,127,127,.04))', padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Stethoscope size={15} style={{ color: 'var(--teal)' }} />
            <strong style={{ fontSize: 14 }}>Paciente (ficticio): mujer, 68 años</strong>
          </div>
          <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
            <div><b style={{ color: 'var(--text)' }}>Dx:</b> DM2 · ERC · Fibrilación auricular · Dislipidemia</div>
            <div><b style={{ color: 'var(--text)' }}>Fármacos:</b> Metformina 850 mg · Enalapril 10 mg · Ibuprofeno 400 mg · Warfarina 5 mg · Amoxicilina 500 mg</div>
            <div><b style={{ color: 'var(--text)' }}>Signos:</b> TA 186/118 · FC 112 · peso 74 kg · talla 158 cm</div>
            <div><b style={{ color: 'var(--text)' }}>Labs:</b> creatinina 2.1 · LDL 162 · AST 42 · ALT 48 · plaquetas 135</div>
            <div><b style={{ color: 'var(--text)' }}>Alergia:</b> penicilina</div>
          </div>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '10px 0 8px' }}>Los 12 pasos, con fuente y confianza</h2>
        <PanelRazonamiento entrada={CASO} embebido />

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '26px 0 8px' }}>Evidencia real, recuperada al momento</h2>
        <EvidenciaEnVivo />

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '26px 0 8px' }}>Y lo que el copiloto sugiere (calculado, no inventado)</h2>
        <Copiloto entrada={CASO} />

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '26px 0 8px' }}>De dónde salió cada dato de la nota</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 8px', maxWidth: '66ch' }}>
          Trazabilidad medicolegal por campo: lo que la IA sacó <strong>del dictado</strong> conserva la frase exacta;
          lo que fue <strong>inferencia de IA</strong> se marca aparte; lo que capturó el médico <strong>a mano</strong>,
          también. Despliega para ver la cita textual de cada dato.
        </p>
        <SelloProcedencia final={FINAL_DEMO} extraction={EXTRACCION_DEMO} />

        <div style={{ marginTop: 26, padding: '16px 18px', border: '1px solid var(--border)', borderLeft: '3px solid var(--teal)', borderRadius: 12, background: 'var(--s1, rgba(127,127,127,.04))', fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Fíjate:</strong> la TFG por CKD-EPI 2021, el ajuste renal de la metformina, la alerta
          de alergia penicilina↔amoxicilina, la crisis hipertensiva y las metas de LDL salen de <em>reglas con código</em> —
          no de un modelo de lenguaje. La evidencia PubMed (pasos 8-9) se recupera y verifica por PMID en vivo aquí
          arriba; dentro de la consulta, el análisis que la razona corre en el nivel 💎 Máxima.
        </div>

        <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/demo/interactivo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700 }}>
            Probar la demo interactiva
          </Link>
          <Link href="/arquitectura" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2)', textDecoration: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}>
            Ver los motores
          </Link>
        </div>
      </div>
    </main>
  )
}
