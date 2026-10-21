// Aplica os dados reais do consultório (deploy/perfil.json) no banco de produção:
// perfil, contatos, agenda, chat, serviços e perguntas frequentes. Também desliga a faixa de demonstração.
// Uso:
//   node scripts/aplicar-perfil.mjs deploy/perfil.json --conferir   (só confere, não grava)
//   DATABASE_URL=... node scripts/aplicar-perfil.mjs deploy/perfil.json
// No servidor (Docker), lendo o arquivo pela entrada padrão:
//   docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T app node scripts/aplicar-perfil.mjs - < deploy/perfil.json
// Pode ser rodado de novo sempre que os dados mudarem. Foto, logo e assinatura são enviadas pelo painel (Configurações).
import { readFileSync } from 'node:fs'
import { z } from 'zod'

const [fileArg, ...flags] = process.argv.slice(2)
const onlyCheck = flags.includes('--conferir')
if (!fileArg) {
  console.error('Uso: node scripts/aplicar-perfil.mjs deploy/perfil.json [--conferir]')
  process.exit(1)
}

let raw
try {
  raw = JSON.parse(readFileSync(fileArg === '-' ? 0 : fileArg, 'utf8'))
} catch (err) {
  console.error(`Não consegui ler o arquivo: ${err.message}`)
  process.exit(1)
}

// 1. Campos ainda não preenchidos ou dados de exemplo esquecidos.
const EXAMPLE = [/PREENCHER/i, /example\.com/i, /^5500000000000$/, /Rua Exemplo/i, /\(exemplo/i, /fict[ií]ci/i]
const pending = []
;(function scan(v, path) {
  if (typeof v === 'string') {
    if (EXAMPLE.some((re) => re.test(v))) pending.push(`${path}: ${v}`)
  } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k)
})(raw, '')
if (pending.length) {
  console.error('Ainda faltam dados reais nestes campos:')
  for (const p of pending) console.error(`  - ${p}`)
  process.exit(1)
}

// 2. Formato de cada campo.
const DIAS = { domingo: 0, segunda: 1, terca: 2, 'terça': 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, 'sábado': 6 }
const dia = z.string().transform((v, ctx) => {
  const n = DIAS[v.trim().toLowerCase().replace(/-feira$/, '')]
  if (n === undefined) ctx.addIssue({ code: 'custom', message: `dia inválido: "${v}" (use segunda, terca, …)` })
  return n ?? 0
})
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use o formato HH:MM, ex. 08:00')
const texto = (max) => z.string().trim().min(1, 'não pode ficar vazio').max(max)
const whatsapp = z.string().transform((v, ctx) => {
  let d = v.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = `55${d}` // DDD + número: adiciona o código do Brasil
  if (!/^55\d{10,11}$/.test(d)) ctx.addIssue({ code: 'custom', message: 'use DDD + número, ex. (41) 99999-9999' })
  return d
})
const instagram = z.string().transform((v, ctx) => {
  const handle = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) ctx.addIssue({ code: 'custom', message: 'use @usuario ou o link do perfil' })
  return `https://instagram.com/${handle}`
})
const reais = z.number({ error: 'informe o valor em reais, só o número (ex. 250 ou 249.90)' }).min(0).max(100000)

