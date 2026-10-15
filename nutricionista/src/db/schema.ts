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
import type { PlanContent } from '@/lib/plan'
import type { FormField, FormAnswers } from '@/lib/forms'

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
  leadRetentionDays: integer('lead_retention_days').notNull().default(180),
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
    notes: text('notes'),
    professionalComment: text('professional_comment'),
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
