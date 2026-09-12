/**
 * EL BORRADOR EN VIVO SE ARMA CON EL PARSER LOCAL, NO CON UN MODELO (D-062).
 *
 * ── QUÉ PASABA ───────────────────────────────────────────────────────────────
 *
 * Mientras el médico grababa, cada ~15 s con 18 palabras nuevas la pantalla
 * pedía al servidor una nota «rápida» (Haiku) con todo lo dictado hasta ese
 * momento. En una consulta de 20 minutos eran unos 40 pases: el prompt del
 * sistema entero, la transcripción creciente y un JSON de salida cada vez.
 * Costaba casi lo mismo que la nota final, y el médico no lo mira mientras
 * atiende: es provisional por definición, se reemplaza al terminar.
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 * El parser clínico —determinista, con sus pruebas— extrae signos vitales,
 * medicamentos, alergias y comorbilidades al instante y gratis. Eso es el
 * borrador. La nota final la sigue escribiendo el modelo, con el nivel que
 * decida el servidor.
 *
 * Es cliente-seguro a propósito: corre en el navegador, sin red.
 *
 * ── QUÉ NO ES ────────────────────────────────────────────────────────────────
 *
 * No es el respaldo de «la IA falló». Ése sigue en el servidor
 * (`parserClinicoComoRespuestaIA`) con su aviso. Aquí no hay fallo que avisar,
 * así que no se pinta el texto de «IA externa no disponible» ni se marcan
 * campos críticos faltantes: el pase en vivo sólo rellena huecos.
 */
import type { TipoNota } from '@/types/expediente'
import { parserClinicoComoRespuestaIA } from './parser-clinico'

export type BorradorLocal = ReturnType<typeof parserClinicoComoRespuestaIA> & {
  _borradorLocal: true
  _modelo: 'parser-local'
  _promptVersion: 'n/a'
  _apiVersion: 'n/a'
}

export function borradorLocal(transcripcion: string, tipo: TipoNota): BorradorLocal {
  const base = parserClinicoComoRespuestaIA(transcripcion, tipo)
  return {
    ...base,
    // Sin frase de respaldo: el resumen lo escribe el modelo al final.
    resumenEjecutivo: '',
    safety: { ...base.safety, missing_critical_fields: [] },
    _borradorLocal: true,
    _modelo: 'parser-local',
    _promptVersion: 'n/a',
    _apiVersion: 'n/a',
  }
}
