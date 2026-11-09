-- =====================================================================
-- Banco de dados do sistema (site, área do cliente e painel do coach)
-- PostgreSQL 14 ou mais novo. Arquivo gerado por scripts/gerar-banco-sql.mjs
-- a partir de src/db/schema.ts. Não edite à mão: gere de novo.
--
-- Como criar o banco do zero:
--   createdb nutri
--   psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/banco-de-dados.sql
--   psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/alimentos.sql
--   psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/criar-admin.sql
--
-- Com Docker (deploy/docker-compose.yml) nada disso é necessário: ao subir,
-- o sistema cria as mesmas tabelas sozinho (migrações) e carrega os alimentos.
--
-- Tabelas principais:
--   users, sessions, auth_tokens ......... contas (cliente, coach, equipe) e login
--   patients ............................. ficha do cliente (plano contratado, recursos do app)
--   anamneses ............................ anamnese no app (versões e rascunho)
--   appointments, services, working_hours  agenda e consultas on-line
--   meal_plans ........................... planos alimentares (rascunho, publicado, histórico)
--   meal_logs, water_logs, diary_entries . o que o cliente marca e registra no dia
--   measurements, progress_photos, goals . avaliações, fotos de evolução e metas
--   files ................................ arquivos privados (exames, fotos, documentos)
--   foods, household_measures, measure_refs  TACO 4ª ed. e medidas caseiras do IBGE
--   messages, notifications, push_subscriptions  chat e avisos
--   packages, payments ................... planos de acompanhamento e financeiro
--   consents, data_requests, audit_logs .. LGPD e trilha de auditoria
--   settings ............................. configurações (nome do site, contato, textos)
-- =====================================================================

BEGIN;

CREATE TYPE "public"."adherence" AS ENUM('total', 'parcial', 'nao_seguiu');
CREATE TYPE "public"."appointment_status" AS ENUM('pendente', 'confirmada', 'cancelada', 'realizada', 'faltou');
CREATE TYPE "public"."measurement_source" AS ENUM('profissional', 'paciente');
CREATE TYPE "public"."modality" AS ENUM('presencial', 'online');
CREATE TYPE "public"."patient_status" AS ENUM('ativo', 'pausado', 'inativo', 'alta');
CREATE TYPE "public"."payment_source" AS ENUM('manual', 'provedor');
CREATE TYPE "public"."payment_status" AS ENUM('pendente', 'pago', 'cancelado', 'estornado');
CREATE TYPE "public"."plan_status" AS ENUM('rascunho', 'publicado', 'arquivado');
CREATE TYPE "public"."role" AS ENUM('admin', 'staff', 'patient');
CREATE TYPE "public"."service_modality" AS ENUM('presencial', 'online', 'ambos');
CREATE TYPE "public"."token_type" AS ENUM('reset', 'convite', 'verificacao');
CREATE TABLE "anamneses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"modality" "modality" NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'pendente' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"is_returning" boolean DEFAULT false NOT NULL,
	"patient_notes" text,
	"internal_notes" text,
	"cancel_reason" text,
	"meeting_url" text,
	"source" text DEFAULT 'site' NOT NULL,
	"code" text NOT NULL,
	"rescheduled_from_id" uuid,
	"reminder_sent_at" timestamp with time zone,
	"reminder_2h_sent_at" timestamp with time zone,
	"patient_confirmed_at" timestamp with time zone,
	"reschedule_requested_at" timestamp with time zone,
	"reschedule_note" text,
	"rating" smallint,
	"rating_comment" text,
	"rated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_label" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"patient_id" uuid,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "token_type" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"patient_id" uuid,
	"subject_email" text,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);

CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"requester_name" text NOT NULL,
	"type" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'aberta' NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);

CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"time" text NOT NULL,
	"meal" text NOT NULL,
	"foods" text NOT NULL,
	"quantity" text,
	"photo_file_id" uuid,
	"hunger" smallint,
	"satiety" smallint,
	"adherence" "adherence",
	"meal_key" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mood" smallint,
	"notes" text,
	"professional_comment" text,
	"commented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"uploaded_by" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"visible_to_patient" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"search" text NOT NULL,
	"group" text NOT NULL,
	"source" text DEFAULT 'TACO' NOT NULL,
	"code" integer,
	"category" text,
	"nutrients" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kcal" numeric NOT NULL,
	"protein" numeric NOT NULL,
	"carbs" numeric NOT NULL,
	"fat" numeric NOT NULL,
	"fiber" numeric DEFAULT 0 NOT NULL,
	"sodium" numeric,
	"cooking_factor" numeric,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "form_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"fields" jsonb NOT NULL,
	"answers" jsonb,
	"due_date" date,
	"answered_at" timestamp with time zone,
	"source" text DEFAULT 'nativa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'questionario' NOT NULL,
	"fields" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metric" text,
	"start_value" numeric,
	"target_value" numeric,
	"unit" text,
	"due_date" date,
	"status" text DEFAULT 'ativa' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "household_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"name" text NOT NULL,
	"grams" numeric NOT NULL
);

CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"interest" text,
	"message" text,
	"status" text DEFAULT 'novo' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text,
	"file_id" uuid,
	"audience" text DEFAULT 'todos' NOT NULL,
	"patient_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"plan_id" uuid,
	"meal_key" text NOT NULL,
	"option_id" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"is_template" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"status" "plan_status" DEFAULT 'rascunho' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_id" uuid,
	"content" jsonb NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"visible_in_history" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "measure_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food" text NOT NULL,
	"preparation" text DEFAULT '' NOT NULL,
	"measure" text NOT NULL,
	"grams" numeric NOT NULL,
	"search" text NOT NULL
);

CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"source" "measurement_source" NOT NULL,
	"weight_kg" numeric,
	"height_cm" numeric,
	"body_fat_pct" numeric,
	"body_fat_method" text,
	"waist_cm" numeric,
	"hip_cm" numeric,
	"arm_cm" numeric,
	"thigh_cm" numeric,
	"chest_cm" numeric,
	"abdomen_cm" numeric,
	"calf_cm" numeric,
	"skinfolds" jsonb,
	"skinfold_protocol" text,
	"bioimpedance" jsonb,
	"lean_mass_kg" numeric,
	"extra" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"sender_id" uuid,
	"from_patient" boolean NOT NULL,
	"is_guidance" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"attachment_file_id" uuid,
	"diary_entry_id" uuid,
	"automatic" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sessions" integer DEFAULT 1 NOT NULL,
	"price_cents" integer NOT NULL,
	"validity_days" integer DEFAULT 90 NOT NULL,
	"months" integer DEFAULT 1 NOT NULL,
	"perks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlight" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"birth_date" date,
	"objective" text,
	"sex" text,
	"height_cm" numeric,
	"features" jsonb DEFAULT '{"diario":true,"peso":true,"chat":true,"calorias":true,"macros":true,"calculadoras":true,"agua":true,"fotosCorpo":true,"exames":true}'::jsonb NOT NULL,
	"energy" jsonb,
	"anamnesis_received_at" timestamp with time zone,
	"anamnesis_notes" text,
	"anamnesis_via" text,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nutritionist_id" uuid,
	"package_id" uuid,
	"package_start" date,
	"package_end" date,
	"payment_required" boolean DEFAULT false NOT NULL,
	"status" "patient_status" DEFAULT 'ativo' NOT NULL,
	"stage" text DEFAULT 'Avaliação inicial' NOT NULL,
	"follow_up_days" integer,
	"next_follow_up" date,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"package_id" uuid,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"discount_reason" text,
	"status" "payment_status" DEFAULT 'pendente' NOT NULL,
	"method" text,
	"due_date" date,
	"paid_at" date,
	"source" "payment_source" DEFAULT 'manual' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"provider_preference_id" text,
	"provider_status" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"dose" text,
	"schedule" text,
	"duration" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"angle" text NOT NULL,
	"file_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone
);

CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"photo_file_id" uuid,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_weight_g" numeric,
	"portions" integer DEFAULT 1 NOT NULL,
	"prep_minutes" integer,
	"instructions" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visible_to_all" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"modality" "service_modality" DEFAULT 'ambos' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site_name" text DEFAULT 'Farion' NOT NULL,
	"professional_name" text NOT NULL,
	"professional_title" text DEFAULT 'Coach' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"photo_file_id" uuid,
	"logo_file_id" uuid,
	"brand_color" text DEFAULT '#1f5e3b' NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"differentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"how_it_works" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"address" text,
	"hours_text" text,
	"modality_text" text,
	"whatsapp" text,
	"instagram" text,
	"contact_email" text,
	"privacy_contact" text,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"slot_step_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"min_notice_hours" integer DEFAULT 12 NOT NULL,
	"max_days_ahead" integer DEFAULT 45 NOT NULL,
	"finance_enabled" boolean DEFAULT true NOT NULL,
	"demo_banner" boolean DEFAULT true NOT NULL,
	"show_prices" boolean DEFAULT false NOT NULL,
	"show_plan_prices" boolean DEFAULT true NOT NULL,
	"plans_included" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_channel" text DEFAULT 'site' NOT NULL,
	"daily_quote" text,
	"weekly_tip" text,
	"stats_patients" integer,
	"stats_years" integer,
	"responsible_document" text,
	"lead_retention_days" integer DEFAULT 180 NOT NULL,
	"anamnese_url" text,
	"water_ml_per_kg" integer DEFAULT 35 NOT NULL,
	"signature_text" text,
	"signature_file_id" uuid,
	"default_meals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_anamnesis_template_id" uuid,
	"adherence_good" integer DEFAULT 80 NOT NULL,
	"adherence_low" integer DEFAULT 40 NOT NULL,
	"quick_replies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chat_hours" jsonb,
	"chat_auto_reply" text,
	"mp_max_installments" integer DEFAULT 12 NOT NULL,
	"mp_statement_descriptor" text DEFAULT 'FARION' NOT NULL,
	"templates" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"author_display" text NOT NULL,
	"text" text NOT NULL,
	"rating" smallint,
	"date" date NOT NULL,
	"authorized_at" timestamp with time zone,
	"authorization_method" text,
	"published" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"before_file_id" uuid,
	"after_file_id" uuid,
	"photos_authorized_at" timestamp with time zone,
	"photos_authorization_method" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "role" NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"google_sub" text,
	"onboarded_at" timestamp with time zone,
	"own_patients_only" boolean DEFAULT false NOT NULL,
	"notification_prefs" jsonb DEFAULT '{"refeicoes":true,"agua":true,"plano":true,"mensagens":true,"consultas":true,"lembretes":true,"pesagem":true,"quietStart":"22:00","quietEnd":"07:00","waterEveryH":2,"waterStart":"08:00","waterEnd":"20:00"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "water_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"ml" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "working_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekday" smallint NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL
);

ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "files" ADD CONSTRAINT "files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_template_id_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "goals" ADD CONSTRAINT "goals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "household_measures" ADD CONSTRAINT "household_measures_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "patients" ADD CONSTRAINT "patients_nutritionist_id_users_id_fk" FOREIGN KEY ("nutritionist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "patients" ADD CONSTRAINT "patients_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_before_file_id_files_id_fk" FOREIGN KEY ("before_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_after_file_id_files_id_fk" FOREIGN KEY ("after_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "anamneses_patient_version_idx" ON "anamneses" USING btree ("patient_id","version");
CREATE INDEX "appointments_start_idx" ON "appointments" USING btree ("start_at");
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");
CREATE UNIQUE INDEX "appointments_code_idx" ON "appointments" USING btree ("code");
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");
CREATE INDEX "audit_patient_idx" ON "audit_logs" USING btree ("patient_id");
CREATE INDEX "clinical_notes_patient_idx" ON "clinical_notes" USING btree ("patient_id");
CREATE INDEX "diary_patient_idx" ON "diary_entries" USING btree ("patient_id","date");
CREATE INDEX "foods_search_idx" ON "foods" USING btree ("search");
CREATE INDEX "form_assignments_patient_idx" ON "form_assignments" USING btree ("patient_id");
CREATE INDEX "measures_food_idx" ON "household_measures" USING btree ("food_id");
CREATE UNIQUE INDEX "meal_logs_unique" ON "meal_logs" USING btree ("patient_id","date","meal_key");
CREATE INDEX "meal_plans_patient_idx" ON "meal_plans" USING btree ("patient_id");
CREATE INDEX "measure_refs_search_idx" ON "measure_refs" USING btree ("search");
CREATE INDEX "measurements_patient_idx" ON "measurements" USING btree ("patient_id","date");
CREATE INDEX "messages_patient_idx" ON "messages" USING btree ("patient_id","created_at");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");
CREATE UNIQUE INDEX "patients_user_idx" ON "patients" USING btree ("user_id");
CREATE INDEX "patients_status_idx" ON "patients" USING btree ("status");
CREATE INDEX "payments_patient_idx" ON "payments" USING btree ("patient_id");
CREATE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider_ref");
CREATE INDEX "prescriptions_patient_idx" ON "prescriptions" USING btree ("patient_id");
CREATE INDEX "progress_photos_patient_idx" ON "progress_photos" USING btree ("patient_id","date");
CREATE UNIQUE INDEX "push_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");
CREATE UNIQUE INDEX "reminder_log_unique" ON "reminder_log" USING btree ("user_id","kind","key");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE UNIQUE INDEX "testimonials_appointment_idx" ON "testimonials" USING btree ("appointment_id");
CREATE INDEX "testimonials_published_idx" ON "testimonials" USING btree ("published");
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
CREATE UNIQUE INDEX "water_logs_unique" ON "water_logs" USING btree ("patient_id","date");

-- Migrações já contidas neste arquivo: o sistema só aplicará as que vierem depois.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
	id SERIAL PRIMARY KEY,
	hash text NOT NULL,
	created_at bigint
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
	('861641955a135bdd6a658235dd35791f1d54e73500b36fc3227d6ab283a6c0bb', 1792096811953), -- 0000_inicial
	('5b503cc2dc4d5ac3ac5bfe38b2c3abf6e708eb5720c435206e0f61c95c707845', 1792522331789), -- 0001_fase1_nutricao
	('5d85f716e33a854d936e9e577b22b623d8a1f66a81b3d7b911928f2c0bb0ecac', 1792526734286), -- 0002_fase2_acompanhamento
	('64c38b2abf2b994928f5bfdecd1d28b6c00eff8f819cc561ca64dc4e8c92ae9f', 1792539792465), -- 0003_fase3_gestao
	('cd30ff20f018f2ac695401116f630ab8eaa78f51869737a5caf692499d3ee8d2', 1792546188441), -- 0004_site_whatsapp
	('f64655f023d8c1778f9eef97aeec6d154a4376357ae0703801f51211f9322b7b', 1792620738126), -- 0005_planos_e_prescricao_livre
	('a059d2d77a17a9508030855283109eba14cce6ee3d6a25e7e6c41bb3d0a677c1', 1792762810808), -- 0006_site_contas_anamnese
	('71d85c80872c82ddbc098bedc5dbba3538f4ad3028159bc573146db0f4618857', 1792763318643), -- 0007_verde
	('67da0ace260b73ec41d8af5527e5a954c840b9fbc6253b8273a98fa21a01ceb3', 1792766071739), -- 0008_coach
	('75b071d528d8ab69b59c8280a633ac468f99fcba7401658919c13b455942abfa', 1793303404552), -- 0009_online
	('13559b4518251786d5839346631d30832376c85c49858fa04aa65f1c2a49eec8', 1793304109614), -- 0010_marca_verde
	('0dd439ebf8eb5813d1a78a61888eca47f5205ca6d167be42bc5286cf3654cd63', 1793307951918), -- 0011_tabela_taco
	('054f528c984f24b3ea396af61537ea35bc561a2ed7ed5318f882d1a7735f7d6f', 1793744723727), -- 0012_nome_do_site
	('1edeceb744158fdd598e644daa625774f766f3ddd90d0e8be29fefac08d223dc', 1793744908354), -- 0013_inicio_do_plano
	('efffafd63fc67c884d198cdf49f70cb4c153420112520cdbc8193a9edf43088c', 1793746594581), -- 0014_termino_definido_pelo_coach
	('ce8d6b3f756346cc2c39bf837811809d539e4c83adc2b8e33499795ce8f318ec', 1793746859502), -- 0015_anamnese_por_formulario
	('9484041a13fa7651753afcca2f161e3da20253bb28af71ac0e44ab6785c9a121', 1793916101839), -- 0016_mercado_pago
	('5490ee0bd517e4ccea7f372d3a2c9836288a2e192c0d2c2d055b724c607d54dc', 1793916106957), -- 0017_remover_desconto_parceiro
	('14bee88ebe9c56612d5a9182a2e3abb4e2cf171125eeeca996ca4b2b650110d6', 1794244118204), -- 0018_remover_registro
	('006e7b8e1cd622cce4f9f9685c59cc71d00ac4cbd64c43be92a88e37772ea1a6', 1794245146457); -- 0019_depoimentos_e_formacoes

COMMIT;
