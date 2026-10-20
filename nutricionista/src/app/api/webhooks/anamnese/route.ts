import { timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { audit } from '@/lib/audit'
import { applyAnamnesis } from '@/lib/anamnese'
import { notifyTeam } from '@/lib/team'
import { pushToTeam } from '@/lib/push'
import { rateLimit } from '@/lib/rate-limit'
import type { FormField } from '@/lib/forms'

/**
 * Recebe respostas de anamnese de formulários externos (Google Forms via Apps Script, Tally, Typeform).
 * Cabeçalho: Authorization: Bearer ANAMNESE_WEBHOOK_SECRET
 * Corpo JSON: { "email": "...", "nome": "...", "telefone": "...", "respostas": { "Pergunta": "Resposta" | ["A", "B"] } }
 * Encontra o paciente pelo e-mail (ou cria um cadastro novo) e guarda as respostas na ficha.
 * Perguntas cujo texto fala em restrições/alergias/intolerâncias vão para as restrições do paciente.
 */
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  nome: z.string().trim().min(2).max(160).optional(),
  telefone: z.string().trim().max(30).optional(),
  respostas: z.record(z.string().min(1).max(300), z.union([z.string().max(5000), z.array(z.string().max(300)).max(40)])),
})

export async function POST(req: Request) {
  const secret = process.env.ANAMNESE_WEBHOOK_SECRET
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }
  if (!rateLimit('webhook:anamnese', 120, 60 * 60_000)) return Response.json({ erro: 'muitas requisições' }, { status: 429 })
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return Response.json({ erro: 'dados inválidos', detalhes: parsed.error.issues.slice(0, 3).map((i) => i.message) }, { status: 400 })
  const d = parsed.data
  if (Object.keys(d.respostas).length > 120) return Response.json({ erro: 'respostas demais' }, { status: 400 })

  let [patient] = await db.select().from(schema.patients).where(eq(schema.patients.email, d.email))
  let created = false
  if (!patient) {
    ;[patient] = await db
      .insert(schema.patients)
      .values({ fullName: d.nome ?? d.email, email: d.email, phone: d.telefone?.replace(/\D/g, '') || null, status: 'ativo', stage: 'Avaliação inicial' })
      .returning()
    created = true
  }
  // Cada pergunta vira um campo (texto), na ordem recebida.
  const fields: FormField[] = Object.keys(d.respostas).map((label, i) => ({
    id: `q${i + 1}`,
    label,
    type: Array.isArray(d.respostas[label]) ? 'checkbox' : 'textarea',
    required: false,
    options: Array.isArray(d.respostas[label]) ? (d.respostas[label] as string[]) : [],
    help: '',
    mapsTo: /restri|alergi|intoler/i.test(label) ? 'restricoes' : /objetivo/i.test(label) ? 'objetivo' : null,
  }))
  const answers = Object.fromEntries(fields.map((f) => [f.id, d.respostas[f.label]]))
  const [a] = await db
    .insert(schema.formAssignments)
    .values({ patientId: patient.id, title: 'Anamnese (formulário externo)', kind: 'anamnese', fields, answers, answeredAt: new Date(), source: 'externa' })
    .returning({ id: schema.formAssignments.id })
  await applyAnamnesis(patient.id, fields, answers)
  await notifyTeam('clinico', 'Anamnese recebida (formulário externo)', patient.fullName, `/admin/pacientes/${patient.id}?aba=formularios`, patient.id)
  await pushToTeam('clinico', { title: 'Anamnese recebida', body: patient.fullName, url: `/admin/pacientes/${patient.id}?aba=formularios` }, patient.id)
  await audit(null, 'anamnese_externa_recebida', 'formulario', { entityId: a.id, patientId: patient.id, details: { pacienteNovo: created } })
  return Response.json({ ok: true, pacienteNovo: created, pacienteId: patient.id })
}
