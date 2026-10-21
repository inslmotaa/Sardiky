import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  numeric,
  smallint,
  index,
  uniqueIndex,
  serial,
} from 'drizzle-orm/pg-core'
import type { DiaryItem, PlanContent } from '@/lib/plan'
import type { FormField, FormAnswers } from '@/lib/forms'
import type { Skinfolds } from '@/lib/nutricao'

export type AppFeatures = { diario: boolean; peso: boolean; chat: boolean; calorias: boolean; macros: boolean; calculadoras: boolean; agua: boolean }
export const DEFAULT_FEATURES: AppFeatures = { diario: true, peso: true, chat: true, calorias: true, macros: true, calculadoras: true, agua: true }
/** Preferências de notificação do paciente (cada tipo liga/desliga) e horário de silêncio. */
export type NotificationPrefs = {
  refeicoes: boolean
  agua: boolean
  plano: boolean
  mensagens: boolean
  consultas: boolean
  lembretes: boolean
  pesagem: boolean
  /** Horário de silêncio (HH:MM); nada é enviado entre início e fim. */
  quietStart: string
  quietEnd: string
  /** Lembrete de água a cada N horas dentro da janela. */
  waterEveryH: number
  waterStart: string
  waterEnd: string
}
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  refeicoes: true,
  agua: true,
  plano: true,
  mensagens: true,
  consultas: true,
  lembretes: true,
  pesagem: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  waterEveryH: 2,
  waterStart: '08:00',
  waterEnd: '20:00',
}
export type { Skinfolds }
export type Bioimpedance = { fatPct?: number; muscleKg?: number; waterPct?: number; visceral?: number; bmrKcal?: number }
export type ChatHours = { start: string; end: string; weekdays: number[] }

export type EnergyCalc = { formula: string; factor: number; bmr: number; tdee: number; targetKcal: number; adjust: number; adjustUnit: 'kcal' | 'pct'; date: string }

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum('role', ['admin', 'staff', 'patient'])
export const modalityEnum = pgEnum('modality', ['presencial', 'online'])
export const serviceModalityEnum = pgEnum('service_modality', ['presencial', 'online', 'ambos'])
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pendente',
  'confirmada',
  'cancelada',
  'realizada',
  'faltou',
])
export const patientStatusEnum = pgEnum('patient_status', ['ativo', 'pausado', 'inativo', 'alta'])
export const planStatusEnum = pgEnum('plan_status', ['rascunho', 'publicado', 'arquivado'])
export const measurementSourceEnum = pgEnum('measurement_source', ['profissional', 'paciente'])
export const adherenceEnum = pgEnum('adherence', ['total', 'parcial', 'nao_seguiu'])
export const paymentStatusEnum = pgEnum('payment_status', ['pendente', 'pago', 'cancelado', 'estornado'])
export const paymentSourceEnum = pgEnum('payment_source', ['manual', 'provedor'])
export const tokenTypeEnum = pgEnum('token_type', ['reset', 'convite'])

/* ------------------------------------------------------------------ */
/* Usuários, sessões e autenticação                                    */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    role: roleEnum('role').notNull(),
    name: text('name').notNull(),
    /** Permissões extras de membros da equipe (role = staff). */
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    failedLogins: integer('failed_logins').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Primeiro acesso concluído (boas-vindas, notificações e anamnese). */
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    /** Nutricionista da equipe que vê apenas os pacientes sob sua responsabilidade. */
    ownPatientsOnly: boolean('own_patients_only').notNull().default(false),
    notificationPrefs: jsonb('notification_prefs').$type<NotificationPrefs>().notNull().default(DEFAULT_NOTIFICATION_PREFS),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
)

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 do token; o token em si só existe no cookie do navegador. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const authTokens = pgTable('auth_tokens', {
  /** SHA-256 do token enviado no link. */
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: tokenTypeEnum('type').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
})

/* ------------------------------------------------------------------ */
/* Configurações do profissional (registro único, id = 1)              */
/* ------------------------------------------------------------------ */

