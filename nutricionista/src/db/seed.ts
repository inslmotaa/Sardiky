/**
 * Dados fictícios para demonstração. Nenhuma informação real de paciente.
 * Uso: npm run db:seed (apaga e recria todos os dados do banco configurado).
 */
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleLite } from 'drizzle-orm/pglite'
import { eq, sql } from 'drizzle-orm'
import { createConnection } from './connection'
import { loadEnv } from './env'
import * as s from './schema'
import { hashPassword } from '../lib/auth/password'
import { addDays, todayIn, zonedToUtc } from '../lib/time'
import { newCode } from '../lib/auth/tokens'
import { normalize, bmr as calcBmr, tdee as calcTdee, bodyFatFromSkinfolds, leanMass as leanMassOf } from '../lib/nutricao'
import { buildDemoPlans } from './demo-plans'
import { jitsiRoom } from '../lib/feriados'
import { TACO_FOODS } from './foods-taco'
import type { FormField } from '../lib/forms'

loadEnv()

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Seed de demonstração bloqueado em produção (defina ALLOW_DEMO_SEED=true para forçar).')
  process.exit(1)
}

const conn = createConnection()
const db = (conn.kind === 'postgres' ? drizzlePg(conn.client, { schema: s }) : drizzleLite(conn.client, { schema: s })) as ReturnType<
  typeof drizzlePg<typeof s>
>

const TZ = 'America/Sao_Paulo'
const today = todayIn(TZ)
const at = (offsetDays: number, time: string) => zonedToUtc(addDays(today, offsetDays), time, TZ)
const day = (offsetDays: number) => addDays(today, offsetDays)

const PASSWORDS = {
  admin: 'Nutri#Demo2026',
  staff: 'Equipe#Demo2026',
  patient: 'Paciente#Demo2026',
}

