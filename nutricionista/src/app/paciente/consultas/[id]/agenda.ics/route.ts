import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const ics = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`)

/** "Adicionar à agenda": arquivo .ics da consulta do próprio paciente (Google Agenda, Apple, Outlook). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const { id } = await params
  if (!user?.patientId || !uuid.safeParse(id).success) return new Response('Não encontrado', { status: 404 })
  const [a] = await db
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.id, id), eq(schema.appointments.patientId, user.patientId)))
  if (!a) return new Response('Não encontrado', { status: 404 })
  const s = await getSettings()
  const where = a.modality === 'online' ? (a.meetingUrl ?? 'On-line (link no app)') : (s.address ?? 'Consultório')
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Consultorio//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${a.id}@consultorio`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(a.startAt)}`,
    `DTEND:${ics(a.endAt)}`,
    `SUMMARY:${esc(`${a.serviceName} · ${s.professionalName}`)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`Consulta ${a.modality === 'online' ? 'on-line' : 'presencial'}. Código ${a.code ?? ''}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Consulta em 2 horas',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="consulta.ics"', 'Cache-Control': 'private, no-store' } })
}
