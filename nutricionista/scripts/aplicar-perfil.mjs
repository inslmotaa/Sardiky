// Aplica os dados reais do consultório (deploy/perfil.json) no banco de produção:
// perfil, contatos, fuso horário, chat, planos e perguntas frequentes. Também desliga a faixa de demonstração.
// Uso:
//   node scripts/aplicar-perfil.mjs deploy/perfil.json --conferir   (só confere, não grava)
//   DATABASE_URL=... node scripts/aplicar-perfil.mjs deploy/perfil.json
//   DATABASE_URL=... node scripts/aplicar-perfil.mjs --pendencias   (lista o que ainda falta no site já no ar:
//     biografia com PREENCHER, e-mail example.com, Instagram vazio, foto não enviada, "(Texto de exemplo — …)")
// No servidor (Docker), lendo o arquivo pela entrada padrão:
//   docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T app node scripts/aplicar-perfil.mjs - < deploy/perfil.json
// Pode ser rodado de novo sempre que os dados mudarem. Foto, logo e assinatura são enviadas pelo painel (Configurações).
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { pendenciasDoSite } from './pendencias.mjs'

const [fileArg, ...flags] = process.argv.slice(2)
const onlyCheck = flags.includes('--conferir')

/** Pendências de conteúdo do site, lidas do banco. Sai com código 1 se houver alguma. */
async function listarPendencias() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definida.')
    process.exit(1)
  }
  const { default: postgres } = await import('postgres')
  const db = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })
  const [s] = await db`select bio, method, specialties, differentials, contact_email, privacy_contact, instagram, photo_file_id from settings where id = 1`
  await db.end()
  const list = pendenciasDoSite({
    bio: s?.bio,
    method: s?.method,
    specialties: s?.specialties,
    differentials: s?.differentials,
    contactEmail: s?.contact_email,
    privacyContact: s?.privacy_contact,
    instagram: s?.instagram,
    photoFileId: s?.photo_file_id,
  })
  if (!list.length) {
    console.log('Nenhuma pendência de conteúdo: o site pode ir ao ar.')
    return 0
  }
  console.log('O site ainda não pode ir ao ar. Falta:')
  for (const x of list) console.log(`  - ${x.texto}`)
  return 1
}

