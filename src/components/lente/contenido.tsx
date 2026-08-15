'use client'
/**
 * QUÉ ENSEÑA LA LENTE PARA CADA HECHO.
 *
 * Un caso por clase de hecho, y en los tres la misma promesa: **lo que se
 * enseña sale de donde el hecho dice que sale, o se declara que no consta.**
 *
 * ── DÓNDE ESTÁ EL PELIGRO REAL DE ESTE ARCHIVO ──────────────────────────────
 *
 * Una lente de procedencia mal escrita no falla ruidosamente: enseña algo
 * plausible. Bastaría con pintar el título del pendiente bajo el rótulo
 * «lo que dice la nota» para que el médico creyera que lo leyó de la nota. Por
 * eso la cita la decide `citaDeOrigen` —módulo puro, con guardián— y aquí sólo
 * se PINTA lo que ese módulo devuelve, incluido su `porQue` cuando no hay cita.
 *
 * ── LAS TRES RESPUESTAS QUE NO SON LA MISMA ─────────────────────────────────
 *
 *   resolviendo       · todavía no se sabe
 *   sin-fuente        · se sabe, y no consta procedencia
 *   no-se-pudo-leer   · NO se sabe, porque la lectura falló
 *
 * Fundir las dos últimas convierte un error de red en la afirmación clínica
 * «no consta de dónde salió». Es `sin-leer` de `estado-clinico.ts` otra vez.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, FileText, Quote, Clock, User, ExternalLink } from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { getNota } from '@/lib/expediente/firestore'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { NotaMedica } from '@/types/expediente'
import { resumenProcedencia } from '@/lib/expediente/procedencia'
import {
  citaDeOrigen, fuenteDeclarada, laNotaEsDeEstePaciente, limiteDelHecho,
  type HechoInspeccionable, type Resolucion,
} from '@/lib/lente/modelo'
import {
  ETIQUETA_TIPO, debeEscalar, estaVencida, ordenWorklist, type TareaClinica,
} from '@/lib/tareas-clinicas/modelo'

export function ContenidoDeLaLente({ hecho }: { hecho: HechoInspeccionable }) {
  switch (hecho.clase) {
    case 'tarea':          return <DeUnPendiente hecho={hecho} />
    case 'estado-clinico': return <DeUnEstadoClinico hecho={hecho} />
    case 'alergias':       return <DeLasAlergias hecho={hecho} />
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   PIEZAS COMPARTIDAS — la lente tiene UNA gramática, no una por caso.
   ──────────────────────────────────────────────────────────────────────────── */

function Bloque({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <section className="nx-lente-bloque">
      <div className="t-overline">{rotulo}</div>
      {children}
    </section>
  )
}

/**
 * LO QUE NO CONSTA SE DICE, Y SE DICE EN ÁMBAR.
 *
 * Ni en gris —que se lee como «aquí no hay nada que ver»— ni en rojo, que en
 * este producto significa riesgo clínico. Ámbar es el color que el ancla ya usa
 * para «alergias no registradas», que es exactamente el mismo tipo de hecho: un
 * hueco del registro, no un fallo y no una tranquilidad.
 */
