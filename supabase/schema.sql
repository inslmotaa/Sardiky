-- =============================================================
-- FONSECA TEAM · banco de dados do site-app (Supabase / Postgres)
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este
-- arquivo inteiro e clique em "Run". Pode rodar mais de uma vez.
-- =============================================================

-- ---------- Perfis ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'aluno' check (role in ('aluno', 'profissional')),
  nome text,
  nascimento date,
  sexo text check (sexo in ('m', 'f')),
  altura numeric,
  peso numeric,
  whatsapp text,
  plano text,
  criado_em timestamptz not null default now()
);

-- Quem é profissional (usado nas regras de acesso). security definer evita recursão no RLS.
create or replace function public.is_pro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'profissional');
$$;

-- Cria o perfil automaticamente no primeiro acesso (todo mundo começa como aluno)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome) values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Aluno não pode se promover a profissional nem trocar o próprio plano
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = comando do painel do Supabase ou do servidor: liberado
  if auth.uid() is not null and not public.is_pro() then
    new.role := old.role;
    new.plano := old.plano;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------- Consentimentos (LGPD) ----------
create table if not exists public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles (id) on delete cascade,
  versao text not null,
  aceito_em timestamptz not null default now()
);

-- ---------- Anamnese ----------
create table if not exists public.anamneses (
  aluno_id uuid primary key references public.profiles (id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  concluida boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- ---------- Avaliações ----------
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles (id) on delete cascade,
  criada_em timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'rascunho', 'aprovada', 'erro')),
  medidas jsonb not null default '{}'::jsonb,
  resultado_final jsonb,           -- o que o aluno vê, depois de aprovado
  aprovada_por uuid references public.profiles (id),
  aprovada_em timestamptz,
  erro text
);
create index if not exists avaliacoes_aluno on public.avaliacoes (aluno_id, criada_em desc);

-- Aluno só mexe nas medidas; status e resultado são do profissional
create or replace function public.guard_avaliacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro() and auth.uid() is not null then
    new.status := old.status;
    new.resultado_final := old.resultado_final;
    new.aprovada_por := old.aprovada_por;
    new.aprovada_em := old.aprovada_em;
    new.erro := old.erro;
  end if;
  return new;
end $$;
drop trigger if exists guard_avaliacao on public.avaliacoes;
create trigger guard_avaliacao before update on public.avaliacoes
  for each row execute function public.guard_avaliacao();

-- Rascunho da IA: tabela separada que SÓ o profissional lê (a IA nunca fala direto com o aluno)
create table if not exists public.rascunhos_ia (
  avaliacao_id uuid primary key references public.avaliacoes (id) on delete cascade,
  resultado jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- ---------- Fotos ----------
create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes (id) on delete cascade,
  aluno_id uuid not null references public.profiles (id) on delete cascade,
  pose text not null check (pose in ('frente', 'costas', 'lado_direito', 'lado_esquerdo')),
  caminho text not null,
  criada_em timestamptz not null default now()
);
create index if not exists fotos_avaliacao on public.fotos (avaliacao_id);

-- ---------- Treinos ----------
create table if not exists public.treinos (
  aluno_id uuid primary key references public.profiles (id) on delete cascade,
  conteudo jsonb not null default '{}'::jsonb,
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- =============================================================
-- Regras de acesso (Row Level Security)
-- =============================================================
alter table public.profiles enable row level security;
alter table public.consentimentos enable row level security;
alter table public.anamneses enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.rascunhos_ia enable row level security;
alter table public.fotos enable row level security;
alter table public.treinos enable row level security;

drop policy if exists "perfil: ver" on public.profiles;
create policy "perfil: ver" on public.profiles for select using (id = auth.uid() or public.is_pro());
drop policy if exists "perfil: editar" on public.profiles;
create policy "perfil: editar" on public.profiles for update using (id = auth.uid() or public.is_pro()) with check (id = auth.uid() or public.is_pro());
drop policy if exists "perfil: apagar o próprio" on public.profiles;
create policy "perfil: apagar o próprio" on public.profiles for delete using (id = auth.uid());

drop policy if exists "consentimento: ver" on public.consentimentos;
create policy "consentimento: ver" on public.consentimentos for select using (aluno_id = auth.uid() or public.is_pro());
drop policy if exists "consentimento: aceitar" on public.consentimentos;
create policy "consentimento: aceitar" on public.consentimentos for insert with check (aluno_id = auth.uid());

drop policy if exists "anamnese: ver" on public.anamneses;
create policy "anamnese: ver" on public.anamneses for select using (aluno_id = auth.uid() or public.is_pro());
drop policy if exists "anamnese: criar" on public.anamneses;
create policy "anamnese: criar" on public.anamneses for insert with check (aluno_id = auth.uid());
drop policy if exists "anamnese: editar" on public.anamneses;
create policy "anamnese: editar" on public.anamneses for update using (aluno_id = auth.uid() or public.is_pro()) with check (aluno_id = auth.uid() or public.is_pro());

drop policy if exists "avaliação: ver" on public.avaliacoes;
create policy "avaliação: ver" on public.avaliacoes for select using (aluno_id = auth.uid() or public.is_pro());
drop policy if exists "avaliação: criar" on public.avaliacoes;
create policy "avaliação: criar" on public.avaliacoes for insert with check (aluno_id = auth.uid() and status = 'pendente' and resultado_final is null);
drop policy if exists "avaliação: editar" on public.avaliacoes;
create policy "avaliação: editar" on public.avaliacoes for update using (aluno_id = auth.uid() or public.is_pro()) with check (aluno_id = auth.uid() or public.is_pro());

drop policy if exists "rascunho: só profissional" on public.rascunhos_ia;
create policy "rascunho: só profissional" on public.rascunhos_ia for all using (public.is_pro()) with check (public.is_pro());

drop policy if exists "foto: ver" on public.fotos;
create policy "foto: ver" on public.fotos for select using (aluno_id = auth.uid() or public.is_pro());
drop policy if exists "foto: enviar" on public.fotos;
create policy "foto: enviar" on public.fotos for insert with check (aluno_id = auth.uid());
drop policy if exists "foto: apagar" on public.fotos;
create policy "foto: apagar" on public.fotos for delete using (aluno_id = auth.uid() or public.is_pro());

drop policy if exists "treino: aluno vê o liberado" on public.treinos;
create policy "treino: aluno vê o liberado" on public.treinos for select using ((aluno_id = auth.uid() and liberado) or public.is_pro());
drop policy if exists "treino: profissional edita" on public.treinos;
create policy "treino: profissional edita" on public.treinos for all using (public.is_pro()) with check (public.is_pro());

-- =============================================================
-- Fotos: bucket PRIVADO. Cada aluno só acessa a própria pasta (<id do aluno>/...).
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avaliacoes', 'avaliacoes', false, 8388608, array['image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists "fotos: aluno envia na própria pasta" on storage.objects;
create policy "fotos: aluno envia na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avaliacoes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: aluno substitui na própria pasta" on storage.objects;
create policy "fotos: aluno substitui na própria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'avaliacoes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'avaliacoes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_pro()));
drop policy if exists "fotos: apagar" on storage.objects;
create policy "fotos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'avaliacoes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_pro()));

-- =============================================================
-- DEPOIS DO PRIMEIRO ACESSO DO MAICON: torne a conta dele profissional.
-- Troque o e-mail abaixo e rode só esta linha.
-- update public.profiles set role = 'profissional' where id = (select id from auth.users where email = 'email-do-maicon@exemplo.com');
-- =============================================================
