import 'server-only'
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { ChatHours } from '@/db/schema'
import { notifyUser } from './notify'
import { notifyTeam } from './team'
import { pushToTeam, pushToUser } from './push'
import { getSettings } from './settings'
import { fmtDateTime, fmtDay, timeToMinutes, zonedParts } from './time'
import type { ChatMessage } from '@/components/nutri/ChatThread'

/** Dentro do horário de atendimento do chat? Sem horário configurado, sempre. */
export function withinChatHours(h: ChatHours | null | undefined, weekday: number, hhmm: string) {
  if (!h) return true
  const now = timeToMinutes(hhmm)
  return h.weekdays.includes(weekday) && now >= timeToMinutes(h.start) && now < timeToMinutes(h.end)
}

type Post = {
  patientId: string
  senderId: string
  fromPatient: boolean
  body: string
  attachmentFileId?: string | null
  diaryEntryId?: string | null
  isGuidance?: boolean
  /** Nome de quem enviou (aparece na notificação). */
  senderName: string
}

/**
 * Envia uma mensagem da conversa paciente ↔ nutricionista, com aviso no sistema e push.
 * Fora do horário de atendimento, o paciente recebe a resposta automática (no máximo uma a cada 12 h).
 */
export async function postMessage(p: Post) {
  const [msg] = await db
    .insert(schema.messages)
    .values({
      patientId: p.patientId,
      senderId: p.senderId,
      fromPatient: p.fromPatient,
      body: p.body,
      attachmentFileId: p.attachmentFileId ?? null,
      diaryEntryId: p.diaryEntryId ?? null,
      isGuidance: p.isGuidance ?? false,
    })
    .returning()
  const s = await getSettings()
  const now = zonedParts(new Date(), s.timezone)
  const preview = p.body.length > 90 ? `${p.body.slice(0, 87)}…` : p.body

  if (p.fromPatient) {
    await notifyTeam('clinico', 'Nova mensagem de paciente', p.senderName, `/admin/pacientes/${p.patientId}?aba=mensagens`, p.patientId)
    await pushToTeam('clinico', { title: `Mensagem de ${p.senderName.split(' ')[0]}`, body: preview, url: `/admin/pacientes/${p.patientId}?aba=mensagens`, tag: `chat-${p.patientId}` }, p.patientId)
    if (s.chatAutoReply && !withinChatHours(s.chatHours, now.weekday, now.time)) {
      const [recent] = await db
        .select({ id: schema.messages.id })
        .from(schema.messages)
        .where(and(eq(schema.messages.patientId, p.patientId), eq(schema.messages.automatic, true), gte(schema.messages.createdAt, new Date(Date.now() - 12 * 3_600_000))))
        .limit(1)
      if (!recent) await db.insert(schema.messages).values({ patientId: p.patientId, senderId: null, fromPatient: false, automatic: true, body: s.chatAutoReply })
    }
  } else {
    // Ao responder, as mensagens do paciente contam como lidas.
    await db
      .update(schema.messages)
      .set({ readAt: new Date() })
      .where(and(eq(schema.messages.patientId, p.patientId), eq(schema.messages.fromPatient, true), isNull(schema.messages.readAt)))
    const [pt] = await db.select({ userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.id, p.patientId))
    if (pt?.userId) {
      await notifyUser(pt.userId, p.isGuidance ? 'Nova orientação do nutricionista' : 'Nova mensagem do nutricionista', undefined, '/paciente/mensagens')
      await pushToUser(pt.userId, 'mensagens', { title: p.isGuidance ? 'Nova orientação' : `Mensagem de ${s.professionalName.split(' ')[0]}`, body: preview, url: '/paciente/mensagens', tag: 'chat' }, { nowHHMM: now.time })
    }
  }
  return msg
}

/** Mensagens da conversa, com o nome de quem enviou. */
export async function threadOf(patientId: string, limit = 200) {
  const rows = await db
    .select({ m: schema.messages, sender: schema.users.name })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.users.id, schema.messages.senderId))
    .where(eq(schema.messages.patientId, patientId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit)
  return rows.reverse()
}

/** Conversa pronta para a tela (anexos, registro do diário citado e indicador de lida). */
export async function threadView(patientId: string, viewer: 'patient' | 'team', names: { professional: string; patient: string }): Promise<ChatMessage[]> {
  const s = await getSettings()
  const rows = await threadOf(patientId)
  const fileIds = rows.map((r) => r.m.attachmentFileId).filter((v): v is string => !!v)
  const diaryIds = rows.map((r) => r.m.diaryEntryId).filter((v): v is string => !!v)
  const [files, diary] = await Promise.all([
    fileIds.length ? db.select().from(schema.files).where(and(inArray(schema.files.id, fileIds), eq(schema.files.patientId, patientId))) : [],
    diaryIds.length ? db.select().from(schema.diaryEntries).where(and(inArray(schema.diaryEntries.id, diaryIds), eq(schema.diaryEntries.patientId, patientId))) : [],
  ])
  return rows.map(({ m, sender }) => {
    const f = files.find((x) => x.id === m.attachmentFileId)
    const d = diary.find((x) => x.id === m.diaryEntryId)
    const mine = viewer === 'patient' ? m.fromPatient : !m.fromPatient
    return {
      id: m.id,
      mine,
      author: m.fromPatient ? (viewer === 'patient' ? 'Você' : names.patient) : viewer === 'patient' ? names.professional : (sender ?? 'Equipe'),
      body: m.body,
      at: fmtDateTime(m.createdAt, s.timezone),
      attachment: f ? { url: `/arquivos/${f.id}`, mime: f.mime, title: f.title } : null,
      diary: d ? { meal: d.meal, date: fmtDay(d.date), photoUrl: d.photoFileId ? `/arquivos/${d.photoFileId}` : null, foods: d.foods } : null,
      guidance: m.isGuidance,
      automatic: m.automatic,
      read: !!m.readAt,
    }
  })
}