const Perfil = z.object({
  profissional: z.object({
    nome: texto(120),
    titulo: texto(80),
    crn: z.string().trim().regex(/^CRN-?\s?\d{1,2}\s*[\d.\s/-]{3,}[A-Z]?$/i, 'use o formato CRN-8 12345'),
    biografia: texto(3000),
    especialidades: z.array(texto(80)).max(12),
    metodo: texto(3000),
    diferenciais: z.array(texto(200)).max(12),
    comoFunciona: z.array(z.object({ titulo: texto(60), texto: texto(300) })).max(6),
    corDaMarca: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'use uma cor como #2f5d50'),
    assinatura: z.string().trim().max(200).optional(),
  }),
  contato: z.object({
    whatsapp,
    instagram: instagram.optional(),
    email: z.email('e-mail inválido'),
    emailPrivacidade: z.email('e-mail inválido'),
    endereco: texto(300),
    horarioTexto: texto(200),
    modalidadeTexto: texto(200),
  }),
  anamneseUrl: z.url({ protocol: /^https$/, error: 'use o link completo (https://…)' }).optional(),
  agenda: z.object({
    fusoHorario: z.string().default('America/Sao_Paulo'),
    intervaloMinutos: z.number().int().min(5).max(120),
    folgaEntreConsultasMinutos: z.number().int().min(0).max(120),
    antecedenciaMinimaHoras: z.number().int().min(0).max(240),
    diasAFrente: z.number().int().min(1).max(365),
    horarios: z
      .array(z.object({ dia, inicio: hora, fim: hora }).refine((h) => h.inicio < h.fim, 'o início precisa ser antes do fim'))
      .min(1, 'informe ao menos um horário de atendimento'),
  }),
  chat: z
    .object({
      horario: z.object({ inicio: hora, fim: hora, dias: z.array(dia).min(1) }).optional(),
      respostaAutomatica: z.string().trim().max(500).optional(),
      respostasRapidas: z.array(texto(200)).max(20).default([]),
    })
    .default({ respostasRapidas: [] }),
  refeicoesPadrao: z.array(z.object({ nome: texto(60), horario: hora })).max(10).default([]),
  servicos: z
    .array(
      z.object({
        nome: texto(120),
        descricao: z.string().trim().max(1000).default(''),
        modalidade: z.enum(['presencial', 'online', 'ambos'], { error: 'use presencial, online ou ambos' }),
        duracaoMinutos: z.number().int().min(10).max(300),
        preco: reais,
        publico: z.boolean().default(true),
      }),
    )
    .min(1, 'informe ao menos um serviço'),
  perguntasFrequentes: z.array(z.object({ pergunta: texto(200), resposta: texto(2000) })).default([]),
})