function NoConsta({ children }: { children: React.ReactNode }) {
  return (
    <p className="nx-lente-hueco">
      <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** Un fallo de lectura NO se pinta como un hueco del registro. */
function NoSePudoLeer({ children }: { children: React.ReactNode }) {
  return (
    <p className="nx-lente-fallo" role="status">
      <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function fechaLarga(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
}

/* ────────────────────────────────────────────────────────────────────────────
   UN PENDIENTE → LA NOTA DE LA QUE SALIÓ
   ──────────────────────────────────────────────────────────────────────────── */

function DeUnPendiente({ hecho }: { hecho: Extract<HechoInspeccionable, { clase: 'tarea' }> }) {
  const { tarea } = hecho
  const declarada = useMemo(() => fuenteDeclarada(hecho), [hecho])
  const [fuente, setFuente] = useState<Resolucion<NotaMedica>>(
    declarada.tipo === 'nota'
      ? { estado: 'resolviendo' }
      : { estado: 'sin-fuente', porQue: declarada.tipo === 'ninguna' ? declarada.porQue : '' },
  )

  useEffect(() => {
    if (declarada.tipo !== 'nota') return
    let vivo = true
    const limite = limiteDelHecho(hecho)
    getNota(limite.clinicId, limite.patientId, declarada.notaId)
      .then(n => {
        if (!vivo) return
        if (!n) {
          /* La nota se pidió por id y no está. NO es «no consta procedencia»:
             consta, y el documento no aparece. Un expediente al que le falta
             la nota que sostiene un pendiente es un hallazgo, no un vacío. */
          setFuente({
            estado: 'no-se-pudo-leer',
            porQue: 'La nota de la que sale este pendiente ya no está en el expediente.',
          })
          return
        }
        if (!laNotaEsDeEstePaciente(n, limite)) {
          /* Familia «paciente equivocado»: se corta ANTES de pintar. */
          setFuente({
            estado: 'no-se-pudo-leer',
            porQue: 'La nota de origen dice pertenecer a otro paciente. No se enseña.',
          })
          return
        }
        setFuente({ estado: 'resuelta', valor: n })
      })
      .catch(e => {
        console.error('[lente] no se pudo leer la nota de origen', e)
        if (vivo) {
          setFuente({
            estado: 'no-se-pudo-leer',
            porQue: 'No se pudo leer la nota de origen. Revisa tu conexión y vuelve a intentarlo.',
          })
        }
      })
    return () => { vivo = false }
  }, [hecho, declarada])

  return (
    <>
      <Bloque rotulo="El pendiente">
        <p className="nx-lente-prosa">
          <strong>{ETIQUETA_TIPO[tarea.tipo] ?? 'Pendiente'}</strong>
          {tarea.detalle ? ` — ${tarea.detalle}` : ''}
        </p>
        <div className="nx-meta nx-lente-meta">
          <span><User size={13} aria-hidden="true" /> {tarea.ownerNombre || 'sin dueño'}</span>
          {tarea.venceEn && (
            <span className="nx-num">
              <Clock size={13} aria-hidden="true" /> {fechaLarga(tarea.venceEn)}
            </span>
          )}
        </div>
      </Bloque>

      <Bloque rotulo="Su origen">
        {fuente.estado === 'resolviendo' && <p className="nx-meta">Buscando la nota…</p>}
        {fuente.estado === 'sin-fuente' && <NoConsta>{fuente.porQue}</NoConsta>}
        {fuente.estado === 'no-se-pudo-leer' && <NoSePudoLeer>{fuente.porQue}</NoSePudoLeer>}
        {fuente.estado === 'resuelta' && <LaNotaDeOrigen tarea={tarea} nota={fuente.valor} />}
      </Bloque>
    </>
  )
}

function LaNotaDeOrigen({ tarea, nota }: { tarea: TareaClinica; nota: NotaMedica }) {
  const cita = useMemo(() => citaDeOrigen(tarea, nota), [tarea, nota])
  const procedencia = nota.iaAuditoria?.procedencia

  return (
    <>
      <p className="nx-lente-prosa">
        <FileText size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
        {TIPO_NOTA_LABEL[nota.tipo] ?? 'Nota'} del {fechaLarga(nota.fechaConsulta || nota.createdAt)}
        {/* FIRMADA o no es la diferencia entre un documento y un borrador, y
            cambia lo que este pendiente significa. No es un adorno de estado. */}
        {nota.estado === 'firmada'
          ? <>, firmada{nota.firma?.nombreMedico ? ` por ${nota.firma.nombreMedico}` : ''}.</>
          : <>, <strong>todavía sin firmar</strong>.</>}
      </p>

      {cita.literal ? (
        <figure className="nx-lente-cita">
          <Quote size={13} aria-hidden="true" />
          <blockquote>{cita.literal}</blockquote>
          <figcaption className="nx-meta">{cita.campo}, tal como quedó en la nota</figcaption>
        </figure>
      ) : (
        <NoConsta>{cita.porQue}</NoConsta>
      )}

      {/*
        LA PROCEDENCIA DE LA NOTA — sólo si la nota la trae.
        Es el mismo resumen que ya pinta `SelloProcedencia` dentro de la nota
        (`resumenProcedencia`), no un segundo cálculo: dos formas de contar lo
        mismo acabarían discrepando y la lente perdería su única razón de ser.
      */}
      {procedencia && (
        <p className="nx-meta" style={{ marginTop: 10 }}>
          {/*
            Se pasa el resumen TAL CUAL viene de la nota, sin rellenar
            `confirmados`. Ponerle un `0` afirmaría que el médico no aceptó
            ningún campo, cuando la verdad de una nota vieja es que eso no se
            registraba — «no consta» y «cero» no son lo mismo en un expediente,
            y el propio campo lo dice en su comentario.
          */}
          Datos estructurados de esa nota: {resumenProcedencia(procedencia)}.
        </p>
      )}

      {/*
        SALIR ES UN GESTO EXPLÍCITO Y ROTULADO COMO TAL.
        Inspeccionar no navega; abrir la nota entera sí, y por eso está aquí
        abajo, con su icono de «se va a otra pantalla». La lente no decide por
        el médico que quiere irse.
      */}
      <Link className="nx-lente-salida" href={`/nota/${nota.pacienteId || tarea.patientId}/${nota.id}`}>
        Abrir la nota completa <ExternalLink size={13} aria-hidden="true" />
      </Link>
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   EL ESTADO CLÍNICO DE UNA FILA → LOS PENDIENTES QUE LO PRODUCEN
   ──────────────────────────────────────────────────────────────────────────── */

function DeUnEstadoClinico({
  hecho,
}: { hecho: Extract<HechoInspeccionable, { clase: 'estado-clinico' }> }) {
  /*
    `ahora` se fija UNA vez al abrir, igual que en `/pendientes`: leer el reloj
    en cada render permite que dos renders del mismo segundo discrepen sobre si
    algo venció, y una lente que se contradice a sí misma no explica nada.
  */
  const [ahora] = useState(() => Date.now())
  const suyas = useMemo(
    () => [...hecho.tareas].sort((a, b) => ordenWorklist(a, b, ahora)),
    [hecho.tareas, ahora],
  )

  return (
    <Bloque rotulo={`Lo que produce este estado (${suyas.length})`}>
      <p className="nx-meta" style={{ marginBottom: 12 }}>
        La fila resume el pendiente que manda. Éstos son todos, en el mismo orden
        con el que trabaja <strong>Pendientes</strong> — es la misma lectura, no otra.
      </p>
      <ul className="nx-lente-lista">
        {suyas.map(t => {
          const esc = debeEscalar(t, ahora)
          return (
            <li key={t.id ?? `${t.tipo}-${t.creadaEn}`}>
              <div className="nx-lente-lista-titulo">
                <span className="nx-estado">{ETIQUETA_TIPO[t.tipo] ?? 'Pendiente'}</span>
                <strong>{t.titulo}</strong>
              </div>
              <div className="nx-meta nx-lente-meta">
                <span><User size={13} aria-hidden="true" /> {t.ownerNombre || 'sin dueño'}</span>
                {t.venceEn && (
                  <span className="nx-num" style={{ color: estaVencida(t, ahora) ? 'var(--red)' : undefined }}>
                    <Clock size={13} aria-hidden="true" />
                    {estaVencida(t, ahora) ? 'venció' : 'vence'} {fechaLarga(t.venceEn)}
                  </span>
                )}
              </div>
              {/* El porqué en prosa, igual que en la fila: la consecuencia, no
                  el estado. `/pendientes` puntúa 1.0 por decir «venció y nadie
                  la tomó» en vez de pintar un chip rojo. */}
              {esc.escalar && <p className="nx-critico" style={{ margin: '4px 0 0' }}>{esc.motivo}</p>}
            </li>
          )
        })}
      </ul>
      <Link className="nx-lente-salida" href="/pendientes">
        Trabajarlos en Pendientes <ExternalLink size={13} aria-hidden="true" />
      </Link>
    </Bloque>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   LA BANDA DE ALERGIAS → EL TEXTO DEL QUE SE LEYÓ
   ──────────────────────────────────────────────────────────────────────────── */

function DeLasAlergias({
  hecho,
}: { hecho: Extract<HechoInspeccionable, { clase: 'alergias' }> }) {
  const { alergenos, textoLibre, estructuradas } = hecho
  const texto = String(textoLibre ?? '').trim()
  const conEstructura = (estructuradas ?? []).filter(a => String(a?.alergeno ?? '').trim())

  return (
    <>
      <Bloque rotulo="Lo que la banda dice">
        <p className="nx-lente-prosa">
          {alergenos.length
            ? <><strong>{alergenos.join(' · ')}</strong></>
            : 'Ningún alérgeno registrado.'}
        </p>
      </Bloque>

      <Bloque rotulo="De dónde se leyó">
        {conEstructura.length > 0 && (
          <ul className="nx-lente-lista">
            {conEstructura.map((a, i) => (
              <li key={`${a.alergeno}-${i}`}>
                <div className="nx-lente-lista-titulo"><strong>{a.alergeno}</strong></div>
                <div className="nx-meta nx-lente-meta">
                  {a.tipo && <span>{a.tipo}</span>}
                  {a.severidad && <span>{a.severidad}</span>}
                  {a.reaccion && <span>{a.reaccion}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {texto ? (
          <figure className="nx-lente-cita">
            <Quote size={13} aria-hidden="true" />
            <blockquote>{texto}</blockquote>
            <figcaption className="nx-meta">
              El campo de alergias del expediente, tal como está escrito
            </figcaption>
          </figure>
        ) : conEstructura.length === 0 ? (
          /*
            REGLA 4, EN LA DIRECCIÓN QUE CUESTA. Que el campo esté vacío no
            significa que el paciente no tenga alergias: significa que nadie lo
            llenó. Decir aquí «sin alergias» sería convertir un hueco del
            registro en una afirmación clínica que nadie hizo.
          */
          <NoConsta>
            El campo de alergias está vacío. Eso no dice que el paciente no
            tenga: dice que nadie lo ha registrado.
          </NoConsta>
        ) : null}

        {/*
          POR QUÉ SE ENSEÑA EL TEXTO CRUDO AL LADO DE LA LECTURA.
          La banda no pinta el campo: pinta lo que la semántica sellada de
          REG-311 ENTENDIÓ del campo («Niega penicilina. Alérgico a sulfas» →
          sulfas). Enseñar las dos cosas juntas es la única forma de que el
          médico pueda cazar una lectura equivocada antes de que llegue a una
          receta impresa con su cédula.
        */}
        {texto && (
          <p className="nx-meta" style={{ marginTop: 10 }}>
            La banda no repite este texto: enseña lo que se entendió de él. Si las
            dos cosas no coinciden, manda el texto — y hay que corregirlo en el
            expediente.
          </p>
        )}
      </Bloque>
    </>
  )
}
