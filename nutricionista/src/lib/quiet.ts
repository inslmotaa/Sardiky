import type { NotificationPrefs } from '@/db/schema'
import { timeToMinutes } from './time'

/** Está dentro do horário de silêncio? (janela pode atravessar a meia-noite: 22:00–07:00). Vale para todos os canais. */
export function inQuietHours(prefs: Pick<NotificationPrefs, 'quietStart' | 'quietEnd'>, nowHHMM: string) {
  const now = timeToMinutes(nowHHMM)
  const a = timeToMinutes(prefs.quietStart)
  const b = timeToMinutes(prefs.quietEnd)
  if (a === b) return false
  return a < b ? now >= a && now < b : now >= a || now < b
}

/** Janela de cada lembrete: a tarefa roda a cada 5 minutos; 15 minutos de folga cobrem atrasos. */
export const REMINDER_WINDOW_MIN = 15

/**
 * Push da refeição sai agora? Só na janela do horário, se a refeição ainda não foi marcada no app
 * e fora do horário de silêncio (a mesma regra vale para o calendário e o e-mail).
 */
export function mealPushDue(o: { now: string; mealTime: string | null | undefined; alreadyLogged: boolean; quiet: Pick<NotificationPrefs, 'quietStart' | 'quietEnd'> }) {
  if (!o.mealTime || o.alreadyLogged || inQuietHours(o.quiet, o.now)) return false
  const now = timeToMinutes(o.now)
  const at = timeToMinutes(o.mealTime)
  return now >= at && now < at + REMINDER_WINDOW_MIN
}