export type MessageTemplates = { confirmacao: string; lembrete: string; cancelamento: string }

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  professionalName: text('professional_name').notNull(),
  professionalTitle: text('professional_title').notNull().default('Nutricionista'),
  registry: text('registry'),
  bio: text('bio').notNull().default(''),
  photoFileId: uuid('photo_file_id'),
  logoFileId: uuid('logo_file_id'),
  brandColor: text('brand_color').notNull().default('#2f5d50'),
  specialties: jsonb('specialties').$type<string[]>().notNull().default([]),
  method: text('method').notNull().default(''),
  differentials: jsonb('differentials').$type<string[]>().notNull().default([]),
  howItWorks: jsonb('how_it_works').$type<{ title: string; text: string }[]>().notNull().default([]),
  address: text('address'),
  hoursText: text('hours_text'),
  modalityText: text('modality_text'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  contactEmail: text('contact_email'),
  privacyContact: text('privacy_contact'),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  slotStepMinutes: integer('slot_step_minutes').notNull().default(30),
  bufferMinutes: integer('buffer_minutes').notNull().default(0),
  minNoticeHours: integer('min_notice_hours').notNull().default(12),
  maxDaysAhead: integer('max_days_ahead').notNull().default(45),
  financeEnabled: boolean('finance_enabled').notNull().default(true),
  /** Faixa "dados fictícios" no topo do site, enquanto o sistema estiver em demonstração. */
  demoBanner: boolean('demo_banner').notNull().default(true),
  /** Valores dos serviços e planos visíveis no site público. */
  showPrices: boolean('show_prices').notNull().default(false),
  /** Para onde o "Agendar consulta" do site leva: WhatsApp do consultório ou agenda on-line do próprio site. */
  bookingChannel: text('booking_channel').$type<'whatsapp' | 'site'>().notNull().default('whatsapp'),
  leadRetentionDays: integer('lead_retention_days').notNull().default(180),
  /** Formulário de anamnese externo (Google Forms, Typeform…). */
  anamneseUrl: text('anamnese_url'),
  /** Meta padrão de água: ml por kg de peso corporal. */
  waterMlPerKg: integer('water_ml_per_kg').notNull().default(35),
  /** Assinatura que vai no rodapé do PDF do plano (texto e imagem opcional). */
  signatureText: text('signature_text'),
  signatureFileId: uuid('signature_file_id'),
  /** Refeições e horários que um plano em branco já traz. */
  defaultMeals: jsonb('default_meals').$type<{ name: string; time: string }[]>().notNull().default([]),
  /** Modelo de anamnese nativa enviado automaticamente a cada novo paciente. */
  autoAnamnesisTemplateId: uuid('auto_anamnesis_template_id'),
  /** Limites do painel de Acompanhamento (% de refeições feitas nos últimos 7 dias). */
  adherenceGood: integer('adherence_good').notNull().default(80),
  adherenceLow: integer('adherence_low').notNull().default(40),
  /** Respostas rápidas do chat. */
  quickReplies: jsonb('quick_replies').$type<string[]>().notNull().default([]),
  /** Horário de atendimento do chat; fora dele o paciente recebe a resposta automática. */
  chatHours: jsonb('chat_hours').$type<ChatHours | null>(),
  chatAutoReply: text('chat_auto_reply'),
  templates: jsonb('templates').$type<MessageTemplates>().notNull(),
  updatedAt: updatedAt(),
})