async function main() {
  console.log('Limpando dados…')
  await db.execute(sql`
    TRUNCATE audit_logs, data_requests, consents, payments, files, clinical_notes, form_assignments,
      form_templates, notifications, messages, diary_entries, meal_logs, water_logs, progress_photos, push_subscriptions, reminder_log, recipes, materials, prescriptions, meal_plans, household_measures, foods, measurements, goals, leads,
      appointments, patients, packages, faqs, testimonials, time_blocks, working_hours, services,
      settings, auth_tokens, sessions, users CASCADE
  `)

  /* -------------------------- configurações -------------------------- */
  await db.insert(s.settings).values({
    id: 1,
    professionalName: 'André Farion',
    professionalTitle: 'Nutricionista',
    registry: 'CRN-0 00000 (exemplo — informe o número real em Configurações)',
    bio: 'Nutricionista dedicado a um atendimento individualizado. Acredito em um plano que caiba na sua vida: possível de seguir, construído junto com você e ajustado a cada consulta. (Texto de exemplo — ajuste a biografia em Configurações.)',
    specialties: ['Reeducação alimentar', 'Nutrição esportiva', 'Saúde da mulher', 'Comportamento alimentar'],
    method:
      'O atendimento começa por uma avaliação completa da sua rotina, histórico e preferências. A partir dela, definimos metas realistas e um plano alimentar individualizado, revisado nos retornos conforme sua evolução.',
    differentials: [
      'Plano alimentar individualizado, com substituições para dar flexibilidade',
      'Área do paciente para consultar o plano e registrar a rotina',
      'Acompanhamento entre consultas pelos canais combinados',
      'Atendimento presencial e on-line',
    ],
    howItWorks: [
      { title: 'Agende', text: 'Escolha o tipo de consulta, a data e o horário disponíveis.' },
      { title: 'Pré-consulta', text: 'Você recebe um questionário breve para aproveitarmos melhor o encontro.' },
      { title: 'Consulta', text: 'Avaliação, conversa sobre objetivos e definição das primeiras metas.' },
      { title: 'Plano e acompanhamento', text: 'Seu plano fica disponível na área do paciente e é ajustado nos retornos.' },
    ],
    address: 'Rua Exemplo, 123 — sala 45, Centro, Cidade/UF (endereço fictício)',
    hoursText: 'Segunda a sexta, 8h às 18h · Sábados, 8h às 12h',
    modalityText: 'Presencial no consultório e on-line por videochamada',
    whatsapp: '5541991551789',
    instagram: 'https://instagram.com/',
    contactEmail: 'contato@example.com',
    privacyContact: 'privacidade@example.com',
    anamneseUrl: 'https://forms.gle/8EkK8XcNE35ydHYKA',
    waterMlPerKg: 35,
    defaultMeals: [
      { name: 'Café da manhã', time: '07:00' },
      { name: 'Almoço', time: '12:30' },
      { name: 'Lanche da tarde', time: '16:00' },
      { name: 'Jantar', time: '19:30' },
    ],
    signatureText: 'Nutricionista · atendimento presencial e on-line',
    quickReplies: ['Ótima escolha!', 'Vamos ajustar isso no retorno.', 'Obrigado por registrar, {nome}! Continue assim.', 'Tudo bem, amanhã é um novo dia.'],
    chatHours: { start: '08:00', end: '18:00', weekdays: [1, 2, 3, 4, 5] },
    chatAutoReply: 'Oi! Recebi sua mensagem e respondo no próximo horário de atendimento (segunda a sexta, 8h às 18h). Em caso de urgência, procure um serviço de saúde.',
    timezone: TZ,
    slotStepMinutes: 30,
    bufferMinutes: 10,
    minNoticeHours: 12,
    maxDaysAhead: 45,
    financeEnabled: true,
    demoBanner: true,
    showPrices: false,
    showPlanPrices: true,
    plansIncluded: [
      { title: 'Avaliação física', text: 'Presencial ou online.' },
      { title: 'Anamnese completa', text: 'Histórico de saúde, rotina e objetivos.' },
      { title: 'Dieta personalizada', text: 'Atualizada a cada 15 dias.' },
      { title: 'Manipulados e ergogênicos', text: 'Acompanhamento com orientações e ajustes individuais.' },
    ],
    bookingChannel: 'whatsapp',
    templates: {
      confirmacao:
        'Olá, {nome}! Sua consulta ({servico}) está confirmada para {data} às {hora}. Código: {codigo}. Se precisar remarcar, responda esta mensagem.',
      lembrete: 'Olá, {nome}! Lembrete: sua consulta ({servico}) é amanhã, {data}, às {hora}.',
      cancelamento: 'Olá, {nome}. Sua consulta de {data} às {hora} foi cancelada. Fale conosco para escolher um novo horário.',
    },
  })

  const services = await db
    .insert(s.services)
    .values([
      {
        name: 'Primeira consulta',
        description: 'Avaliação completa, definição de metas e elaboração do plano alimentar individualizado.',
        modality: 'ambos',
        durationMinutes: 60,
        priceCents: 25000,
        sort: 1,
      },
      {
        name: 'Retorno',
        description: 'Reavaliação, análise da evolução e ajustes no plano.',
        modality: 'ambos',
        durationMinutes: 40,
        priceCents: 15000,
        sort: 2,
      },
      {
        name: 'Acompanhamento esportivo',
        description: 'Estratégia nutricional alinhada à rotina de treinos e às competições.',
        modality: 'ambos',
        durationMinutes: 60,
        priceCents: 28000,
        sort: 3,
      },
      {
        name: 'Reeducação alimentar on-line',
        description: 'Consulta por videochamada com foco em hábitos e rotina, para quem mora longe.',
        modality: 'online',
        durationMinutes: 50,
        priceCents: 22000,
        sort: 4,
      },
    ])
    .returning()
  const [svcFirst, svcReturn, svcSport] = services

  const hours: { weekday: number; start: string; end: string }[] = []
  for (const wd of [1, 2, 3, 4, 5]) hours.push({ weekday: wd, start: '08:00', end: '12:00' }, { weekday: wd, start: '13:30', end: '18:00' })
  hours.push({ weekday: 6, start: '08:00', end: '12:00' })
  await db.insert(s.workingHours).values(hours)

  await db.insert(s.testimonials).values([
    {
      authorDisplay: 'M. S. (exemplo)',
      text: 'Pela primeira vez consegui manter uma alimentação organizada sem sentir que estava de dieta. As substituições no plano fazem muita diferença.',
      authorizedAt: day(-60),
      published: true,
      sort: 1,
    },
    {
      authorDisplay: 'R. A. (exemplo)',
      text: 'O acompanhamento entre as consultas me ajudou a ajustar a alimentação nos dias de treino. Atendimento atencioso e muito claro.',
      authorizedAt: day(-40),
      published: true,
      sort: 2,
    },
    {
      authorDisplay: 'J. P. (exemplo)',
      text: 'Gosto de ver minha evolução na área do paciente e de ter o plano sempre à mão no celular.',
      authorizedAt: day(-20),
      published: true,
      sort: 3,
    },
    {
      authorDisplay: 'Depoimento sem autorização (não aparece no site)',
      text: 'Exemplo de depoimento recebido, ainda sem autorização registrada.',
      authorizedAt: null,
      published: false,
      sort: 4,
    },
  ])

  await db.insert(s.faqs).values([
    {
      question: 'Como funciona a primeira consulta?',
      answer:
        'Conversamos sobre sua rotina, histórico de saúde, preferências e objetivos. Fazemos a avaliação antropométrica (no presencial) e, em até alguns dias, seu plano fica disponível na área do paciente.',
      sort: 1,
    },
    {
      question: 'A consulta on-line tem a mesma qualidade?',
      answer:
        'A consulta on-line segue a mesma estrutura, por videochamada. Algumas medidas podem ser informadas por você com orientação; elas aparecem identificadas como “informadas pelo paciente” nos gráficos.',
      sort: 2,
    },
    {
      question: 'Quanto tempo leva para ver resultados?',
      answer:
        'Cada pessoa responde de um jeito, e não há resultado garantido. O que fazemos é definir metas realistas, acompanhar a evolução e ajustar a estratégia sempre que necessário.',
      sort: 3,
    },
    {
      question: 'Vocês atendem por convênio?',
      answer: 'O atendimento é particular. Emitimos recibo para que você solicite reembolso ao seu plano, quando ele oferecer essa possibilidade.',
      sort: 4,
    },
    {
      question: 'Posso remarcar minha consulta?',
      answer: 'Sim. Pedimos aviso com pelo menos 24 horas de antecedência, pelo WhatsApp ou pela área do paciente.',
      sort: 5,
    },
    {
      question: 'Como meus dados são protegidos?',
      answer:
        'Seus dados de saúde ficam em área com acesso restrito, protegida por senha e conexão criptografada, e são usados apenas para o seu atendimento. Veja os detalhes na Política de Privacidade.',
      sort: 6,
    },
  ])

  // Planos de acompanhamento (valores do material de divulgação do André).
  const exclusive = [
    { title: 'Vale avaliação física', text: 'Avaliação física completa sem custo adicional.' },
    { title: 'Desconto em produtos selecionados', text: 'Até 15% de desconto em produtos do nosso parceiro de suplementos e nutrição esportiva.' },
  ]
  await db.insert(s.packages).values([
    { name: 'Mensal', months: 1, priceCents: 25000, validityDays: 30, sort: 1 },
    { name: 'Trimestral', months: 3, priceCents: 63750, validityDays: 90, sort: 2 },
    { name: 'Semestral', months: 6, priceCents: 120000, validityDays: 180, sort: 3, perks: exclusive },
    { name: 'Anual', months: 12, priceCents: 225000, validityDays: 365, sort: 4, perks: exclusive, highlight: 'Melhor custo-benefício' },
  ])

  /* ------------------------------ usuários ----------------------------- */
  console.log('Criando usuários (o hash de senha leva alguns segundos)…')
  const [adminHash, staffHash, patientHash] = await Promise.all([
    hashPassword(PASSWORDS.admin),
    hashPassword(PASSWORDS.staff),
    hashPassword(PASSWORDS.patient),
  ])
  const [admin, , uBeatriz, uLucas, uHelena, nutri2] = await db
    .insert(s.users)
    .values([
      { email: 'nutri@example.com', name: 'André Farion', role: 'admin', passwordHash: adminHash },
      {
        email: 'recepcao@example.com',
        name: 'Recepção (exemplo)',
        role: 'staff',
        passwordHash: staffHash,
        permissions: ['agenda', 'cadastro', 'financeiro', 'site'],
      },
      { email: 'paciente@example.com', name: 'Beatriz Exemplo', role: 'patient', passwordHash: patientHash, onboardedAt: at(-150, '20:00') },
      { email: 'lucas@example.com', name: 'Lucas Fictício', role: 'patient', passwordHash: patientHash, onboardedAt: at(-24, '20:00') },
      { email: 'helena@example.com', name: 'Helena Teste', role: 'patient', passwordHash: patientHash, onboardedAt: at(-20, '20:00') },
      // Segunda nutricionista da equipe: vê só os próprios pacientes (Helena).
      {
        email: 'nutri2@example.com',
        name: 'Carla Nutricionista (exemplo)',
        role: 'staff',
        passwordHash: staffHash,
        permissions: ['clinico', 'agenda', 'cadastro'],
        ownPatientsOnly: true,
      },
    ])
    .returning()

  const [beatriz, lucas, rafael, helena] = await db
    .insert(s.patients)
    .values([
      {
        userId: uBeatriz.id,
        fullName: 'Beatriz Exemplo',
        email: 'paciente@example.com',
        phone: '11900000001',
        birthDate: '1991-04-12',
        objective: 'Reeducação alimentar e melhora da disposição',
        sex: 'F',
        heightCm: 165,
        restrictions: ['lactose'],
        nutritionistId: admin.id,
        anamnesisReceivedAt: at(-151, '20:00'),
        status: 'ativo',
        stage: 'Acompanhamento',
        followUpDays: 30,
        nextFollowUp: day(5),
      },
      {
        userId: uLucas.id,
        fullName: 'Lucas Fictício',
        email: 'lucas@example.com',
        phone: '11900000002',
        birthDate: '1996-09-30',
        objective: 'Performance em corrida de rua',
        sex: 'M',
        heightCm: 178,
        nutritionistId: admin.id,
        status: 'ativo',
        stage: 'Avaliação inicial',
        followUpDays: 21,
        nextFollowUp: day(-3),
      },
      {
        fullName: 'Rafael Demonstração',
        email: 'rafael@example.com',
        phone: '11900000003',
        birthDate: '1985-01-20',
        objective: 'Controle de peso',
        sex: 'M',
        heightCm: 175,
        status: 'pausado',
        stage: 'Manutenção',
        followUpDays: 60,
      },
      {
        userId: uHelena.id,
        nutritionistId: nutri2.id,
        restrictions: ['vegetariano'],
        fullName: 'Helena Teste',
        email: 'helena@example.com',
        phone: '11900000004',
        birthDate: '1978-07-08',
        objective: 'Alimentação na menopausa',
        sex: 'F',
        heightCm: 160,
        status: 'ativo',
        stage: 'Acompanhamento',
        followUpDays: 30,
        nextFollowUp: day(12),
      },
    ])
    .returning()

  await db.insert(s.consents).values([
    { userId: uBeatriz.id, patientId: beatriz.id, kind: 'tratamento_dados_saude', version: '2026-10' },
    { userId: uLucas.id, patientId: lucas.id, kind: 'tratamento_dados_saude', version: '2026-10' },
    { userId: uHelena.id, patientId: helena.id, kind: 'tratamento_dados_saude', version: '2026-10' },
  ])

  /* ------------------------------ consultas ---------------------------- */
  const appt = (
    p: { id: string; fullName: string; email: string | null; phone: string | null } | null,
    svc: typeof svcFirst,
    offset: number,
    time: string,
    status: (typeof s.appointmentStatusEnum.enumValues)[number],
    extra: Partial<typeof s.appointments.$inferInsert> = {},
  ): typeof s.appointments.$inferInsert => {
    const startAt = at(offset, time)
    return {
      patientId: p?.id ?? null,
      serviceId: svc.id,
      serviceName: svc.name,
      modality: 'presencial',
      startAt,
      endAt: new Date(startAt.getTime() + svc.durationMinutes * 60_000),
      status,
      priceCents: svc.priceCents,
      contactName: p?.fullName ?? 'Contato',
      contactEmail: p?.email ?? 'contato@example.com',
      contactPhone: p?.phone ?? '11900000000',
      isReturning: Boolean(p),
      code: newCode(),
      source: 'admin',
      ...extra,
    }
  }
  // Ajusta para dia útil: evita gerar consultas de exemplo em domingos.
  const wd = (offset: number) => {
    let o = offset
    while (new Date(at(o, '12:00')).getUTCDay() === 0) o += offset >= 0 ? 1 : -1
    return o
  }

  const pastAppts = await db
    .insert(s.appointments)
    .values([
      appt(beatriz, svcFirst, wd(-150), '09:00', 'realizada'),
      appt(beatriz, svcReturn, wd(-120), '09:00', 'realizada'),
      appt(beatriz, svcReturn, wd(-90), '10:00', 'realizada'),
      appt(beatriz, svcReturn, wd(-60), '10:00', 'realizada', { modality: 'online' }),
      appt(beatriz, svcReturn, wd(-30), '14:00', 'realizada'),
      appt(lucas, svcSport, wd(-24), '15:00', 'realizada'),
      appt(rafael, svcReturn, wd(-45), '16:00', 'faltou'),
      appt(helena, svcReturn, wd(-15), '11:00', 'cancelada', { cancelReason: 'Paciente pediu para remarcar' }),
      appt(helena, svcReturn, wd(-10), '11:00', 'realizada'),
    ])
    .returning()

  await db.insert(s.appointments).values([
    appt(helena, svcReturn, 0, '14:00', 'confirmada'),
    appt(lucas, svcReturn, wd(1), '16:00', 'confirmada', { modality: 'online', meetingUrl: jitsiRoom('André Farion', 'demo0a1b2c') }),
    appt(beatriz, svcReturn, wd(5), '09:00', 'confirmada'),
    appt(null, svcFirst, wd(2), '10:00', 'pendente', {
      contactName: 'Interessada Exemplo',
      contactEmail: 'interessada@example.com',
      contactPhone: '11900000010',
      isReturning: false,
      source: 'site',
      patientNotes: 'Gostaria de orientação para melhorar a alimentação no trabalho.',
    }),
    appt(null, svcSport, wd(3), '15:00', 'pendente', {
      contactName: 'Atleta Fictício',
      contactEmail: 'atleta@example.com',
      contactPhone: '11900000011',
      isReturning: false,
      source: 'site',
      modality: 'online',
    }),
  ])

  await db.insert(s.timeBlocks).values({
    startAt: at(wd(4), '13:30'),
    endAt: at(wd(4), '18:00'),
    reason: 'Congresso (exemplo)',
    createdBy: admin.id,
  })

  /* ------------------------------ evolução ----------------------------- */
  const lucasFolds = { peitoral: 8, axilarMedia: 10, triceps: 9, subescapular: 12, abdominal: 16, suprailiaca: 11, coxa: 13 }
  const lucasFat = bodyFatFromSkinfolds('jp7', 'M', 29, lucasFolds)!
  const weights = [78.4, 77.3, 76.6, 75.9, 75.1]
  const waists = [86, 84.5, 83.5, 82, 81]
  const fats = [31.5, 30.6, 29.9, 29.1, 28.4]
  await db.insert(s.measurements).values([
    ...weights.map((w, i) => ({
      patientId: beatriz.id,
      date: day(wd(-150 + i * 30)),
      source: 'profissional' as const,
      weightKg: w,
      heightCm: 165,
      bodyFatPct: fats[i],
      bodyFatMethod: 'Bioimpedância',
      waistCm: waists[i],
      hipCm: 104 - i * 0.8,
      armCm: 30 - i * 0.2,
      thighCm: 58 - i * 0.4,
      abdomenCm: 92 - i * 1.1,
      leanMassKg: Math.round(leanMassOf(w, fats[i]) * 10) / 10,
      bioimpedance: { fatPct: fats[i], waterPct: 49 + i * 0.4, visceral: 7 - (i > 2 ? 1 : 0) },
      extra: [{ label: 'Circunferência do pescoço', value: 33 - i * 0.2, unit: 'cm' }],
      createdBy: admin.id,
    })),
    { patientId: beatriz.id, date: day(-20), source: 'paciente' as const, weightKg: 75.4, notes: 'Balança de casa, pela manhã' },
    { patientId: beatriz.id, date: day(-10), source: 'paciente' as const, weightKg: 74.9, notes: 'Balança de casa' },
    { patientId: beatriz.id, date: day(-3), source: 'paciente' as const, weightKg: 74.8, waistCm: 80.5 },
    {
      patientId: lucas.id,
      date: day(wd(-24)),
      source: 'profissional' as const,
      weightKg: 71.2,
      heightCm: 178,
      bodyFatPct: Math.round(lucasFat.pct * 10) / 10,
      bodyFatMethod: 'Jackson-Pollock 7 dobras + Siri',
      skinfolds: lucasFolds,
      skinfoldProtocol: 'jp7',
      leanMassKg: Math.round(leanMassOf(71.2, lucasFat.pct) * 10) / 10,
      waistCm: 78,
      hipCm: 94,
      abdomenCm: 80,
      calfCm: 37,
      createdBy: admin.id,
    },
    { patientId: helena.id, date: day(wd(-10)), source: 'profissional' as const, weightKg: 68.3, heightCm: 160, waistCm: 84, createdBy: admin.id },
  ])

  await db.insert(s.goals).values([
    {
      patientId: beatriz.id,
      title: 'Reduzir a circunferência da cintura',
      metric: 'waistCm',
      startValue: 86,
      targetValue: 80,
      unit: 'cm',
      dueDate: day(60),
    },
    { patientId: beatriz.id, title: 'Incluir frutas em pelo menos 2 refeições por dia', description: 'Registrar no diário alimentar.' },
    { patientId: beatriz.id, title: 'Beber 2 litros de água por dia', status: 'concluida' },
    { patientId: lucas.id, title: 'Ajustar a alimentação pré-treino', description: 'Testar as opções do plano antes dos treinos longos.' },
  ])

  /* --------------------------- base de alimentos ---------------------- */
  const foodRows = await db
    .insert(s.foods)
    .values(
      TACO_FOODS.map((f) => ({
        name: f.name,
        search: normalize(f.name),
        group: f.group,
        source: 'TACO',
        kcal: f.kcal,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber: f.fiber,
        sodium: f.sodium ?? null,
        cookingFactor: f.cookingFactor ?? null,
      })),
    )
    .returning()
  await db.insert(s.householdMeasures).values(
    TACO_FOODS.flatMap((f) => {
      const row = foodRows.find((r) => r.name === f.name)!
      return f.measures.map(([name, grams]) => ({ foodId: row.id, name, grams }))
    }),
  )

  /* --------------------------- planos alimentares ---------------------- */
  const { beatrizPlan, beatrizV1, lucasPlan, vegetarianoPlan, emagrecimentoPlan } = buildDemoPlans((name) => {
    const row = foodRows.find((r) => r.name.startsWith(name))
    if (!row) throw new Error(`Alimento não encontrado no seed: ${name}`)
    return { id: row.id, name: row.name, group: row.group, per100: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat, fiber: row.fiber } }
  })

  const [v1] = await db
    .insert(s.mealPlans)
    .values({
      patientId: beatriz.id,
      title: 'Plano alimentar — reeducação',
      status: 'arquivado',
      version: 1,
      content: beatrizV1,
      validFrom: day(-150),
      validUntil: day(-31),
      publishedAt: at(-150, '18:00'),
      publishedBy: admin.id,
      createdBy: admin.id,
    })
    .returning()
  const [beatrizCurrent] = await db
    .insert(s.mealPlans)
    .values({
      patientId: beatriz.id,
      title: 'Plano alimentar — reeducação',
      status: 'publicado',
      version: 2,
      parentId: v1.id,
      content: beatrizPlan,
      validFrom: day(-30),
      validUntil: day(30),
      publishedAt: at(-30, '18:00'),
      publishedBy: admin.id,
      createdBy: admin.id,
    })
    .returning()
  await db.insert(s.mealPlans).values([
    { patientId: lucas.id, title: 'Plano para treinos de corrida', status: 'rascunho', version: 1, content: lucasPlan, createdBy: admin.id },
    { isTemplate: true, title: 'Modelo — Reeducação alimentar (4 refeições)', status: 'rascunho', version: 1, content: beatrizPlan, createdBy: admin.id },
    { isTemplate: true, title: 'Modelo — Treino e descanso', status: 'rascunho', version: 1, content: lucasPlan, createdBy: admin.id },
    { isTemplate: true, title: 'Modelo — Vegetariano', status: 'rascunho', version: 1, content: vegetarianoPlan, createdBy: admin.id },
    { isTemplate: true, title: 'Modelo — Emagrecimento (uma opção por refeição)', status: 'rascunho', version: 1, content: emagrecimentoPlan, createdBy: admin.id },
  ])

  // Gasto energético calculado na última consulta (Mifflin-St Jeor, atividade leve, déficit de 400 kcal).
  const bmrB = calcBmr('mifflin', { sex: 'F', weightKg: 75.1, heightCm: 165, age: 35 })!
  const tdeeB = calcTdee(bmrB, 1.375)
  await db
    .update(s.patients)
    .set({ energy: { formula: 'mifflin', factor: 1.375, bmr: bmrB, tdee: tdeeB, targetKcal: Math.round(tdeeB - 400), adjust: -400, adjustUnit: 'kcal', date: day(-30) } })
    .where(eq(s.patients.id, beatriz.id))

  const [helenaPlan] = await db
    .insert(s.mealPlans)
    .values({
      patientId: helena.id,
      title: 'Plano alimentar — vegetariano',
      status: 'publicado',
      version: 1,
      content: vegetarianoPlan,
      validFrom: day(-20),
      validUntil: day(40),
      publishedAt: at(-20, '18:00'),
      publishedBy: admin.id,
      createdBy: admin.id,
    })
    .returning()

  // Histórico de 14 dias para o Acompanhamento (padrões fixos, sem aleatoriedade):
  // Beatriz “em dia” (quase todas as refeições), Helena “com dificuldade” (cerca de metade).
  const bDay = beatrizPlan.days[0]
  const hDay = vegetarianoPlan.days[0]
  const logRows: (typeof s.mealLogs.$inferInsert)[] = []
  const waterRows: (typeof s.waterLogs.$inferInsert)[] = []
  for (let d = -13; d <= 0; d++) {
    bDay.meals.forEach((m, i) => {
      if (d === 0 && i > 0) return // hoje: só o café da manhã
      const status = (d + i) % 9 === 0 ? 'parcial' : (d * 3 + i) % 13 === 0 ? null : d === -1 && i === 2 ? 'outra' : 'feita'
      if (status) logRows.push({ patientId: beatriz.id, date: day(d), planId: beatrizCurrent.id, mealKey: `${bDay.id}:${m.id}`, optionId: m.options[0].id, status })
    })
    waterRows.push({ patientId: beatriz.id, date: day(d), ml: d === 0 ? 750 : 1750 + ((d * 250) % 750) })
    if (d >= -12 && d <= -1)
      hDay.meals.forEach((m, i) => {
        const status = i < 2 ? (d % 3 === 0 && i === 1 ? null : 'feita') : i === 2 && d % 2 === 0 ? 'parcial' : null
        if (status) logRows.push({ patientId: helena.id, date: day(d), planId: helenaPlan.id, mealKey: `${hDay.id}:${m.id}`, optionId: m.options[0].id, status })
      })
  }
  await db.insert(s.mealLogs).values(logRows)
  await db.insert(s.waterLogs).values(waterRows)


  /* ------------------------------ diário ------------------------------- */
  const diaryItem = (name: string, grams: number) => {
    const f = foodRows.find((r) => r.name.startsWith(name))!
    return { foodId: f.id, name: f.name, grams, per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber } }
  }
  await db.insert(s.diaryEntries).values([
    {
      patientId: beatriz.id,
      date: day(-1),
      time: '07:15',
      meal: 'Café da manhã',
      foods: 'Pão integral com ovo mexido, mamão',
      quantity: '2 fatias, 2 ovos, 1 fatia',
      hunger: 3,
      satiety: 4,
      adherence: 'total',
    },
    {
      patientId: beatriz.id,
      date: day(-1),
      time: '13:00',
      meal: 'Almoço',
      foods: 'Arroz, feijão, frango e salada',
      quantity: 'Prato conforme o plano',
      hunger: 4,
      satiety: 4,
      adherence: 'total',
      professionalComment: 'Ótimo registro! Continue começando pela salada.',
    },
    {
      patientId: beatriz.id,
      date: day(-1),
      time: '17:30',
      meal: 'Lanche da tarde',
      mealKey: `${bDay.id}:${bDay.meals[2].id}`,
      foods: 'Biscoito e suco na reunião',
      items: [diaryItem('Biscoito cream cracker', 30), diaryItem('Suco de laranja natural', 200)],
      hunger: 5,
      satiety: 2,
      mood: 2,
      adherence: 'nao_seguiu',
      notes: 'Reunião longa, fiquei muito tempo sem comer.',
    },
    {
      patientId: beatriz.id,
      date: day(0),
      time: '07:10',
      meal: 'Café da manhã',
      mealKey: `${bDay.id}:${bDay.meals[0].id}`,
      foods: 'Segui o plano',
      hunger: 3,
      satiety: 4,
      mood: 4,
      adherence: 'total',
    },
  ])

  /* ----------------------------- mensagens ----------------------------- */
  await db.insert(s.messages).values([
    { patientId: beatriz.id, senderId: admin.id, fromPatient: false, isGuidance: true, body: 'Nesta fase, foque em não pular o lanche da tarde: ele ajuda a chegar ao jantar com menos fome.', createdAt: at(-29, '09:00'), readAt: at(-29, '12:00') },
    { patientId: beatriz.id, senderId: uBeatriz.id, fromPatient: true, body: 'Posso trocar o iogurte por kefir no lanche?', createdAt: at(-2, '18:20'), readAt: at(-2, '19:00') },
    { patientId: beatriz.id, senderId: admin.id, fromPatient: false, body: 'Pode sim! Use a mesma quantidade (1 pote, 170 g).', createdAt: at(-2, '19:05'), readAt: at(-1, '08:00') },
    { patientId: beatriz.id, senderId: uBeatriz.id, fromPatient: true, body: 'Ontem tive dificuldade com o lanche por causa de uma reunião. Alguma sugestão prática?', createdAt: at(0, '08:10') },
    { patientId: helena.id, senderId: admin.id, fromPatient: false, body: 'Oi, Helena! Como estão os jantares desta semana?', createdAt: at(-3, '10:00'), readAt: at(-3, '12:30') },
    { patientId: helena.id, senderId: uHelena.id, fromPatient: true, body: 'Estou chegando tarde e acabo pulando o jantar.', createdAt: at(-3, '20:40'), readAt: at(-2, '09:00') },
    { patientId: lucas.id, senderId: admin.id, fromPatient: false, isGuidance: true, body: 'Seu plano está em revisão. Enquanto isso, mantenha a hidratação nos treinos longos.', createdAt: at(-20, '10:00') },
  ])

  /* ---------------------------- formulários ---------------------------- */
  // Modelo inicial de anamnese (seções da especificação). Os ids das perguntas antigas foram mantidos.
  const F = (id: string, label: string, type: FormField['type'], extra: Partial<FormField> = {}): FormField => ({ id, label, type, required: false, options: [], help: '', ...extra })
  const anamnese: FormField[] = [
    F('sec_objetivo', 'Objetivo', 'section'),
    F('objetivo', 'Qual é o seu principal objetivo com o acompanhamento?', 'textarea', { required: true, mapsTo: 'objetivo' }),
    F('sec_saude', 'Saúde', 'section', { help: 'Doenças, medicamentos, alergias e exames.' }),
    F('saude', 'Possui alguma condição de saúde diagnosticada?', 'textarea', { help: 'Ex.: diabetes, hipertensão, hipotireoidismo.' }),
    F('medicamentos', 'Usa medicamentos ou suplementos? Quais?', 'textarea'),
    F('restricoes', 'Restrições, alergias e intolerâncias alimentares', 'checkbox', {
      options: ['Lactose', 'Glúten', 'Vegetariano(a)', 'Vegano(a)', 'Frutos do mar', 'Ovo', 'Amendoim', 'Castanhas e oleaginosas', 'Soja', 'Nenhuma'],
      mapsTo: 'restricoes',
    }),
    F('exames', 'Exames recentes (opcional)', 'file', { help: 'PDF ou foto do resultado.' }),
    F('intestino', 'Como funciona seu intestino?', 'radio', { options: ['Todos os dias', 'Dia sim, dia não', 'Menos de 3 vezes por semana', 'Varia muito'] }),
    F('sec_rotina', 'Rotina', 'section'),
    F('refeicoes', 'Quantas refeições você faz por dia?', 'select', { required: true, options: ['1 a 2', '3', '4', '5 ou mais'] }),
    F('horarios', 'Horários de acordar, trabalho/estudo e dormir', 'textarea'),
    F('quem_cozinha', 'Quem cozinha na sua casa?', 'radio', { options: ['Eu', 'Outra pessoa da casa', 'Como fora quase sempre', 'Delivery / congelados'] }),
    F('orcamento', 'Orçamento para alimentação', 'radio', { options: ['Apertado', 'Médio', 'Confortável'] }),
    F('sono', 'Como avalia seu sono?', 'radio', { options: ['Ruim', 'Regular', 'Bom'] }),
    F('atividade', 'Pratica atividade física?', 'radio', { required: true, options: ['Não', '1 a 2 vezes/semana', '3 a 4 vezes/semana', '5 ou mais vezes/semana'] }),
    F('agua', 'Quantos litros de água bebe por dia (aprox.)?', 'number'),
    F('alcool', 'Consumo de bebida alcoólica', 'radio', { options: ['Não bebo', 'Socialmente', 'Toda semana', 'Quase todo dia'] }),
    F('sec_alimentacao', 'Alimentação', 'section'),
    F('preferencias', 'Alimentos de que mais gosta', 'textarea'),
    F('aversoes', 'Alimentos de que não gosta', 'textarea'),
    F('recordatorio', 'Recordatório 24 h: o que você comeu e bebeu ontem, do café ao jantar?', 'textarea'),
    F('fome', 'Como costuma ser sua fome ao longo do dia?', 'scale', { options: ['Pouca fome', 'Muita fome'] }),
    F('frequencia', 'Com que frequência come frutas e verduras?', 'radio', { options: ['Todo dia', 'Algumas vezes por semana', 'Raramente'] }),
  ]
  const acompanhamento: FormField[] = [
    { id: 'adesao', label: 'Como foi a adesão ao plano nas últimas semanas?', type: 'radio', required: true, options: ['Segui quase tudo', 'Segui em parte', 'Tive muita dificuldade'], help: '' },
    { id: 'dificuldades', label: 'Quais foram as principais dificuldades?', type: 'textarea', required: false, options: [], help: '' },
    { id: 'disposicao', label: 'Disposição no dia a dia (1 a 5)', type: 'select', required: true, options: ['1', '2', '3', '4', '5'], help: '' },
  ]
  const termo: FormField[] = [
    {
      id: 'ciencia',
      label:
        'Declaro que as informações fornecidas são verdadeiras e autorizo o uso dos meus dados pessoais e de saúde exclusivamente para o meu acompanhamento nutricional, conforme a Política de Privacidade.',
      type: 'consent',
      required: true,
      options: [],
      help: '',
    },
  ]
  const preConsulta: FormField[] = [
    { id: 'motivo', label: 'O que motivou você a buscar acompanhamento agora?', type: 'textarea', required: true, options: [], help: '' },
    { id: 'rotina', label: 'Descreva brevemente sua rotina de trabalho', type: 'textarea', required: false, options: [], help: '' },
  ]
  const [tAnamnese, tAcomp, tTermo] = await db
    .insert(s.formTemplates)
    .values([
      { title: 'Anamnese nutricional', kind: 'anamnese', description: 'Objetivo, saúde, rotina e alimentação. Leva cerca de 10 minutos.', fields: anamnese },
      { title: 'Questionário de acompanhamento', kind: 'acompanhamento', description: 'Preencha entre as consultas.', fields: acompanhamento },
      { title: 'Termo de consentimento', kind: 'consentimento', description: 'Autorização para tratamento de dados de saúde.', fields: termo },
      { title: 'Questionário pré-consulta', kind: 'pre_consulta', description: 'Enviado antes da primeira consulta.', fields: preConsulta },
    ])
    .returning()

  await db.insert(s.formAssignments).values([
    {
      templateId: tAnamnese.id,
      patientId: beatriz.id,
      title: tAnamnese.title,
      kind: tAnamnese.kind,
      fields: anamnese,
      answers: {
        objetivo: 'Organizar a alimentação e ter mais disposição.',
        saude: 'Nenhuma diagnosticada.',
        medicamentos: '',
        restricoes: ['Nenhuma'],
        refeicoes: '3',
        agua: '1',
        atividade: '1 a 2 vezes/semana',
        sono: 'Regular',
      },
      answeredAt: at(-151, '20:00'),
      createdAt: at(-152, '10:00'),
    },
    { templateId: tTermo.id, patientId: beatriz.id, title: tTermo.title, kind: tTermo.kind, fields: termo, answers: { ciencia: true }, answeredAt: at(-151, '20:05') },
    { templateId: tAcomp.id, patientId: beatriz.id, title: tAcomp.title, kind: tAcomp.kind, fields: acompanhamento, dueDate: day(4) },
    { templateId: tAnamnese.id, patientId: lucas.id, title: tAnamnese.title, kind: tAnamnese.kind, fields: anamnese, dueDate: day(-1) },
    { templateId: tAcomp.id, patientId: lucas.id, title: tAcomp.title, kind: tAcomp.kind, fields: acompanhamento, dueDate: day(6) },
  ])

  /* --------------------------- notas clínicas -------------------------- */
  await db.insert(s.clinicalNotes).values([
    { patientId: beatriz.id, authorId: admin.id, body: 'Boa adesão nos dias úteis; dificuldade aos fins de semana. Trabalhar estratégias para eventos sociais no próximo retorno.', createdAt: at(-30, '15:00') },
    { patientId: lucas.id, authorId: admin.id, body: 'Treina para meia maratona. Revisar estratégia de carboidratos antes dos longões.', createdAt: at(-24, '16:00') },
  ])

  /* ----------------------------- financeiro ---------------------------- */
  /* ---------------- receitas, materiais, prescrições e anamnese ---------------- */
  await db.update(s.settings).set({ autoAnamnesisTemplateId: tAnamnese.id }).where(eq(s.settings.id, 1))
  const ing = (name: string, grams: number) => {
    const f = foodRows.find((r) => r.name.startsWith(name))!
    return { foodId: f.id, name: f.name, grams, per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber } }
  }
  await db.insert(s.recipes).values([
    {
      title: 'Panqueca de banana e aveia',
      ingredients: [ing('Banana prata', 100), ing('Aveia em flocos', 30), ing('Ovo de galinha, inteiro, cozido', 50)],
      finalWeightG: 160,
      portions: 1,
      prepMinutes: 10,
      tags: ['café da manhã', 'sem lactose', 'vegetariana'],
      instructions: '1. Amasse a banana com um garfo.\n2. Misture o ovo e a aveia até formar uma massa.\n3. Doure em frigideira antiaderente, 2 a 3 minutos de cada lado.\n4. Sirva com canela, se quiser.',
      createdBy: admin.id,
    },
    {
      title: 'Salada de grão-de-bico',
      ingredients: [ing('Grão-de-bico', 160), ing('Tomate', 120), ing('Cenoura', 60), ing('Azeite de oliva', 10)],
      portions: 2,
      prepMinutes: 15,
      tags: ['vegana', 'sem glúten', 'sem lactose', 'congelável'],
      instructions: '1. Pique o tomate e rale a cenoura.\n2. Misture com o grão-de-bico cozido.\n3. Tempere com o azeite, limão, sal e cheiro-verde.',
      createdBy: admin.id,
    },
    {
      title: 'Omelete de legumes',
      ingredients: [ing('Ovo de galinha, inteiro, cozido', 100), ing('Tomate', 40), ing('Abobrinha italiana', 40), ing('Azeite de oliva', 4)],
      finalWeightG: 170,
      portions: 1,
      prepMinutes: 12,
      tags: ['low carb', 'sem glúten', 'sem lactose'],
      instructions: '1. Bata os ovos com uma pitada de sal.\n2. Refogue os legumes picados no azeite por 3 minutos.\n3. Junte os ovos, tampe e cozinhe em fogo baixo até firmar.',
      visibleToAll: true,
      createdBy: admin.id,
    },
  ])
  await db.insert(s.materials).values([
    {
      title: 'Guia Alimentar para a População Brasileira',
      kind: 'guia',
      description: 'Publicação do Ministério da Saúde com os princípios de uma alimentação adequada e saudável.',
      url: 'https://www.gov.br/saude/pt-br/assuntos/saude-brasil/publicacoes-para-promocao-a-saude/guia_alimentar_populacao_brasileira_2ed.pdf/view',
      audience: 'todos',
      createdBy: admin.id,
    },
    {
      title: 'Como montar o prato do dia a dia',
      kind: 'video',
      description: 'Vídeo curto (exemplo): metade do prato com verduras e legumes, um quarto de proteína e um quarto de carboidrato.',
      url: 'https://www.youtube.com/results?search_query=como+montar+um+prato+saudavel',
      audience: 'pacientes',
      patientIds: [beatriz.id],
      createdBy: admin.id,
    },
  ])
  await db.insert(s.prescriptions).values([
    { patientId: beatriz.id, type: 'suplemento', name: 'Vitamina D3', dose: '2.000 UI', schedule: 'No almoço', duration: '90 dias', createdBy: admin.id },
    { patientId: beatriz.id, type: 'exame', name: 'Hemograma, ferritina e vitamina D', notes: 'Trazer no próximo retorno.', createdBy: admin.id },
  ])

  await db.insert(s.payments).values([
    ...pastAppts
      .filter((a) => a.status === 'realizada')
      .map((a) => ({
        patientId: a.patientId,
        appointmentId: a.id,
        description: a.serviceName,
        amountCents: a.priceCents,
        status: 'pago' as const,
        method: 'pix',
        paidAt: a.startAt.toISOString().slice(0, 10),
        createdBy: admin.id,
      })),
    { patientId: lucas.id, description: 'Pacote trimestral', amountCents: 49000, discountCents: 4900, discountReason: 'Pagamento à vista', status: 'pendente', dueDate: day(7), createdBy: admin.id },
    { patientId: helena.id, description: 'Retorno', amountCents: 15000, status: 'pendente', dueDate: day(-5), createdBy: admin.id },
  ])

  /* ------------------------ interessados (leads) ----------------------- */
  await db.insert(s.leads).values([
    { name: 'Pessoa Interessada (exemplo)', phone: '11900000020', email: 'lead1@example.com', interest: 'Reeducação alimentar', message: 'Gostaria de saber valores.', consentAt: at(-1, '10:00') },
    { name: 'Corredor Exemplo', phone: '11900000021', interest: 'Acompanhamento esportivo', consentAt: at(-4, '15:00'), status: 'contatado' },
  ])

  await db.insert(s.notifications).values([
    { userId: uBeatriz.id, title: 'Novo questionário disponível', body: 'Questionário de acompanhamento', link: '/paciente/formularios', createdAt: at(-1, '09:00') },
    { userId: uBeatriz.id, title: 'Consulta confirmada', body: 'Seu retorno foi confirmado.', link: '/paciente/consultas', createdAt: at(-2, '09:00') },
  ])

  await db.insert(s.auditLogs).values({ action: 'seed', entity: 'sistema', actorLabel: 'script de demonstração', details: { note: 'Dados fictícios carregados' } })

  console.log('\nPronto! Acessos de demonstração (dados fictícios):')
  console.log(`  Nutricionista: nutri@example.com / ${PASSWORDS.admin}`)
  console.log(`  Equipe:        recepcao@example.com / ${PASSWORDS.staff}`)
  console.log(`  Paciente:      paciente@example.com / ${PASSWORDS.patient}`)
  console.log(`  Paciente 2:    lucas@example.com / ${PASSWORDS.patient}`)
  console.log(`  Paciente 3:    helena@example.com / ${PASSWORDS.patient}`)
  console.log(`  Nutricionista 2 (só os próprios pacientes): nutri2@example.com / ${PASSWORDS.staff}`)
}

await main()
if (conn.kind === 'postgres') await conn.client.end()
else await conn.client.close()
