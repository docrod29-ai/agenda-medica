'use client'
/**
 * LO QUE TE PROTEGE, FUNCIONANDO — LA PANTALLA QUE HACE VISIBLE LO INVISIBLE.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * El 9-ago-2026, tras quince versiones seguidas de reparaciones, el dueño dijo:
 *
 *   *«no he visto ningún cambio en la aplicación»*
 *
 * Y tenía razón. Casi todas eran **defensas**: una alergia que ya no se inventa,
 * un VIH que ya no se descarta solo, una CMI censurada que ya no se lee como
 * exacta, mil veces la dosis que ya no pasa. Todas hacen que **no** ocurra algo
 * malo — lo más difícil de ver que existe.
 *
 * Una defensa que no se puede enseñar es, para quien paga, una defensa que no
 * existe.
 *
 * ── POR QUÉ ESTO NO ES UNA DEMO ─────────────────────────────────────────────
 *
 * Los motores son módulos **puros**, así que corren aquí mismo, en el navegador,
 * sobre lo que se escriba en cada campo. Nada está grabado ni preparado.
 *
 * **Si un motor se rompe mañana, esta pantalla lo enseña roto.** Ésa es la
 * diferencia entre una demo y una prueba: una demo se prepara, esto se ejecuta.
 *
 * Y sirve para las dos cosas que hacían falta: que el dueño VEA lo que compró, y
 * que se lo pueda enseñar a alguien sin pedirle que se fíe.
 */
import { useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { QueDiceElMotor } from '@/components/motores/QueDiceElMotor'

import { respuestaNiega, condicionesNegadas } from '@/lib/expediente/negaciones'
import { primeraMencionSinEscudo } from '@/lib/expediente/mencion-en-la-nota'
import { extraerComorbilidades } from '@/lib/expediente/parser-clinico'
import { alergenosDe } from '@/lib/seguridad/alergias'
import { extraerMg, extraerTomasDia } from '@/lib/seguridad/dosis'
import { cdsMedicamento } from '@/lib/hospital/cds'
import { repartirPorSistemas, tuvoEstructura } from '@/lib/uci/reparto-sistemas'

/** Cómo se enseña una lista vacía sin que parezca un fallo. */
const lista = (xs: readonly string[], vacio: string) => xs.length ? xs.join(' · ') : vacio

/** El escudo que usan los dos motores que preguntan «¿está bien escrito?». */
const ESCUDO = /\b(?:niega|no\s+(?:tiene|refiere)|sin\s+antecedente[s]?\s+de|antecedente\s+de)\b/i

export default function MotoresPage() {
  /**
   * Las cajas se declaran una vez. Cada `motor` es una función pura de texto a
   * texto: lo único que hace es llamar al motor de verdad y contar lo que
   * contestó, sin interpretarlo.
   */
  const cajas = useMemo(() => [
    {
      titulo: 'El paciente dice que sí, y no queda como que dijo que no',
      reg: 'REG-271 · 284',
      etiqueta: 'Lo que contesta el paciente',
      ejemplo: 'No, sí tengo, desde hace años',
      antes: 'Se registraba como una NEGACIÓN. El paciente afirmaba tener la enfermedad y el expediente decía que la negó; después se reclasificaba a «descartado» y la pantalla de contradicciones no saltaba, porque para ella todo cuadraba.',
      porQue: 'El «no» que corrige y afirma en la misma frase. Se contesta así todos los días, y también con muletilla en medio: «no pues sí».',
      motor: (t: string) => respuestaNiega(t)
        ? 'Lo cuenta como una NEGACIÓN'
        : 'NO lo cuenta como negación — lo que dice después manda',
    },
    {
      titulo: 'La enfermedad que se nombra en la pregunta no es un antecedente',
      reg: 'REG-280 · 281',
      etiqueta: 'El interrogatorio, como se dicta',
      ejemplo: '¿Diabetes? No. ¿Hipertensión? Tampoco.',
      antes: 'Las DOS enfermedades quedaban como antecedentes POSITIVOS. El interrogatorio nombra la enfermedad en la pregunta, y el motor sólo miraba hacia atrás: la negación viene después, en la respuesta.',
      porQue: 'Es el fallo que más veces ha vuelto en este expediente. Se reparó para la vía de la IA, y seguía vivo en el motor local — el que entra cuando la IA falla.',
      motor: (t: string) => {
        const r = extraerComorbilidades(t)
        return `Tiene: ${lista(r.positivas, '(ninguna)')}\nNiega: ${lista(r.negadas, '(ninguna)')}`
      },
    },
    {
      titulo: 'Una alergia negada no se convierte en una alergia',
      reg: 'REG-276 · 277',
      etiqueta: 'El campo de alergias del paciente',
      ejemplo: 'Niega alergias a penicilina y sulfas',
      antes: 'Devolvía una alergia a SULFAS que nadie afirmó. El negador se escribe una vez y el partidor cortaba por «y»: el resto de la lista salía sin la negación que lo cubría.',
      porQue: 'Una alergia inventada apaga el botón de Firmar, se imprime en rojo en la receta que va a la farmacia, y en infectología empuja a segunda línea.',
      motor: (t: string) => {
        const a = alergenosDe({ alergias: t })
        return `Alergias registradas: ${lista(a, '(ninguna — el campo las niega)')}`
      },
    },
    {
      titulo: 'El hospital y la consulta leen la misma alergia',
      reg: 'REG-277',
      etiqueta: 'El campo, tal como se dicta en planta',
      ejemplo: 'NKDA',
      antes: 'De once formas de escribirlo, NUEVE se leían distinto en planta que en consulta. «NKDA», «(-)», «n/a» y «ninguna» pasaban por alérgenos en el hospital: no disparaban alerta, pero se imprimían en el recuadro rojo.',
      porQue: 'Lo grave no era cada caso: era que las dos pantallas decidieran distinto sobre el mismo campo del mismo paciente, sin que ninguna dijera que la otra existe.',
      motor: (t: string) => {
        const consulta = alergenosDe({ alergias: t })
        const alerta = cdsMedicamento({ nombre: 'Penicilina G', alergias: t })
          .some(a => a.nivel === 'critica')
        return `Consulta ve: ${lista(consulta, '(ninguna)')}\n`
          + `Hospital, al prescribir Penicilina G: ${alerta ? 'ALERTA CRÍTICA' : 'sin alerta'}\n`
          + `${(consulta.some(a => /penicilin/i.test(a)) === alerta) ? '→ Coinciden' : '→ NO COINCIDEN'}`
      },
    },
    {
      titulo: '«Obesidad» no dice VIH',
      reg: 'REG-285',
      etiqueta: 'Lo que dice el expediente',
      ejemplo: 'Niega obesidad',
      antes: 'Devolvía VIH como enfermedad negada — porque «obe·SIDA·d» contiene «sida» y la comparación era por subcadena. De ahí lee el motor que reclasifica: un paciente con VIH real quedaba con el VIH DESCARTADO.',
      porQue: 'Escriba «Niega sida» y verá que la palabra de verdad sí se reconoce. Lo que se quitó fue que casara dentro de otra.',
      motor: (t: string) => `Enfermedades que el texto NIEGA: ${lista(condicionesNegadas(t).map(c => c.condicion), '(ninguna)')}`,
    },
    {
      titulo: 'La nota no puede afirmar lo que el paciente negó',
      reg: 'REG-286',
      etiqueta: 'La nota escrita',
      ejemplo: 'Niega diabetes. Diagnóstico de diabetes tipo 2.',
      antes: 'No avisaba. El escudo de la primera oración cruzaba el punto y tapaba la afirmación de la segunda: la alarma de contradicción se quedaba muda justo en el caso para el que existe.',
      porQue: 'La ventana era de 60 caracteres y «Antecedente de asma. » mide 21. Un número no puede expresar «la misma oración»; el punto sí.',
      motor: (t: string) => {
        const m = primeraMencionSinEscudo(t, ['diabetes'], ESCUDO)
        return m ? `AVISA — la nota lo afirma aquí: «${m.cita}»` : 'No avisa: todas las menciones vienen escudadas'
      },
    },
    {
      titulo: 'Quinientos microgramos no son quinientos miligramos',
      reg: 'REG-289',
      etiqueta: 'La dosis, como se escribe',
      ejemplo: '500 microgramos',
      antes: 'Se leía como 500 mg — MIL VECES la dosis. La abreviatura «mcg» estaba en la lista; la palabra escrita, no. Y cualquier unidad desconocida se convertía en miligramos en silencio: «1000 UI» salía como 1000 mg.',
      porQue: 'Pruebe también «1000 UI» o «10 mEq»: ahora contesta que no puede validarlo en miligramos, que es la respuesta honesta.',
      motor: (t: string) => {
        const mg = extraerMg(t)
        return mg === null
          ? 'No se puede validar en mg — no es una masa (y se dice, en vez de suponerlo)'
          : `${mg} mg por toma`
      },
    },
    {
      titulo: 'El techo diario se comprueba aunque la receta esté en latín',
      reg: 'REG-289',
      etiqueta: 'La frecuencia',
      ejemplo: 'QID',
      antes: 'Devolvía «no se entiende», y quien preguntaba asumía UNA toma al día: el techo diario no fallaba, no se ejecutaba. Paracetamol 1000 mg QID son 4 000 mg —el techo entero— y se comprobaban 1 000.',
      porQue: 'Pruebe «TID», «BID», «q8h» o «cada 4 a 6 horas». Y con algo que de verdad no se entienda, contesta que no lo entiende en vez de inventarse un número.',
      motor: (t: string) => {
        const n = extraerTomasDia(t)
        return n === null ? 'No se entiende la frecuencia — y no se inventa una' : `${n} tomas al día`
      },
    },
    {
      titulo: 'El pase de UCI dictado se reparte por aparatos',
      reg: 'REG-264',
      etiqueta: 'El pase, dictado de corrido',
      ejemplo: 'Neurológico, RASS menos dos, pupilas isocóricas. Respiratorio, PEEP diez, FiO2 cuarenta. Hemodinámico, noradrenalina a punto uno.',
      antes: 'Caía ENTERO en el plan, con todos los aparatos vacíos y sin decirlo. El reparto partía por saltos de línea, y un pase dictado llega como párrafo corrido: la nota por aparatos —lo que ningún competidor hace— no corría sobre voz.',
      porQue: 'Quite las comas después de cada aparato y verá que deja de repartir: se parte sólo cuando el nombre abre la frase, para no llevarse medio párrafo al aparato siguiente.',
      motor: (t: string) => {
        const r = repartirPorSistemas(t)
        if (!tuvoEstructura(r)) return 'Sin estructura: todo cayó en el plan'
        return Object.entries(r)
          .filter(([k, v]) => k !== 'plan' && v.trim())
          .map(([k, v]) => `${k}: ${v.trim().slice(0, 70)}`)
          .join('\n')
      },
    },
  ], [])

  return (
    <div className="page-pad" style={{ maxWidth: 880, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={20} style={{ color: 'var(--teal)' }} />
          <h1 className="t-h1" style={{ margin: 0 }}>Lo que te protege, funcionando</h1>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.6 }}>
          Cada caja de abajo es una defensa que <strong>falló de verdad</strong> y que ya está
          reparada. Los motores <strong>corren aquí</strong>, en tu navegador, sobre lo que
          escribas: no hay nada grabado. Cambia el texto y mira cómo responden.
        </p>
        <p style={{
          margin: '10px 0 0', fontSize: 13, color: 'var(--text3)', lineHeight: 1.6,
          paddingLeft: 11, borderLeft: '2px solid var(--border)',
        }}>
          El <strong>«antes»</strong> se cita del registro de reparaciones, no se calcula: ese
          código ya no existe. Lo que se calcula es lo de ahora. Dar por medido algo que sólo
          está recordado sería justo el defecto que la mitad de estos motores existen para
          evitar.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 15 }}>
        {cajas.map(c => <QueDiceElMotor key={c.reg + c.titulo} {...c} />)}
      </div>

      <p style={{
        margin: '24px 0 0', fontSize: 13, color: 'var(--text3)', lineHeight: 1.6,
        textAlign: 'center',
      }}>
        Nueve defensas de las que se repararon esta semana. El registro completo vive en{' '}
        <code style={{ fontSize: 12 }}>docs/audit/regression-ledger.md</code>.
      </p>
    </div>
  )
}