const parsed = Perfil.safeParse(raw)
if (!parsed.success) {
  console.error('Corrija estes campos:')
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join('.') || '(arquivo)'}: ${i.message}`)
  process.exit(1)
}
const p = parsed.data
try {
  new Intl.DateTimeFormat('pt-BR', { timeZone: p.agenda.fusoHorario })
} catch {
  console.error(`Fuso horário inválido: ${p.agenda.fusoHorario}`)
  process.exit(1)
}
if (new Set(p.servicos.map((s) => s.nome.toLowerCase())).size !== p.servicos.length) {
  console.error('Há serviços com o mesmo nome; use nomes diferentes.')
  process.exit(1)
}

if (onlyCheck) {
  console.log(`Arquivo conferido: ${p.servicos.length} serviço(s), ${p.agenda.horarios.length} faixa(s) de horário, ${p.perguntasFrequentes.length} pergunta(s). Nada foi gravado.`)
  process.exit(0)
}

// 3. Gravação (tudo ou nada).
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida.')
  process.exit(1)
}
const { default: postgres } = await import('postgres')
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })

const settings = {
  professional_name: p.profissional.nome,
  professional_title: p.profissional.titulo,
  registry: p.profissional.crn.toUpperCase(),
  bio: p.profissional.biografia,
  specialties: sql.json(p.profissional.especialidades),
  method: p.profissional.metodo,
  differentials: sql.json(p.profissional.diferenciais),
  how_it_works: sql.json(p.profissional.comoFunciona.map((x) => ({ title: x.titulo, text: x.texto }))),
  brand_color: p.profissional.corDaMarca.toLowerCase(),
  signature_text: p.profissional.assinatura || null,
  whatsapp: p.contato.whatsapp,
  instagram: p.contato.instagram ?? null,
  contact_email: p.contato.email.toLowerCase(),
  privacy_contact: p.contato.emailPrivacidade.toLowerCase(),
  address: p.contato.endereco,
  hours_text: p.contato.horarioTexto,
  modality_text: p.contato.modalidadeTexto,
  anamnese_url: p.anamneseUrl ?? null,
  timezone: p.agenda.fusoHorario,
  slot_step_minutes: p.agenda.intervaloMinutos,
  buffer_minutes: p.agenda.folgaEntreConsultasMinutos,
  min_notice_hours: p.agenda.antecedenciaMinimaHoras,
  max_days_ahead: p.agenda.diasAFrente,
  chat_hours: p.chat.horario ? sql.json({ start: p.chat.horario.inicio, end: p.chat.horario.fim, weekdays: [...new Set(p.chat.horario.dias)].sort() }) : null,
  chat_auto_reply: p.chat.respostaAutomatica || null,
  quick_replies: sql.json(p.chat.respostasRapidas),
  default_meals: sql.json(p.refeicoesPadrao.map((m) => ({ name: m.nome, time: m.horario }))),
  demo_banner: false,
  updated_at: new Date(),
}
const templates = {
  confirmacao: 'Olá, {nome}! Sua consulta ({servico}) está confirmada para {data} às {hora}. Código: {codigo}.',
  lembrete: 'Olá, {nome}! Lembrete: sua consulta ({servico}) é amanhã, {data}, às {hora}.',
  cancelamento: 'Olá, {nome}. Sua consulta de {data} às {hora} foi cancelada. Fale conosco para escolher um novo horário.',
}

const out = await sql.begin(async (tx) => {
  const cols = Object.keys(settings)
  await tx`
    insert into settings ${tx({ id: 1, templates: tx.json(templates), ...settings }, 'id', 'templates', ...cols)}
    on conflict (id) do update set ${tx(settings, ...cols)}`

  // Serviços: atualiza pelo nome, cria os novos e desativa os que saíram do arquivo
  // (desativar preserva o histórico de consultas já marcadas).
  const existing = await tx`select id, name from services`
  const keep = []
  for (const [i, s] of p.servicos.entries()) {
    const row = {
      name: s.nome,
      description: s.descricao,
      modality: s.modalidade,
      duration_minutes: s.duracaoMinutos,
      price_cents: Math.round(s.preco * 100),
      is_public: s.publico,
      active: true,
      sort: i + 1,
    }
    const found = existing.find((e) => e.name.trim().toLowerCase() === s.nome.toLowerCase())
    if (found) {
      await tx`update services set ${tx(row)} where id = ${found.id}`
      keep.push(found.id)
    } else {
      const [n] = await tx`insert into services ${tx(row)} returning id`
      keep.push(n.id)
    }
  }
  const off = await tx`update services set active = false where active and not (id = any(${keep}::uuid[])) returning name`

  await tx`delete from working_hours`
  await tx`insert into working_hours ${tx(p.agenda.horarios.map((h) => ({ weekday: h.dia, start: h.inicio, end: h.fim })))}`

  await tx`delete from faqs`
  if (p.perguntasFrequentes.length)
    await tx`insert into faqs ${tx(p.perguntasFrequentes.map((f, i) => ({ question: f.pergunta, answer: f.resposta, published: true, sort: i + 1 })))}`

  const [admins] = await tx`select count(*)::int as n from users where role = 'admin' and is_active`
  const [media] = await tx`select photo_file_id, logo_file_id from settings where id = 1`
  return { off: off.map((r) => r.name), admins: admins.n, media }
})
await sql.end()

console.log(`Perfil aplicado: ${p.profissional.nome} (${p.profissional.crn.toUpperCase()}).`)
console.log(`  ${p.servicos.length} serviço(s), ${p.agenda.horarios.length} faixa(s) de horário, ${p.perguntasFrequentes.length} pergunta(s) frequente(s).`)
if (out.off.length) console.log(`  Serviços desativados (não estão mais no arquivo): ${out.off.join(', ')}`)
console.log('  Faixa de demonstração desligada.')
const todo = []
if (!out.admins) todo.push('criar a conta do nutricionista: node scripts/create-admin.mjs "Nome" email')
if (!out.media?.photo_file_id) todo.push('enviar a foto profissional em Configurações')
if (!out.media?.logo_file_id) todo.push('enviar o logo em Configurações (opcional)')
if (todo.length) {
  console.log('Ainda falta:')
  for (const t of todo) console.log(`  - ${t}`)
}