if (fileArg === '--pendencias') process.exit(await listarPendencias())
if (!fileArg) {
  console.error('Uso: node scripts/aplicar-perfil.mjs deploy/perfil.json [--conferir]  |  node scripts/aplicar-perfil.mjs --pendencias')
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
const EXAMPLE = [/PREENCHER/i, /example\.com/i, /^5500000000000$/, /Rua Exemplo/i, /\(exemplo/i, /\(Texto de exemplo/i, /fict[ií]ci/i]
const pending = []
;(function scan(v, path) {
  if (typeof v === 'string') {
    if (EXAMPLE.some((re) => re.test(v))) pending.push(`${path}: ${v}`)
  } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k)
})(raw, '')
// Instagram vazio também conta: o site não vai ao ar sem ele.
if (!String(raw?.contato?.instagram ?? '').trim()) pending.push('contato.instagram: vazio (use @usuario)')
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

// Títulos que não valem para o André (ele é coach).
const TITULO_PROIBIDO = /nutricionista|\bc\s*r\s*n\b|registro\s+profissional/i

const Perfil = z.object({
  profissional: z.object({
    nome: texto(120),
    // O André é coach: o título não pode ser "nutricionista" nem trazer número de conselho.
    titulo: texto(80).refine((v) => !TITULO_PROIBIDO.test(v), 'o título é Coach (não use "nutricionista" nem número de conselho)'),
    // O campo "registro" não existe mais: um perfil que ainda o traga é recusado.
    registro: z.unknown().optional().refine((v) => v === undefined, 'o campo registro não existe mais'),
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
  }),
  // Sem agendamento de consultas: o site leva a Ver planos → Contratar. Só a opção dos valores dos planos.
  site: z
    .object({
      mostrarValoresPlanos: z.boolean().default(true),
    })
    .default({ mostrarValoresPlanos: true }),
  anamneseUrl: z.url({ protocol: /^https$/, error: 'use o link completo (https://…)' }).optional(),
  // Só o fuso horário do consultório (lembretes, idade e datas do app).
  agenda: z.object({ fusoHorario: z.string().default('America/Sao_Paulo') }).default({ fusoHorario: 'America/Sao_Paulo' }),
  chat: z
    .object({
      horario: z.object({ inicio: hora, fim: hora, dias: z.array(dia).min(1) }).optional(),
      respostaAutomatica: z.string().trim().max(500).optional(),
      respostasRapidas: z.array(texto(200)).max(20).default([]),
    })
    .default({ respostasRapidas: [] }),
  refeicoesPadrao: z.array(z.object({ nome: texto(60), horario: hora })).max(10).default([]),
  perguntasFrequentes: z.array(z.object({ pergunta: texto(200), resposta: texto(2000) })).default([]),
  // Planos de acompanhamento (seção "Planos" do site e financeiro).
  planos: z
    .array(
      z.object({
        nome: texto(80),
        meses: z.number().int().min(1).max(36),
        preco: reais.refine((v) => v > 0, 'informe o valor total do plano'),
        descricao: z.string().trim().max(300).default(''),
        destaque: z.string().trim().max(40).optional(),
        beneficiosExclusivos: z.array(z.object({ titulo: texto(80), texto: z.string().trim().max(300).default('') })).max(8).default([]),
      }),
    )
    .default([]),
  planosIncluem: z.array(z.object({ titulo: texto(80), texto: z.string().trim().max(300).default('') })).max(12).default([]),
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

if (onlyCheck) {
  console.log(`Arquivo conferido: ${p.planos.length} plano(s), ${p.perguntasFrequentes.length} pergunta(s). Nada foi gravado.`)
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
  ...(p.nomeDoSite ? { site_name: String(p.nomeDoSite).trim().slice(0, 60) } : {}),
  professional_name: p.profissional.nome,
  professional_title: p.profissional.titulo,
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
  address: null,
  hours_text: null,
  modality_text: null,
  anamnese_url: p.anamneseUrl ?? null,
  timezone: p.agenda.fusoHorario,
  chat_hours: p.chat.horario ? sql.json({ start: p.chat.horario.inicio, end: p.chat.horario.fim, weekdays: [...new Set(p.chat.horario.dias)].sort() }) : null,
  chat_auto_reply: p.chat.respostaAutomatica || null,
  quick_replies: sql.json(p.chat.respostasRapidas),
  default_meals: sql.json(p.refeicoesPadrao.map((m) => ({ name: m.nome, time: m.horario }))),
  demo_banner: false,
  show_plan_prices: p.site.mostrarValoresPlanos,
  plans_included: sql.json(p.planosIncluem.map((x) => ({ title: x.titulo, text: x.texto }))),
  updated_at: new Date(),
}
// Modelos de mensagem: só os botões de WhatsApp (editáveis no painel); vazios = texto padrão.
const templates = {}

const out = await sql.begin(async (tx) => {
  const cols = Object.keys(settings)
  await tx`
    insert into settings ${tx({ id: 1, templates: tx.json(templates), ...settings }, 'id', 'templates', ...cols)}
    on conflict (id) do update set ${tx(settings, ...cols)}`

  await tx`delete from faqs`
  if (p.perguntasFrequentes.length)
    await tx`insert into faqs ${tx(p.perguntasFrequentes.map((f, i) => ({ question: f.pergunta, answer: f.resposta, published: true, sort: i + 1 })))}`

  // Planos: atualiza pelo nome, cria os novos e desativa os que saíram do arquivo.
  const plans = await tx`select id, name from packages`
  const keepPlans = []
  for (const [i, pl] of p.planos.entries()) {
    const row = {
      name: pl.nome,
      description: pl.descricao,
      months: pl.meses,
      price_cents: Math.round(pl.preco * 100),
      validity_days: pl.meses === 12 ? 365 : pl.meses * 30,
      highlight: pl.destaque || null,
      perks: tx.json(pl.beneficiosExclusivos.map((x) => ({ title: x.titulo, text: x.texto }))),
      sort: i + 1,
      active: true,
    }
    const found = plans.find((e) => e.name.trim().toLowerCase() === pl.nome.toLowerCase())
    if (found) {
      await tx`update packages set ${tx(row)} where id = ${found.id}`
      keepPlans.push(found.id)
    } else {
      const [n] = await tx`insert into packages ${tx(row)} returning id`
      keepPlans.push(n.id)
    }
  }
  await tx`update packages set active = false where active and not (id = any(${keepPlans}::uuid[]))`

  const [admins] = await tx`select count(*)::int as n from users where role = 'admin' and is_active`
  const [media] = await tx`select photo_file_id, logo_file_id from settings where id = 1`
  return { admins: admins.n, media }
})
await sql.end()

console.log(`Perfil aplicado: ${p.profissional.nome} (${p.profissional.titulo}).`)
console.log(`  ${p.planos.length} plano(s), ${p.perguntasFrequentes.length} pergunta(s) frequente(s).`)
console.log('  Faixa de demonstração desligada.')
const todo = []
if (!out.admins) todo.push('criar a conta do coach: node scripts/create-admin.mjs "Nome" email')
if (!out.media?.photo_file_id) todo.push('enviar a foto profissional em Configurações')
if (!out.media?.logo_file_id) todo.push('enviar o logo em Configurações (opcional)')
if (todo.length) {
  console.log('Ainda falta:')
  for (const t of todo) console.log(`  - ${t}`)
}
// Mesma checagem do aviso no Início do painel (foto, textos de exemplo, e-mail, Instagram).
const code = await listarPendencias()
if (code) console.log('Rode de novo com --pendencias depois de enviar a foto e ajustar os textos.')