export const services = pgTable('services', {
  id: id(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  modality: serviceModalityEnum('modality').notNull().default('ambos'),
  durationMinutes: integer('duration_minutes').notNull(),
  priceCents: integer('price_cents').notNull().default(0),
  isPublic: boolean('is_public').notNull().default(true),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
  createdAt: createdAt(),
})

export const workingHours = pgTable('working_hours', {
  id: serial('id').primaryKey(),
  /** 0 = domingo … 6 = sábado */
  weekday: smallint('weekday').notNull(),
  start: text('start').notNull(), // HH:MM
  end: text('end').notNull(), // HH:MM
})

export const timeBlocks = pgTable('time_blocks', {
  id: id(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  reason: text('reason').notNull().default(''),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

export const testimonials = pgTable('testimonials', {
  id: id(),
  authorDisplay: text('author_display').notNull(),
  text: text('text').notNull(),
  /** Data em que a autorização de publicação foi obtida. Sem ela, nunca é publicado. */
  authorizedAt: date('authorized_at'),
  published: boolean('published').notNull().default(false),
  sort: integer('sort').notNull().default(0),
  createdAt: createdAt(),
})

export const faqs = pgTable('faqs', {
  id: id(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  published: boolean('published').notNull().default(true),
  sort: integer('sort').notNull().default(0),
})

export const packages = pgTable('packages', {
  id: id(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sessions: integer('sessions').notNull().default(1),
  priceCents: integer('price_cents').notNull(),
  validityDays: integer('validity_days').notNull().default(90),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
})

/* ------------------------------------------------------------------ */
/* Pacientes                                                           */
/* ------------------------------------------------------------------ */

export const patients = pgTable(
  'patients',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    birthDate: date('birth_date'),
    objective: text('objective'),
    sex: text('sex'), // 'F' | 'M'
    heightCm: numeric('height_cm', { mode: 'number' }),
    /** Recursos do app liberados para o paciente (liga/desliga pelo nutricionista). */
    features: jsonb('features').$type<AppFeatures>().notNull().default(DEFAULT_FEATURES),
    /** Último cálculo de gasto energético salvo na ficha. */
    energy: jsonb('energy').$type<EnergyCalc | null>(),
    anamnesisReceivedAt: timestamp('anamnesis_received_at', { withTimezone: true }),
    anamnesisNotes: text('anamnesis_notes'),
    /** Restrições alimentares (lactose, glúten, vegetariano…): geram alerta no editor de planos. */
    restrictions: jsonb('restrictions').$type<string[]>().notNull().default([]),
    /** Nutricionista responsável (equipe com vários nutricionistas). */
    nutritionistId: uuid('nutritionist_id').references(() => users.id, { onDelete: 'set null' }),
    status: patientStatusEnum('status').notNull().default('ativo'),
    stage: text('stage').notNull().default('Avaliação inicial'),
    followUpDays: integer('follow_up_days'),
    nextFollowUp: date('next_follow_up'),
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('patients_user_idx').on(t.userId), index('patients_status_idx').on(t.status)],
)

export const appointments = pgTable(
  'appointments',
  {
    id: id(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    serviceName: text('service_name').notNull(),
    modality: modalityEnum('modality').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: appointmentStatusEnum('status').notNull().default('pendente'),
    priceCents: integer('price_cents').notNull().default(0),
    contactName: text('contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull(),
    isReturning: boolean('is_returning').notNull().default(false),
    patientNotes: text('patient_notes'),
    internalNotes: text('internal_notes'),
    cancelReason: text('cancel_reason'),
    meetingUrl: text('meeting_url'),
    source: text('source').notNull().default('site'),
    code: text('code').notNull(),
    rescheduledFromId: uuid('rescheduled_from_id'),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    reminder2hSentAt: timestamp('reminder_2h_sent_at', { withTimezone: true }),
    /** O paciente confirmou presença pelo app. */
    patientConfirmedAt: timestamp('patient_confirmed_at', { withTimezone: true }),
    rescheduleRequestedAt: timestamp('reschedule_requested_at', { withTimezone: true }),
    rescheduleNote: text('reschedule_note'),
    /** Avaliação da consulta pelo paciente (1 a 5 estrelas). */
    rating: smallint('rating'),
    ratingComment: text('rating_comment'),
    ratedAt: timestamp('rated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('appointments_start_idx').on(t.startAt),
    index('appointments_patient_idx').on(t.patientId),
    uniqueIndex('appointments_code_idx').on(t.code),
  ],
)

export const leads = pgTable('leads', {
  id: id(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  interest: text('interest'),
  message: text('message'),
  status: text('status').notNull().default('novo'),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
})

export const goals = pgTable('goals', {
  id: id(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  metric: text('metric'), // ex.: weightKg, waistCm
  startValue: numeric('start_value', { mode: 'number' }),
  targetValue: numeric('target_value', { mode: 'number' }),
  unit: text('unit'),
  dueDate: date('due_date'),
  status: text('status').notNull().default('ativa'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export type ExtraIndicator = { label: string; value: number; unit: string }

export const measurements = pgTable(
  'measurements',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    source: measurementSourceEnum('source').notNull(),
    weightKg: numeric('weight_kg', { mode: 'number' }),
    heightCm: numeric('height_cm', { mode: 'number' }),
    bodyFatPct: numeric('body_fat_pct', { mode: 'number' }),
    bodyFatMethod: text('body_fat_method'),
    waistCm: numeric('waist_cm', { mode: 'number' }),
    hipCm: numeric('hip_cm', { mode: 'number' }),
    armCm: numeric('arm_cm', { mode: 'number' }),
    thighCm: numeric('thigh_cm', { mode: 'number' }),
    chestCm: numeric('chest_cm', { mode: 'number' }),
    abdomenCm: numeric('abdomen_cm', { mode: 'number' }),
    calfCm: numeric('calf_cm', { mode: 'number' }),
    /** Dobras cutâneas em mm e protocolo usado (jp3, jp7, durnin). */
    skinfolds: jsonb('skinfolds').$type<Skinfolds>(),
    skinfoldProtocol: text('skinfold_protocol'),
    bioimpedance: jsonb('bioimpedance').$type<Bioimpedance>(),
    leanMassKg: numeric('lean_mass_kg', { mode: 'number' }),
    extra: jsonb('extra').$type<ExtraIndicator[]>().notNull().default([]),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('measurements_patient_idx').on(t.patientId, t.date)],
)

export const mealPlans = pgTable(
  'meal_plans',
  {
    id: id(),
    /** Nulo para modelos de plano. */
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    isTemplate: boolean('is_template').notNull().default(false),
    title: text('title').notNull(),
    status: planStatusEnum('status').notNull().default('rascunho'),
    version: integer('version').notNull().default(1),
    parentId: uuid('parent_id'),
    content: jsonb('content').$type<PlanContent>().notNull(),
    validFrom: date('valid_from'),
    validUntil: date('valid_until'),
    /** Versões arquivadas só aparecem ao paciente quando o profissional libera. */
    visibleInHistory: boolean('visible_in_history').notNull().default(true),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('meal_plans_patient_idx').on(t.patientId)],
)

export const diaryEntries = pgTable(
  'diary_entries',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    time: text('time').notNull(),
    meal: text('meal').notNull(),
    foods: text('foods').notNull(),
    quantity: text('quantity'),
    photoFileId: uuid('photo_file_id'),
    hunger: smallint('hunger'),
    satiety: smallint('satiety'),
    adherence: adherenceEnum('adherence'),
    /** Refeição do plano a que o registro se refere (diaId:refeicaoId). */
    mealKey: text('meal_key'),
    /** Alimentos da base com quantidade, quando o paciente comeu outra coisa. */
    items: jsonb('items').$type<DiaryItem[]>().notNull().default([]),
    mood: smallint('mood'),
    notes: text('notes'),
    professionalComment: text('professional_comment'),
    commentedAt: timestamp('commented_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('diary_patient_idx').on(t.patientId, t.date)],
)

export const messages = pgTable(
  'messages',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    fromPatient: boolean('from_patient').notNull(),
    /** Orientação destacada no painel do paciente. */
    isGuidance: boolean('is_guidance').notNull().default(false),
    body: text('body').notNull(),
    attachmentFileId: uuid('attachment_file_id'),
    /** Resposta a um registro do diário (foto do prato). */
    diaryEntryId: uuid('diary_entry_id'),
    /** Resposta automática fora do horário de atendimento. */
    automatic: boolean('automatic').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('messages_patient_idx').on(t.patientId, t.createdAt)],
)

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
)

export const formTemplates = pgTable('form_templates', {
  id: id(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  kind: text('kind').notNull().default('questionario'),
  fields: jsonb('fields').$type<FormField[]>().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const formAssignments = pgTable(
  'form_assignments',
  {
    id: id(),
    templateId: uuid('template_id').references(() => formTemplates.id, { onDelete: 'set null' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').notNull(),
    /** Cópia dos campos no momento do envio: alterar o modelo não muda respostas antigas. */
    fields: jsonb('fields').$type<FormField[]>().notNull(),
    answers: jsonb('answers').$type<FormAnswers>(),
    dueDate: date('due_date'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    /** nativa (preenchida no app) ou externa (recebida pelo webhook do Google Forms/Tally). */
    source: text('source').notNull().default('nativa'),
    createdAt: createdAt(),
  },
  (t) => [index('form_assignments_patient_idx').on(t.patientId)],
)

export const clinicalNotes = pgTable(
  'clinical_notes',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('clinical_notes_patient_idx').on(t.patientId)],
)

export const files = pgTable('files', {
  id: id(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(), // documento | foto_refeicao | publico
  title: text('title').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  storageKey: text('storage_key').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  visibleToPatient: boolean('visible_to_patient').notNull().default(false),
  createdAt: createdAt(),
})

export const payments = pgTable(
  'payments',
  {
    id: id(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
    packageId: uuid('package_id').references(() => packages.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    discountReason: text('discount_reason'),
    status: paymentStatusEnum('status').notNull().default('pendente'),
    method: text('method'),
    dueDate: date('due_date'),
    paidAt: date('paid_at'),
    /** manual = registro interno; provedor = confirmado por um gateway integrado. */
    source: paymentSourceEnum('source').notNull().default('manual'),
    provider: text('provider'),
    providerRef: text('provider_ref'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('payments_patient_idx').on(t.patientId)],
)

/* ------------------------------------------------------------------ */
/* Base de alimentos e acompanhamento diário                           */
/* ------------------------------------------------------------------ */

export const foods = pgTable(
  'foods',
  {
    id: id(),
    name: text('name').notNull(),
    /** Nome sem acentos e em minúsculas, para busca. */
    search: text('search').notNull(),
    group: text('group').notNull(),
    source: text('source').notNull().default('TACO'), // TACO | TBCA | proprio
    kcal: numeric('kcal', { mode: 'number' }).notNull(),
    protein: numeric('protein', { mode: 'number' }).notNull(),
    carbs: numeric('carbs', { mode: 'number' }).notNull(),
    fat: numeric('fat', { mode: 'number' }).notNull(),
    fiber: numeric('fiber', { mode: 'number' }).notNull().default(0),
    sodium: numeric('sodium', { mode: 'number' }),
    /** Peso cozido ÷ peso cru (ex.: arroz ≈ 2,5). */
    cookingFactor: numeric('cooking_factor', { mode: 'number' }),
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('foods_search_idx').on(t.search)],
)

export const householdMeasures = pgTable(
  'household_measures',
  {
    id: id(),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    grams: numeric('grams', { mode: 'number' }).notNull(),
  },
  (t) => [index('measures_food_idx').on(t.foodId)],
)

/** Refeição do plano marcada pelo paciente no dia (feita, parcial ou pulada). */
export const mealLogs = pgTable(
  'meal_logs',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    planId: uuid('plan_id').references(() => mealPlans.id, { onDelete: 'set null' }),
    mealKey: text('meal_key').notNull(), // diaId:refeicaoId
    optionId: text('option_id'),
    status: text('status').notNull(), // feita | parcial | pulada
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('meal_logs_unique').on(t.patientId, t.date, t.mealKey)],
)

export const waterLogs = pgTable(
  'water_logs',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    ml: integer('ml').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('water_logs_unique').on(t.patientId, t.date)],
)

/** Fotos de evolução (frente, lado, costas): privadas, só paciente e nutricionista. */
export const progressPhotos = pgTable(
  'progress_photos',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    angle: text('angle').notNull(), // frente | lado | costas
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('progress_photos_patient_idx').on(t.patientId, t.date)],
)

/* ------------------------------------------------------------------ */
/* Receitas, materiais e prescrições                                   */
/* ------------------------------------------------------------------ */

export type RecipeIngredient = { foodId: string | null; name: string; grams: number; per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } | null }

export const recipes = pgTable('recipes', {
  id: id(),
  title: text('title').notNull(),
  photoFileId: uuid('photo_file_id'),
  ingredients: jsonb('ingredients').$type<RecipeIngredient[]>().notNull().default([]),
  /** Peso final pronto (g) e número de porções: nutrientes por porção e por 100 g. */
  finalWeightG: numeric('final_weight_g', { mode: 'number' }),
  portions: integer('portions').notNull().default(1),
  prepMinutes: integer('prep_minutes'),
  instructions: text('instructions').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  /** Aparece na biblioteca de receitas de todos os pacientes (além das vinculadas ao plano). */
  visibleToAll: boolean('visible_to_all').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const materials = pgTable('materials', {
  id: id(),
  title: text('title').notNull(),
  kind: text('kind').notNull(), // ebook | video | guia | link
  description: text('description').notNull().default(''),
  url: text('url'),
  fileId: uuid('file_id'),
  /** todos | pacientes (lista em patientIds) */
  audience: text('audience').notNull().default('todos'),
  patientIds: jsonb('patient_ids').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

export const prescriptions = pgTable(
  'prescriptions',
  {
    id: id(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // suplemento | fitoterapico | exame
    name: text('name').notNull(),
    dose: text('dose'),
    schedule: text('schedule'),
    duration: text('duration'),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('prescriptions_patient_idx').on(t.patientId)],
)

/* ------------------------------------------------------------------ */
/* Notificações push                                                    */
/* ------------------------------------------------------------------ */

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('push_endpoint_idx').on(t.endpoint), index('push_user_idx').on(t.userId)],
)

/** Lembretes já enviados (evita repetir o mesmo lembrete quando a tarefa agendada roda de novo). */
export const reminderLog = pgTable(
  'reminder_log',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('reminder_log_unique').on(t.userId, t.kind, t.key)],
)

/* ------------------------------------------------------------------ */
/* LGPD: consentimentos, solicitações e trilha de auditoria            */
/* ------------------------------------------------------------------ */

export const consents = pgTable('consents', {
  id: id(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
  subjectEmail: text('subject_email'),
  kind: text('kind').notNull(),
  version: text('version').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const dataRequests = pgTable('data_requests', {
  id: id(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  requesterName: text('requester_name').notNull(),
  type: text('type').notNull(), // acesso | correcao | exclusao | portabilidade | revogacao
  details: text('details'),
  status: text('status').notNull().default('aberta'),
  response: text('response'),
  createdAt: createdAt(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorLabel: text('actor_label'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    patientId: uuid('patient_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt), index('audit_patient_idx').on(t.patientId)],
)
