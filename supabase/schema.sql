-- =====================================================================
--  FONSECA TEAM — banco de dados (Supabase / Postgres)
--  Rode este arquivo inteiro no SQL Editor do Supabase.
--  Pode rodar de novo: tudo usa "if not exists" / "or replace".
--
--  Regras (Row Level Security):
--   • o treinador (profiles.role = 'admin') vê e edita tudo;
--   • cada aluno só enxerga os PRÓPRIOS dados;
--   • o aluno só escreve o registro do treino (feito / carga usada)
--     e o aceite dos termos; todo o resto é do treinador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PERFIS (1 por usuário do Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'student' check (role in ('admin', 'student')),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ALUNOS
-- ---------------------------------------------------------------------
create table if not exists public.students (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid unique references auth.users (id) on delete set null,
  full_name          text not null,
  email              text not null,
  whatsapp           text,
  birth_date         date,
  goal               text,
  plan               text,
  start_date         date,
  end_date           date,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  notes              text,
  consent_at         timestamptz,   -- LGPD: consentimento registrado no cadastro
  terms_accepted_at  timestamptz,   -- LGPD: aceite do aluno no primeiro acesso
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists students_email_key on public.students (lower(email));
create index if not exists students_end_date_idx on public.students (end_date);

-- ---------------------------------------------------------------------
-- BIBLIOTECA DE EXERCÍCIOS
-- ---------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  muscle_group  text,
  equipment     text,
  video_url     text,   -- link do YouTube/Vimeo
  media_url     text,   -- GIF/vídeo enviado para o Storage (bucket "exercises")
  tips          text,
  created_at    timestamptz not null default now()
);
create index if not exists exercises_group_idx on public.exercises (muscle_group);

-- ---------------------------------------------------------------------
-- TREINOS (fichas A, B, C...) e seus exercícios
-- ---------------------------------------------------------------------
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  name        text not null,                 -- "Treino A"
  focus       text,                          -- "Peito e tríceps"
  notes       text,
  weekdays    smallint[] not null default '{}', -- 0 = domingo ... 6 = sábado
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists workouts_student_idx on public.workouts (student_id);

create table if not exists public.workout_items (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references public.workouts (id) on delete cascade,
  exercise_id   uuid references public.exercises (id) on delete set null,
  position      int not null default 0,
  sets          text,          -- "4"
  reps          text,          -- "8-12"
  load          text,          -- "20 kg"
  rest_seconds  int,           -- 90
  method        text,          -- "Drop-set", "Bi-set"...
  notes         text
);
create index if not exists workout_items_workout_idx on public.workout_items (workout_id);

-- Registro do aluno: "feito" e carga usada, por dia
create table if not exists public.workout_logs (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  item_id       uuid not null references public.workout_items (id) on delete cascade,
  performed_on  date not null default current_date,
  done          boolean not null default false,
  load_used     text,
  updated_at    timestamptz not null default now(),
  unique (item_id, performed_on)
);
create index if not exists workout_logs_student_idx on public.workout_logs (student_id, performed_on desc);

-- ---------------------------------------------------------------------
-- NUTRIÇÃO — sempre com nutricionista responsável (nome + CRN)
-- ---------------------------------------------------------------------
create table if not exists public.nutrition_plans (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students (id) on delete cascade,
  title              text not null default 'Plano alimentar',
  guidelines         text,
  nutritionist_name  text not null check (length(trim(nutritionist_name)) > 0),
  nutritionist_crn   text not null check (length(trim(nutritionist_crn)) > 0),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists nutrition_plans_student_idx on public.nutrition_plans (student_id);

create table if not exists public.meals (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references public.nutrition_plans (id) on delete cascade,
  time      time,
  name      text not null,
  -- [{ "food": "Ovo", "quantity": "3 un", "substitutions": "2 fatias de queijo" }]
  items     jsonb not null default '[]'::jsonb,
  notes     text,
  position  int not null default 0
);
create index if not exists meals_plan_idx on public.meals (plan_id);

-- ---------------------------------------------------------------------
-- AVALIAÇÕES (peso, medidas e fotos por data)
-- ---------------------------------------------------------------------
create table if not exists public.assessments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  date        date not null default current_date,
  weight      numeric(5, 2),
  body_fat    numeric(4, 1),
  chest       numeric(5, 1),
  waist       numeric(5, 1),
  hip         numeric(5, 1),
  arm         numeric(5, 1),
  thigh       numeric(5, 1),
  calf        numeric(5, 1),
  notes       text,
  photos      text[] not null default '{}',  -- caminhos no bucket privado "progress"
  created_at  timestamptz not null default now()
);
create index if not exists assessments_student_idx on public.assessments (student_id, date);

-- =====================================================================
--  FUNÇÕES AUXILIARES
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_student_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

-- O aluno registra o aceite dos termos (LGPD) sem poder editar o resto do cadastro
create or replace function public.accept_terms()
returns void
language sql volatile security definer
set search_path = public
as $$
  update public.students set terms_accepted_at = now()
  where user_id = auth.uid() and terms_accepted_at is null;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- e-mail sempre em minúsculas (o convite e o vínculo com o login usam o e-mail)
create or replace function public.normalize_email()
returns trigger language plpgsql as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;
drop trigger if exists students_email on public.students;
create trigger students_email before insert or update of email on public.students
  for each row execute function public.normalize_email();

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();
drop trigger if exists nutrition_touch on public.nutrition_plans;
create trigger nutrition_touch before update on public.nutrition_plans
  for each row execute function public.touch_updated_at();
drop trigger if exists logs_touch on public.workout_logs;
create trigger logs_touch before update on public.workout_logs
  for each row execute function public.touch_updated_at();

-- Novo usuário no Auth (convite aceito ou cadastro): cria o perfil e liga ao aluno pelo e-mail
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  update public.students
     set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ninguém muda o próprio papel: perfis só são escritos pelo trigger acima
-- e pelo SQL Editor (para promover o treinador a admin).

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.students        enable row level security;
alter table public.exercises       enable row level security;
alter table public.workouts        enable row level security;
alter table public.workout_items   enable row level security;
alter table public.workout_logs    enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meals           enable row level security;
alter table public.assessments     enable row level security;

-- PROFILES
drop policy if exists "profiles: ver o próprio" on public.profiles;
create policy "profiles: ver o próprio" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- STUDENTS
drop policy if exists "students: admin tudo" on public.students;
create policy "students: admin tudo" on public.students
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "students: aluno vê o próprio" on public.students;
create policy "students: aluno vê o próprio" on public.students
  for select to authenticated using (user_id = auth.uid());

-- EXERCISES (biblioteca: qualquer usuário logado lê; só o admin escreve)
drop policy if exists "exercises: logados leem" on public.exercises;
create policy "exercises: logados leem" on public.exercises
  for select to authenticated using (true);
drop policy if exists "exercises: admin escreve" on public.exercises;
create policy "exercises: admin escreve" on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- WORKOUTS
drop policy if exists "workouts: admin tudo" on public.workouts;
create policy "workouts: admin tudo" on public.workouts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "workouts: aluno vê os próprios" on public.workouts;
create policy "workouts: aluno vê os próprios" on public.workouts
  for select to authenticated using (student_id = public.my_student_id());

-- WORKOUT ITEMS
drop policy if exists "items: admin tudo" on public.workout_items;
create policy "items: admin tudo" on public.workout_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "items: aluno vê os próprios" on public.workout_items;
create policy "items: aluno vê os próprios" on public.workout_items
  for select to authenticated using (
    exists (select 1 from public.workouts w
            where w.id = workout_id and w.student_id = public.my_student_id())
  );

-- WORKOUT LOGS (o aluno marca "feito" e anota a carga)
drop policy if exists "logs: admin tudo" on public.workout_logs;
create policy "logs: admin tudo" on public.workout_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "logs: aluno lê os próprios" on public.workout_logs;
create policy "logs: aluno lê os próprios" on public.workout_logs
  for select to authenticated using (student_id = public.my_student_id());
drop policy if exists "logs: aluno cria os próprios" on public.workout_logs;
create policy "logs: aluno cria os próprios" on public.workout_logs
  for insert to authenticated with check (
    student_id = public.my_student_id()
    and exists (select 1 from public.workout_items i
                join public.workouts w on w.id = i.workout_id
                where i.id = item_id and w.student_id = public.my_student_id())
  );
drop policy if exists "logs: aluno edita os próprios" on public.workout_logs;
create policy "logs: aluno edita os próprios" on public.workout_logs
  for update to authenticated
  using (student_id = public.my_student_id())
  with check (student_id = public.my_student_id());

-- NUTRITION
drop policy if exists "nutrition: admin tudo" on public.nutrition_plans;
create policy "nutrition: admin tudo" on public.nutrition_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "nutrition: aluno vê o próprio" on public.nutrition_plans;
create policy "nutrition: aluno vê o próprio" on public.nutrition_plans
  for select to authenticated using (student_id = public.my_student_id());

drop policy if exists "meals: admin tudo" on public.meals;
create policy "meals: admin tudo" on public.meals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "meals: aluno vê as próprias" on public.meals;
create policy "meals: aluno vê as próprias" on public.meals
  for select to authenticated using (
    exists (select 1 from public.nutrition_plans p
            where p.id = plan_id and p.student_id = public.my_student_id())
  );

-- ASSESSMENTS
drop policy if exists "assessments: admin tudo" on public.assessments;
create policy "assessments: admin tudo" on public.assessments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "assessments: aluno vê as próprias" on public.assessments;
create policy "assessments: aluno vê as próprias" on public.assessments
  for select to authenticated using (student_id = public.my_student_id());

-- Funções chamáveis pelo app
grant execute on function public.is_admin()       to authenticated;
grant execute on function public.my_student_id()  to authenticated;
grant execute on function public.accept_terms()   to authenticated;
revoke execute on function public.accept_terms()  from anon;

-- =====================================================================
--  STORAGE
--   exercises: público (GIFs/vídeos de execução); só o admin envia.
--   progress:  PRIVADO (fotos de evolução). Pasta = id do aluno.
--              O aluno só vê a própria pasta; o admin vê tudo.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('exercises', 'exercises', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('progress', 'progress', false)
on conflict (id) do nothing;

drop policy if exists "exercises: admin envia" on storage.objects;
create policy "exercises: admin envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'exercises' and public.is_admin());
drop policy if exists "exercises: admin altera" on storage.objects;
create policy "exercises: admin altera" on storage.objects
  for update to authenticated using (bucket_id = 'exercises' and public.is_admin());
drop policy if exists "exercises: admin apaga" on storage.objects;
create policy "exercises: admin apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'exercises' and public.is_admin());

drop policy if exists "progress: admin tudo" on storage.objects;
create policy "progress: admin tudo" on storage.objects
  for all to authenticated
  using (bucket_id = 'progress' and public.is_admin())
  with check (bucket_id = 'progress' and public.is_admin());
drop policy if exists "progress: aluno vê a própria pasta" on storage.objects;
create policy "progress: aluno vê a própria pasta" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = public.my_student_id()::text);

-- =====================================================================
--  DEPOIS DE RODAR:
--  1) Em Authentication > Users, crie o usuário do treinador (e-mail + senha).
--  2) Promova esse usuário a admin (troque o e-mail):
--
--     update public.profiles set role = 'admin', full_name = 'Maicon Fonseca'
--     where id = (select id from auth.users where email = 'email-do-maicon@exemplo.com');
-- =====================================================================
