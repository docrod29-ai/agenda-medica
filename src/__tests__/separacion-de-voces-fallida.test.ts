/**
 * GOLDEN — cuando la separación de voces no separó, no se inventa quién habló.
 *
 * ── EL HALLAZGO, MEDIDO SOBRE EL CORPUS ACTUADO ──────────────────────────────
 *
 * La atribución de rol acertaba el 81,94 % (72 turnos, 12 diálogos). Al abrir el
 * detalle, **6 de las 9 confusiones venían de los dos diálogos en los que el
 * proveedor devolvió UNA sola voz** — y no eran confusiones de reparto: el
 * diálogo entero llegaba como un solo turno.
 *
 * Esto es lo que se atribuyó ÍNTEGRO al médico en uno de ellos:
 *
 *     «¿Ha fumado alguna vez? Fumé como 10 años, pero lo dejé hace 5.
 *      ¿Toma alcohol? No, nunca he tomado.»
 *
 * Las preguntas y las respuestas del paciente, todas como voz del médico. Es el
 * mismo mecanismo del peor defecto que ha tenido este sistema —«¿diabetes o
 * presión alta?» «No» → «paciente con DM2 e HTA»—, sólo que aquí ocurre antes:
 * el motor de negaciones y la procedencia razonan sobre una atribución falsa.
 *
 * ── POR QUÉ NO BASTA CON DESCONFIAR DE TODA VOZ ÚNICA ────────────────────────
 *
 * El médico dictando solo es un uso normal. Lo que separa los dos casos es una
 * marca gramatical comprobable, no una probabilidad.
 *
 * ── LO QUE MIDE ESTE GOLDEN ──────────────────────────────────────────────────
 *
 * Los dos casos reales del corpus (uno por cada vía de detección) y, sobre todo,
 * que un dictado legítimo NO se marque — porque un guardián que marca de más se
 * acaba ignorando, y con él los avisos que sí importan.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { diagnosticarSeparacion, senalesDeMezcla } from '@/lib/asr/separacion-fallida'

/** Los dos textos REALES que devolvió el proveedor colapsados en una voz. */
const DLG_008 = '¿Ha fumado alguna vez? Fumé como 10 años, pero lo dejé hace 5. ¿Toma alcohol? No, nunca he tomado. ¿Le han operado de algo? Me operaron de la vesícula en 2019. ¿Alguna otra cirugía? No, nada más esa.'
const DLG_005 = 'Le voy a dejar paracetamol 500 miligramos cada 8 horas por 5 días. ¿Ese es el que viene en pastilla blanca? Ese mismo. Y si no cede la fiebre, agregamos ibuprofeno 400 miligramos cada 8 horas. Está bien, doctor. Tómelos con alimento. Si sigue igual en 3 días, regresa.'

describe('LOS DOS CASOS REALES DEL CORPUS SE MARCAN', () => {
  it('interrogatorio y respuestas en la misma voz (DLG-008)', () => {
    const d = diagnosticarSeparacion({ hablantes: ['A'], texto: DLG_008 })
    expect(d.veredicto).toBe('mezcla_sin_separar')
    expect(d.senales!.preguntasDirigidas).toBeGreaterThanOrEqual(2)
    expect(d.senales!.respuestasPropias).toBeGreaterThanOrEqual(2)
  })

  it('el vocativo «doctor» (DLG-005), que la otra vía no veía', () => {
    /**
     * Este diálogo no tiene interrogatorio: son indicaciones y el paciente
     * contestando. Sin la vía del vocativo se escapaba — y aporta 2 de las 9
     * confusiones.
     */
    const d = diagnosticarSeparacion({ hablantes: ['A'], texto: DLG_005 })
    expect(d.veredicto).toBe('mezcla_sin_separar')
    expect(d.senales!.vocativosAlMedico).toBeGreaterThanOrEqual(1)
  })
})

describe('UN DICTADO LEGÍTIMO NO SE MARCA — el falso positivo tiene costo', () => {
  it('el médico dictando en tercera persona', () => {
    const texto = 'Paciente femenina de 54 años que refiere dolor abdominal de tres días. Niega fiebre. A la exploración, abdomen blando. Solicito biometría hemática y ultrasonido.'
    expect(diagnosticarSeparacion({ hablantes: ['A'], texto }).veredicto).toBe('dictado_de_una_voz')
  })

  it('aunque use una pregunta retórica y hable en primera persona', () => {
    /**
     * Por esto el umbral es DOS y DOS: con uno y uno, un dictado normal
     * dispararía la alarma.
     */
    const texto = '¿Tiene datos de irritación peritoneal? No los encuentro. Tengo la impresión de un cuadro funcional. Voy a solicitar laboratorios.'
    expect(diagnosticarSeparacion({ hablantes: ['A'], texto }).veredicto).toBe('dictado_de_una_voz')
  })

  it('y aunque mencione a otro médico por su nombre', () => {
    /**
     * «me comentó el doctor García» es relato, no un paciente hablándole al
     * médico. Sin excluir el nombre propio, todo dictado que cite a un colega
     * se marcaría.
     */
    const texto = 'Me comentó el doctor García que el cultivo salió positivo. Continúo el mismo esquema.'
    expect(senalesDeMezcla(texto).vocativosAlMedico).toBe(0)
  })
})

describe('CON DOS O MÁS VOCES NO SE OPINA', () => {
  it('se confía en el proveedor', () => {
    /**
     * Si repartió mal los turnos es otro problema, y no se arregla adivinando
     * aquí. Este módulo sólo cubre el caso en que el silencio del separador se
     * puede confundir con un hecho.
     */
    const d = diagnosticarSeparacion({ hablantes: ['A', 'B'], texto: DLG_008 })
    expect(d.veredicto).toBe('separado')
  })
})

describe('ESTÁ CONECTADO — y el médico se entera', () => {
  const ruta = readFileSync(join(process.cwd(), 'src/app/api/expediente/atribuir-roles/route.ts'), 'utf8')
  const pagina = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('la ruta lo comprueba ANTES de pedirle roles al modelo', () => {
    /**
     * Después no serviría: el modelo ya habría contestado «Médico» y el gasto
     * estaría hecho.
     */
    const iDiag = ruta.indexOf('diagnosticarSeparacion({')
    const iModelo = ruta.indexOf('const system =')
    expect(iDiag).toBeGreaterThan(0)
    expect(iDiag).toBeLessThan(iModelo)
  })

  it('y entonces NO asigna ningún rol', () => {
    expect(ruta).toContain('roles: {}')
    expect(ruta).toContain('separacionFallida: true')
  })

  it('la consulta lo enseña en vez de callarlo', () => {
    // Callarlo dejaría al médico firmando una procedencia falsa sin señal.
    expect(pagina).toContain('data?.separacionFallida')
    expect(pagina).toContain("toast(String(data.aviso), 'info')")
  })
})
