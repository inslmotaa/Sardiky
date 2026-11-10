import 'server-only'
import { createHash } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { audit } from './audit'
import type { CurrentUser } from './auth/session'
import { saveSystemFile } from './storage'

type Actor = Pick<CurrentUser, 'id' | 'name' | 'role'>

/**
 * Cópia dos dados pessoais do cliente (portabilidade, LGPD art. 18), usada no "Baixar meus dados"
 * e, automaticamente, antes de excluir a conta ou anonimizar o prontuário.
 */
export async function buildPatientExport(pid: string, userId: string | null) {
  const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.id, pid))
  const by = <T,>(p: Promise<T>) => p
  const [appointments, measurements, goals, plans, diary, messages, forms, consents, files, mealLogs, water, photos, prefs, prescriptions, anamneses, testimonials] = await Promise.all([
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
    by(db.select({ notificacoes: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, userId ?? ''))),
    by(db.select().from(schema.prescriptions).where(eq(schema.prescriptions.patientId, pid))),
    by(db.select().from(schema.anamneses).where(eq(schema.anamneses.patientId, pid))),
    by(db.select().from(schema.testimonials).where(eq(schema.testimonials.patientId, pid))),
  ])
  const [checkins, payments, heights, photoSets] = await Promise.all([
    db.select().from(schema.checkins).where(eq(schema.checkins.patientId, pid)),
    db
      .select({ descricao: schema.payments.description, valorCentavos: schema.payments.amountCents, situacao: schema.payments.status, pagoEm: schema.payments.paidAt, forma: schema.payments.method, recibo: schema.payments.receiptNumber })
      .from(schema.payments)
      .where(eq(schema.payments.patientId, pid)),
    db.select({ data: schema.heightLogs.date, alturaCm: schema.heightLogs.heightCm, origem: schema.heightLogs.source }).from(schema.heightLogs).where(eq(schema.heightLogs.patientId, pid)),
    db.select({ data: schema.photoSets.date, comentarioDoCoach: schema.photoSets.coachComment }).from(schema.photoSets).where(eq(schema.photoSets.patientId, pid)),
  ])
  const data = {
    geradoEm: new Date().toISOString(),
    observacao: 'Cópia dos seus dados pessoais. Observações clínicas internas do profissional não são incluídas neste arquivo; solicite-as ao seu coach, se desejar.',
    cadastro: patient,
    consultas: appointments.map(({ internalNotes: _i, ...a }) => a),
    medidas: measurements,
    historicoDePeso: measurements
      .filter((m) => m.weightKg != null)
      .map((m) => ({ data: m.date, pesoKg: m.weightKg, origem: m.source === 'profissional' ? 'medido pelo coach' : 'informado pelo cliente' })),
    historicoDeAltura: heights.map((h) => ({ ...h, origem: h.origem === 'profissional' ? 'medido pelo coach' : 'informado pelo cliente' })),
    conjuntosDeFotosDoCorpo: photoSets,
    metas: goals,
    planosAlimentares: plans.filter((p) => p.status !== 'rascunho'),
    diarioAlimentar: diary,
    refeicoesMarcadas: mealLogs,
    agua: water,
    fotosDeEvolucao: photos,
    preferenciasDeNotificacao: prefs[0]?.notificacoes ?? null,
    prescricoes: prescriptions,
    anamneses,
    mensagens: messages,
    formularios: forms,
    consentimentos: consents,
    depoimentosAutorizados: testimonials,
    checkins,
    pagamentos: payments,
    arquivos: files,
  }
  return data
}

/** Quantos dias a exportação automática fica guardada (para entregar ao titular a pedido). */
export const EXPORT_RETENTION_DAYS = 30

/**
 * Antes de excluir a conta ou anonimizar: gera a exportação completa, guarda como arquivo privado
 * (só quem administra a privacidade baixa; apagado sozinho depois de 30 dias) e registra na
 * auditoria o resumo SHA-256, o tamanho e o motivo — sem copiar dados pessoais para o log.
 */
export async function archiveExportBeforeDeletion(pid: string, userId: string | null, actor: Actor | null, motivo: 'conta_excluida_pelo_cliente' | 'anonimizacao') {
  const data = { ...(await buildPatientExport(pid, userId)), motivo, guardadoAte: new Date(Date.now() + EXPORT_RETENTION_DAYS * 86_400_000).toISOString() }
  const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf8')
  const sha256 = createHash('sha256').update(buf).digest('hex')
  const saved = await saveSystemFile(buf, 'json', 'application/json')
  const protocolo = sha256.slice(0, 10).toUpperCase()
  const [f] = await db
    .insert(schema.files)
    .values({ patientId: null, uploadedBy: actor?.id ?? null, kind: 'lgpd_exportacao', title: `Exportação LGPD ${protocolo}`, mime: saved.mime, size: saved.size, storageKey: saved.key, isPublic: false })
    .returning({ id: schema.files.id })
  await audit(actor, 'lgpd_exportacao_automatica', 'paciente', { entityId: pid, patientId: pid, details: { motivo, arquivo: f.id, protocolo, sha256, bytes: saved.size, guardadoPorDias: EXPORT_RETENTION_DAYS } })
  return { fileId: f.id, sha256, protocolo }
}

/**
 * Exportação completa em ZIP: o JSON acima e todas as fotos do cliente (corpo, pratos, check-ins e
 * demais arquivos dele), com nomes legíveis. Arquivos que sumiram do disco ficam listados no JSON.
 */
export async function buildPatientExportZip(pid: string, userId: string | null) {
  const { readUpload } = await import('./storage')
  const { zip } = await import('./zip')
  const data = await buildPatientExport(pid, userId)
  const rows = await db.select().from(schema.files).where(eq(schema.files.patientId, pid))
  const photos = await db.select().from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, pid))
  const ext = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'application/pdf' ? 'pdf' : mime.startsWith('audio/') ? mime.split('/')[1] : 'jpg')
  const folder = (kind: string) => (kind === 'foto_evolucao' ? 'fotos-do-corpo' : kind === 'foto_refeicao' ? 'fotos-dos-pratos' : kind === 'checkin' ? 'fotos-dos-checkins' : kind === 'lgpd_exportacao' ? null : 'arquivos')
  const used = new Set<string>()
  const entries: { name: string; data: Buffer | string }[] = []
  for (const f of rows) {
    const dir = folder(f.kind)
    if (!dir) continue
    const bytes = await readUpload(f.storageKey).catch(() => null)
    if (!bytes) continue
    const ph = photos.find((x) => x.fileId === f.id)
    const base = (ph ? `${ph.date}-${ph.angle}` : `${f.createdAt.toISOString().slice(0, 10)}-${f.title}`)
      .normalize('NFD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)
    let name = `${dir}/${base}.${ext(f.mime)}`
    for (let i = 2; used.has(name); i++) name = `${dir}/${base}-${i}.${ext(f.mime)}`
    used.add(name)
    entries.push({ name, data: bytes })
  }
  return zip([{ name: 'meus-dados.json', data: JSON.stringify(data, null, 2) }, ...entries])
}
