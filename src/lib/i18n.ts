/**
 * Internacionalización ligera (sin dependencias externas) — base para LATAM.
 *
 * Estrategia conservadora: por ahora español-MX es el idioma activo y
 * los strings están en sus componentes (no se rompe nada). Cuando se
 * quiera ofrecer portugués (Brasil) o variantes regionales, se centraliza
 * aquí sin reescribir los componentes.
 *
 * Patrón de uso futuro:
 *   const t = useT()
 *   <button>{t('cita.confirmar')}</button>
 */

export type Locale = 'es-MX' | 'es-CO' | 'es-AR' | 'es-CL' | 'es-PE' | 'es-UY' | 'pt-BR'

export interface DiccionarioI18n {
  // ── Genéricos
  'app.name': string
  'common.save': string
  'common.cancel': string
  'common.confirm': string
  'common.delete': string
  'common.loading': string
  'common.error': string

  // ── Citas
  'cita.confirmar': string
  'cita.cancelar': string
  'cita.reprogramar': string
  'cita.no_asistio': string

  // ── Pacientes
  'paciente.nuevo': string
  'paciente.alergias': string

  // ── Consentimientos
  'consent.privacy': string
  'consent.informed': string
  'consent.voice': string
  'consent.tele': string
}

const ES_MX: DiccionarioI18n = {
  'app.name': 'Agenda Médica',
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',
  'common.delete': 'Eliminar',
  'common.loading': 'Cargando…',
  'common.error': 'Error',

  'cita.confirmar': 'Confirmar cita',
  'cita.cancelar': 'Cancelar cita',
  'cita.reprogramar': 'Reprogramar',
  'cita.no_asistio': 'No asistió',

  'paciente.nuevo': 'Nuevo paciente',
  'paciente.alergias': 'Alergias',

  'consent.privacy': 'Acepto el aviso de privacidad',
  'consent.informed': 'Doy mi consentimiento informado',
  'consent.voice': 'Acepto que la consulta sea grabada para transcripción y resumen clínico',
  'consent.tele': 'Acepto las condiciones de la teleconsulta',
}

const PT_BR: DiccionarioI18n = {
  'app.name': 'Agenda Médica',
  'common.save': 'Salvar',
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',
  'common.delete': 'Excluir',
  'common.loading': 'Carregando…',
  'common.error': 'Erro',

  'cita.confirmar': 'Confirmar consulta',
  'cita.cancelar': 'Cancelar consulta',
  'cita.reprogramar': 'Reagendar',
  'cita.no_asistio': 'Não compareceu',

  'paciente.nuevo': 'Novo paciente',
  'paciente.alergias': 'Alergias',

  'consent.privacy': 'Aceito o aviso de privacidade',
  'consent.informed': 'Dou meu consentimento informado',
  'consent.voice': 'Aceito que a consulta seja gravada para transcrição e resumo clínico',
  'consent.tele': 'Aceito as condições da teleconsulta',
}

const DICCIONARIOS: Record<Locale, DiccionarioI18n> = {
  'es-MX': ES_MX,
  'es-CO': ES_MX,   // por ahora reusan es-MX
  'es-AR': ES_MX,
  'es-CL': ES_MX,
  'es-PE': ES_MX,
  'es-UY': ES_MX,
  'pt-BR': PT_BR,
}

let LOCALE_ACTIVO: Locale = 'es-MX'

export function setLocale(l: Locale) { LOCALE_ACTIVO = l }
export function getLocale(): Locale { return LOCALE_ACTIVO }

/** Traduce una clave. Si no existe, devuelve la clave (útil para detectar faltantes). */
export function t(key: keyof DiccionarioI18n, locale: Locale = LOCALE_ACTIVO): string {
  return (DICCIONARIOS[locale] ?? ES_MX)[key] ?? key
}

/** Locales que ya tienen traducción completa (no fallback a es-MX). */
export const LOCALES_COMPLETOS: Locale[] = ['es-MX', 'pt-BR']
