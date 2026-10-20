import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/audit'

/** Portabilidade (LGPD art. 18): exporta os dados do próprio paciente em JSON. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return new Response('Não autorizado', { status: 401 })
  const pid = user.patientId
  const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.id, pid))
  const by = <T,>(p: Promise<T>) => p
  const [appointments, measurements, goals, plans, diary, messages, forms, consents, files, mealLogs, water, photos, prefs] = await Promise.all([
    by(db.select().from(schema.appointments).where(eq(schema.appointments.patientId, pid))),
    by(db.select().from(schema.measurements).where(eq(schema.measurements.patientId, pid))),
    by(db.select().from(schema.goals).where(eq(schema.goals.patientId, pid))),
    by(db.select().from(schema.mealPlans).where(eq(schema.mealPlans.patientId, pid)).orderBy(desc(schema.mealPlans.version))),
    by(db.select().from(schema.diaryEntries).where(eq(schema.diaryEntries.patientId, pid))),
    by(db.select().from(schema.messages).where(eq(schema.messages.patientId, pid))),
    by(db.select().from(schema.formAssignments).where(eq(schema.formAssignments.patientId, pid))),
    by(db.select().from(schema.consents).where(eq(schema.consents.patientId, pid))),
    by(db.select({ id: schema.files.id, title: schema.files.title, kind: schema.files.kind, createdAt: schema.files.createdAt }).from(schema.files).where(eq(schema.files.patientId, pid))),
    by(db.select().from(schema.mealLogs).where(eq(schema.mealLogs.patientId, pid))),
    by(db.select().from(schema.waterLogs).where(eq(schema.waterLogs.patientId, pid))),
    by(db.select({ data: schema.progressPhotos.date, angulo: schema.progressPhotos.angle, arquivo: schema.progressPhotos.fileId }).from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, pid))),
    by(db.select({ notificacoes: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, user.id))),
  ])
  const data = {
    geradoEm: new Date().toISOString(),
    observacao: 'Cópia dos seus dados pessoais. Observações clínicas internas do profissional não são incluídas neste arquivo; solicite-as ao consultório, se desejar.',
    cadastro: patient,
    consultas: appointments.map(({ internalNotes: _i, ...a }) => a),
    medidas: measurements,
    metas: goals,
    planosAlimentares: plans.filter((p) => p.status !== 'rascunho'),
    diarioAlimentar: diary,
    refeicoesMarcadas: mealLogs,
    agua: water,
    fotosDeEvolucao: photos,
    preferenciasDeNotificacao: prefs[0]?.notificacoes ?? null,
    mensagens: messages,
    formularios: forms,
    consentimentos: consents,
    arquivos: files,
  }
  await audit(user, 'lgpd_exportacao', 'paciente', { entityId: pid, patientId: pid })
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
